# Deployment

## Purpose

This document is the single source of truth for the current production deployment line.

Use it only when the user explicitly asks for deployment or production sync work.

### Default Rule

- local development and validation first
- local `git commit`
- push GitHub
- deploy to `DigitalOcean` only when the user explicitly confirms it
- local Docker compose is a development convenience, not the production runtime line

`GitHub` sync does not equal deployment.

## Current default deployment truth

### Repo and Remote

- Active local repo: `/Users/openclaw_john/工作文件夹/Acre_latest_clean`
- Active GitHub remote: `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`

### Public Entries

- Active public entry: `https://acresystem.us/`
- Active login entry: `https://acresystem.us/login`
- Direct fallback entry during DNS propagation or troubleshooting: `http://45.55.247.137:3105/`

### Runtime Facts

- systemd service: `acre-ui-rebuild-web.service`
- `WorkingDirectory`: `/opt/acre-ui-rebuild/app`
- env file: `/etc/acre/acre-ui-rebuild.env`
- nginx config: `/etc/nginx/sites-available/acre-ui-rebuild.conf`
- nginx upstream: `127.0.0.1:3206`
- HTTPS/TLS: `certbot + nginx`, certificate for `acresystem.us` / `www.acresystem.us`
- certificate renewal: `certbot.timer`
- live app directory `/opt/acre-ui-rebuild/app` is not the source-of-truth git checkout, so do not assume `git pull` works there

## Runtime truth precedence

If any document, note, or remembered server detail conflicts with the above, treat the server runtime as the truth source:

- systemd `ExecStart`
- the active nginx upstream

Do not fall back to legacy `:80`, `acre-web`, or `/opt/acre/app` assumptions in the main operational path.

## Default workflow

1. Develop and validate locally.
2. Create a local `git commit`.
3. Push the committed change to `origin`.
4. Deploy to `DigitalOcean` only after explicit user confirmation.

### Operational Rules

- deployment is a separate step from `git push`
- do not treat GitHub sync as proof that production changed
- do not use `Vercel` as the delivery target for this repo
- when deployment is not explicitly requested, stop after local work and GitHub sync as directed by the task

## Deployment line to follow when explicitly confirmed

When a deployment is explicitly approved, use only this line:

1. Prepare a temporary checkout from GitHub `main` or the exact committed revision being deployed.
2. In that temporary checkout, run:
   - `npm ci`
   - `npm run db:generate`
   - `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma` after loading `/etc/acre/acre-ui-rebuild.env`
   - `npm run build`
3. Only if those steps succeed, sync the built repo state into `/opt/acre-ui-rebuild/app`.
4. Restore `/opt/acre-ui-rebuild/app` ownership to `acre:acre`.
5. Restart `acre-ui-rebuild-web.service`.
6. Validate through `https://acresystem.us/` and `https://acresystem.us/login`.
7. If runtime behavior disagrees with docs, trust systemd `ExecStart` and the active nginx upstream.

If DNS propagation is still in flight, direct fallback validation may temporarily use:

- `http://45.55.247.137:3105/`
- `http://45.55.247.137:3105/login`

The preferred repo-root deployment command already validates the public HTTPS login first and falls back to the direct `:3105` login only if the public domain is temporarily unavailable from the operator network.

### Practical operator note

The current production line is:

- temporary checkout/build directory
- sync into `/opt/acre-ui-rebuild/app`
- `systemctl restart acre-ui-rebuild-web.service`

It is not:

- `ssh -> cd /opt/acre-ui-rebuild/app -> git pull`

### Expected timing

A normal deployment may take around 1 to 3 minutes because it includes:

- dependency install
- Prisma client generation
- Prisma migration deploy
- Next.js production build
- service restart

### Preferred command

From repo root, the preferred operator command is:

- `npm run deploy:digitalocean`

To deploy a specific already-pushed commit:

- `npm run deploy:digitalocean -- <commit_sha>`

## Legacy reference only

These are historical references only. They are not the current default target:

- `http://45.55.247.137/`
- `acre-web`
- `/opt/acre/app`
- `/etc/acre/acre.env`
- `/etc/nginx/sites-available/acre.conf`
- nginx upstream `127.0.0.1:3000`

If a legacy note conflicts with the current deployment line, ignore the legacy note and follow this file.
