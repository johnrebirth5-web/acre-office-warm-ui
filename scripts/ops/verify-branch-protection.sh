#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="johnrebirth5-web/acre-office-warm-ui"
BRANCH_NAME="main"
REQUIRED_CHECKS=("verify" "hardening-tests")
CUSTOM_REQUIRED_CHECKS=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/verify-branch-protection.sh [--repo OWNER/NAME] [--branch NAME] [--required-check NAME]

Example:
  bash scripts/ops/verify-branch-protection.sh --repo johnrebirth5-web/acre-office-warm-ui --branch main --required-check verify --required-check hardening-tests
EOF
}

OVERALL_STATUS=0

report_ok() {
  printf '[OK] %s\n' "$1"
}

report_fail() {
  printf '[FAIL] %s\n' "$1"
  OVERALL_STATUS=1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      REPO_NAME="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      BRANCH_NAME="$2"
      shift 2
      ;;
    --required-check)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      if [[ "$CUSTOM_REQUIRED_CHECKS" -eq 0 ]]; then
        REQUIRED_CHECKS=()
        CUSTOM_REQUIRED_CHECKS=1
      fi
      REQUIRED_CHECKS+=("$2")
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

for required_command in gh jq; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf '[FAIL] required command is missing: %s\n' "$required_command" >&2
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  printf '[FAIL] gh is not authenticated\n' >&2
  exit 1
fi

response_tmp="$(mktemp)"
cleanup() {
  rm -f "$response_tmp"
}
trap cleanup EXIT

if ! gh api "repos/$REPO_NAME/branches/$BRANCH_NAME/protection" >"$response_tmp" 2>/dev/null; then
  report_fail "could not read branch protection for $REPO_NAME:$BRANCH_NAME"
  printf 'FAIL\n'
  exit 1
fi

if jq -e '.required_pull_request_reviews != null' "$response_tmp" >/dev/null; then
  report_ok "pull requests are required before merge"
else
  report_fail "pull requests are not required before merge"
fi

approvals="$(jq -r '.required_pull_request_reviews.required_approving_review_count // 0' "$response_tmp")"
if [[ "$approvals" =~ ^[0-9]+$ ]] && [[ "$approvals" -ge 1 ]]; then
  report_ok "required approvals is $approvals"
else
  report_fail "required approvals is ${approvals:-0}"
fi

if jq -e '.required_pull_request_reviews.dismiss_stale_reviews == true' "$response_tmp" >/dev/null; then
  report_ok "stale reviews are dismissed on new commits"
else
  report_fail "stale reviews are not dismissed on new commits"
fi

if jq -e '.required_status_checks != null' "$response_tmp" >/dev/null; then
  report_ok "required status checks are enabled"
else
  report_fail "required status checks are not enabled"
fi

if jq -e '.required_status_checks.strict == true' "$response_tmp" >/dev/null; then
  report_ok "branches must be up to date before merge"
else
  report_fail "branches are not required to be up to date before merge"
fi

for required_check in "${REQUIRED_CHECKS[@]}"; do
  if jq -e --arg required_check "$required_check" '
    [
      (.required_status_checks.contexts // []),
      ((.required_status_checks.checks // []) | map(.context))
    ]
    | add
    | map(select(. != null))
    | unique
    | index($required_check) != null
  ' "$response_tmp" >/dev/null; then
    report_ok "required status checks include $required_check"
  else
    report_fail "required status checks do not include $required_check"
  fi
done

if jq -e '.allow_force_pushes.enabled == false' "$response_tmp" >/dev/null; then
  report_ok "force pushes are disabled"
else
  report_fail "force pushes are allowed"
fi

if jq -e '.allow_deletions.enabled == false' "$response_tmp" >/dev/null; then
  report_ok "branch deletions are disabled"
else
  report_fail "branch deletions are allowed"
fi

if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  printf 'PASS\n'
  exit 0
fi

printf 'FAIL\n'
exit 1
