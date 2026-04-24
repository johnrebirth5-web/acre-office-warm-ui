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

## Front Office source of truth

When a task touches `Front Office`, `/agent` routes, FO roadmap, FO priority, or FO/BO handoff behavior, use:

- [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md)

as the canonical product source of truth.

This file is distilled from:

- `/Users/openclaw_john/Desktop/ACRE_Front_Office_PRD_03-30.docx.pdf`

Rules:

- If older repo docs, implementation notes, placeholder copy, or partial route behavior conflict with the current FO spec, follow `frontoffice-overview.md` for `Front Office` product decisions.
- Treat older FO descriptions in `README.md`, `docs/specs/implementation-log.md`, and current `/agent` placeholder pages as implementation-state references, not final product direction.
- Keep engineering, deployment, validation, security, and Git workflow rules in this file unchanged unless a task explicitly updates them.
- Keep the FO -> BO boundary explicit: `Front Office` leads agent execution, while `Back Office` remains the formal home for transactions, accounting, commissions, signatures, and archival workflows.

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
  - macOS local container runtime uses OrbStack (historically `colima`/Lima); do not assume `host.lima.internal` resolves
  - when local Docker dev uses the DO database tunnel, `scripts/docker-dev-keepalive.sh` should bind the SSH forward on `0.0.0.0:15432` so containers can reach it via `host.docker.internal:15432` (OrbStack / Docker Desktop); host-mode tools should still use `127.0.0.1:15432`
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
- [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md) for `Front Office` tasks
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

Exception for `Front Office` work:

- if the user is explicitly asking about `Front Office`, `/agent`, FO next steps, FO roadmap, or FO module priority, use [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md) as the priority guide instead of this section

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

- For Codex-authored repository changes, do not modify `main` directly. Treat `main` as the protected integration baseline and final merge target, not as a working branch.
- Before any task that will modify repo-tracked files, confirm the current branch and working tree state. If the current branch is not `main`, call that out before continuing instead of silently stacking new work onto an existing feature branch.
- For each new task, create a fresh `codex/<short-task-slug>` branch from the latest `origin/main` by default. Only continue on the current branch when the user explicitly asks to continue that branch, or when the task is clearly a temporary local experiment that does not need the standard workflow.
- For Codex-authored repository changes, finish the task with relevant validation, a local `git commit`, a push to `origin`, and a GitHub PR by default.
- Unless the user explicitly asks not to sync to GitHub in the current task, push the completed commit(s) to `origin`.
- Unless the user explicitly asks not to open a PR in the current task, create a GitHub PR for the completed task branch.
- If local commits already exist on `main`, preserve them by branching from the current `HEAD` first; do not rewrite or discard those commits just to satisfy the branch workflow.
- If branch protection behavior becomes relevant, inspect the live protection response before reasoning about merge requirements.
- Current `main` branch protection baseline for `johnrebirth5-web/acre-office-warm-ui` is:
  - pull requests are not required before merge
  - required status checks are not enabled
  - `enforce_admins = true`
- Treat that branch-protection block as the expected steady state, not as a timeless fact. Before merge work, protection changes, or any reasoning that depends on current GitHub policy, re-run:
  - `bash scripts/ops/verify-branch-protection.sh --repo johnrebirth5-web/acre-office-warm-ui --branch main`
  - if needed, confirm the live GitHub response with `gh api repos/johnrebirth5-web/acre-office-warm-ui/branches/main/protection`
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
2. If the task is about `Front Office` or `/agent`, read [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md) before relying on older repo descriptions.
3. Build a brief plan before coding.
4. Keep the plan aligned to the current repo state, while using the current FO spec as product direction when `Front Office` work is in scope.
5. If a prerequisite is missing, stop and report it instead of making partial hidden changes.

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

- [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md)
- [docs/specs/backoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/backoffice-overview.md)
- [docs/specs/implementation-log.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/implementation-log.md)
- module specs in [docs/specs](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs)
- [docs/deployment.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/deployment.md) for DigitalOcean production sync/runbook details
- [docs/ops/branch-protection.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/ops/branch-protection.md) for the expected GitHub `main` protection baseline; always re-check live GitHub settings before merges because cloud policy is mutable

## Opt-In multi-thread worktree workflow

Only activate this workflow when the user explicitly asks for it, for example:

- “按多线程 worktree 并发工作流执行”
- “拆成多个 worktree 线程并发做”
- “总控拆任务，子线程并发开发”
- “按 AGENTS.md 里的并发规则执行”

If the user does not explicitly ask for this workflow, keep using the normal single-thread workflow and the standard Git rules above.

### Purpose

This workflow is for larger implementation batches where one Local controller thread coordinates multiple Worktree child threads.

Core goals:

- keep child threads from editing the same files
- avoid direct concurrent work on `main` or the current target branch
- keep each parallel wave on a single frozen base commit
- let the controller thread own integration and validation

### Scope and precedence

When this workflow is explicitly activated:

- these rules apply in addition to the rest of this file
- Acre-specific product, deployment, validation, and Git constraints elsewhere in this file still take precedence over generic parallel-workflow guidance
- for that batch only, the controller thread may create and use an `integration/*` branch even though the default Git rule is to stay on the current branch
- outside that batch, revert to the normal Git workflow rules in this file

### First-use / legacy-area onboarding

This repo already has project-specific rules, but when this workflow is used for the first time on an older module or on a batch with unclear boundaries, the controller thread should treat it as a cautious onboarding pass instead of jumping straight to high parallelism.

Before the first large parallel batch in a legacy area, inspect and confirm:

- current package manager and dependency bootstrap command
- standard validation commands
- target branch conventions already in use for that area
- shared or high-risk files that would break parallel safety
- schema / migration / seed impact
- tracked codegen impact
- modules that still require serial ownership

Recommended first trial in a legacy area:

- start with only `2-3` child threads
- prefer a smaller batch to prove the workflow fits the real repo boundaries
- expand to more threads only after one wave integrates cleanly

### Acre project defaults for this workflow

Use these defaults unless the current task explicitly says otherwise:

- project type: Node.js monorepo
- package manager: `npm`
- deterministic dependency bootstrap: `npm ci`
- standard validation commands:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- extra validation when Prisma schema changes:
  - `npm run db:validate`
  - `npm run db:generate`
  - `npm run db:migrate -- --name <change_name>` when required
  - `npm run db:seed` only when the task explicitly requires seed verification
- default local app port remains `3105`
- host-mode local PostgreSQL access remains `127.0.0.1:5433`
- container-to-container PostgreSQL access remains `db:5432`

Do not rewrite this `AGENTS.md` for every batch. Batch-specific values such as target branch, `integration` branch name, wave base commit, assigned ports, and temporary database strategy should live in the controller prompt and child prompts for that batch.

### Roles

When this workflow is active, there are only two roles:

- controller thread:
  - runs in `Local`
  - reads the task, inspects the repo, defines boundaries, creates the integration branch, freezes each wave base commit, generates child prompts, merges finished child branches into integration, runs full validation, and finally merges back to the target branch
- child thread:
  - runs in its own `Worktree`
  - implements exactly one bounded subtask
  - must not merge, rebase, pull target updates, or integrate other child threads

If a prompt does not clearly identify the thread as the controller, treat it as a child thread.

### Controller-thread required startup sequence

When the user explicitly asks for this workflow, the controller thread must do the following in order:

1. inspect project scripts and constraints
2. identify whether the batch touches shared or high-risk files
3. determine the target branch explicitly
4. run `git fetch`
5. confirm `git status` is clean
6. create the integration branch from the clean target branch
7. split work into `2-5` subtasks by default
8. only exceed `5` subtasks when write boundaries are unusually clean, and never exceed `7`
9. assign clear allowed paths and forbidden paths for each child thread
10. freeze a single wave base commit before opening each parallel wave
11. wait for the whole wave to finish before freezing the next wave
12. merge child branches back into integration in dependency order
13. run full validation on integration after each wave
14. merge integration back into the target branch only after the full batch passes validation

### Target branch and integration branch

When this workflow starts:

1. the controller thread must determine the batch target branch
2. default target branch is the branch checked out at batch start, not automatically `main`
3. if the user explicitly says `main`, use `main`
4. if the repo is already on a feature branch, call that out and use that feature branch as the default target unless the user says otherwise

For the batch, create an integration branch from the clean target branch. Recommended naming:

- `integration/<target-branch>-<yyyymmdd>-<short-slug>`

Example:

- `integration/main-20260408-contacts-batch`

### Clean-start requirements

Before creating the integration branch, the controller thread must confirm:

- `git fetch` has been run
- `git status` is clean
- the target branch is explicit
- the user has not asked to avoid branch creation

If the working tree is dirty, do not start a new parallel batch until the state is clarified.

### Controller output contract

When the controller thread activates this workflow, it should produce the following sections in its user-facing plan.

Project environment block:

```text
- 项目类型：
- 包管理器：
- 依赖准备命令：
- 类型检查命令：
- Lint 命令：
- 测试命令：
- 构建命令：
- 其他只读初始化命令：
- 当前 integration 分支：
- 运行态约束：
```

Rules:

- if an item does not exist, write `无`
- prefer existing repo scripts over improvised commands
- only include stable, repeatable commands
- do not hide tracked-file mutations inside “只读初始化命令”

Setup script guidance:

- if Local Environment is needed, provide a deterministic setup script that only prepares dependencies and read-only bootstrap work
- if no setup script is needed, explicitly say `无需配置 Local Environment`

Runtime strategy:

- say whether child threads are allowed to run dev servers
- if live verification is needed, assign ports centrally
- if schema / migration / seed is involved, explain database isolation
- call out any external services that must remain controller-owned

Subtask table:

```text
### 子任务 [编号]：[任务名]
- 类型：基础任务 / 独立任务
- 波次：第 N 波
- 目标：
- 允许修改的路径：
  - ...
- 禁止修改的路径：
  - ...
- 依赖：
- 完成标准：
  - ...
- 验证命令：
  - ...
```

Wave sequencing:

- identify which tasks belong to wave 1
- mark which tasks are serial foundation tasks
- include the current wave base commit
- state that only the controller merges back into `integration`
- state that the next wave must wait for integration + validation

Child prompt requirements:

- one ready-to-paste prompt per child thread
- each prompt must say the thread is a child thread
- include the unique goal, allowed paths, forbidden paths, integration branch, wave base commit, runtime constraints, completion standard, validation requirements, and the rule that the child may only `commit + push` its own branch

Controller closeout instructions:

- explain how finished child branches are merged back into `integration`
- explain which full validation commands run on `integration`
- explain that the next wave requires a freshly frozen base commit
- explain that only a fully validated batch can merge back to the target branch

### Child-thread hard rules

Every child thread must follow all of these rules:

- use its own `Worktree`
- use the current batch `integration/*` branch as the worktree base branch
- use the exact wave base commit assigned by the controller thread
- only modify files inside the allowed path set from its prompt
- stop immediately if it needs to change files outside that path set
- commit and push only its own task branch
- never merge, rebase, or pull updates from `main`, the target branch, `integration`, or any sibling branch
- do not install or remove dependencies unless the controller explicitly assigned that shared ownership
- do not adjust ports, database targets, or external service settings unless the controller explicitly assigned them

### Boundary-conflict stop condition

If a child thread discovers any of the following, it must stop immediately and report instead of continuing:

- it needs to edit a shared or high-risk file
- it needs to install a new dependency
- it needs to change shared types or shared interfaces outside its allowed scope
- it needs to change files outside the allowed path set
- the current worktree base does not match the assigned wave base commit
- runtime constraints are missing or ambiguous

Use this exact compact report format:

```text
⚠️ 边界冲突
- 冲突类型：
- 具体文件或资源：
- 原因：
- 建议：
```

Before receiving new instructions, do not continue implementation after such a report.

### Shared or high-risk files

Treat the following as shared or high-risk by default. Child threads must not touch them unless the controller thread explicitly assigns single-owner responsibility for that file group in the prompt:

- `package.json`
- `package-lock.json`
- `turbo.json`
- root TypeScript and build config files
- `.env*`
- `apps/web/app/globals.css`
- shared UI exports and shared barrel files
- shared type definition files
- `packages/db/prisma/schema.prisma`
- Prisma migrations and seed-related files
- tracked generated files
- CI/CD and deployment scripts

If a task needs any of the above:

- either turn it into an earlier serial foundation task
- or assign one explicit owner thread and make downstream tasks depend on it

### Setup script and environment bootstrapping

If the user wants to use Local Environment for child worktrees:

- prefer `npm ci`
- keep the setup script deterministic
- do not include commands that modify tracked files
- do not hide foundation work inside the setup script

For this repo, `npm ci` is the default dependency bootstrap. Only add extra setup commands when the batch clearly needs them.

If an initialization command would write back to tracked files, it is not setup-script material. Treat it as a serial foundation task owned by the controller or by one explicitly assigned owner thread.

### Validation rules for this repo

Controller thread full-batch validation on `integration` should normally run:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`

When Prisma schema changes are involved, also run:

1. `npm run db:validate`
2. `npm run db:generate`

Child threads should run the smallest validation set that still proves their work, but must report exactly what they ran and what passed or failed.

### Runtime isolation rules

Worktrees isolate code, not runtime state. When this workflow is active:

- child threads should not start `npm run dev` by default
- if live runtime verification is needed, the controller thread must assign unique ports
- do not let multiple child threads share a drifting local database when schema changes are in flight
- if a batch changes Prisma schema or migrations, finish and integrate that foundation work before opening dependent child threads
- when host-mode DB access is needed, prefer `127.0.0.1:5433`
- when Docker inter-container access is needed, prefer `db:5432`

### Wave-based execution model

A batch should run in waves, not as an uncontrolled pile of threads.

For each wave:

1. controller thread checks out the integration branch
2. controller thread records `git rev-parse HEAD` as the wave base commit
3. every child thread in that wave must start from that same base commit
4. no next-wave thread should be opened until the current wave is integrated and validated

If a new task appears mid-wave and cannot use the same base commit cleanly, defer it to the next wave.

### Final integration rules

Only the controller thread may perform final integration.

After each wave, the controller thread should:

1. merge finished child branches back into `integration` in dependency order
2. run full validation on `integration`
3. record the next wave base commit only after validation passes
4. open the next wave only after the prior wave is integrated and validated

Only merge `integration` back to the target branch when:

- all planned waves are complete
- required validation has passed
- known risks have been surfaced clearly

### Reporting contract

Each child thread must finish with a compact report containing:

- branch name
- integration branch
- base commit
- latest commit hash and message
- changed files
- validation commands run and results
- known risks
- integration notes

Recommended child-thread completion format:

```text
✅ 任务完成报告
- 分支名：
- integration 分支：
- wave base commit：
- 最新 commit：
- 改动文件列表：
  - ...
- 验证结果：
  - [命令]：[通过/失败]
- 已知风险：
- 集成注意事项：
```

The controller thread should then summarize:

- what merged cleanly
- what conflicts or risks remain
- what validation ran on integration
- whether the batch is ready to merge back to the target branch

### Recommended trigger phrase

If the user wants this workflow, interpret a short instruction like the following as sufficient:

“按 AGENTS.md 里的多线程 worktree 并发工作流执行这次任务：先由总控线程识别项目环境、确认目标主线、创建 integration 分支并冻结当前波次的 base commit，再拆成 2-5 个写入边界不重叠的子任务，让每个子线程用独立 worktree 开发，最后由总控统一集成和验证。”
