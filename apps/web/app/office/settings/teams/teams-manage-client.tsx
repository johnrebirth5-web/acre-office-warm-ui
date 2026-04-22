"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  ConfirmActionDialog,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  ListPageFooter,
  ListPageSection,
  ListPageStack,
  ListPageTableSection,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";
import { getAssignableLeaderOptions } from "./team-directory-shared";

type OfficeSettingsTeamsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageTeams: boolean;
};

type TeamRecord = OfficeSettingsTeamsClientProps["snapshot"]["teams"][number];

type TeamDraft = {
  name: string;
  isActive: boolean;
  parentTeamId: string;
  nextMembershipId: string;
  nextRole: string;
  nextReportsToTeamMembershipId: string;
};

type TeamMemberDraft = {
  role: string;
  reportsToTeamMembershipId: string;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const inheritedManagerOptionValue = "__inherited_manager__";

function isLeaderRoleValue(roleValue: string) {
  return roleValue === "team_leader" || roleValue === "junior_team_leader" || roleValue === "leader_i" || roleValue === "leader_ii";
}

function getTeamMemberRoleLabel(roleValue: string) {
  if (roleValue === "team_leader" || roleValue === "leader_i") {
    return "Team Leader";
  }

  if (roleValue === "junior_team_leader" || roleValue === "leader_ii") {
    return "Junior Team Leader";
  }

  return "Member";
}

function getLeaderRoleValue(team: TeamRecord) {
  return team.parentTeamId ? "junior_team_leader" : "team_leader";
}

function getLeaderRoleLabel(team: TeamRecord) {
  return team.parentTeamId ? "Junior Team Leader" : "Team Leader";
}

function getBranchTypeLabel(team: TeamRecord) {
  return team.parentTeamId ? "Junior Team" : "Team";
}

function getLeaderScopeLabel(team: TeamRecord) {
  return team.parentTeamId ? "junior team" : "team";
}

function isValidBranchLeaderRoleForTeam(team: TeamRecord, roleValue: string) {
  return isLeaderRoleValue(roleValue) && roleValue === getLeaderRoleValue(team);
}

function isInvalidLeaderRoleForTeam(team: TeamRecord, roleValue: string) {
  return isLeaderRoleValue(roleValue) && roleValue !== getLeaderRoleValue(team);
}

function getBranchLeaderMembers(team: TeamRecord) {
  return team.members.filter((member) => isValidBranchLeaderRoleForTeam(team, member.roleValue));
}

function getPrimaryBranchLeader(team: TeamRecord) {
  return getBranchLeaderMembers(team)[0] ?? null;
}

function getInvalidLeaderMembers(team: TeamRecord) {
  return team.members.filter((member) => isInvalidLeaderRoleForTeam(team, member.roleValue));
}

function getTeamMemberByTeamMembershipId(team: TeamRecord, teamMembershipId: string | null | undefined) {
  if (!teamMembershipId) {
    return null;
  }

  return team.members.find((member) => member.teamMembershipId === teamMembershipId) ?? null;
}

function getCurrentInvalidManagerOption(
  team: TeamRecord,
  reportsToTeamMembershipId: string,
  currentTeamMembershipId?: string
) {
  const currentManager = getTeamMemberByTeamMembershipId(team, reportsToTeamMembershipId);

  if (
    !currentManager ||
    currentManager.teamMembershipId === currentTeamMembershipId ||
    isValidBranchLeaderRoleForTeam(team, currentManager.roleValue)
  ) {
    return null;
  }

  return {
    value: currentManager.teamMembershipId,
    label: `${currentManager.label} · ${currentManager.role} (invalid for ${getLeaderScopeLabel(team)})`
  };
}

function getTeamRoleOptions(team: TeamRecord, currentRoleValue?: string) {
  const options = [
    { value: getLeaderRoleValue(team), label: getLeaderRoleLabel(team) },
    { value: "member", label: "Member" }
  ];

  if (!currentRoleValue || !isInvalidLeaderRoleForTeam(team, currentRoleValue)) {
    return options;
  }

  return [
    {
      value: currentRoleValue,
      label: `${getTeamMemberRoleLabel(currentRoleValue)} (invalid for ${getLeaderScopeLabel(team)})`
    },
    ...options
  ];
}

function getParentBranchLeader(teams: TeamRecord[], team: TeamRecord) {
  if (!team.parentTeamId) {
    return null;
  }

  const parentTeam = teams.find((candidate) => candidate.id === team.parentTeamId);
  if (!parentTeam) {
    return null;
  }

  return getPrimaryBranchLeader(parentTeam);
}

function getInheritedManagerOption(teams: TeamRecord[], team: TeamRecord, roleValue: string) {
  if (!isLeaderRoleValue(roleValue)) {
    return null;
  }

  const parentLeader = getParentBranchLeader(teams, team);
  if (!parentLeader) {
    return null;
  }

  return {
    value: inheritedManagerOptionValue,
    label: `${parentLeader.label} · ${parentLeader.role}`
  };
}

function getDirectManagerPlaceholder(teams: TeamRecord[], team: TeamRecord, roleValue: string) {
  if (!isLeaderRoleValue(roleValue)) {
    return getPrimaryBranchLeader(team) ? `Use ${getLeaderRoleLabel(team)}` : `No ${getLeaderRoleLabel(team)} assigned`;
  }

  const parentLeader = getParentBranchLeader(teams, team);
  if (parentLeader) {
    return `Inherited from ${parentLeader.label}`;
  }

  return team.parentTeamId ? "Parent Team Leader not assigned" : "No direct manager";
}

export function OfficeSettingsTeamsManageClient({ snapshot, canManageTeams }: OfficeSettingsTeamsClientProps) {
  const router = useRouter();
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamParentTeamId, setNewTeamParentTeamId] = useState("");
  const [newTeamLeaderMembershipId, setNewTeamLeaderMembershipId] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamDraft>>(
    Object.fromEntries(
      snapshot.teams.map((team) => [
        team.id,
        {
          name: team.name,
          isActive: team.isActive,
          parentTeamId: team.parentTeamId ?? "",
          nextMembershipId: "",
          nextRole: "member",
          nextReportsToTeamMembershipId: ""
        }
      ])
    )
  );
  const [memberDrafts, setMemberDrafts] = useState<Record<string, TeamMemberDraft>>(
    Object.fromEntries(
      snapshot.teams.flatMap((team) =>
        team.members.map((member) => [
          member.teamMembershipId,
          {
            role: member.roleValue,
            reportsToTeamMembershipId: member.reportsToTeamMembershipId ?? ""
          }
        ])
      )
    )
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const memberOptions = useMemo(
    () =>
      snapshot.allRows.map((row) => ({
        membershipId: row.membershipId,
        label: `${row.name} · ${row.title}`
      })),
    [snapshot.allRows]
  );
  const rootTeamOptions = useMemo(() => snapshot.teams.filter((team) => !team.parentTeamId), [snapshot.teams]);
  const newTeamLeaderOptions = useMemo(
    () => getAssignableLeaderOptions(snapshot, newTeamParentTeamId || null),
    [snapshot, newTeamParentTeamId]
  );

  function setTeamDraft(teamId: string, field: keyof TeamDraft, value: string | boolean) {
    setTeamDrafts((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? {
          name: "",
          isActive: true,
          parentTeamId: "",
          nextMembershipId: "",
          nextRole: "member",
          nextReportsToTeamMembershipId: ""
        }),
        [field]: value
      }
    }));
  }

  function setMemberDraft(teamMembershipId: string, field: keyof TeamMemberDraft, value: string) {
    setMemberDrafts((current) => ({
      ...current,
      [teamMembershipId]: {
        ...(current[teamMembershipId] ?? { role: "member", reportsToTeamMembershipId: "" }),
        [field]: value
      }
    }));
  }

  function getManagerOptions(team: TeamRecord, roleValue: string, currentTeamMembershipId?: string) {
    if (roleValue !== "member") {
      return [];
    }

    return team.members.filter(
      (member) =>
        member.teamMembershipId !== currentTeamMembershipId &&
        isValidBranchLeaderRoleForTeam(team, member.roleValue)
    );
  }

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTeamName.trim() || !newTeamLeaderMembershipId) {
      return;
    }

    setPendingAction("create-team");
    setSubmitError("");

    try {
      const response = await fetch("/api/office/agents/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newTeamName,
          parentTeamId: newTeamParentTeamId || null,
          leaderMembershipId: newTeamLeaderMembershipId
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create team.");
      }

      setNewTeamName("");
      setNewTeamParentTeamId("");
      setNewTeamLeaderMembershipId("");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTeam(teamId: string) {
    const draft = teamDrafts[teamId];
    if (!draft) {
      return;
    }

    setPendingAction(`save-team:${teamId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: draft.name,
          isActive: draft.isActive,
          parentTeamId: draft.parentTeamId || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update team.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    setPendingAction(`delete-team:${teamId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete team.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to delete team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddMember(teamId: string) {
    const draft = teamDrafts[teamId];
    if (!draft?.nextMembershipId) {
      return;
    }

    setPendingAction(`add-member:${teamId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}/memberships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: draft.nextMembershipId,
          role: draft.nextRole,
          reportsToTeamMembershipId: draft.nextReportsToTeamMembershipId || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to add team member.");
      }

      setTeamDraft(teamId, "nextMembershipId", "");
      setTeamDraft(teamId, "nextRole", "member");
      setTeamDraft(teamId, "nextReportsToTeamMembershipId", "");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to add team member.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveMember(teamId: string, membershipId: string, teamMembershipId: string) {
    const draft = memberDrafts[teamMembershipId];
    if (!draft) {
      return;
    }

    setPendingAction(`save-member:${teamId}:${membershipId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}/memberships/${membershipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: draft.role,
          reportsToTeamMembershipId: draft.reportsToTeamMembershipId || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update team member.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update team member.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(teamId: string, membershipId: string) {
    setPendingAction(`remove-member:${teamId}:${membershipId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}/memberships/${membershipId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to remove team member.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to remove team member.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <ListPageStack>
        {submitError ? <p className="office-inline-error">{submitError}</p> : null}

      <ListPageTableSection footer={<ListPageFooter summary={`${snapshot.teams.length} team rows`} />} subtitle="Same list/table rhythm as Transactions, with team-level operational metrics." title="Teams list">
        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-teams">
            <span>Team</span>
            <span>Parent</span>
            <span>Members</span>
            <span>Branches</span>
            <span>Status</span>
            <span>Actions</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.teams.length ? (
              snapshot.teams.map((team) => (
                <DataTableRow className="office-table-row office-table-row-settings-teams" key={`summary-${team.id}`}>
                  <div className="office-table-primary">
                    <strong>{team.teamPathLabel}</strong>
                    <p>
                      {team.slug} · {team.openTaskCount} open tasks · {team.openTransactionCount} open transactions
                    </p>
                  </div>
                  <span>{team.parentTeamId ? team.teamPathLabel.split(" / ").slice(0, -1).join(" / ") : "Top-level Team"}</span>
                  <span>{team.memberCount}</span>
                  <span>{team.childTeamCount}</span>
                  <span>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </span>
                  <div className="office-table-actions">
                    <Link className="office-inline-action" href={`/office/settings/users?view=operations&teamId=${team.id}`}>
                      View roster
                    </Link>
                  </div>
                </DataTableRow>
              ))
            ) : (
              <EmptyState description="Create the first Team for this office to start grouping agents." title="No teams configured yet" />
            )}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      <ListPageSection subtitle="Create and manage Teams and Junior Teams without leaving Back Office." title="Team administration">

        {canManageTeams ? (
          <form className="office-settings-inline-form" onSubmit={handleCreateTeam}>
            <FormField className="is-wide" label={newTeamParentTeamId ? "New Junior Team name" : "New Team name"}>
              <TextInput
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder={newTeamParentTeamId ? "Create a new Junior Team..." : "Create a new Team..."}
                value={newTeamName}
              />
            </FormField>
            <FormField label="Parent team">
              <SelectInput onChange={(event) => setNewTeamParentTeamId(event.target.value)} value={newTeamParentTeamId}>
                <option value="">No parent team</option>
                {rootTeamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.teamPathLabel}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label={newTeamParentTeamId ? "Junior Team Leader" : "Team Leader"}>
              <SelectInput onChange={(event) => setNewTeamLeaderMembershipId(event.target.value)} value={newTeamLeaderMembershipId}>
                <option value="">Select leader</option>
                {newTeamLeaderOptions.map((option) => (
                  <option key={option.membershipId} value={option.membershipId}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <Button disabled={!newTeamLeaderOptions.length || pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? "Creating..." : newTeamParentTeamId ? "Create Junior Team" : "Create Team"}
            </Button>
          </form>
        ) : null}
        {canManageTeams && newTeamLeaderOptions.length === 0 ? (
          <p className="office-form-helper">No eligible leader is currently available for this new team.</p>
        ) : null}

        <div className="office-settings-card-grid office-settings-teams-grid">
          {snapshot.teams.length ? (
            snapshot.teams.map((team) => {
              const draft = teamDrafts[team.id] ?? {
                name: team.name,
                isActive: team.isActive,
                parentTeamId: team.parentTeamId ?? "",
                nextMembershipId: "",
                nextRole: "member",
                nextReportsToTeamMembershipId: ""
              };
              const availableMembers = memberOptions.filter((option) => !team.members.some((member) => member.membershipId === option.membershipId));
              const nextManagerOptions = getManagerOptions(team, draft.nextRole);
              const teamRoleOptions = getTeamRoleOptions(team);
              const inheritedNextManagerOption = getInheritedManagerOption(snapshot.teams, team, draft.nextRole);
              const parentTeamOptions = snapshot.teams.filter((candidate) => !candidate.parentTeamId && candidate.id !== team.id);
              const parentTeamLabel = team.parentTeamId ? team.teamPathLabel.split(" / ").slice(0, -1).join(" / ") : "Top-level Team";
              const branchLeaderMembers = getBranchLeaderMembers(team);
              const invalidLeaderMembers = getInvalidLeaderMembers(team);
              const branchOwnerLabel = branchLeaderMembers.length
                ? branchLeaderMembers.map((member) => member.label).join(", ")
                : "Unassigned";
              const branchOwnerNoun = getLeaderRoleLabel(team);
              const branchTypeLabel = getBranchTypeLabel(team);
              const multipleBranchLeaderMessage =
                branchLeaderMembers.length > 1
                  ? `Multiple leaders are assigned: ${branchOwnerLabel}. Keep only one active ${getLeaderRoleLabel(team)} on this ${branchTypeLabel.toLowerCase()}.`
                  : "";
              const invalidLeaderMessage =
                invalidLeaderMembers.length > 0
                  ? `Invalid leader assignment: ${invalidLeaderMembers
                      .map((member) => `${member.label} (${member.role})`)
                      .join(", ")}. This ${branchTypeLabel.toLowerCase()} only uses ${getLeaderRoleLabel(team)}.`
                  : "";

              return (
                <ListPageSection
                  actions={
                    <div className="office-settings-team-card-actions">
                      <Badge tone="neutral">{branchTypeLabel}</Badge>
                      <Badge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                  }
                  className="office-settings-team-card"
                  key={team.id}
                  subtitle={`${team.parentTeamId ? `Parent: ${parentTeamLabel}` : "No parent team"} · ${team.memberCount} members · ${team.childTeamCount} Junior Teams · ${team.openTaskCount} open tasks · ${team.openTransactionCount} open transactions`}
                  title={team.teamPathLabel}
                >
                  <div className="office-settings-team-editor">
                    <div className="office-settings-team-editor-grid">
                      <FormField label="Team name">
                        <TextInput
                          disabled={!canManageTeams}
                          onChange={(event) => setTeamDraft(team.id, "name", event.target.value)}
                          value={draft.name}
                        />
                      </FormField>

                      <FormField label="Parent team">
                        <SelectInput
                          disabled={!canManageTeams}
                          onChange={(event) => setTeamDraft(team.id, "parentTeamId", event.target.value)}
                          value={draft.parentTeamId}
                        >
                          <option value="">No parent team</option>
                          {parentTeamOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.teamPathLabel}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>

                      <FormField label="Status">
                        <SelectInput
                          disabled={!canManageTeams}
                          onChange={(event) => setTeamDraft(team.id, "isActive", event.target.value === "active")}
                          value={draft.isActive ? "active" : "inactive"}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </SelectInput>
                      </FormField>
                    </div>

                    {canManageTeams ? (
                      <div className="office-settings-team-editor-actions">
                        <Button
                          disabled={pendingAction === `save-team:${team.id}`}
                          onClick={() => handleSaveTeam(team.id)}
                          size="sm"
                          variant="secondary"
                        >
                          {pendingAction === `save-team:${team.id}` ? "Saving..." : "Save team"}
                        </Button>
                        <Button
                          disabled={pendingAction === `delete-team:${team.id}`}
                          onClick={() =>
                            setConfirmDialog({
                              title: `Delete ${team.name}?`,
                              description:
                                "This permanently deletes the team record after the current server-side safety checks pass.",
                              confirmLabel: "Delete team",
                              onConfirm: () => {
                                void handleDeleteTeam(team.id);
                              }
                            })
                          }
                          size="sm"
                          variant="danger"
                        >
                          {pendingAction === `delete-team:${team.id}` ? "Deleting..." : "Delete team"}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="office-settings-team-meta">
                    <p className="office-form-helper">
                      {branchTypeLabel} · {branchOwnerNoun}: {branchOwnerLabel}
                    </p>
                    {multipleBranchLeaderMessage ? <p className="office-settings-team-warning">{multipleBranchLeaderMessage}</p> : null}
                    {invalidLeaderMessage ? <p className="office-settings-team-warning">{invalidLeaderMessage}</p> : null}
                  </div>

                  <div className="office-settings-team-members">
                    <div className="office-settings-team-members-head">
                      <strong>Members</strong>
                      <span>
                        {team.onboardingInProgressCount} onboarding in progress · Team path: {team.teamPathLabel}
                      </span>
                    </div>

                    {team.members.length ? (
                      <div className="office-settings-team-member-list">
                        {team.members.map((member) => {
                          const memberDraft = memberDrafts[member.teamMembershipId] ?? {
                            role: member.roleValue,
                            reportsToTeamMembershipId: member.reportsToTeamMembershipId ?? ""
                          };
                          const memberRoleOptions = getTeamRoleOptions(team, memberDraft.role);
                          const managerOptions = getManagerOptions(team, memberDraft.role, member.teamMembershipId);
                          const inheritedManagerOption = getInheritedManagerOption(snapshot.teams, team, memberDraft.role);
                          const currentInvalidManagerOption = getCurrentInvalidManagerOption(
                            team,
                            memberDraft.reportsToTeamMembershipId,
                            member.teamMembershipId
                          );
                          const invalidLeaderRole = isInvalidLeaderRoleForTeam(team, member.roleValue);
                          const currentManager = getTeamMemberByTeamMembershipId(team, member.reportsToTeamMembershipId);
                          const invalidDirectManager =
                            member.roleValue === "member" &&
                            currentManager &&
                            !isValidBranchLeaderRoleForTeam(team, currentManager.roleValue);

                          return (
                          <article className={`office-settings-team-member-row${canManageTeams ? "" : " is-readonly"}`} key={member.membershipId}>
                            <div className="office-settings-team-member-copy">
                              <Link href={`/office/settings/users/${member.membershipId}`}>{member.label}</Link>
                              <p>
                                {member.role}
                                {invalidLeaderRole ? ` · Invalid for ${getLeaderScopeLabel(team)}` : ""}
                                {member.reportsToLabel !== "No direct manager" ? ` · Reports to ${member.reportsToLabel}` : ""}
                                {invalidDirectManager ? ` · Direct manager is not the current ${getLeaderRoleLabel(team)}` : ""}
                              </p>
                            </div>
                            {canManageTeams ? (
                              <div className="office-settings-team-member-controls">
                                <SelectInput
                                  onChange={(event) => {
                                    const nextRole = event.target.value;
                                    setMemberDraft(member.teamMembershipId, "role", nextRole);
                                    if (isLeaderRoleValue(nextRole)) {
                                      setMemberDraft(member.teamMembershipId, "reportsToTeamMembershipId", "");
                                    }
                                  }}
                                  value={memberDraft.role}
                                >
                                  {memberRoleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </SelectInput>
                                <SelectInput
                                  disabled={isLeaderRoleValue(memberDraft.role)}
                                  onChange={(event) =>
                                    setMemberDraft(member.teamMembershipId, "reportsToTeamMembershipId", event.target.value)
                                  }
                                  value={inheritedManagerOption ? inheritedManagerOption.value : memberDraft.reportsToTeamMembershipId}
                                >
                                  <option value="">{getDirectManagerPlaceholder(snapshot.teams, team, memberDraft.role)}</option>
                                  {inheritedManagerOption ? (
                                    <option value={inheritedManagerOption.value}>{inheritedManagerOption.label}</option>
                                  ) : null}
                                  {currentInvalidManagerOption ? (
                                    <option value={currentInvalidManagerOption.value}>{currentInvalidManagerOption.label}</option>
                                  ) : null}
                                  {managerOptions.map((option) => (
                                    <option key={option.teamMembershipId} value={option.teamMembershipId}>
                                      {option.label} · {option.role}
                                    </option>
                                  ))}
                                </SelectInput>
                              </div>
                            ) : null}
                            {canManageTeams ? (
                              <div className="office-settings-team-member-actions">
                                <Button
                                  disabled={pendingAction === `save-member:${team.id}:${member.membershipId}`}
                                  onClick={() => handleSaveMember(team.id, member.membershipId, member.teamMembershipId)}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  Save
                                </Button>
                                <Button
                                  disabled={pendingAction === `remove-member:${team.id}:${member.membershipId}`}
                                  onClick={() =>
                                    setConfirmDialog({
                                      title: `Remove ${member.label} from ${team.name}?`,
                                      description:
                                        "This removes the team membership but keeps the agent active in the roster.",
                                      confirmLabel: "Remove member",
                                      onConfirm: () => {
                                        void handleRemoveMember(team.id, member.membershipId);
                                      }
                                    })
                                  }
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : null}
                          </article>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState description="Add members from the current roster to make this team operational." title="No team members yet" />
                    )}
                  </div>

                  {canManageTeams ? (
                    <div className="office-settings-team-assign-panel">
                      <div className="office-settings-team-assign-grid">
                        <FormField className="is-wide" label="Add member">
                          <SelectInput onChange={(event) => setTeamDraft(team.id, "nextMembershipId", event.target.value)} value={draft.nextMembershipId}>
                            <option value="">Select a roster member</option>
                            {availableMembers.map((option) => (
                              <option key={option.membershipId} value={option.membershipId}>
                                {option.label}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>

                        <FormField label="Role">
                          <SelectInput
                            onChange={(event) => {
                              const nextRole = event.target.value;
                              setTeamDraft(team.id, "nextRole", nextRole);
                              if (isLeaderRoleValue(nextRole)) {
                                setTeamDraft(team.id, "nextReportsToTeamMembershipId", "");
                              }
                            }}
                            value={draft.nextRole}
                          >
                            {teamRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>

                        <FormField label="Direct manager">
                          <SelectInput
                            disabled={isLeaderRoleValue(draft.nextRole)}
                            onChange={(event) => setTeamDraft(team.id, "nextReportsToTeamMembershipId", event.target.value)}
                            value={inheritedNextManagerOption ? inheritedNextManagerOption.value : draft.nextReportsToTeamMembershipId}
                          >
                            <option value="">{getDirectManagerPlaceholder(snapshot.teams, team, draft.nextRole)}</option>
                            {inheritedNextManagerOption ? (
                              <option value={inheritedNextManagerOption.value}>{inheritedNextManagerOption.label}</option>
                            ) : null}
                            {nextManagerOptions.map((option) => (
                              <option key={option.teamMembershipId} value={option.teamMembershipId}>
                                {option.label} · {option.role}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                      </div>

                      <div className="office-settings-team-assign-actions">
                        <Button
                          disabled={!draft.nextMembershipId || pendingAction === `add-member:${team.id}`}
                          onClick={() => handleAddMember(team.id)}
                          size="sm"
                          variant="secondary"
                        >
                          {pendingAction === `add-member:${team.id}` ? "Adding..." : "Add member"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </ListPageSection>
              );
            })
          ) : (
            <EmptyState description="Create the first operational team for this office to start grouping agents." title="No teams configured yet" />
          )}
        </div>
      </ListPageSection>
      </ListPageStack>

      <ConfirmActionDialog
        cancelLabel="Cancel"
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </>
  );
}
