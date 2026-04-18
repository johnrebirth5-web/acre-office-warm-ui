#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <gitleaks arguments...>" >&2
  exit 1
fi

GITLEAKS_VERSION="${GITLEAKS_VERSION:-8.30.1}"
GITLEAKS_IMAGE="${GITLEAKS_DOCKER_IMAGE:-zricethezav/gitleaks:v${GITLEAKS_VERSION}}"

if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks "$@"
fi

if command -v docker >/dev/null 2>&1; then
  exec docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/repo" -w /repo "$GITLEAKS_IMAGE" "$@"
fi

echo "gitleaks is not installed locally and Docker is unavailable." >&2
echo "Install gitleaks, enable Docker, or rely on the GitHub Actions secret scan workflow." >&2
exit 1
