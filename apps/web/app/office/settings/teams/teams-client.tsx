"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, EmptyState, FormField, ListPageSection, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";
import {
  getBranchLeaderLabel,
  getChildTeams,
  getDirectMembers,
  getInvalidLeaderMembers,
  getMemberNamesLabel,
  getRootTeams
} from "./team-directory-shared";

type OfficeSettingsTeamsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageTeams: boolean;
};

export function OfficeSettingsTeamsClient({ snapshot, canManageTeams }: OfficeSettingsTeamsClientProps) {
  const router = useRouter();
  const rootTeams = useMemo(() => getRootTeams(snapshot), [snapshot]);
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  async function handleCreateRootTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newTeamName.trim()) {
      return;
    }

    setPendingAction("create-root-team");
    setSubmitError("");

    try {
      const response = await fetch("/api/office/agents/teams", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: newTeamName.trim(),
          parentTeamId: null
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create team.");
      }

      setNewTeamName("");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create team.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <ListPageSection
        actions={
          canManageTeams ? (
            <Link className="office-button office-button-secondary office-button-sm" href="/office/settings/teams?view=manage">
              Advanced manage view
            </Link>
          ) : null
        }
        subtitle="Start from the top-level teams. Open a team to review its child branches and direct agents."
        title="Top-Level Teams"
      >
        {submitError ? <p className="office-inline-error">{submitError}</p> : null}

        {canManageTeams ? (
          <form className="office-settings-inline-form" onSubmit={handleCreateRootTeam}>
            <FormField className="is-wide" label="New top-level team">
              <TextInput
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Create a top-level team..."
                value={newTeamName}
              />
            </FormField>
            <Button disabled={pendingAction === "create-root-team"} type="submit">
              {pendingAction === "create-root-team" ? "Creating..." : "Create root team"}
            </Button>
          </form>
        ) : null}

        {rootTeams.length ? (
          <div className="office-settings-card-grid office-settings-team-directory-grid">
            {rootTeams.map((team) => {
              const childTeams = getChildTeams(snapshot, team.id);
              const directMembers = getDirectMembers(team);
              const invalidLeaderMembers = getInvalidLeaderMembers(team);
              const childPreview = childTeams.slice(0, 3).map((childTeam) => childTeam.name);

              return (
                <article className="office-settings-team-directory-card" key={team.id}>
                  <div className="office-settings-team-directory-card-head">
                    <div className="office-settings-team-directory-card-copy">
                      <strong>{team.name}</strong>
                      <p>Leader: {getBranchLeaderLabel(team)}</p>
                    </div>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </div>

                  <div className="office-settings-team-directory-card-meta">
                    <span>{team.memberCount} total members</span>
                    <span>{directMembers.length} direct agents</span>
                    <span>{team.childTeamCount} child branches</span>
                    <span>{team.openTransactionCount} open transactions</span>
                  </div>

                  <div className="office-settings-team-directory-card-body">
                    <p>
                      Child branches: {childPreview.length ? childPreview.join(", ") : "No child branches yet"}
                      {childTeams.length > childPreview.length ? ` +${childTeams.length - childPreview.length} more` : ""}
                    </p>
                    <p>Direct agents: {getMemberNamesLabel(directMembers)}</p>
                    {invalidLeaderMembers.length ? (
                      <p className="office-settings-team-warning">
                        {invalidLeaderMembers.length} invalid leader assignment
                        {invalidLeaderMembers.length > 1 ? "s" : ""} need cleanup in this team.
                      </p>
                    ) : null}
                  </div>

                  <div className="office-settings-team-directory-card-actions">
                    <Badge tone="neutral">Root team</Badge>
                    <Link className="office-button office-button-secondary office-button-sm" href={`/office/settings/teams/${team.id}`}>
                      View team
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="Create the first top-level team to start organizing branches and direct agents."
            title="No top-level teams yet"
          />
        )}
      </ListPageSection>
    </>
  );
}
