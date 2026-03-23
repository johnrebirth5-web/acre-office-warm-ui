"use client";

import type { OfficeUserDetailWorkspaceSnapshot } from "@acre/db";
import { OfficeSettingsUserDetailClient } from "./user-detail-client";
import { UserOperationsDetailSections } from "./user-operations-detail-sections";

type OfficeSettingsUserWorkspaceDetailClientProps = {
  snapshot: OfficeUserDetailWorkspaceSnapshot;
  canManageUsers: boolean;
  canManageSensitiveUsers: boolean;
  canManageAgents: boolean;
  canManageOnboarding: boolean;
  canManageGoals: boolean;
  canManageTeams: boolean;
};

export function OfficeSettingsUserWorkspaceDetailClient({
  snapshot,
  canManageUsers,
  canManageSensitiveUsers,
  canManageAgents,
  canManageOnboarding,
  canManageGoals,
  canManageTeams
}: OfficeSettingsUserWorkspaceDetailClientProps) {
  const accessMode = snapshot.operations ? "access-only" : "full";

  return (
    <div className="office-settings-user-detail-stack">
      {snapshot.access ? (
        <OfficeSettingsUserDetailClient
          canManageSensitiveUsers={canManageSensitiveUsers}
          canManageTeams={canManageTeams}
          canManageUsers={canManageUsers}
          mode={accessMode}
          operationsHref={snapshot.operations ? "#profile" : undefined}
          snapshot={snapshot.access}
        />
      ) : null}

      {snapshot.operations ? (
        <UserOperationsDetailSections
          canManageAgents={canManageAgents}
          canManageGoals={canManageGoals}
          canManageOnboarding={canManageOnboarding}
          canManageTeams={canManageTeams}
          snapshot={snapshot.operations}
        />
      ) : null}
    </div>
  );
}
