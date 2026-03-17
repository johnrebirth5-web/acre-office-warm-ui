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
- the unified user detail page currently acts as the operational profile hub with sections for:
  - profile basics
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
- team hierarchy now supports:
  - `Team Leader`
  - `Junior Team Leader`
  - `Member`
  - recursive child branches
  - explicit `reportsToTeamMembershipId`
  - direct `Team Leader -> Member`
  - nested `Team Leader -> Junior Team Leader -> Member`
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
