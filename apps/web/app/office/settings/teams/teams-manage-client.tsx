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
import {
  getAssignableLeaderOptions,
  getAvailableParentTeams,
  getBranchLeader,
  getBranchLeaderMembers,
  getBranchTypeLabel,
  getChildBranchTypeLabel,
  getChildCollectionLabel,
  getInvalidLeaderMembers,
  getLeaderScopeLabel,
  getLeaderTitleLabelByDepth,
  getLeaderTitleLabel,
  getTeamMemberRoleLabel,
  isInvalidBranchLeaderRoleValue,
  isLeaderRoleValue,
  isValidBranchLeaderRoleValue
} from "./team-directory-shared";

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
    isValidBranchLeaderRoleValue(team, currentManager.roleValue)
  ) {
    return null;
  }

  return {
    value: currentManager.teamMembershipId,
    label: `${currentManager.label} · ${getTeamMemberRoleLabel(team, currentManager.roleValue)} (invalid for ${getLeaderScopeLabel(team)})`
  };
}

function getMemberDirectReportCount(team: TeamRecord, teamMembershipId: string) {
  return team.members.filter((member) => member.reportsToTeamMembershipId === teamMembershipId).length;
}

function getRemoveMemberBlockedReason(team: TeamRecord, member: TeamRecord["members"][number]) {
  const directReportCount = getMemberDirectReportCount(team, member.teamMembershipId);
  const isCurrentBranchLeader = isValidBranchLeaderRoleValue(team, member.roleValue);

  if (isCurrentBranchLeader && getBranchLeaderMembers(team).length === 1) {
    return `Assign another ${getLeaderTitleLabel(team)} before removing the current owner.`;
  }

  if (directReportCount > 0) {
    return `Reassign or remove ${directReportCount} direct report${directReportCount === 1 ? "" : "s"} before removing this member.`;
  }

  if (isLeaderRoleValue(member.roleValue) && team.childTeamCount > 0) {
    return `Reassign this team's ${getChildCollectionLabel(team).toLowerCase()} before removing its leader.`;
  }

  return null;
}

function getDeleteTeamBlockedReason(team: TeamRecord) {
  const canCascadeDeleteFinalOwner =
    team.members.length === 1 && Boolean(team.members[0] && isValidBranchLeaderRoleValue(team, team.members[0].roleValue));

  if (team.members.length > 0 && !canCascadeDeleteFinalOwner) {
    return "Remove all team members before deleting this team.";
  }

  if (team.childTeamCount > 0) {
    return `Remove or reassign this team's ${getChildCollectionLabel(team).toLowerCase()} before deleting it.`;
  }

  if (team.commissionPlanAssignmentCount > 0) {
    return `Remove ${team.commissionPlanAssignmentCount} commission plan assignment${
      team.commissionPlanAssignmentCount === 1 ? "" : "s"
    } before deleting this team.`;
  }

  return null;
}

function getTeamRoleOptions(team: TeamRecord, currentRoleValue?: string) {
  const options = [
    { value: team.parentTeamId ? "junior_team_leader" : "team_leader", label: getLeaderTitleLabel(team) },
    { value: "member", label: "Member" }
  ];

  if (!currentRoleValue || !isInvalidBranchLeaderRoleValue(team, currentRoleValue)) {
    return options;
  }

  return [
    {
      value: currentRoleValue,
      label: `${getTeamMemberRoleLabel(team, currentRoleValue)} (invalid for ${getLeaderScopeLabel(team)})`
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

  return getBranchLeader(parentTeam);
}

function getInheritedManagerOption(teams: TeamRecord[], team: TeamRecord, roleValue: string) {
  if (!isLeaderRoleValue(roleValue)) {
    return null;
  }

  const parentLeader = getParentBranchLeader(teams, team);
  if (!parentLeader) {
    return null;
  }

  const parentTeam = team.parentTeamId ? teams.find((candidate) => candidate.id === team.parentTeamId) ?? null : null;

  return {
    value: inheritedManagerOptionValue,
    label: `${parentLeader.label} · ${parentTeam ? getLeaderTitleLabel(parentTeam) : "Parent leader"}`
  };
}

function getDirectManagerPlaceholder(teams: TeamRecord[], team: TeamRecord, roleValue: string) {
  if (!isLeaderRoleValue(roleValue)) {
    return getBranchLeader(team) ? `Use ${getLeaderTitleLabel(team)}` : `No ${getLeaderTitleLabel(team)} assigned`;
  }

  const parentLeader = getParentBranchLeader(teams, team);
  if (parentLeader) {
    return `Inherited from ${parentLeader.label}`;
  }

  if (team.parentTeamId) {
    const parentTeam = teams.find((candidate) => candidate.id === team.parentTeamId) ?? null;
    return parentTeam ? `Parent ${getLeaderTitleLabel(parentTeam)} not assigned` : "Parent branch leader not assigned";
  }

  return "No direct manager";
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
  const selectedNewTeamParent = useMemo(
    () => snapshot.teams.find((team) => team.id === newTeamParentTeamId) ?? null,
    [snapshot.teams, newTeamParentTeamId]
  );
  const newTeamTypeLabel = selectedNewTeamParent ? getChildBranchTypeLabel(selectedNewTeamParent) : "Team";
  const newTeamLeaderLabel = selectedNewTeamParent ? getLeaderTitleLabelByDepth(selectedNewTeamParent.depth + 1) : "Team Leader";
  const availableNewTeamParents = useMemo(() => getAvailableParentTeams(snapshot), [snapshot]);
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
        isValidBranchLeaderRoleValue(team, member.roleValue)
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
        throw new Error(body?.error ?? `Failed to create ${newTeamTypeLabel}.`);
      }

      setNewTeamName("");
      setNewTeamParentTeamId("");
      setNewTeamLeaderMembershipId("");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : `Failed to create ${newTeamTypeLabel}.`);
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

      <ListPageTableSection footer={<ListPageFooter summary={`${snapshot.teams.length} team rows`} />} subtitle="Same list/table rhythm as Transactions, with recursive team-level operational metrics." title="Teams list">
        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-teams">
            <span>Team</span>
            <span>Parent</span>
            <span>Members</span>
            <span>Child teams</span>
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
                      {getBranchTypeLabel(team)} · {team.slug} · {team.openTaskCount} open tasks · {team.openTransactionCount} open transactions
                    </p>
                  </div>
                  <span>{team.parentTeamId ? team.teamPathLabel.split(" / ").slice(0, -1).join(" / ") : "Top-level Team"}</span>
                  <span>{team.memberCount}</span>
                  <span>{team.childTeamCount} child teams</span>
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
              <EmptyState description="Create the first Team for this office to start grouping recursive branches." title="No teams configured yet" />
            )}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      <ListPageSection subtitle="Create and manage recursive Team / Junior Team paths without leaving Back Office." title="Team administration">

        {canManageTeams ? (
          <form className="office-settings-inline-form" onSubmit={handleCreateTeam}>
            <FormField className="is-wide" label={`New ${newTeamTypeLabel} name`}>
              <TextInput
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder={`Create a new ${newTeamTypeLabel}...`}
                value={newTeamName}
              />
            </FormField>
            <FormField label="Parent team">
              <SelectInput onChange={(event) => setNewTeamParentTeamId(event.target.value)} value={newTeamParentTeamId}>
                <option value="">No parent team</option>
                {availableNewTeamParents.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.teamPathLabel}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label={newTeamLeaderLabel}>
              <SelectInput onChange={(event) => setNewTeamLeaderMembershipId(event.target.value)} value={newTeamLeaderMembershipId}>
                <option value="">{`Select ${newTeamLeaderLabel}`}</option>
                {newTeamLeaderOptions.map((option) => (
                  <option key={option.membershipId} value={option.membershipId}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <Button disabled={!newTeamLeaderOptions.length || pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? "Creating..." : `Create ${newTeamTypeLabel}`}
            </Button>
          </form>
        ) : null}
        {canManageTeams && newTeamLeaderOptions.length === 0 ? (
          <p className="office-form-helper">{`No eligible leader is currently available for this new ${newTeamTypeLabel.toLowerCase()}.`}</p>
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
              const parentTeamOptions = getAvailableParentTeams(snapshot, team.id);
              const parentTeamLabel = team.parentTeamId ? team.teamPathLabel.split(" / ").slice(0, -1).join(" / ") : "Top-level Team";
              const branchLeaderMembers = getBranchLeaderMembers(team);
              const invalidLeaderMembers = getInvalidLeaderMembers(team);
              const branchOwnerLabel = branchLeaderMembers.length
                ? branchLeaderMembers.map((member) => member.label).join(", ")
                : "Unassigned";
              const branchOwnerNoun = getLeaderTitleLabel(team);
              const branchTypeLabel = getBranchTypeLabel(team);
              const deleteBlockedReason = getDeleteTeamBlockedReason(team);
              const multipleBranchLeaderMessage =
                branchLeaderMembers.length > 1
                  ? `Multiple leaders are assigned: ${branchOwnerLabel}. Keep only one active ${getLeaderTitleLabel(team)} on this ${branchTypeLabel.toLowerCase()}.`
                  : "";
              const invalidLeaderMessage =
                invalidLeaderMembers.length > 0
                  ? `Invalid leader assignment: ${invalidLeaderMembers
                      .map((member) => `${member.label} (${getTeamMemberRoleLabel(team, member.roleValue)})`)
                      .join(", ")}. This ${branchTypeLabel.toLowerCase()} only uses ${getLeaderTitleLabel(team)}.`
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
                  subtitle={`${team.parentTeamId ? `Parent: ${parentTeamLabel}` : "No parent team"} · ${team.memberCount} members · ${team.childTeamCount} child teams · ${team.commissionPlanAssignmentCount} commission plan assignments · ${team.openTaskCount} open tasks · ${team.openTransactionCount} open transactions`}
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
                          disabled={Boolean(deleteBlockedReason) || pendingAction === `delete-team:${team.id}`}
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
                    {deleteBlockedReason ? <p className="office-settings-team-warning">Delete blocked: {deleteBlockedReason}</p> : null}
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
                          const invalidLeaderRole = isInvalidBranchLeaderRoleValue(team, member.roleValue);
                          const currentManager = getTeamMemberByTeamMembershipId(team, member.reportsToTeamMembershipId);
                          const invalidDirectManager =
                            member.roleValue === "member" &&
                            currentManager &&
                            !isValidBranchLeaderRoleValue(team, currentManager.roleValue);
                          const removeBlockedReason = getRemoveMemberBlockedReason(team, member);

                          return (
                          <article className={`office-settings-team-member-row${canManageTeams ? "" : " is-readonly"}`} key={member.membershipId}>
                            <div className="office-settings-team-member-copy">
                              <Link href={`/office/settings/users/${member.membershipId}`}>{member.label}</Link>
                              <p>
                                {getTeamMemberRoleLabel(team, member.roleValue)}
                                {invalidLeaderRole ? ` · Invalid for ${getLeaderScopeLabel(team)}` : ""}
                                {member.reportsToLabel !== "No direct manager" ? ` · Reports to ${member.reportsToLabel}` : ""}
                                {invalidDirectManager ? ` · Direct manager is not the current ${getLeaderTitleLabel(team)}` : ""}
                              </p>
                              {removeBlockedReason ? <p className="office-settings-team-warning">Remove blocked: {removeBlockedReason}</p> : null}
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
                                      {option.label} · {getTeamMemberRoleLabel(team, option.roleValue)}
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
                                  disabled={Boolean(removeBlockedReason) || pendingAction === `remove-member:${team.id}:${member.membershipId}`}
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
                                {option.label} · {getTeamMemberRoleLabel(team, option.roleValue)}
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
            <EmptyState description="Create the first operational team for this office to start grouping recursive branches." title="No teams configured yet" />
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
