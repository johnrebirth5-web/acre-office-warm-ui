# Acre Repository Guide

## Project identity

This repository is the `Acre` monorepo. It currently powers the internal `Acre Agent OS` / `Back Office` product for brokerage operations, not the public customer-facing site.

Primary scope today:

- `Office / Back Office` workflow modeled after `BoldTrail / Brokermint`
- transaction management
- contacts
- tasks / approvals / compliance
- activity log
- accounting / agent billing / commissions
- documents / forms / eSignature / incoming updates
- offers
- settings / admin
- agent management / onboarding

## Canonical working baseline

Use this baseline unless the current task explicitly says otherwise:

- local source of truth: `/Users/openclaw_john/工作文件夹/Acre_latest_clean`
- default local browser entry: `http://localhost:3105/`
- root `npm run dev` must bring up `@acre/web` on port `3105` unless the current task explicitly overrides `PORT`
- local Docker dev baseline is supported and preferred when the user wants a longer-running local environment:
  - `npm run docker:dev:up` starts `web + db`
  - the `web` container bind-mounts `/Users/openclaw_john/工作文件夹/Acre_latest_clean` into `/app`, so Docker uses the same working tree instead of a second copied checkout
  - the local Docker `db` container keeps PostgreSQL on container port `5432`, but publishes to host port `5433`; host-mode `.env.local` / Prisma commands should use `127.0.0.1:5433`, while container-to-container access stays on `db:5432`
  - `/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean` is a stale partial directory and must not be treated as the active repo or Docker source of truth
  - PostgreSQL data, `node_modules`, Next cache, and local documents live in Docker volumes
  - macOS local container runtime may use `colima`
  - when local Docker runs `next dev`, the bottom-left `N` Next.js dev tools badge is expected and does not mean the app is running outside Docker
- default GitHub remote target: `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- default public entry: `https://acresystem.us/`
- default public login entry: `https://acresystem.us/login`
- direct DigitalOcean fallback entry: `http://45.55.247.137:3105/`
- default production app root: `/opt/acre-ui-rebuild/app`
- default production env file: `/etc/acre/acre-ui-rebuild.env`
- default production service: `acre-ui-rebuild-web.service`
- old `acre-web`, old `/opt/acre/app`, and `http://45.55.247.137/` are legacy-only references and must not be treated as the default target

## Architecture summary

- `apps/web`: Next.js App Router application
- `packages/auth`: roles and permissions
- `packages/db`: Prisma schema, seed, and database services
- `packages/ui`: shared Back Office UI primitives
- `packages/backoffice`: remaining mock/domain snapshot layer where not yet fully replaced

Current implementation reality:

- large parts of `Office` are now Prisma-backed
- some legacy UI still reads transitional view models
- do not assume all routes are fully production-complete
- prefer extending existing foundations over introducing parallel systems

Start with these docs before large work:

- [README.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/README.md)
- [docs/architecture.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/architecture.md)
- [docs/decisions.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/decisions.md)
- [docs/office-design-system.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/office-design-system.md)
- [docs/deployment.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/deployment.md)
- relevant files under [docs/specs](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs)

## Current product priority

Current repo priority is the `Back Office` product line. Favor:

- stronger operational workflows
- explicit workflow state
- auditable changes
- admin-managed configuration
- alignment with current `BoldTrail / Brokermint` workflows

Do not spend effort on speculative public-site features unless the task explicitly asks for them.

## Language / Communication

- Default to Chinese when communicating with the user in this workspace, including explanations, plans, progress updates, final summaries, and general collaboration.
- If the user explicitly requests English or another language, switch to that language for the current task or thread.
- Do not force-translate code symbols, file paths, terminal commands, API names, library names, permission keys, table names, or interface names when keeping the original wording avoids ambiguity.

## Engineering rules

- Reuse `@acre/ui` shared primitives before adding page-specific visual patterns.
- Reuse `@acre/db` services before writing page-level data logic.
- Keep organization and office scoping explicit in reads and writes.
- Keep permissions explicit in `@acre/auth`.
- Prefer explicit Prisma models over opaque JSON for workflow/stateful data.
- Extend existing modules; do not create competing systems for tasks, accounting, offers, documents, commissions, or agent management.
- Keep activity/audit behavior integrated with the existing `Activity Log` instead of inventing separate event stores.
- Do not redesign unrelated modules during feature work.
- Keep URL/query-param behavior stable when the page already uses it.

## Scoping rules

- Prefer incremental changes over module rewrites.
- Do not fake external integrations that do not exist.
- Do not claim “paid”, “signed”, “synced”, or “received” unless the system truly records that state.
- For workflow-heavy features, keep statuses explicit and reviewable.
- Preserve backward compatibility when a temporary bridge still exists, such as transitional transaction finance or primary contact fields.

## Validation commands

Run from repo root:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

If Prisma schema changed, also run:

- `npm run db:validate`
- `npm run db:generate`
- `npm run db:migrate -- --name <change_name>` when needed
- `npm run db:seed` when the task requires seed verification
- `npm run dev` now auto-runs `db:generate` before booting the web app and auto-restarts the Next dev server when `packages/db/prisma/schema.prisma` changes
- if browser/runtime errors still mention Prisma validation after a schema change, first suspect a long-running nonstandard process or container that has not picked up the regenerated Prisma Client yet
- keep `/login` visually empty on first render: no prefilled demo credentials, no hardcoded default email/password values, and resist localhost browser autofill where practical
- `/login` is email + password only; do not reintroduce username-oriented copy or sample values like `admin`

## Git workflow rules

- For Codex-authored repository changes, finish the task with a local `git commit`.
- Unless the user explicitly asks not to sync to GitHub in the current task, push the completed commit(s) to `origin`.
- Unless the user explicitly asks for a separate feature branch or PR, stay on the currently checked out branch and commit/push there directly; do not auto-create a `codex/*` branch for this workspace.
- If the repo is already on a feature branch from earlier work, call that out before continuing instead of silently stacking new tasks onto it.
- Keep `origin` pointed at `https://github.com/johnrebirth5-web/acre-office-warm-ui.git` unless the task explicitly requires a different remote.
- Treat GitHub push and DigitalOcean deployment as separate steps.
- Even when GitHub push is required, do not deploy or run production commands unless the user explicitly asks for deployment.
- Do not run `vercel`, do not trigger Vercel deployments or redeploys, and do not use Vercel as a delivery target in Codex tasks.
- If historical Vercel integrations still exist, treat them as legacy-only; they are not the default delivery path for this workspace.

## Documentation rules

When major features, routes, permissions, schema, environment variables, or Back Office UI behavior change, update the relevant docs in the same task:

- [README.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/README.md)
- [docs/architecture.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/architecture.md)
- [docs/decisions.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/decisions.md)
- [docs/deployment.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/deployment.md)
- [docs/env.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/env.md)
- [docs/office-design-system.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/office-design-system.md)
- relevant module spec files under [docs/specs](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs)

## Planning rules

For large or multi-module tasks:

1. Read the relevant `docs/specs/*.md` files first.
2. Build a brief plan before coding.
3. Keep the plan aligned to the current repo state, not an imagined future rewrite.
4. If a prerequisite is missing, stop and report it instead of making partial hidden changes.

For deployment or production-sync work:

0. Do not deploy, sync to Vercel or DigitalOcean, or run production commands unless the user explicitly asks for deployment in the current task.
1. Read [docs/deployment.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/deployment.md) first.
2. Follow the documented `:3105` server paths, service names, and sync flow exactly.
3. Do not guess production hostnames, process managers, or environment file locations.
4. Do not commit secrets, passwords, tokens, SSH private keys, or server-only env files.
5. Do not assume `/opt/acre-ui-rebuild/app` is a git checkout; the current deployment flow is temporary checkout/build, then sync into the live directory, then restart `acre-ui-rebuild-web.service`.
6. Prefer `npm run deploy:digitalocean` from repo root for this workspace instead of reconstructing the remote sync procedure manually.

## Back Office UI rules

- Follow the shared design system in [docs/office-design-system.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/office-design-system.md).
- Keep the UI dense, operational, and desktop-first.
- Use shared tokens and primitives from:
  - [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css)
  - [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/packages/ui/src/index.tsx)
- Treat `/office/transactions` as the canonical list-page composition reference for peer Office list pages. Reuse its page-header, summary, filter-card, table-card, and footer rhythm instead of inventing page-local list shells.
- Treat `@acre/ui` + `office-*` styles as the canonical Office system. When touching older `bm-*` surfaces, migrate or normalize them toward that system instead of extending `bm-*` as a parallel visual language.
- Prefer shared heading, button, card, badge, table, and detail-field patterns over page-local styling. If a visual pattern appears twice, it should usually move toward a shared primitive or canonical class.
- `QueueItem` is now the canonical compact operational list row for small Back Office / Front Office side lists. Do not introduce new `office-note-item` usage for live pages.
- `office-note-item` is deprecated as a live-page pattern. If a task touches a page that still uses it, migrate the touched list block to `office-queue-list + QueueItem` unless a documented blocker prevents it.
- `bm-*` classes are legacy-only compatibility hooks. Do not introduce new `bm-*` markup, and when touching existing `bm-*` surfaces, prefer migrating the touched shell or list block toward `office-*` / `@acre/ui` primitives in the same task.
- For responsive behavior:
  - prefer horizontal table overflow over squeezed columns
  - make filter/action bars wrap instead of compressing
  - stack split-pane layouts at documented breakpoints
  - avoid page-only hacks when a shared solution is possible

## Output and hand-off rules

At task completion, clearly report:

1. what changed
2. which files changed
3. whether schema or env changed
4. which commands were run and whether they passed
5. remaining limitations or follow-up work

Do not say a feature is complete unless:

- implementation is done
- required validation has passed
- blockers are either resolved or explicitly called out

## Stable long-context files

Future Codex tasks should rely on these stable project files instead of chat history:

- [docs/specs/backoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/backoffice-overview.md)
- [docs/specs/implementation-log.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/implementation-log.md)
- module specs in [docs/specs](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs)
- [docs/deployment.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/deployment.md) for DigitalOcean production sync/runbook details
