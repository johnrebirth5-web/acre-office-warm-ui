# Deployment

## Purpose

This document is the single source of truth for the current production deployment line.

Use it only when the user explicitly asks for deployment or production sync work.

### Default Rule

- local development and validation first
- local `git commit`
- push GitHub
- deploy to `DigitalOcean` only when the user explicitly confirms it

`GitHub` sync does not equal deployment.

## Current default deployment truth

### Repo and Remote

- Active local repo: `/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean`
- Active GitHub remote: `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`

### Public Entries

- Active public entry: `http://45.55.247.137:3105/`
- Active login entry: `http://45.55.247.137:3105/login`

### Runtime Facts

- systemd service: `acre-ui-rebuild-web.service`
- `WorkingDirectory`: `/opt/acre-ui-rebuild/app`
- env file: `/etc/acre/acre-ui-rebuild.env`
- nginx config: `/etc/nginx/sites-available/acre-ui-rebuild.conf`
- nginx upstream: `127.0.0.1:3206`

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

1. Sync the committed repo state into `/opt/acre-ui-rebuild/app`.
2. Load runtime configuration from `/etc/acre/acre-ui-rebuild.env`.
3. Restart or inspect `acre-ui-rebuild-web.service`.
4. Validate through `http://45.55.247.137:3105/` and `http://45.55.247.137:3105/login`.
5. If runtime behavior disagrees with docs, trust systemd `ExecStart` and the active nginx upstream.

## Legacy reference only

These are historical references only. They are not the current default target:

- `http://45.55.247.137/`
- `acre-web`
- `/opt/acre/app`
- `/etc/acre/acre.env`
- `/etc/nginx/sites-available/acre.conf`
- nginx upstream `127.0.0.1:3000`

If a legacy note conflicts with the current deployment line, ignore the legacy note and follow this file.
