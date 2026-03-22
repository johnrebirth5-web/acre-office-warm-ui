# Agent Management Spec

## Goal

Provide a real Back Office agent management workspace for office operations, covering roster visibility, profile hub behavior, onboarding, goals, teams, and agent-facing operational context pulled from existing modules.

## Current implemented foundation

- `Agent Management` now survives primarily as underlying domain foundation plus legacy redirect routes
- canonical routes now live under:
  - `/office/settings/users?view=operations`
  - `/office/settings/users/[membershipId]`
- legacy routes:
  - `/office/agents`
  - `/office/agents/[membershipId]`
  - both redirect into the unified `Users` workspace
- operational roster view currently supports management-oriented visibility for:
  - office
  - role
  - team
  - onboarding status
  - task / transaction / billing / goal progress summaries
  - read-only roster/profile loading must remain side-effect free; legacy team normalization belongs to explicit admin writes or one-off backfills, not page opens
- the unified user detail page currently acts as the operational profile hub with sections for:
  - profile basics
  - default commission
  - office / role
  - teams
  - onboarding
  - goals
  - recent transactions
  - active tasks / upcoming workload
  - billing / commission summary
  - recent activity items
- current model foundation includes:
  - `AgentProfile`
  - `Team`
  - `TeamMembership`
  - `MembershipCommissionSetting`
  - `AgentOnboardingItem`
  - `AgentOnboardingTemplateItem`
  - `AgentGoal`
- onboarding currently supports:
  - explicit checklist items
  - due dates
  - complete / reopen
  - default template application
- goals currently support:
  - monthly / quarterly / annual periods
  - transaction count
  - closed volume
  - office net
  - agent net targets
- current profile summaries reuse real data from:
  - transactions
  - tasks
  - accounting / billing
  - activity log
- `Settings > Teams` now separates hierarchy browsing into:
  - a top-level Team directory for root-team summaries
  - a Team detail page for Junior Team cards first, then direct agents assigned to the selected Team
- team hierarchy now supports:
  - `Team Leader`
  - `Junior Team Leader`
  - `Member`
  - recursive child branches in the underlying data model
  - current Back Office admin flow intentionally opens only `Team -> Junior Team` to keep the product hierarchy readable today while leaving future depth available
  - explicit `reportsToTeamMembershipId`
  - direct `Team Leader -> Member`
  - nested `Team Leader -> Junior Team Leader -> Member`
  - branch-owner summaries and team-assignment dropdowns now only count leader roles that match the current branch shape
  - creating a `Team` or `Junior Team` now requires picking the corresponding owner up front
  - promoting another member to the owner role transfers leadership instead of leaving the team without an owner
  - legacy `Junior Team Leader` records that still sit directly in the parent Team are now auto-normalized into a real Junior Team named after that leader, with direct reports moved into the same child team
  - that legacy normalization now runs only from explicit management actions instead of from roster/profile read paths
  - legacy ownerless child branches can still surface as `Leader: Unassigned` until they are cleaned up, but normal admin creation paths no longer create new empty branches
- the operational profile now edits default commission via:
  - reusable split template selection
  - custom agent percentage
  - effective-from date
- access-side onboarding now also supports assigning operational team placement during create-user:
  - admins can place a new sales user directly into a top-level team or junior branch at invitation time
  - create-user can optionally set the direct manager based on the selected branch's current leaders
  - the same unified user detail page continues to allow later reassignment to a different team / branch or manager
- one membership can now belong to only one active team / reporting line per organization
- roster/profile/reporting visibility is now resolved server-side from:
  - broad membership role
  - active team memberships
  - reporting-line descendants
  - explicit collaborator transaction links where relevant

## Current gaps

- this is not a full `Recruit` product
- there is no candidate pipeline or recruiting campaign layer
- there is no advanced coaching / performance review workflow
- onboarding templates are practical defaults, not a full template center with advanced assignment logic
- agent self-view is still not a fully developed separate product surface, but current pages now apply server-side scope and financial redaction by viewer tier
- goal progress is grounded in real data, but not yet a full analytics/performance suite

## Future direction

- strengthen onboarding template management and assignment rules
- deepen manager-facing progress and performance visibility
- add more team-level rollups where operationally useful
- optionally introduce a safer self-view mode for agents without turning this into a second portal
- keep the module operational and brokerage-focused rather than expanding into a generic HR or recruiting product
- keep commission editing tied to the same membership/team hierarchy instead of inventing a second parallel org chart
