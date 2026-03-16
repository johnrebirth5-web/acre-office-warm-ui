#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_REPO_URL="$(git -C "$ROOT_DIR" remote get-url origin)"

DEPLOY_HOST="${ACRE_DEPLOY_HOST:-root@45.55.247.137}"
SSH_KEY="${ACRE_DEPLOY_SSH_KEY:-$HOME/.ssh/acre_do_ed25519}"
REPO_URL="${ACRE_DEPLOY_REPO_URL:-$DEFAULT_REPO_URL}"
LIVE_DIR="${ACRE_DEPLOY_LIVE_DIR:-/opt/acre-ui-rebuild/app}"
ENV_FILE="${ACRE_DEPLOY_ENV_FILE:-/etc/acre/acre-ui-rebuild.env}"
SERVICE_NAME="${ACRE_DEPLOY_SERVICE:-acre-ui-rebuild-web.service}"
PUBLIC_LOGIN_URL="${ACRE_DEPLOY_LOGIN_URL:-https://acresystem.us/login}"
FALLBACK_LOGIN_URL="${ACRE_DEPLOY_FALLBACK_LOGIN_URL:-http://45.55.247.137:3105/login}"
COMMIT="${1:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"

echo "Deploy host: $DEPLOY_HOST"
echo "Deploy commit: $COMMIT"
echo "Repo URL: $REPO_URL"
echo "Live dir: $LIVE_DIR"
echo "Service: $SERVICE_NAME"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=yes "$DEPLOY_HOST" \
  "TARGET_COMMIT='$COMMIT' REPO_URL='$REPO_URL' LIVE_DIR='$LIVE_DIR' ENV_FILE='$ENV_FILE' SERVICE_NAME='$SERVICE_NAME' bash -s" <<'EOF'
set -euo pipefail

TMP_DIR="$(mktemp -d /tmp/acre-deploy-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Using temp dir: $TMP_DIR"
git clone --depth 1 --branch main "$REPO_URL" "$TMP_DIR"
cd "$TMP_DIR"
echo "Cloned commit: $(git rev-parse HEAD)"
git checkout "$TARGET_COMMIT"

echo "--- npm ci ---"
NODE_ENV=development npm ci

echo "--- prisma generate ---"
npm run db:generate

echo "--- prisma migrate deploy ---"
set -a
. "$ENV_FILE"
set +a
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

echo "--- build ---"
npm run build

echo "--- switch live app ---"
systemctl stop "$SERVICE_NAME"
rsync -a --delete --exclude .local-storage --exclude .turbo "$TMP_DIR"/ "$LIVE_DIR"/
chown -R acre:acre "$LIVE_DIR"
systemctl start "$SERVICE_NAME"

echo "--- final status ---"
systemctl status --no-pager "$SERVICE_NAME" | sed -n '1,30p'
EOF

echo "--- public validation ---"
if curl -fsSI "$PUBLIC_LOGIN_URL"; then
  exit 0
fi

echo "Primary public validation failed, trying fallback: $FALLBACK_LOGIN_URL" >&2
curl -fsSI "$FALLBACK_LOGIN_URL"
