#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="acre-ui-rebuild-web.service"
HEALTH_URL="https://acresystem.us/api/health"
PROBE_INTERVAL=5
JOURNAL_SINCE="now"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/watch.sh [--service NAME] [--health-url URL] [--probe-interval SECONDS] [--since SYSTEMD_SINCE]

Example:
  bash scripts/ops/watch.sh --service acre-ui-rebuild-web.service --health-url https://acresystem.us/api/health --probe-interval 5 --since "10 minutes ago"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      SERVICE_NAME="$2"
      shift 2
      ;;
    --health-url)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      HEALTH_URL="$2"
      shift 2
      ;;
    --probe-interval)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      PROBE_INTERVAL="$2"
      shift 2
      ;;
    --since)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      JOURNAL_SINCE="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if ! [[ "$PROBE_INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
  printf '[FAIL] --probe-interval must be a positive integer\n' >&2
  exit 1
fi

for required_command in curl journalctl awk grep sed; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf '[FAIL] required command is missing: %s\n' "$required_command" >&2
    exit 1
  fi
done

tmp_dir="$(mktemp -d)"
health_codes_file="$tmp_dir/health-codes.log"
journal_hits_file="$tmp_dir/journal-hits.log"
touch "$health_codes_file" "$journal_hits_file"

journal_pid=""
health_pid=""
signal_received=0
script_status=1
start_epoch="$(date +%s)"

cleanup() {
  rm -rf "$tmp_dir"
}

terminate_children() {
  local pid
  for pid in "$journal_pid" "$health_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

handle_signal() {
  signal_received=1
  terminate_children
}

print_summary() {
  local end_epoch runtime_seconds health_total health_2xx health_non_2xx journal_hits
  end_epoch="$(date +%s)"
  runtime_seconds=$((end_epoch - start_epoch))
  health_total="$(wc -l < "$health_codes_file" | awk '{print $1}')"
  health_2xx="$(grep -c '^2' "$health_codes_file" || true)"
  journal_hits="$(wc -l < "$journal_hits_file" | awk '{print $1}')"
  health_non_2xx=$((health_total - health_2xx))
  printf '[LOG] summary runtime_seconds=%s health_total=%s health_2xx=%s health_non_2xx=%s journal_hits=%s\n' \
    "$runtime_seconds" "$health_total" "$health_2xx" "$health_non_2xx" "$journal_hits"
}

trap handle_signal INT TERM
trap 'terminate_children; wait "$journal_pid" 2>/dev/null || true; wait "$health_pid" 2>/dev/null || true; print_summary; cleanup' EXIT

watch_journal() {
  journalctl -u "$SERVICE_NAME" -f --since "$JOURNAL_SINCE" --no-pager 2>/dev/null \
    | grep -iE --line-buffered 'error|invalid session signature|db auth|resend|prisma|rate_limit_rejected|panic|fatal' \
    | sed -u -E \
        -e 's/([Pp]a[s][s]word|[Ss]e[c]ret|[Tt]o[k]en|[Kk]ey|[Cc]o[o]kie|[Aa]u[t]horization)[[:space:]]*[:=][[:space:]]*[^[:space:]]+/\1=[REDACTED]/g' \
        -e 's/Bearer[[:space:]]+[A-Za-z0-9._~+\/=-]+/Bearer [REDACTED]/g' \
    | while IFS= read -r line; do
        printf '[LOG] %s\n' "$line"
        printf '1\n' >> "$journal_hits_file"
      done
}

watch_health() {
  local timestamp http_code
  while true; do
    timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    http_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)"
    if [[ -z "$http_code" ]]; then
      http_code="000"
    fi
    printf '[HEALTH] %s %s\n' "$timestamp" "$http_code"
    printf '%s\n' "$http_code" >> "$health_codes_file"
    sleep "$PROBE_INTERVAL"
  done
}

watch_journal &
journal_pid=$!

watch_health &
health_pid=$!

if wait -n "$journal_pid" "$health_pid"; then
  wait_status=0
else
  wait_status=$?
fi

if [[ "$signal_received" -eq 1 ]]; then
  script_status=0
else
  printf '[FAIL] watch subprocess exited unexpectedly with status %s\n' "$wait_status" >&2
  script_status=1
fi

terminate_children
wait "$journal_pid" 2>/dev/null || true
wait "$health_pid" 2>/dev/null || true

exit "$script_status"
