"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  FormField,
  ListPageFilters,
  ListPageFooter,
  ListPageSection,
  ListPageStack,
  ListPageTableSection,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";

type OfficeAgentsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageAgents: boolean;
  canManageOnboarding: boolean;
  canManageGoals: boolean;
  canManageTeams: boolean;
};

const onboardingStatusOptions = [
  { value: "", label: "All onboarding states" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" }
] as const;

const membershipStatusOptions = [
  { value: "", label: "All member states" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
] as const;

function getMembershipTone(value: OfficeAgentsRosterSnapshot["rows"][number]["membershipStatusValue"]) {
  if (value === "active") {
    return "success" as const;
  }

  if (value === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getOnboardingTone(value: string) {
  if (value === "Complete") {
    return "success" as const;
  }

  if (value === "In progress") {
    return "accent" as const;
  }

  return "warning" as const;
}

export function OfficeAgentsClient({
  snapshot,
  canManageAgents,
  canManageOnboarding,
  canManageGoals,
  canManageTeams
}: OfficeAgentsClientProps) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const hasActiveRosterFilters = Boolean(
    snapshot.filters.q ||
      snapshot.filters.officeId ||
      snapshot.filters.role ||
      snapshot.filters.teamId ||
      snapshot.filters.onboardingStatus ||
      snapshot.filters.membershipStatus
  );

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teamName.trim()) {
      setTeamError("Team name is required.");
      return;
    }

    setPendingAction("create-team");
    setTeamError("");

    try {
      const response = await fetch("/api/office/agents/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: teamName })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create team.");
      }

      setTeamName("");
      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Failed to create team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTeam(teamId: string, formData: FormData) {
    setPendingAction(`save-team:${teamId}`);
    setTeamError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          isActive: formData.get("isActive") === "true"
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update team.");
      }

      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Failed to update team.");
    } finally {
      setPendingAction(null);
    }
  }

  const rosterFilters = (
    <ListPageFilters as="form" className="office-agents-toolbar" method="get">
      <FilterField className="office-agents-search-field" label="Search">
        <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="Search name, email, title, or team" type="search" />
      </FilterField>
      <FilterField className="office-agents-filter-field" label="Office">
        <SelectInput defaultValue={snapshot.filters.officeId} name="officeId">
          <option value="">All offices</option>
          {snapshot.filters.officeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="Role">
        <SelectInput defaultValue={snapshot.filters.role} name="role">
          <option value="">All roles</option>
          {snapshot.filters.roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="Team">
        <SelectInput defaultValue={snapshot.filters.teamId} name="teamId">
          <option value="">All teams</option>
          {snapshot.filters.teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="Onboarding">
        <SelectInput defaultValue={snapshot.filters.onboardingStatus} name="onboardingStatus">
          {onboardingStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-membership-field" label="Membership">
        <SelectInput defaultValue={snapshot.filters.membershipStatus} name="membershipStatus">
          {membershipStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <div className="office-filter-actions office-agents-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Link className="office-button-secondary" href="/office/agents">
          Reset
        </Link>
      </div>
    </ListPageFilters>
  );

  const rosterFooter = (
    <ListPageFooter
      controls={
        hasActiveRosterFilters ? (
          <Link className="office-list-page-button" href="/office/agents">
            Clear filters
          </Link>
        ) : null
      }
      summary={`${snapshot.rows.length} roster rows in the current scope`}
    />
  );

  const teamsFooter = <ListPageFooter summary={`${snapshot.teams.length} visible teams in the current office scope`} />;

  return (
    <ListPageStack className="office-agents-layout">
      <ListPageTableSection filters={rosterFilters} footer={rosterFooter} subtitle="Search and filter the current office roster without leaving the back-office workflow." title="Agent roster">
        {snapshot.rows.length ? (
          <DataTable className="office-table office-agents-roster-table">
            <DataTableHeader className="office-agents-roster-head">
              <span>Agent</span>
              <span>Office</span>
              <span>Role</span>
              <span>Team</span>
              <span>Membership</span>
              <span>Onboarding</span>
              <span className="office-agents-roster-head-metric">Workload</span>
              <span className="office-agents-roster-head-metric">Transactions</span>
              <span className="office-agents-roster-head-metric">Goals</span>
              <span className="office-agents-roster-head-metric">Billing</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.rows.map((row) => (
                <Link className="office-data-table-row office-agents-roster-row" href={row.href} key={row.membershipId} role="row">
                  <span className="office-data-table-row-main office-agents-roster-stack office-agents-roster-primary">
                    <strong>{row.name}</strong>
                    <small>{row.email}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.officeName}</span>
                  <span className="office-agents-roster-stack">
                    <strong>{row.role}</strong>
                    <small>{row.title}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.teamLabel}</span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getMembershipTone(row.membershipStatusValue)}>{row.membershipStatus}</StatusBadge>
                    <small>{row.membershipStatusValue === "active" ? "In roster" : "Needs review"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getOnboardingTone(row.onboardingStatus)}>{row.onboardingStatus}</StatusBadge>
                    <small>{row.onboardingProgressLabel}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.activeTasksCount} active</strong>
                    <small>{row.activeTasksCount === 0 ? "No open workload" : "Tasks currently assigned"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.transactionSummaryLabel}</strong>
                    <small>{row.openTransactionCount} open pipeline</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.goalProgressSummary}</strong>
                    <small>{row.recentClosedTransactionCount} closed in 90d</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.billingBalanceLabel}</strong>
                    <small>{row.billingSummaryLabel}</small>
                  </span>
                </Link>
              ))}
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyState
            description="Try relaxing the current office, team, onboarding, or membership filters."
            title="No agents matched the current roster filters"
          />
        )}
      </ListPageTableSection>

      <ListPageTableSection
        actions={<StatusBadge tone="neutral">{snapshot.teams.length} total teams</StatusBadge>}
        footer={teamsFooter}
        subtitle="Quick inventory of teams, membership, active work, and status across the current office scope."
        title="Teams overview"
      >
        <div className="office-agents-team-inventory">
          <DataTable className="office-table office-agents-team-table">
            <DataTableHeader className="office-agents-team-table-head">
              <span>Team</span>
              <span>Members</span>
              <span>Open tasks</span>
              <span>Open transactions</span>
              <span>Status</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.teams.map((team) => (
                <DataTableRow className="office-agents-team-table-row" key={`team-summary-${team.id}`}>
                  <span className="office-data-table-row-main">
                    <strong>{team.name}</strong>
                    <small>{team.slug}</small>
                  </span>
                  <span>{team.memberCount}</span>
                  <span>{team.openTaskCount}</span>
                  <span>{team.openTransactionCount}</span>
                  <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          {snapshot.teams.length === 0 ? <EmptyState description="Create your first team to start grouping agents into rosters." title="No teams yet" /> : null}
        </div>
      </ListPageTableSection>

      <ListPageSection
        subtitle="Create, rename, activate, and maintain teams here. Membership remains managed inside each agent profile."
        title="Team administration"
      >
        {canManageTeams ? (
          <form className="office-inline-form office-agents-team-create-form" onSubmit={handleCreateTeam}>
            <FormField className="office-inline-form-field" label="New team name">
              <TextInput onChange={(event) => setTeamName(event.target.value)} placeholder="Create team" value={teamName} />
            </FormField>
            <Button disabled={pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? "Creating..." : "Create team"}
            </Button>
            {teamError ? <p className="office-form-error">{teamError}</p> : null}
          </form>
        ) : null}

        <div className="office-agents-team-admin-shell">
          <div className="office-agents-team-grid">
            {snapshot.teams.map((team) => (
              <form
                className="office-section-card office-agents-team-card"
                key={team.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSaveTeam(team.id, new FormData(event.currentTarget));
                }}
              >
                <div className="office-section-body">
                  <div className="office-agents-team-card-head">
                    <FormField className="office-agents-team-name-field" label="Team name">
                      <TextInput defaultValue={team.name} name="name" readOnly={!canManageTeams} />
                    </FormField>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </div>

                  <div className="office-secondary-meta-list">
                    <div className="office-secondary-meta-row">
                      <dt>Slug</dt>
                      <dd>{team.slug}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Members</dt>
                      <dd>{team.memberCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Open tasks</dt>
                      <dd>{team.openTaskCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Open transactions</dt>
                      <dd>{team.openTransactionCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Onboarding in progress</dt>
                      <dd>{team.onboardingInProgressCount}</dd>
                    </div>
                  </div>

                  <ul className="office-agents-team-members">
                    {team.members.map((member) => (
                      <li key={member.membershipId}>
                        <Link href={`/office/agents/${member.membershipId}`}>{member.label}</Link>
                        <span>{member.role}</span>
                      </li>
                    ))}
                    {team.members.length === 0 ? <li className="office-agents-team-empty">No members assigned yet.</li> : null}
                  </ul>

                  {canManageTeams ? (
                    <div className="office-inline-form office-inline-form-compact">
                      <input name="isActive" type="hidden" value={String(team.isActive)} />
                      <Button disabled={pendingAction === `save-team:${team.id}`} type="submit" variant="secondary">
                        {pendingAction === `save-team:${team.id}` ? "Saving..." : "Save team"}
                      </Button>
                      <Button
                        disabled={pendingAction === `save-team:${team.id}`}
                        onClick={async () => {
                          const formData = new FormData();
                          formData.set("name", team.name);
                          formData.set("isActive", String(!team.isActive));
                          await handleSaveTeam(team.id, formData);
                        }}
                        type="button"
                        variant="ghost"
                      >
                        {team.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </form>
            ))}
            {snapshot.teams.length === 0 ? <EmptyState description="Create your first team to start grouping agents into rosters." title="No teams yet" /> : null}
          </div>
        </div>

        {!canManageAgents && !canManageOnboarding && !canManageGoals && !canManageTeams ? (
          <p className="office-form-helper">This roster is read-only for your current role.</p>
        ) : null}
      </ListPageSection>
    </ListPageStack>
  );
}
