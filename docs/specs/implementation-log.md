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
  - `Settings > Fields` is now the single field-structure admin surface
  - first centralized modules are `transaction / contact / offer`
  - built-in fields can be sorted, marked visible/hidden, and required/optional
  - built-in `Type / Status / Representing` dropdowns still support office-admin option enable/disable and display-name overrides without changing stored enum values
  - `office_admin` can add custom `text / select / date` fields per module
  - hidden address groups still force `Transaction Name` visible + required
  - contact and offer custom values now persist in `Client.additionalFields` and `Offer.additionalFields`
  - create-mode intake now routes legacy finance-style fields like `Commission($) / Rebate / Referral Fee / Reimbursement / Note` through a structured finance section so new transactions write real `grossCommission`, fee-ledger rows, and finance notes instead of disconnected text-only values
  - field-structure changes write to `Activity Log`
- Shared `@acre/ui` and the Office design system are now the canonical UI layer for Back Office pages, with `/office/transactions` as the list-page composition reference
- Destructive Back Office actions now use a shared confirmation dialog before delete/remove/unlink-style execution, replacing one-click deletes and ad-hoc `window.confirm` prompts
- `/office/transactions` and `/office/contacts` now share one canonical Office list-page template, including the same page header, summary/action block, workbench card, table card, and footer/pagination rhythm

## Current default baseline

- Product priority: `Back Office`, not the public site
- Local source of truth: `/Users/openclaw_john/工作文件夹/Acre_latest_clean`
- Default local browser entry: `http://localhost:3105/`
- Root `npm run dev` is now expected to bind `@acre/web` to `3105` by default
- Local development now defaults `@acre/web` to `next dev --webpack` instead of Turbopack to avoid recurring false `Module not found` errors when Docker bind mounts add or rename files under `app/`
- Local Docker development is now a supported long-running baseline:
  - `npm run docker:dev:up` starts `web + db`
  - the `web` container bind-mounts the local repo, so Docker uses the same source tree instead of a second copied checkout
  - Docker volumes persist PostgreSQL data, `node_modules`, Next cache, and local document storage
  - local Docker runtime currently uses `colima` on macOS
  - seeing the bottom-left `N` dev tools badge locally is expected while the app runs under `next dev`, even inside Docker
- `/login` should never prefill demo credentials, but now keeps standard username/password autofill semantics so browsers can save and reuse the real login
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
- Added recursive team hierarchy support so local and deployed databases upgrade legacy `lead / leader_i / leader_ii` memberships into `team_leader / junior_team_leader`, add `Team.parentTeamId`, and keep descendant-scope access working across `/office/settings/users`, `/office/transactions`, and `/office/reports`
- Back Office account access is now tiered as `owner / office_admin / accountant / human_resources / team_lead / agent`, with server-side scope enforcement and finance redaction applied to dashboard, transactions, reports, exports, and agent views
- Team hierarchy is now modeled explicitly with `TeamMembership.role + reportsToTeamMembershipId`, and the repo includes a one-off provisioning script for the initial `acreny.us` account batch plus invite-link output
- `Settings > Teams` now shows inherited parent-branch managers for leader rows and flags invalid root/child branch leader-role mismatches instead of silently displaying the first allowed option
- Team labels and branch summaries now treat branch ownership consistently:
  - assignable team dropdowns always render `Team path · Leader: ...` and show `Leader: Unassigned` when a branch exists without an active owner
  - only leader roles that match the current team shape count as branch owners, so invalid root/child mismatches no longer appear in branch-owner summaries or manager pickers
  - `Settings > Teams` now makes `Root team / Child branch / Branch owner` status explicit so an empty child branch is distinguishable from an invalid leader assignment on the parent team
- `Settings > Teams` now defaults to a directory-style hierarchy browser:
  - the landing page shows top-level Team cards only, with leader, direct-agent, and Junior Team summaries
  - opening `/office/settings/teams/[teamId]` shows Junior Team cards first and the selected Team's direct agents below, so Team and Junior Team structure no longer compete on the same page
  - the previous dense all-team editor remains available as an advanced manage view for deeper admin cleanup
- Team admin now treats hierarchy ownership as a required binding instead of optional copy:
  - current product language uses `Team / Junior Team / Team Leader / Junior Team Leader`
  - creating a Team or Junior Team requires selecting its owner in the same flow
  - the current owner cannot be removed or demoted without first transferring ownership
  - promoting another member into the owner role now transfers leadership instead of forcing admins through a temporary ownerless state
  - legacy `Junior Team Leader` assignments that were still sitting inside the parent Team now auto-create a leader-named Junior Team and move that leader plus direct reports into the correct child structure
  - the current Back Office UI intentionally opens only two levels today while the underlying recursive team model remains in place for future expansion
- Office table column widths can now be resized and saved at the organization level by `owner / office_admin`, with the shared layout applied across list/workspace tables for every user in the same org
- Commission V2 now uses membership-level default split settings plus reporting-line chain calculation:
  - new `CommissionSplitTemplate` + `MembershipCommissionSetting` models
  - create-user and profile editing now write structured default commission values
  - transaction commission defaults lock to `Transaction.createdAt`
  - accounting commission page now leads with split templates / member defaults and keeps legacy plan tools under advanced settings
  - team assignments now block multiple active reporting lines for one membership inside the same organization
  - saving `Finance > Gross commission` on transaction detail now auto-triggers commission recalculation when the current role can calculate commissions
- Agent profile team assignment now shows leader names inside team options and allows choosing the direct manager during the initial `Add to team` action, so admins can place agents directly under the right branch lead without a second pass in `Settings > Teams`
- Team hierarchy and commission chain derivation now honor explicit `reportsToTeamMembershipId` links even for leader roles, so same-branch `junior_team_leader -> team_leader` reporting lines propagate correctly into multi-level commission splits
- Transaction and accounting commission tables now show each row's actual effective share in the `Plan` column detail instead of repeating the owner's default split label for every recipient
- `New transaction` owner assignment now treats the `Agent Name` field as the real owner control:
  - sales roles can only create transactions for themselves and see a locked self owner label
  - admin/company-scope roles can search active agents or team leads by name and assign ownership before create
- Commission self-service visibility is now aligned to sales hierarchy expectations:
  - `agent` always keeps self commission visibility
  - `team_lead` always keeps self + downline commission visibility
  - `/office/dashboard` now shows the self-service commission summary only for sales roles, so admins and non-sales office roles do not get a redundant `My commissions` card on their dashboard
  - the dashboard keeps the current month expanded while older commission months now live inside a collapsible history block to save vertical space
  - `/office/transactions/[transactionId]` now respects scoped commission visibility even when older org role templates are missing the newer commission view keys
  - commission plan management and statement-generation surfaces stay restricted to admin/review roles instead of piggybacking on the new self-service visibility baseline
  - backend now enforces the same rule and persists `additionalFields.agentName` from the actual selected owner instead of arbitrary free text
- `Settings > Fields` custom field editor now supports `Protected from deletion`, and the transaction `Agent Name` field is hard-protected so admins must hide it instead of deleting the owner-linked schema row
- Transaction intake now retires the legacy `Team Leader` custom field from both `New Transaction` and `Settings > Fields`; team hierarchy should come only from membership/team assignment, not from a second dropdown on the transaction form
- Transaction owner selection for `New Transaction` now treats `invited` sales memberships the same as `active` ones, so admins can create transactions for agents/team leads who never log into the system themselves
- `New Transaction > Agent Name` owner search now sources assignable owners from office/global sales memberships instead of the viewer's current transaction roster visibility, so admins can still find unassigned or not-yet-rostered agents and company-level members with `officeId = null`
- `Create user` now supports immediate operational placement:
  - admins with team permissions can assign a new sales user into a top-level team or junior branch during invitation
  - the same create flow can optionally set the user's direct manager from current branch leaders
  - the unified user detail page continues to support later team reassignment or removal without a separate agent-only route
- `Settings > Users > [membership]` now keeps the `Teams` card available for admins with `teams:manage` even when the target member has no current branch visibility through the agent roster yet:
  - assignable team options come from the current office team-management scope instead of the viewer's agent roster visibility
  - members with `officeId = null` can still be assigned to the current office's teams from the user detail page

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
