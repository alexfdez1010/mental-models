#!/usr/bin/env bash
# install-cron.sh — one command to (un)install the autonomous cron jobs.
#
# It adds two user-crontab entries for THIS clone of the template, deriving every
# path and the flock lock name from the repo location, so you never hand-edit a
# path:
#
#   • Builder   — scripts/daily-lesson.sh        (default: 06:00 & 18:00 daily)
#   • Improver  — scripts/improve-daily-lesson.sh (default: Sundays 12:00)
#
# Both lines share ONE non-blocking flock, so they can never run at the same
# time. The installer is IDEMPOTENT: re-running it updates the two lines in place
# and never touches unrelated crontab entries (including other projects').
#
# Usage:
#   scripts/install-cron.sh            Install / update both jobs (idempotent)
#   scripts/install-cron.sh --builder  Install / update ONLY the builder job
#   scripts/install-cron.sh --list     Show the lines this repo would manage
#   scripts/install-cron.sh --remove   Remove this repo's jobs from the crontab
#   scripts/install-cron.sh --help     This help
#
# Tunables (environment variables):
#   CRON_TZ            Timezone header        (default: Europe/Madrid)
#   BUILDER_SCHEDULE   5-field cron for builder   (default: "0 6,18 * * *")
#   IMPROVER_SCHEDULE  5-field cron for improver  (default: "0 12 * * 0")
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$(basename "$REPO")"
LOCK="/tmp/${NAME}-daily-lesson.lock"
LOG_DIR="$REPO/.daily-lesson-logs"

CRON_TZ="${CRON_TZ:-Europe/Madrid}"
BUILDER_SCHEDULE="${BUILDER_SCHEDULE:-0 6,18 * * *}"
IMPROVER_SCHEDULE="${IMPROVER_SCHEDULE:-0 12 * * 0}"

# Resolve flock to an absolute path baked into the crontab line (cron's PATH is
# minimal). macOS has no native flock; the Homebrew `flock` formula installs it
# at /opt/homebrew/bin/flock. Fall back to the Linux default only as a last resort.
FLOCK="$(command -v flock || true)"
[ -n "$FLOCK" ] || for c in /opt/homebrew/bin/flock /usr/local/bin/flock /usr/bin/flock; do
  [ -x "$c" ] && { FLOCK="$c"; break; }
done
FLOCK="${FLOCK:-/usr/bin/flock}"

# Marker comment tags the lines this repo owns, so --remove / re-install only
# touch our own entries even if several template clones share one crontab.
TAG="# lessons-template:${NAME}"

builder_line() {
  echo "${BUILDER_SCHEDULE} ${FLOCK} -n ${LOCK} ${REPO}/scripts/daily-lesson.sh >> ${LOG_DIR}/cron.log 2>&1 ${TAG}"
}
improver_line() {
  echo "${IMPROVER_SCHEDULE} ${FLOCK} -n ${LOCK} ${REPO}/scripts/improve-daily-lesson.sh >> ${LOG_DIR}/improve-cron.log 2>&1 ${TAG}"
}

usage() { sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; }

case "${1:-}" in
  --help|-h) usage; exit 0;;
esac

if [ "$(uname -s)" = "Darwin" ]; then
  cat >&2 <<'EOF'
NOTE (macOS): cron works but is deprecated and needs Full Disk Access granted to
/usr/sbin/cron in System Settings → Privacy. For a laptop that sleeps, a launchd
agent or a hosted runner is more reliable. The crontab lines below are still
valid; this is just a heads-up.
EOF
fi

mkdir -p "$LOG_DIR"
chmod +x "$REPO/scripts/daily-lesson.sh" "$REPO/scripts/improve-daily-lesson.sh" 2>/dev/null || true

# Current crontab with ALL of this repo's managed lines (and any stale TZ header
# we manage) stripped out, so we can re-add cleanly. Other entries are preserved.
current="$(crontab -l 2>/dev/null || true)"
cleaned="$(printf '%s\n' "$current" | grep -vF "$TAG" || true)"

case "${1:-}" in
  --list)
    echo "CRON_TZ=${CRON_TZ}"
    builder_line
    improver_line
    exit 0
    ;;
  --remove)
    printf '%s\n' "$cleaned" | grep -v '^[[:space:]]*$' | crontab - 2>/dev/null || crontab -r 2>/dev/null || true
    echo "Removed cron jobs for '${NAME}'."
    exit 0
    ;;
esac

# Ensure a CRON_TZ header is present exactly once (prepend if missing).
header=""
if ! printf '%s\n' "$cleaned" | grep -q "^CRON_TZ="; then
  header="CRON_TZ=${CRON_TZ}"
fi

{
  [ -n "$header" ] && echo "$header"
  printf '%s\n' "$cleaned" | grep -v '^[[:space:]]*$' || true
  builder_line
  if [ "${1:-}" != "--builder" ]; then
    improver_line
  fi
} | crontab -

echo "Installed cron jobs for '${NAME}':"
echo "  repo: $REPO"
echo "  lock: $LOCK"
echo "  logs: $LOG_DIR/{cron.log,improve-cron.log}"
echo
echo "Active crontab:"
crontab -l
