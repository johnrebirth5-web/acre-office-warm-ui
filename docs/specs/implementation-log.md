# Back Office Implementation Log

## Current milestone

- `Back Office MVP+` on one active repo/deployment line
- Core operational modules already exist as real product surfaces, not just placeholder navigation
- Current priority is cleanup, normalization, and workflow hardening instead of blindly adding more modules

## Recently completed major work

- Working baseline normalized around:
  - local repo `/Users/openclaw_john/工作文件夹/Acre_latest_clean`
  - GitHub remote `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
  - DigitalOcean default entry `http://45.55.247.137:3105/`
- Internal auth now moved past seeded-email login:
  - bootstrap admin enforcement
  - invitation onboarding + password setup
  - email + password login
  - forced first password change
  - 5-attempt account lockout + admin unlock
  - signed cookie session kept as the current session model
- `Office / Back Office` now has real route and workflow foundations across:
  - dashboard
  - pipeline
  - transactions
  - contacts
  - tasks and `Approve Docs`
  - reports
  - notifications
  - activity
  - accounting
  - billing and account
  - library
  - settings/admin
  - agent management
- Transaction detail now acts as a real workflow hub for:
  - contacts
  - finance
  - tasks and compliance
  - documents, forms, eSignature, and incoming updates
  - offers
  - commissions
- Transaction intake is now office-scoped and schema-driven across the create modal, `/office/transactions/new`, and transaction detail:
  - built-in fields can be marked visible/hidden and required/optional
  - `office_admin` can add custom `text / select / date` fields
  - hidden address groups force `Transaction Name` visible + required
  - intake schema edits and intake value edits both write to `Activity Log`
- Shared `@acre/ui` and the Office design system are now the canonical UI layer for Back Office pages, with `/office/transactions` as the list-page composition reference
- `/office/transactions` and `/office/contacts` now share one canonical Office list-page template, including the same page header, summary/action block, workbench card, table card, and footer/pagination rhythm

## Current default baseline

- Product priority: `Back Office`, not the public site
- Local source of truth: `/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean`
- Default local browser entry: `http://localhost:3105/`
- Root `npm run dev` is now expected to bind `@acre/web` to `3105` by default
- `/login` is now expected to render with empty email/password fields and should not show demo credentials or username-style autofill values
- Default Git remote: `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- Default deployment line: `DigitalOcean :3105`
- Default public entry: `https://acresystem.us/`
- Default login entry: `https://acresystem.us/login`
- Direct fallback entry during DNS propagation: `http://45.55.247.137:3105/`
- Default production runtime:
  - service `acre-ui-rebuild-web.service`
  - WorkingDirectory `/opt/acre-ui-rebuild/app`
  - env `/etc/acre/acre-ui-rebuild.env`
  - nginx `/etc/nginx/sites-available/acre-ui-rebuild.conf`
  - upstream `127.0.0.1:3206`
  - TLS `certbot + nginx`
  - auto-renew `certbot.timer`
- `GitHub` sync and `DigitalOcean` deployment are separate actions
- For deployment truth, `docs/deployment.md` is the canonical reference and runtime truth comes from systemd `ExecStart` plus the active nginx upstream
- Preferred repo-root deployment command: `npm run deploy:digitalocean`
- UI glassmorphism has been reduced on long-lived shells, headers, badges, and overlays to lower GPU/compositor pressure after reports of prolonged-session screen artifacting
- `acresystem.us` / `www.acresystem.us` now terminate HTTPS at nginx with a Let's Encrypt certificate, and HTTP redirects to HTTPS

## Next recommended work

- Continue product and system cleanup before adding more large modules
- Remove remaining mixed legacy assumptions from docs, specs, and operational notes
- Tighten permissions, audit coverage, admin-managed configuration, and workflow state fidelity in existing modules
- Keep hardening the minimal internal account system before adding forgot-password, email delivery, or 2FA
- Keep filling practical module specs so future Codex runs can rely on repo docs instead of chat history
- Plan future storage, job-runner, and integration upgrades only after the current single-Droplet baseline is fully normalized

## Known limitations / open issues

- Some routes and UI areas still carry transitional patterns even though the main Back Office flows are already Prisma-backed
- After Prisma schema/client changes, the running Next dev server still needs an explicit restart or it may hold a stale Prisma Client in memory
- The active deployment is still a simple single-Droplet line with no staging environment and no object storage
- Background job infrastructure is not yet established, so some reminders/automation remain manual or request-time only
- External integrations remain intentionally absent:
  - MLS ingestion
  - external eSignature vendors
  - QuickBooks sync
  - ACH / payout processor execution
  - OCR or third-party document ingestion

## Update rule

When a major feature, baseline, or deployment truth changes:

1. update this file in the same task
2. update `docs/deployment.md` if runtime or environment truth changed
3. keep this log concise, operational, and current
