#!/usr/bin/env bash
# Continuous-improvement cron for the autonomous daily-lesson builder.
#
# Scheduled WEEKLY at 12:00 Europe/Madrid on Sundays via the user crontab,
# wrapped in the SAME flock as the builder so the two never overlap:
#   0 12 * * 0 /usr/bin/flock -n /tmp/<repo>-daily-lesson.lock \
#       .../scripts/improve-daily-lesson.sh >> .../.daily-lesson-logs/improve-cron.log 2>&1
# (`scripts/install-cron.sh` writes the exact line for you, deriving the lock
#  name and absolute paths from this repo — you never edit a path by hand.)
# Sunday-noon sits far from the builder's 06:00 / 18:00 slots; sharing the lock
# means that even if a builder run overruns, `flock -n` simply skips this tick.
# Do not move the schedule here -- it lives in crontab.
#
# WHAT THIS JOB IS FOR (and what it is NOT):
#   It reviews the most recent autonomous daily-lesson RUNS (their logs/metrics)
#   and makes small, evidence-based improvements to the *execution system* so
#   future runs are faster and more reliable: the wrapper scripts, the session
#   prompts, the validation strategy, reliability/observability. It NEVER builds
#   lessons or product features, and never touches generated content or OG cards.
#
# SAFETY MODEL (mirrors daily-lesson.sh, intentionally):
#   * The Claude session ONLY edits files under scripts/ and docs/, then exits.
#     It never validates, builds, regenerates OG, git-adds, commits, or pushes --
#     the wrapper alone owns all of that.
#   * Every Claude/validation command runs under setsid + timeout in its OWN
#     process group with a hard wall-clock deadline; on exit/timeout the whole
#     group is killed so nothing Claude spawned can outlive it. Only groups this
#     wrapper created are ever signalled.
#   * The job starts from a CLEAN tree (asserted). Because the start state is
#     known-clean, any abort can safely restore the tree to that clean state, so
#     a failed improvement run never strands work for the next builder run.
#   * Changes are constrained to an allowlist (scripts/, docs/). Anything outside
#     it aborts the run WITHOUT committing -- unrelated changes are never landed.
#   * Validation is proportional to what changed (bash -n / shellcheck for shell;
#     `bun run check` only when TypeScript/Astro/MDX changed). We never run the
#     full content/OG rebuild here because this job never touches content.
#   * Making NO change is a valid, successful outcome when the evidence does not
#     justify one. A clean tree after the session => success, nothing to land.
set -euo pipefail

export TZ="Europe/Madrid"
export HOME="${HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}"
export LANG="en_US.UTF-8"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

# Derived from this script's own location so it works wherever you cloned the
# template. Override with REPO=... if you symlink the script elsewhere.
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$REPO/.daily-lesson-logs"
mkdir -p "$LOG_DIR"
TS="$(date +%Y-%m-%dT%H%M%S)"
LOG="$LOG_DIR/improve-$TS.log"
EVIDENCE="$LOG_DIR/improve-evidence-$TS.md"

cd "$REPO"

# ---------------------------------------------------------------------------
# Modes / tunables (env- and flag-overridable). All deadlines are hard seconds.
# ---------------------------------------------------------------------------
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|--analyze-only|-n) DRY_RUN=1 ;;
    --help|-h)
      cat <<'USAGE'
improve-daily-lesson.sh -- weekly continuous-improvement cron for the daily-lesson builder.

Usage:
  scripts/improve-daily-lesson.sh            Full run: analyse recent runs, apply one
                                             small evidence-based improvement to the
                                             execution system, validate, commit, push.
  scripts/improve-daily-lesson.sh --dry-run  Smoke test: gather the evidence digest and
                                             print the plan/prompt. Invokes NO Claude
                                             session, makes NO repo changes, no commit.
                                             (aliases: --analyze-only, -n)

Run manually under the shared lock so it cannot overlap a builder run (the lock
name is derived from this repo by scripts/install-cron.sh — `<repo>` below):
  /usr/bin/flock -n /tmp/<repo>-daily-lesson.lock scripts/improve-daily-lesson.sh
USAGE
      exit 0 ;;
    *) ;;
  esac
done

CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-2400}"          # analyse+implement session (40m)
REPAIR_TIMEOUT="${REPAIR_TIMEOUT:-1200}"          # focused repair session (20m)
CHECK_TIMEOUT="${CHECK_TIMEOUT:-900}"             # one `bun run check` (15m)
KILL_GRACE="${KILL_GRACE:-30}"                    # TERM->KILL grace for `timeout -k`
MAX_REPAIR_ATTEMPTS="${MAX_REPAIR_ATTEMPTS:-2}"   # bounded repair loop (validation is cheap)
EVIDENCE_RUNS="${EVIDENCE_RUNS:-12}"              # how many recent run logs to digest

# Files the improvement job is allowed to change. Anything outside this set
# aborts the run without committing. Kept tight to the execution-system surface.
ALLOW_RE='^(scripts/|docs/)'

# Our own process group -- a guard so cleanup can NEVER signal it.
WRAPPER_PGID="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ' || true)"
WRAPPER_PGIDS=()

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" | tee -a "$LOG" >&2; }

fail() {
  log "ERROR: $*"
  log "improvement session FAILED -- see $LOG"
  exit 1
}

# Kill a process group we created (and only one we created).
kill_group() {
  local pgid="$1"
  [ -n "$pgid" ] || return 0
  case "$pgid" in *[!0-9]*) return 0;; esac
  [ "$pgid" -gt 1 ] || return 0
  if [ -n "$WRAPPER_PGID" ] && [ "$pgid" = "$WRAPPER_PGID" ]; then
    return 0
  fi
  if kill -0 "-$pgid" 2>/dev/null; then
    log "cleaning process group $pgid (TERM)"
    kill -TERM "-$pgid" 2>/dev/null || true
    sleep 2
    if kill -0 "-$pgid" 2>/dev/null; then
      log "process group $pgid survived TERM; sending KILL"
      kill -KILL "-$pgid" 2>/dev/null || true
    fi
  fi
}

cleanup_groups() {
  local pgid
  for pgid in "${WRAPPER_PGIDS[@]:-}"; do
    [ -n "$pgid" ] || continue
    kill_group "$pgid"
  done
}
trap 'rc=$?; cleanup_groups; exit "$rc"' EXIT
trap 'log "received SIGINT -- aborting and cleaning child groups"; exit 130' INT
trap 'log "received SIGTERM -- aborting and cleaning child groups"; exit 143' TERM

# Run a command in its OWN session/process group under a hard wall-clock
# timeout, streaming output to the log. On return (normal/error/timeout) the
# whole group is killed. Returns the command's exit status (124 = timed out).
run_in_group() {
  local timeout_secs="$1"; shift
  local label="$1"; shift
  log "[$label] launching with hard deadline ${timeout_secs}s (group-isolated)"
  setsid --wait timeout -k "$KILL_GRACE" "$timeout_secs" "$@" >>"$LOG" 2>&1 &
  local pid=$!
  local pgid
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  [ -n "$pgid" ] || pgid="$pid"
  if [ -n "$WRAPPER_PGID" ] && [ "$pgid" = "$WRAPPER_PGID" ]; then
    log "[$label] WARNING: could not isolate a process group (pgid=$pgid == wrapper); not group-tracking"
    pgid=""
  else
    WRAPPER_PGIDS+=("$pgid")
  fi
  log "[$label] running pid=$pid pgid=${pgid:-n/a}"
  local rc=0
  wait "$pid" || rc=$?
  kill_group "$pgid"
  if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
    log "[$label] TIMED OUT after ${timeout_secs}s (exit $rc); process group cleaned"
  else
    log "[$label] exited with code $rc"
  fi
  return "$rc"
}

tree_dirty() { [ -n "$(git status --porcelain)" ]; }
dump_status() { git status --porcelain | tee -a "$LOG" >&2 || true; }

# Restore the working tree to the known-clean start state. ONLY ever called when
# we asserted a clean start, so this can only discard work THIS run created.
restore_clean_tree() {
  log "restoring working tree to clean start state (discarding this run's changes)"
  git reset -q --hard HEAD >>"$LOG" 2>&1 || true
  git clean -fdq -- scripts docs >>"$LOG" 2>&1 || true
}

# ---------------------------------------------------------------------------
# Evidence digest. Summarise the most recent BUILDER runs (not improve-*.log)
# into a compact markdown table the Claude session can read instead of scanning
# hundreds of KB of raw logs. Also leaves the raw logs available for deep reads.
# ---------------------------------------------------------------------------
# NOTE: the body runs in a subshell with errexit OFF. This is pure, read-only
# observability -- a grep that matches nothing (exit 1) or a `head`-closed pipe
# (SIGPIPE) must NEVER abort the improvement run. `grep -c` already prints the
# count and we only swallow its exit code, so `|| true` (not `|| echo 0`, which
# would double-print) keeps the value correct.
build_evidence_digest() ( set +e -u +o pipefail
  log "building evidence digest from the last $EVIDENCE_RUNS builder run logs -> $EVIDENCE"
  {
    echo "# Daily-lesson run evidence (generated $TS)"
    echo
    echo "Source: \`.daily-lesson-logs/*.log\` (builder runs only; improve-*.log excluded)."
    echo "One row per run, newest last. Read the raw log named in the last column for detail."
    echo
    echo "| Run log | Mode | Repair attempts | Timeouts | Validation fails | Outcome | Wall-clock |"
    echo "|---|---|---|---|---|---|---|"
  } >"$EVIDENCE"

  # Builder logs are named like 2026-06-15T180001.log. Exclude improve-*/cron.
  local files
  files="$(ls -1 "$LOG_DIR"/*.log 2>/dev/null \
    | grep -vE '/(improve-|cron\.log)' \
    | grep -E '/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}\.log$' \
    | tail -n "$EVIDENCE_RUNS")"

  if [ -z "$files" ]; then
    echo "_No builder run logs found yet._" >>"$EVIDENCE"
    return 0
  fi

  local f base mode repairs timeouts vfails outcome first last span fs ls
  local n_runs=0 n_repair=0 n_timeout=0 n_recovery=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    n_runs=$((n_runs + 1))
    base="$(basename "$f")"
    mode="normal"
    if grep -q "entering recovery mode" "$f" 2>/dev/null; then mode="recovery"; n_recovery=$((n_recovery + 1)); fi
    repairs="$(grep -cE 'launching focused repair' "$f" 2>/dev/null || true)"
    timeouts="$(grep -cE 'TIMED OUT' "$f" 2>/dev/null || true)"
    vfails="$(grep -cE 'validation FAILED' "$f" 2>/dev/null || true)"
    [ "${repairs:-0}" -gt 0 ] 2>/dev/null && n_repair=$((n_repair + 1))
    [ "${timeouts:-0}" -gt 0 ] 2>/dev/null && n_timeout=$((n_timeout + 1))
    if grep -qE 'finished and verified OK' "$f" 2>/dev/null; then
      outcome="OK"
    elif grep -qE 'FAILED -- see' "$f" 2>/dev/null; then
      outcome="FAILED"
    else
      outcome="unknown/partial"
    fi
    # Wall-clock from first to last timestamped line, best-effort.
    first="$(grep -oE '^\[[0-9T:+-]+\]' "$f" 2>/dev/null | head -1 | tr -d '[]')"
    last="$(grep -oE '^\[[0-9T:+-]+\]' "$f" 2>/dev/null | tail -1 | tr -d '[]')"
    span="n/a"
    if [ -n "$first" ] && [ -n "$last" ]; then
      fs="$(date -d "$first" +%s 2>/dev/null || echo 0)"
      ls="$(date -d "$last" +%s 2>/dev/null || echo 0)"
      if [ "$fs" -gt 0 ] && [ "$ls" -ge "$fs" ]; then
        span="$(( (ls - fs) / 60 ))m"
      fi
    fi
    echo "| $base | $mode | ${repairs:-0} | ${timeouts:-0} | ${vfails:-0} | $outcome | $span |" >>"$EVIDENCE"
  done <<<"$files"

  {
    echo
    echo "## Aggregate signal"
    echo
    echo "- Runs digested: $n_runs"
    echo "- Runs needing >=1 repair: $n_repair"
    echo "- Runs with a timeout: $n_timeout"
    echo "- Recovery-mode runs (stranded work): $n_recovery"
  } >>"$EVIDENCE"
)

# ---------------------------------------------------------------------------
# Validation proportional to what changed. bash -n on every changed shell
# script is mandatory (catches the most likely self-inflicted breakage).
# shellcheck is advisory (may be absent). `bun run check` runs ONLY when a
# TypeScript/Astro/MDX file changed -- we never trigger the full content/OG
# rebuild from here because this job never edits content.
# ---------------------------------------------------------------------------
changed_files() { git status --porcelain | awk '{print $2}'; }

run_scoped_validation() {
  local files rc=0 need_ts=0 f
  files="$(changed_files)"
  log "scoped validation over changed files:"
  printf '%s\n' "$files" | sed 's/^/  /' | tee -a "$LOG" >&2

  # 1. bash -n on every changed shell script (mandatory gate).
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
      *.sh)
        log "  bash -n $f"
        if ! bash -n "$f" >>"$LOG" 2>&1; then
          log "  bash -n FAILED on $f"
          rc=1
        fi
        if command -v shellcheck >/dev/null 2>&1; then
          log "  shellcheck (advisory) $f"
          shellcheck -S warning "$f" >>"$LOG" 2>&1 || log "  shellcheck reported advisories on $f (non-fatal)"
        fi
        ;;
      *.ts|*.tsx|*.astro|*.mdx|*.mts|*.cts) need_ts=1 ;;
    esac
  done <<<"$files"

  # 2. Type/content check only if a TS/Astro/MDX file changed.
  if [ "$need_ts" -eq 1 ]; then
    log "  TypeScript/Astro/MDX change detected -> running \`bun run check\`"
    run_in_group "$CHECK_TIMEOUT" "check" bun run check || rc=$?
  else
    log "  no TS/Astro/MDX changes -> skipping \`bun run check\` (shell/docs only)"
  fi

  if [ "$rc" -eq 0 ]; then
    log "scoped validation PASSED"
    return 0
  fi
  log "scoped validation FAILED (exit $rc; a timeout counts as failure)"
  return 1
}

# ---------------------------------------------------------------------------
# Prompts. The session ONLY analyses + edits files under scripts/ and docs/,
# then exits. It never validates, builds, commits, pushes, or touches content.
# ---------------------------------------------------------------------------
PROMPT="You are improving the AUTONOMOUS DAILY-LESSON EXECUTION SYSTEM of this repository --
NOT its lessons or product. Do not build, edit, or research any lesson, topic, component,
content, or OG image. Stay strictly inside the execution/automation surface.

Read these first, in order:
  1. \`$EVIDENCE\` -- a digest of the most recent autonomous builder runs (modes, repair
     counts, timeouts, validation failures, wall-clock). This is your evidence base.
  2. The raw run logs under \`.daily-lesson-logs/*.log\` (builder runs; ignore improve-*.log)
     for any run the digest flags as slow, repeated-repair, timed-out, or recovery-mode.
  3. \`scripts/daily-lesson.sh\` (the builder wrapper + its session prompts),
     \`src/lib/upcoming.ts\` (the \`upcomingCourses\` build queue), \`CLAUDE.md\`, and
     \`docs/daily-lesson-automation.md\`.

Your goal: make future autonomous runs FASTER and MORE EFFECTIVE while NEVER weakening any
correctness gate. Look for evidence-backed wins such as: recurring validation failures the
session could avoid up front; prompt wording that causes repeated repair loops; timeouts that
suggest a deadline or staging change; flaky steps; missing observability; stranded-work causes.

HARD CONSTRAINTS:
- Make at most ONE small, scoped, easily reversible improvement this run. Prefer a prompt or
  doc clarification or a tunable adjustment over structural rewrites.
- It is not only acceptable but CORRECT to make NO change at all if the recent evidence does
  not clearly justify one. If so, change nothing and just exit.
- Base every change on something concrete in the logs/history. Do NOT speculate or
  refactor for taste. If you cannot point to evidence, do not make the change.
- NEVER weaken a correctness gate: do not remove or loosen validation, do not let red code be
  published, do not shorten validation below what safety needs. Speed must never trade away
  correctness.
- You may ONLY create/edit files under \`scripts/\` and \`docs/\`. Touch nothing else. In
  particular do NOT edit content, components, \`src/lib/upcoming.ts\`, or \`public/og\`.
- Be especially careful editing \`scripts/improve-daily-lesson.sh\` (your own runtime): only
  small, obviously-safe changes, and never anything that could make it skip safety steps.

You are running inside a wrapper that owns ALL validation and publishing:
- Do NOT run \`bun run pre-commit\`, \`bun run build\`, \`bun run check\`, \`og:generate\`, any
  type-check, or any other validation/build command. The wrapper validates after you exit.
- Do NOT run \`git add\`, \`git commit\`, or \`git push\`, and do NOT regenerate OG images.
- NEVER launch background or detached processes (no trailing \`&\`, no nohup/setsid/disown).
  Run only short foreground commands and wait for each to exit.

When done, briefly note in your final message WHAT you changed and the evidence for it (or
that you deliberately changed nothing and why), then stop -- leave all edits uncommitted in
the working tree for the wrapper to validate and publish."

# $LOG is interpolated so the repair session can read the validation output.
REPAIR_PROMPT="The wrapper ran scoped validation on your working-tree changes to the
daily-lesson execution system and it FAILED. The full output is at the END of this log file:

  $LOG

Read the most recent errors at the end of that log, then fix ONLY the pending working-tree
changes (under scripts/ and docs/ only) so validation passes. Do not start anything new, do
not touch content/components/OG, and never weaken a correctness gate.

You are inside a wrapper that owns ALL validation and publishing:
- Do NOT run any validation/build/type-check command, \`git add/commit/push\`, or og:generate.
- NEVER launch background or detached processes.

When you have addressed the errors, stop and exit, leaving changes uncommitted."

# Fetch origin/main with bounded retries.
fetch_with_retry() {
  local n=1 max=5
  while true; do
    git fetch --quiet origin main && return 0
    if [ "$n" -ge "$max" ]; then log "git fetch origin main failed after $max attempts"; return 1; fi
    log "git fetch origin main failed (attempt $n/$max); retrying in $((n * 5))s"
    sleep "$((n * 5))"; n="$((n + 1))"
  done
}

push_with_retry() {
  local n=1 max=5
  while true; do
    if git push origin HEAD:main >>"$LOG" 2>&1; then
      log "git push succeeded (attempt $n/$max)"; return 0
    fi
    if [ "$n" -ge "$max" ]; then log "git push failed after $max attempts"; return 1; fi
    log "git push failed (attempt $n/$max); re-fetching, rebasing, retrying in $((n * 5))s"
    fetch_with_retry || true
    git pull --rebase origin main >>"$LOG" 2>&1 || log "git pull --rebase reported an issue; will retry push anyway"
    sleep "$((n * 5))"; n="$((n + 1))"
  done
}

ensure_pushed_and_verified() {
  local head; head="$(git rev-parse HEAD)"
  fetch_with_retry || fail "could not fetch origin/main to check publication state"
  if ! git merge-base --is-ancestor "$head" origin/main; then
    log "HEAD ($head) is not yet on origin/main; pushing"
    push_with_retry || fail "could not push HEAD ($head) to origin/main after retries"
    fetch_with_retry || fail "could not re-fetch origin/main after pushing"
  fi
  git merge-base --is-ancestor "$head" origin/main \
    || fail "HEAD ($head) is still not reachable from origin/main after push"
  log "verified $head is published on origin/main"
}

# ===========================================================================
# Run.
# ===========================================================================
log "improve-daily-lesson starting (dry_run=$DRY_RUN, tz=$TZ)"

git checkout main >>"$LOG" 2>&1 || fail "could not checkout main"

# Clean-tree precondition. If a builder run left work mid-flight, this is NOT
# ours to touch -- skip this tick entirely (success, not failure). The shared
# flock already prevents concurrent runs; this covers a crashed prior run.
if tree_dirty; then
  log "working tree is NOT clean at start -- a builder run may have stranded work."
  dump_status
  log "skipping this improvement tick so we never mix with builder work (no-op success)"
  exit 0
fi

build_evidence_digest
log "evidence digest written:"
sed 's/^/  | /' "$EVIDENCE" | tee -a "$LOG" >&2

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY RUN: evidence gathered above. The full run would now launch a Claude session"
  log "DRY RUN: with the improvement prompt (deadline ${CLAUDE_TIMEOUT}s), then validate"
  log "DRY RUN: changed files, and commit/push only if green. No Claude invoked, no repo"
  log "DRY RUN: changes made, nothing committed. Smoke test OK."
  # Leave the evidence digest in place for inspection; it lives in the gitignored log dir.
  exit 0
fi

# Normal run. Start from the latest main and a frozen install so the environment
# matches the builder's.
git pull --ff-only origin main >>"$LOG" 2>&1 || fail "could not fast-forward main from origin"
bun install --frozen-lockfile >>"$LOG" 2>&1 || log "WARNING: bun install reported an issue; continuing"

START_REF="$(git rev-parse HEAD)"
log "improvement session starting from $START_REF"

run_claude() {
  local timeout_secs="$1" label="$2" prompt="$3" rc=0
  run_in_group "$timeout_secs" "$label" claude -p "$prompt" --dangerously-skip-permissions || rc=$?
  return "$rc"
}

run_claude "$CLAUDE_TIMEOUT" "improve" "$PROMPT" \
  || log "WARNING: improvement session returned non-zero; inspecting git state anyway"

# No change is a valid outcome.
if ! tree_dirty; then
  log "the session made no changes -- evidence did not justify an improvement this run (no-op success)"
  log "improvement session finished OK (no change)"
  exit 0
fi

# Enforce the allowlist BEFORE any validation/commit. Out-of-scope edits abort
# the run and the tree is restored to its known-clean start (safe: clean start
# was asserted), so nothing is stranded for the next builder run.
OUT_OF_SCOPE="$(changed_files | grep -vE "$ALLOW_RE" || true)"
if [ -n "$OUT_OF_SCOPE" ]; then
  log "session changed files OUTSIDE the allowlist (scripts/, docs/):"
  printf '%s\n' "$OUT_OF_SCOPE" | sed 's/^/  /' | tee -a "$LOG" >&2
  restore_clean_tree
  fail "refusing to commit out-of-scope changes; tree restored to clean start"
fi
log "all changes are within the allowlist (scripts/, docs/)"

# Validate; bounded repair loop on red; never commit red. On exhausting repairs,
# restore the clean tree and fail (never publish, never strand).
attempt=0
while true; do
  if run_scoped_validation; then
    break
  fi
  if [ "$attempt" -ge "$MAX_REPAIR_ATTEMPTS" ]; then
    restore_clean_tree
    fail "validation still red after $MAX_REPAIR_ATTEMPTS repair attempt(s); restored clean tree, refusing to publish"
  fi
  attempt="$((attempt + 1))"
  log "validation red -- launching focused repair session (attempt $attempt/$MAX_REPAIR_ATTEMPTS)"
  run_claude "$REPAIR_TIMEOUT" "repair#$attempt" "$REPAIR_PROMPT" \
    || log "repair session returned non-zero; re-validating anyway"
  # A repair could wander out of scope; re-check the allowlist.
  OUT_OF_SCOPE="$(changed_files | grep -vE "$ALLOW_RE" || true)"
  if [ -n "$OUT_OF_SCOPE" ]; then
    log "repair introduced out-of-scope changes:"
    printf '%s\n' "$OUT_OF_SCOPE" | sed 's/^/  /' | tee -a "$LOG" >&2
    restore_clean_tree
    fail "repair went out of scope; restored clean tree"
  fi
done

# Green and in-scope. Stage ONLY the allowlist, then commit.
git add scripts docs
if git diff --cached --quiet; then
  log "validation green but nothing staged within allowlist; nothing to commit"
  restore_clean_tree
  exit 0
fi
git commit -q \
  -m "chore(daily-lesson): improve autonomous execution system" \
  -m "Evidence-based, scoped improvement to the daily-lesson run system (scripts/ docs/), applied and validated by scripts/improve-daily-lesson.sh." \
  >>"$LOG" 2>&1
log "committed improvement -> $(git rev-parse HEAD)"

ensure_pushed_and_verified

if tree_dirty; then
  log "tree unexpectedly dirty after commit/push:"
  dump_status
  fail "working tree is not clean after finalization"
fi

HEAD_AFTER="$(git rev-parse HEAD)"
log "HEAD advanced $START_REF -> $HEAD_AFTER"
log "improvement session finished and verified OK"
