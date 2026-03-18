"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, ConfirmActionDialog, FormField, SectionCard, SelectInput, StatusBadge } from "@acre/ui";

type TeamAssignmentManagerOption = {
  teamMembershipId: string;
  label: string;
  role: string;
};

type TeamAssignmentAvailableTeam = {
  id: string;
  label: string;
  managerOptions: TeamAssignmentManagerOption[];
  defaultReportsToTeamMembershipId: string | null;
};

type TeamAssignmentTeam = {
  id: string;
  name: string;
  roleLabel: string;
  reportsToLabel: string;
  isActive: boolean;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type UserTeamAssignmentsCardProps = {
  membershipId: string;
  memberName: string;
  teams: TeamAssignmentTeam[];
  availableTeams: TeamAssignmentAvailableTeam[];
  canManageTeams: boolean;
};

export function UserTeamAssignmentsCard({
  membershipId,
  memberName,
  teams,
  availableTeams,
  canManageTeams
}: UserTeamAssignmentsCardProps) {
  const router = useRouter();
  const initialAssignableTeam = availableTeams[0] ?? null;
  const [selectedTeamId, setSelectedTeamId] = useState(initialAssignableTeam?.id ?? "");
  const [selectedReportsToTeamMembershipId, setSelectedReportsToTeamMembershipId] = useState(
    initialAssignableTeam?.defaultReportsToTeamMembershipId ?? ""
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const selectedTeamOption = useMemo(
    () => availableTeams.find((team) => team.id === selectedTeamId) ?? null,
    [availableTeams, selectedTeamId]
  );

  useEffect(() => {
    const nextInitialTeam = availableTeams[0] ?? null;
    const teamStillAvailable = availableTeams.some((team) => team.id === selectedTeamId);

    if (!teamStillAvailable) {
      setSelectedTeamId(nextInitialTeam?.id ?? "");
      setSelectedReportsToTeamMembershipId(nextInitialTeam?.defaultReportsToTeamMembershipId ?? "");
      return;
    }

    const managerStillAvailable = selectedTeamOption?.managerOptions.some(
      (manager) => manager.teamMembershipId === selectedReportsToTeamMembershipId
    );

    if (!managerStillAvailable) {
      setSelectedReportsToTeamMembershipId(selectedTeamOption?.defaultReportsToTeamMembershipId ?? "");
    }
  }, [availableTeams, selectedReportsToTeamMembershipId, selectedTeamId, selectedTeamOption]);

  function handleSelectedTeamChange(nextTeamId: string) {
    setSelectedTeamId(nextTeamId);
    const nextTeam = availableTeams.find((team) => team.id === nextTeamId) ?? null;
    setSelectedReportsToTeamMembershipId(nextTeam?.defaultReportsToTeamMembershipId ?? "");
  }

  async function handleAssignTeam() {
    if (!selectedTeamId) {
      return;
    }

    setPendingAction("assign-team");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${selectedTeamId}/memberships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId,
          role: "member",
          reportsToTeamMembershipId: selectedReportsToTeamMembershipId || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to add member to team.");
      }

      router.refresh();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to add member to team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveTeam(teamId: string) {
    setPendingAction(`remove-team:${teamId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}/memberships/${membershipId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to remove member from team.");
      }

      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove member from team.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      {error ? <p className="office-inline-error">{error}</p> : null}
      <SectionCard subtitle="Team memberships for this member. Add or remove roster assignments here." title="Teams">
        <div className="office-agents-profile-team-list">
          {teams.map((team) => (
            <div className="office-agents-profile-team-row" key={team.id}>
              <div>
                <Link href={`/office/settings/users?view=operations&teamId=${team.id}`}>{team.name}</Link>
                <p>
                  {team.roleLabel}
                  {team.reportsToLabel !== "No direct manager" ? ` · Reports to ${team.reportsToLabel}` : ""}
                </p>
              </div>
              <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
              {canManageTeams ? (
                <Button
                  disabled={pendingAction === `remove-team:${team.id}`}
                  onClick={() =>
                    setConfirmDialog({
                      title: `Remove ${memberName} from ${team.name}?`,
                      description: "This will remove the current assignment to this team.",
                      confirmLabel: "Remove from team",
                      onConfirm: () => {
                        void handleRemoveTeam(team.id);
                      }
                    })
                  }
                  size="sm"
                  variant="ghost"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {teams.length === 0 ? <p className="office-form-helper">No team assignments yet.</p> : null}
        </div>

        {canManageTeams && availableTeams.length ? (
          <div className="office-inline-form">
            <FormField label="Team">
              <SelectInput onChange={(event) => handleSelectedTeamChange(event.target.value)} value={selectedTeamId}>
                <option value="">Select team to assign</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Direct manager">
              <SelectInput
                disabled={!selectedTeamOption || selectedTeamOption.managerOptions.length === 0}
                onChange={(event) => setSelectedReportsToTeamMembershipId(event.target.value)}
                value={selectedReportsToTeamMembershipId}
              >
                <option value="">No direct manager</option>
                {(selectedTeamOption?.managerOptions ?? []).map((manager) => (
                  <option key={manager.teamMembershipId} value={manager.teamMembershipId}>
                    {manager.label} · {manager.role}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <Button disabled={!selectedTeamId || pendingAction === "assign-team"} onClick={handleAssignTeam} type="button">
              {pendingAction === "assign-team" ? "Assigning..." : "Add to team"}
            </Button>
          </div>
        ) : null}

        {canManageTeams && availableTeams.length === 0 ? (
          <p className="office-form-helper">No additional team assignments are available in the current office scope.</p>
        ) : null}
      </SectionCard>

      <ConfirmActionDialog
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          const action = confirmDialog;
          setConfirmDialog(null);
          action?.onConfirm();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </>
  );
}
