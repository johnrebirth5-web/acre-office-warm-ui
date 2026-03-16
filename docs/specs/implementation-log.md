# Back Office Implementation Log

## Current milestone

- `Back Office MVP+` on one active repo/deployment line
- Core operational modules already exist as real product surfaces, not just placeholder navigation
- Current priority is cleanup, normalization, and workflow hardening instead of blindly adding more modules

## Recently completed major work

- The working baseline is now centered on:
  - local repo `/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean`
  - GitHub remote `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
  - DigitalOcean default entry `http://45.55.247.137:3105/`
- `Office / Back Office` now has real route and workflow foundations across the main product map:
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
- Transaction detail now acts as a real workflow hub for contacts, finance, tasks/compliance, documents/forms/eSignature/incoming updates, offers, and commissions
- Shared `@acre/ui` and the Office design system are now the canonical UI layer for Back Office pages, with `/office/transactions` as the list-page composition reference

## Current default baseline

- Product priority: `Back Office`, not the public site
- Local source of truth: `/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean`
- Default Git remote: `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- Default deployment line: `DigitalOcean :3105`
- Default public entry: `http://45.55.247.137:3105/`
- Default login entry: `http://45.55.247.137:3105/login`
- Default production runtime:
  - service `acre-ui-rebuild-web.service`
  - WorkingDirectory `/opt/acre-ui-rebuild/app`
  - env `/etc/acre/acre-ui-rebuild.env`
  - nginx `/etc/nginx/sites-available/acre-ui-rebuild.conf`
  - upstream `127.0.0.1:3206`
- `GitHub` sync and `DigitalOcean` deployment are separate actions
- For deployment truth, `docs/deployment.md` is the canonical reference and runtime truth comes from systemd `ExecStart` plus the active nginx upstream

## Next recommended work

- Continue product and system cleanup before adding more large modules
- Remove remaining mixed legacy assumptions from docs, specs, and operational notes
- Tighten permissions, audit coverage, admin-managed configuration, and workflow state fidelity in existing modules
- Keep filling practical module specs so future Codex runs can rely on repo docs instead of chat history
- Plan future storage, job-runner, and integration upgrades only after the current single-Droplet baseline is fully normalized

## Known limitations / open issues

- Some routes and UI areas still carry transitional patterns even though the main Back Office flows are already Prisma-backed
- The active deployment is still a simple single-Droplet line with no staging environment, no HTTPS, and no object storage
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
