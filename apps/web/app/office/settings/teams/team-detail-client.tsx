"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, EmptyState, FormField, ListPageSection, ListPageStatsGrid, StatCard, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";
import {
  getBranchLeaderLabel,
  getBranchTypeLabel,
  getChildTeams,
  getDirectMembers,
  getInvalidLeaderMembers,
  getMemberNamesLabel
} from "./team-directory-shared";

type OfficeSettingsTeamDetailClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  teamId: string;
  canManageTeams: boolean;
};

export function OfficeSettingsTeamDetailClient({
  snapshot,
  teamId,
  canManageTeams
}: OfficeSettingsTeamDetailClientProps) {
  const router = useRouter();
  const team = useMemo(() => snapshot.teams.find((item) => item.id === teamId) ?? null, [snapshot, teamId]);
  const childTeams = useMemo(() => (team ? getChildTeams(snapshot, team.id) : []), [snapshot, team]);
  const directMembers = useMemo(() => (team ? getDirectMembers(team) : []), [team]);
  const [newChildTeamName, setNewChildTeamName] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  if (!team) {
    return null;
  }

  const selectedTeam = team;

  async function handleCreateChildTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newChildTeamName.trim()) {
      return;
    }

    setPendingAction("create-child-team");
    setSubmitError("");

    try {
      const response = await fetch("/api/office/agents/teams", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: newChildTeamName.trim(),
          parentTeamId: selectedTeam.id
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create child team.");
      }

      setNewChildTeamName("");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create child team.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <ListPageSection
        actions={
          <div className="office-settings-team-detail-actions">
            <Badge tone="neutral">{getBranchTypeLabel(team)}</Badge>
            <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
          </div>
        }
        subtitle="Read the branch structure from top to bottom: child branches first, direct agents second."
        title="Team Summary"
      >
        <ListPageStatsGrid className="office-settings-team-detail-stats">
          <StatCard hint="current branch owner" label="Leader" tone="accent" value={getBranchLeaderLabel(team)} />
          <StatCard hint="all memberships assigned to this team" label="Total members" value={team.memberCount} />
          <StatCard hint="direct children under this team" label="Child branches" value={team.childTeamCount} />
          <StatCard hint="members assigned directly here" label="Direct agents" value={directMembers.length} />
          <StatCard hint="work currently owned by this team" label="Open tasks" value={team.openTaskCount} />
          <StatCard hint="live production under this team" label="Open transactions" value={team.openTransactionCount} />
        </ListPageStatsGrid>
      </ListPageSection>

      <ListPageSection
        actions={
          canManageTeams ? (
            <Link className="office-button office-button-secondary office-button-sm" href="/office/settings/teams?view=manage">
              Advanced manage view
            </Link>
          ) : null
        }
        subtitle="Every child branch gets its own card. If no branch owner is assigned yet, the card stays visible as Unassigned."
        title="Child Branches"
      >
        {submitError ? <p className="office-inline-error">{submitError}</p> : null}

        {canManageTeams ? (
          <form className="office-settings-inline-form" onSubmit={handleCreateChildTeam}>
            <FormField className="is-wide" label="New child branch">
              <TextInput
                onChange={(event) => setNewChildTeamName(event.target.value)}
                placeholder={`Create a child branch under ${team.name}...`}
                value={newChildTeamName}
              />
            </FormField>
            <Button disabled={pendingAction === "create-child-team"} type="submit">
              {pendingAction === "create-child-team" ? "Creating..." : "Create child branch"}
            </Button>
          </form>
        ) : null}

        {childTeams.length ? (
          <div className="office-settings-card-grid office-settings-team-directory-grid">
            {childTeams.map((childTeam) => {
              const childMembers = getDirectMembers(childTeam);
              const invalidLeaderMembers = getInvalidLeaderMembers(childTeam);

              return (
                <article className="office-settings-team-directory-card is-child-branch" key={childTeam.id}>
                  <div className="office-settings-team-directory-card-head">
                    <div className="office-settings-team-directory-card-copy">
                      <strong>{childTeam.name}</strong>
                      <p>Branch owner: {getBranchLeaderLabel(childTeam)}</p>
                    </div>
                    <StatusBadge tone={childTeam.isActive ? "success" : "neutral"}>
                      {childTeam.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>

                  <div className="office-settings-team-directory-card-meta">
                    <span>{childTeam.memberCount} total members</span>
                    <span>{childMembers.length} direct agents</span>
                    <span>{childTeam.openTaskCount} open tasks</span>
                    <span>{childTeam.openTransactionCount} open transactions</span>
                  </div>

                  <div className="office-settings-team-directory-card-body">
                    <p>Agents: {getMemberNamesLabel(childMembers)}</p>
                    {invalidLeaderMembers.length ? (
                      <p className="office-settings-team-warning">
                        Invalid leader assignment: {getMemberNamesLabel(invalidLeaderMembers)}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="This team does not have any child branches yet. Direct agents will stay in the section below."
            title="No child branches yet"
          />
        )}
      </ListPageSection>

      <ListPageSection
        subtitle="These members belong directly to this team instead of any child branch."
        title="Direct Agents"
      >
        {directMembers.length ? (
          <div className="office-settings-team-detail-member-list">
            {directMembers.map((member) => (
              <article className="office-settings-team-detail-member-card" key={member.teamMembershipId}>
                <div className="office-settings-team-detail-member-copy">
                  <strong>{member.label}</strong>
                  <p>{member.role}</p>
                  {member.reportsToLabel !== "No direct manager" ? <p>Reports to {member.reportsToLabel}</p> : null}
                </div>
                <div className="office-settings-team-detail-member-meta">
                  {member.roleValue !== "member" ? <Badge tone="warning">Needs review</Badge> : <Badge tone="neutral">Direct agent</Badge>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="All active memberships for this team currently sit inside child branches."
            title="No direct agents"
          />
        )}
      </ListPageSection>
    </>
  );
}
