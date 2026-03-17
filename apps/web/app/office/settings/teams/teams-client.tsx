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

type OfficeSettingsTeamsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageTeams: boolean;
};

type TeamDraft = {
  name: string;
  isActive: boolean;
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

export function OfficeSettingsTeamsClient({ snapshot, canManageTeams }: OfficeSettingsTeamsClientProps) {
  const router = useRouter();
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamDraft>>(
    Object.fromEntries(
      snapshot.teams.map((team) => [
        team.id,
        {
          name: team.name,
          isActive: team.isActive,
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
      snapshot.rows.map((row) => ({
        membershipId: row.membershipId,
        label: `${row.name} · ${row.role}`
      })),
    [snapshot.rows]
  );

  function setTeamDraft(teamId: string, field: keyof TeamDraft, value: string | boolean) {
    setTeamDrafts((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? {
          name: "",
          isActive: true,
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

  function getManagerOptions(
    team: OfficeSettingsTeamsClientProps["snapshot"]["teams"][number],
    roleValue: string,
    currentTeamMembershipId?: string
  ) {
    const allowedRoles = roleValue === "leader_ii" ? ["leader_i"] : roleValue === "member" ? ["leader_i", "leader_ii"] : [];

    return team.members.filter(
      (member) => member.teamMembershipId !== currentTeamMembershipId && allowedRoles.includes(member.roleValue)
    );
  }

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTeamName.trim()) {
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
        body: JSON.stringify({ name: newTeamName })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create team.");
      }

      setNewTeamName("");
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
          isActive: draft.isActive
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
            <span>Members</span>
            <span>Open tasks</span>
            <span>Open transactions</span>
            <span>Status</span>
            <span>Actions</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.teams.length ? (
              snapshot.teams.map((team) => (
                <DataTableRow className="office-table-row office-table-row-settings-teams" key={`summary-${team.id}`}>
                  <div className="office-table-primary">
                    <strong>{team.name}</strong>
                    <p>{team.slug}</p>
                  </div>
                  <span>{team.memberCount}</span>
                  <span>{team.openTaskCount}</span>
                  <span>{team.openTransactionCount}</span>
                  <span>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </span>
                  <div className="office-table-actions">
                    <Link className="office-inline-action" href={`/office/agents?teamId=${team.id}`}>
                      View roster
                    </Link>
                  </div>
                </DataTableRow>
              ))
            ) : (
              <EmptyState description="Create the first operational team for this office to start grouping agents." title="No teams configured yet" />
            )}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      <ListPageSection subtitle="Create and manage operational teams without leaving Back Office." title="Team administration">

        {canManageTeams ? (
          <form className="office-settings-inline-form" onSubmit={handleCreateTeam}>
            <FormField className="is-wide" label="New team name">
              <TextInput onChange={(event) => setNewTeamName(event.target.value)} placeholder="Create a new team..." value={newTeamName} />
            </FormField>
            <Button disabled={pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? "Creating..." : "Create team"}
            </Button>
          </form>
        ) : null}

        <div className="office-settings-card-grid">
          {snapshot.teams.length ? (
            snapshot.teams.map((team) => {
              const draft = teamDrafts[team.id] ?? {
                name: team.name,
                isActive: team.isActive,
                nextMembershipId: "",
                nextRole: "member",
                nextReportsToTeamMembershipId: ""
              };
              const availableMembers = memberOptions.filter((option) => !team.members.some((member) => member.membershipId === option.membershipId));
              const nextManagerOptions = getManagerOptions(team, draft.nextRole);

              return (
                <ListPageSection
                  actions={<Badge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</Badge>}
                  className="office-settings-team-card"
                  key={team.id}
                  subtitle={`${team.memberCount} members · ${team.openTaskCount} open tasks · ${team.openTransactionCount} open transactions`}
                  title={team.name}
                >
                  <div className="office-settings-team-editor">
                    <FormField label="Team name">
                      <TextInput
                        disabled={!canManageTeams}
                        onChange={(event) => setTeamDraft(team.id, "name", event.target.value)}
                        value={draft.name}
                      />
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

                    {canManageTeams ? (
                      <div className="office-settings-actions">
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

                  <div className="office-settings-team-members">
                    <div className="office-settings-team-members-head">
                      <strong>Members</strong>
                      <span>{team.onboardingInProgressCount} onboarding in progress</span>
                    </div>

                    {team.members.length ? (
                      <ul className="office-settings-pill-list">
                        {team.members.map((member) => {
                          const memberDraft = memberDrafts[member.teamMembershipId] ?? {
                            role: member.roleValue,
                            reportsToTeamMembershipId: member.reportsToTeamMembershipId ?? ""
                          };
                          const managerOptions = getManagerOptions(team, memberDraft.role, member.teamMembershipId);

                          return (
                          <li className="office-settings-pill" key={member.membershipId}>
                            <Link href={`/office/agents/${member.membershipId}`}>{member.label}</Link>
                            {canManageTeams ? (
                              <>
                                <SelectInput
                                  onChange={(event) => {
                                    const nextRole = event.target.value;
                                    setMemberDraft(member.teamMembershipId, "role", nextRole);
                                    if (nextRole === "leader_i") {
                                      setMemberDraft(member.teamMembershipId, "reportsToTeamMembershipId", "");
                                    }
                                  }}
                                  value={memberDraft.role}
                                >
                                  <option value="leader_i">Leader I</option>
                                  <option value="leader_ii">Leader II</option>
                                  <option value="member">Member</option>
                                </SelectInput>
                                <SelectInput
                                  disabled={memberDraft.role === "leader_i"}
                                  onChange={(event) =>
                                    setMemberDraft(member.teamMembershipId, "reportsToTeamMembershipId", event.target.value)
                                  }
                                  value={memberDraft.reportsToTeamMembershipId}
                                >
                                  <option value="">{memberDraft.role === "leader_i" ? "No direct manager" : "No direct manager"}</option>
                                  {managerOptions.map((option) => (
                                    <option key={option.teamMembershipId} value={option.teamMembershipId}>
                                      {option.label} · {option.role}
                                    </option>
                                  ))}
                                </SelectInput>
                                <button
                                  className="office-settings-pill-button"
                                  disabled={pendingAction === `save-member:${team.id}:${member.membershipId}`}
                                  onClick={() => handleSaveMember(team.id, member.membershipId, member.teamMembershipId)}
                                  type="button"
                                >
                                  Save
                                </button>
                              </>
                            ) : (
                              <span>
                                {member.role}
                                {member.reportsToLabel !== "No direct manager" ? ` · Reports to ${member.reportsToLabel}` : ""}
                              </span>
                            )}
                            {canManageTeams ? (
                              <button
                                className="office-settings-pill-button"
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
                                type="button"
                              >
                                Remove
                              </button>
                            ) : null}
                          </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <EmptyState description="Add members from the current roster to make this team operational." title="No team members yet" />
                    )}
                  </div>

                  {canManageTeams ? (
                    <div className="office-settings-team-assign">
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
                            if (nextRole === "leader_i") {
                              setTeamDraft(team.id, "nextReportsToTeamMembershipId", "");
                            }
                          }}
                          value={draft.nextRole}
                        >
                          <option value="leader_i">Leader I</option>
                          <option value="leader_ii">Leader II</option>
                          <option value="member">Member</option>
                        </SelectInput>
                      </FormField>

                      <FormField label="Direct manager">
                        <SelectInput
                          disabled={draft.nextRole === "leader_i"}
                          onChange={(event) => setTeamDraft(team.id, "nextReportsToTeamMembershipId", event.target.value)}
                          value={draft.nextReportsToTeamMembershipId}
                        >
                          <option value="">No direct manager</option>
                          {nextManagerOptions.map((option) => (
                            <option key={option.teamMembershipId} value={option.teamMembershipId}>
                              {option.label} · {option.role}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>

                      <Button
                        disabled={!draft.nextMembershipId || pendingAction === `add-member:${team.id}`}
                        onClick={() => handleAddMember(team.id)}
                        size="sm"
                        variant="secondary"
                      >
                        {pendingAction === `add-member:${team.id}` ? "Adding..." : "Add member"}
                      </Button>
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
