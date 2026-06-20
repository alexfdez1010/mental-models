#!/usr/bin/env bash
# Launch one unattended Claude Code lesson-building session from cron.
#
# Scheduled at 06:00 and 18:00 Europe/Madrid via the user crontab
# (`0 6,18 * * * /usr/bin/flock -n /tmp/lessons-daily-lesson.lock .../daily-lesson.sh`).
# Do not move the schedule here -- it lives in crontab.
#
# This wrapper never trusts the session's own report. It enforces the invariant
# that every run ends with a CLEAN tree whose HEAD is published on origin/main,
# and it never publishes code that did not pass full validation.
#
# Architecture (hardened against Claude spawning background builds / hanging):
#   * Claude sessions ONLY implement or fix the pending work, then exit. They
#     NEVER run validation, og:generate, builds, git add, commit, or push --
#     the wrapper alone owns all of that. This keeps a session from launching a
#     detached build that outlives it.
#   * Every Claude session and every validation runs under `setsid` + `timeout`
#     in its OWN process group, with a hard wall-clock deadline. When the
#     command exits or times out, the wrapper kills the ENTIRE process group, so
#     any background build/watcher Claude spawned dies with it. A timeout is
#     treated as a failure. Only process groups this wrapper created are ever
#     signalled, so unrelated processes are never touched.
#   * Both the normal path and the startup-recovery path converge on the SAME
#     deterministic flow: validate -> (bounded repair loop) -> commit -> push ->
#     verify. Red code is never published.
#   * If a previous run left a dirty tree, we do NOT start a new upcoming course --
#     we finish the stranded work and land it.
#   * Push/fetch use bounded retries; the run only succeeds once HEAD is verified
#     reachable from origin/main and the tree is clean. A normal run additionally
#     fails if HEAD did not advance; startup recovery succeeds by landing pending
#     work.
set -euo pipefail

export TZ="Europe/Madrid"
export HOME="${HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}"
export LANG="en_US.UTF-8"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

# Repo root is derived from this script's own location, so the job works wherever
# you cloned the template (no hard-coded path to edit). Override with REPO=... if
# you symlink the script elsewhere.
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$REPO/.daily-lesson-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y-%m-%dT%H%M%S).log"

cd "$REPO"

# ---------------------------------------------------------------------------
# Tunables (env-overridable). All deadlines are hard wall-clock seconds.
# ---------------------------------------------------------------------------
CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-5400}"        # main/rescue implementation session (90m)
REPAIR_TIMEOUT="${REPAIR_TIMEOUT:-2400}"        # focused repair session (40m)
VALIDATION_TIMEOUT="${VALIDATION_TIMEOUT:-1800}" # one `bun run pre-commit` (30m)
KILL_GRACE="${KILL_GRACE:-30}"                  # TERM->KILL grace handed to `timeout -k`
MAX_REPAIR_ATTEMPTS="${MAX_REPAIR_ATTEMPTS:-4}" # bounded repair loop

# Our own process group -- a safety guard so cleanup can NEVER signal it.
WRAPPER_PGID="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ' || true)"
# Process groups this wrapper created (one per Claude/validation run). The
# EXIT/TERM/INT trap only ever signals groups recorded here.
WRAPPER_PGIDS=()

# Timestamped line to both the per-run log and stderr (stderr is captured into
# cron.log), so failures surface wherever someone is looking.
log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" | tee -a "$LOG" >&2; }

# Log a clear error and abort with a non-zero exit code.
fail() {
  log "ERROR: $*"
  log "daily lesson session FAILED -- see $LOG"
  exit 1
}

# Kill an entire process group we created (and only one we created). TERM first,
# then KILL anything that survives. No-op if the group is already gone, so it is
# safe to call repeatedly (e.g. once inline and again from the EXIT trap).
kill_group() {
  local pgid="$1"
  [ -n "$pgid" ] || return 0
  case "$pgid" in *[!0-9]*) return 0;; esac      # numeric only
  [ "$pgid" -gt 1 ] || return 0                  # never 0/1 (whole-session / init)
  if [ -n "$WRAPPER_PGID" ] && [ "$pgid" = "$WRAPPER_PGID" ]; then
    return 0                                     # never our own group
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

# Trap-driven cleanup: signal every group we created. Already-dead groups no-op.
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
# timeout, streaming its output to the log. On return (normal, error, or
# timeout) the whole group is killed so background builds/watchers cannot
# outlive it. Returns the command's exit status (124 = timed out per `timeout`).
#
# Idiom note: in a non-interactive script job control is off, so the backgrounded
# process is not a group leader -- `setsid` execs without forking and `$!` is the
# new session leader, whose PID is also the new PGID.
run_in_group() {
  local timeout_secs="$1"; shift
  local label="$1"; shift
  log "[$label] launching with hard deadline ${timeout_secs}s (group-isolated)"
  setsid --wait timeout -k "$KILL_GRACE" "$timeout_secs" "$@" >>"$LOG" 2>&1 &
  local pid=$!
  local pgid
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  [ -n "$pgid" ] || pgid="$pid"
  # Safety: if PGID detection somehow returned our own group (would mean setsid
  # did not isolate), do NOT record it -- we must never risk killing ourselves.
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

# True (exit 0) when the working tree has uncommitted or untracked changes.
tree_dirty() { [ -n "$(git status --porcelain)" ]; }

# Dump the current porcelain status to the log + stderr.
dump_status() { git status --porcelain | tee -a "$LOG" >&2 || true; }

# Run the full validation pipeline under a hard timeout in its own group. This
# is the single source of truth for "is this safe to publish?". A timeout (or
# any non-zero exit) is a validation FAILURE.
run_validation() {
  local rc=0
  log "validation: running \`bun run pre-commit\` (hard deadline ${VALIDATION_TIMEOUT}s)"
  run_in_group "$VALIDATION_TIMEOUT" "validate" bun run pre-commit || rc=$?
  if [ "$rc" -eq 0 ]; then
    log "validation PASSED"
    return 0
  fi
  log "validation FAILED (exit $rc; a timeout counts as failure)"
  return 1
}

# Run a Claude session under a hard timeout in its own group. Never aborts the
# wrapper on a non-zero exit -- the independent git verification stays the source
# of truth. Returns Claude's exit code for logging only.
run_claude() {
  local timeout_secs="$1" label="$2" prompt="$3"
  local rc=0
  run_in_group "$timeout_secs" "$label" \
    claude -p "$prompt" --dangerously-skip-permissions || rc=$?
  return "$rc"
}

# Fetch origin/main with bounded retries and growing backoff.
fetch_with_retry() {
  local n=1 max=5
  while true; do
    if git fetch --quiet origin main; then
      return 0
    fi
    if [ "$n" -ge "$max" ]; then
      log "git fetch origin main failed after $max attempts"
      return 1
    fi
    log "git fetch origin main failed (attempt $n/$max); retrying in $((n * 5))s"
    sleep "$((n * 5))"
    n="$((n + 1))"
  done
}

# Push HEAD to origin/main with bounded retries. On a rejected push it
# re-fetches and rebases onto the latest main before retrying, so a remote that
# advanced underneath us does not strand the commit locally.
push_with_retry() {
  local n=1 max=5
  while true; do
    if git push origin HEAD:main >>"$LOG" 2>&1; then
      log "git push succeeded (attempt $n/$max)"
      return 0
    fi
    if [ "$n" -ge "$max" ]; then
      log "git push failed after $max attempts"
      return 1
    fi
    log "git push failed (attempt $n/$max); re-fetching, rebasing, retrying in $((n * 5))s"
    fetch_with_retry || true
    git pull --rebase origin main >>"$LOG" 2>&1 || log "git pull --rebase reported an issue; will retry push anyway"
    sleep "$((n * 5))"
    n="$((n + 1))"
  done
}

# Ensure the current HEAD is published on origin/main, pushing if needed, then
# verify it independently. Aborts the run on any unrecoverable failure.
ensure_pushed_and_verified() {
  local head
  head="$(git rev-parse HEAD)"
  fetch_with_retry || fail "could not fetch origin/main to check publication state"
  if ! git merge-base --is-ancestor "$head" origin/main; then
    log "HEAD ($head) is not yet on origin/main; pushing"
    push_with_retry || fail "could not push HEAD ($head) to origin/main after retries"
    fetch_with_retry || fail "could not re-fetch origin/main after pushing"
  fi
  if ! git merge-base --is-ancestor "$head" origin/main; then
    fail "HEAD ($head) is still not reachable from origin/main after push"
  fi
  log "verified $head is published on origin/main"
}

# Assert the tree is clean; abort loudly otherwise.
assert_clean_tree() {
  if tree_dirty; then
    log "working tree is unexpectedly dirty at the final check:"
    dump_status
    fail "working tree is not clean after finalization"
  fi
}

# Deterministic finalize: validate the pending work; if red, run a bounded
# repair loop (a focused Claude session reads the validation log and fixes only
# the pending work, then the wrapper re-validates). Only once validation is
# GREEN does the wrapper itself `git add -A` and commit. Never commits red code;
# aborts via fail() if it cannot reach green. Pushing is the caller's job.
validate_and_finalize() {
  local context="$1"
  local attempt=0
  while true; do
    if run_validation; then
      break
    fi
    if [ "$attempt" -ge "$MAX_REPAIR_ATTEMPTS" ]; then
      fail "$context: validation still red after $MAX_REPAIR_ATTEMPTS repair attempt(s); refusing to publish red code"
    fi
    attempt="$((attempt + 1))"
    log "$context: validation red -- launching focused repair session (attempt $attempt/$MAX_REPAIR_ATTEMPTS)"
    run_claude "$REPAIR_TIMEOUT" "repair#$attempt" "$REPAIR_PROMPT" \
      || log "$context: repair session returned non-zero; re-validating anyway"
  done

  # Green. The wrapper alone stages and commits (sessions never commit).
  git add -A
  if git diff --cached --quiet; then
    log "$context: validation green but nothing staged; nothing to commit"
    return 0
  fi
  git commit -q \
    -m "chore(daily-lesson): land autonomous session work ($context)" \
    -m "Implemented by an autonomous session; validated and committed by the wrapper." \
    >>"$LOG" 2>&1
  log "$context: committed pending work deterministically -> $(git rev-parse HEAD)"
}

# ---------------------------------------------------------------------------
# Prompts. Every session ONLY implements/fixes work and then exits. None of them
# validate, build, regenerate OG, git add, commit, or push -- the wrapper owns
# all of that. None may launch background or detached processes.
# ---------------------------------------------------------------------------
PROMPT='Run one autonomous lesson-building session for this repository.
Read TOPIC.md (the subject + scope), then CLAUDE.md and the relevant skills in
.claude/skills, and follow them completely. The build queue is DATA in `src/lib/upcoming.ts`
(the `upcomingCourses` array), NOT a markdown checklist. Implement exactly the entry with the
LOWEST `order`, from top to bottom, including its complete English and Spanish content. Use
that entry'\''s `buildNotes` as the brief, its `dependencies`/`tags` for catalog wiring, and
keep the same `slug` for the topic MDX. After the course is fully written, REMOVE that entry
from `upcomingCourses` in `src/lib/upcoming.ts` (the built topic under `src/content/topics/`
is now the record; leaving it in upcoming would draw the node twice). If fewer than three
entries remain in `upcomingCourses`, first append suitable progressively harder on-subject
entries — strictly within the scope defined in TOPIC.md, each one notch up the difficulty
ladder — so the queue does not run empty, then implement only the lowest-`order` entry.
Inspect the existing working tree
carefully and never discard or overwrite changes you did not create. Work only inside this
repository.

IMPORTANT -- you are running inside a wrapper that owns ALL validation and publishing:
- Do NOT run `bun run pre-commit`, `bun run build`, `bun run check`, `og:generate`, any
  type-check, or any other validation/build/long-running command. The wrapper runs full
  validation after you exit.
- Do NOT run `git add`, `git commit`, or `git push`, and do NOT regenerate OG images.
- NEVER launch background or detached processes (no trailing `&`, no `run_in_background`,
  no nohup/setsid/disown). Run only short foreground commands and wait for each to exit.

Your job ends when the implementation (MDX content, components, and the `upcomingCourses`
entry removal in `src/lib/upcoming.ts`) is
written to the working tree. When it is complete, simply stop and exit, leaving all your
changes uncommitted in the working tree for the wrapper to validate and publish.'

RESCUE_PROMPT='A previous autonomous session for this repository exited while leaving
uncommitted or untracked changes in the working tree. Do NOT start any new upcoming course or
any new lesson. Your ONLY job is to finish the work that is already present in the working
tree so it is consistent and complete.

1. Run `git status` and inspect every pending change so you understand exactly what it is.
   It is most likely an in-progress course, lesson, component, or regenerated OG cards.
2. Complete only what is needed to make that work consistent and valid. Never discard,
   revert, or overwrite changes you did not create.

IMPORTANT -- you are running inside a wrapper that owns ALL validation and publishing:
- Do NOT run `bun run pre-commit`, `bun run build`, `bun run check`, `og:generate`, any
  type-check, or any other validation/build/long-running command.
- Do NOT run `git add`, `git commit`, or `git push`, and do NOT regenerate OG images.
- NEVER launch background or detached processes (no trailing `&`, no `run_in_background`,
  no nohup/setsid/disown). Run only short foreground commands and wait for each to exit.

When the pending work is complete and consistent, simply stop and exit, leaving all changes
uncommitted in the working tree for the wrapper to validate and publish.'

# NOTE: $LOG is interpolated so the repair session can read the validation output.
REPAIR_PROMPT="The wrapper ran \`bun run pre-commit\` on the pending working-tree changes
and it FAILED. The full validation output is appended to this log file:

  $LOG

Read the most recent validation errors at the END of that log file, then fix ONLY the
pending working-tree changes so that validation will pass. Do NOT start any new upcoming
course or new lesson, and never discard, revert, or overwrite changes you did not create.

IMPORTANT -- you are running inside a wrapper that owns ALL validation and publishing:
- Do NOT run \`bun run pre-commit\`, \`bun run build\`, \`bun run check\`, \`og:generate\`,
  any type-check, or any other validation/build/long-running command. The wrapper will
  re-validate after you exit.
- Do NOT run \`git add\`, \`git commit\`, or \`git push\`, and do NOT regenerate OG images.
- NEVER launch background or detached processes (no trailing \`&\`, no \`run_in_background\`,
  no nohup/setsid/disown). Run only short foreground commands and wait for each to exit.

When you have addressed the errors, simply stop and exit, leaving all changes uncommitted
in the working tree for the wrapper to re-validate."

# ---------------------------------------------------------------------------
# 0. Make sure we are on main.
# ---------------------------------------------------------------------------
git checkout main >>"$LOG" 2>&1 || fail "could not checkout main"

# ---------------------------------------------------------------------------
# 1. Startup recovery. If the tree is already dirty, a previous run crashed
#    mid-flight: finish that stranded work FIRST instead of starting a new
#    upcoming course on top of a dirty tree. Do not pull onto a dirty tree.
#    Converges through the SAME validate/finalize/push flow as a normal run.
# ---------------------------------------------------------------------------
if tree_dirty; then
  log "startup: working tree is NOT clean -- entering recovery mode (no new upcoming course this run)"
  dump_status
  # Stranded changes may touch the lockfile, so install non-frozen.
  log "startup: installing dependencies (non-frozen) for the rescue session and validation"
  bun install >>"$LOG" 2>&1 || log "WARNING: bun install reported an issue; continuing"

  run_claude "$CLAUDE_TIMEOUT" "rescue" "$RESCUE_PROMPT" \
    || log "WARNING: rescue session returned non-zero; the wrapper will validate and finalize"

  if ! tree_dirty; then
    fail "startup recovery: tree became clean without a commit -- nothing to finalize (a session may have wrongly committed/discarded work)"
  fi

  validate_and_finalize "startup-recovery"
  ensure_pushed_and_verified
  assert_clean_tree
  log "daily lesson session (startup recovery) finished and verified OK"
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Normal run. Start from the latest main and a clean install.
# ---------------------------------------------------------------------------
git pull --ff-only origin main >>"$LOG" 2>&1 || fail "could not fast-forward main from origin"
bun install --frozen-lockfile >>"$LOG" 2>&1

# Reference the verification compares against: where main sat before the session.
START_REF="$(git rev-parse HEAD)"
log "session starting from $START_REF"

run_claude "$CLAUDE_TIMEOUT" "main" "$PROMPT" \
  || log "WARNING: main session returned non-zero; validating git state anyway"

# ---------------------------------------------------------------------------
# 3. The session only implements -- it never commits. So the tree must be dirty
#    now. If it is clean, the session produced no work: a normal run fails.
# ---------------------------------------------------------------------------
if ! tree_dirty; then
  fail "normal run: session left a clean tree -- no work to validate or commit (HEAD must advance)"
fi

# ---------------------------------------------------------------------------
# 4. Deterministic validate/finalize, then independent verification -- the
#    source of truth regardless of what the session claimed.
# ---------------------------------------------------------------------------
validate_and_finalize "normal"
ensure_pushed_and_verified
assert_clean_tree

HEAD_AFTER="$(git rev-parse HEAD)"
if [ "$HEAD_AFTER" = "$START_REF" ]; then
  fail "HEAD did not advance (still at $START_REF) -- the session produced no committed work"
fi
log "HEAD advanced $START_REF -> $HEAD_AFTER"
log "daily lesson session finished and verified OK"
