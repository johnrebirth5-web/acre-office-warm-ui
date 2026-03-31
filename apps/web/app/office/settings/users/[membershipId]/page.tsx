import Link from "next/link";
import {
  canManageOfficeAgents,
  canManageOfficeGoals,
  canManageOfficeOnboarding,
  canManageOfficeSettings,
  canViewOfficeSignatures,
  canManageOfficeTeams,
  canManageOfficeUsers,
  canViewOfficeAgents,
  canViewOfficeUsers
} from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import {
  getOfficeAdminUserDetailSnapshot,
  getOfficeAgentProfileSnapshot,
  type OfficeUserDetailWorkspaceSnapshot
} from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeSettingsNav } from "../../settings-nav";
import { OfficeSettingsUserWorkspaceDetailClient } from "./user-workspace-detail-client";

type OfficeSettingsUserDetailPageProps = {
  params: Promise<{
    membershipId: string;
  }>;
};

export default async function OfficeSettingsUserDetailPage({ params }: OfficeSettingsUserDetailPageProps) {
  const context = await requireOfficeSession();
  const canViewUsers = canViewOfficeUsers(context.currentMembership);
  const canViewAgents = canViewOfficeAgents(context.currentMembership);

  if (!canViewUsers && !canViewAgents) {
    redirect("/office/settings");
  }

  const { membershipId } = await params;
  const [accessSnapshot, operationsSnapshot] = await Promise.all([
    canViewUsers
      ? getOfficeAdminUserDetailSnapshot({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null,
          membershipId,
          viewerMembershipId: context.currentMembership.id
        })
      : Promise.resolve(null),
    canViewAgents
      ? getOfficeAgentProfileSnapshot({
          organizationId: context.currentOrganization.id,
          viewerMembershipId: context.currentMembership.id,
          officeId: context.currentOffice?.id ?? null,
          membershipId
        })
      : Promise.resolve(null)
  ]);

  if (!accessSnapshot && !operationsSnapshot) {
    notFound();
  }

  const snapshot: OfficeUserDetailWorkspaceSnapshot = {
    access: accessSnapshot,
    operations: operationsSnapshot
  };
  const primaryTitle = accessSnapshot?.profile.name ?? operationsSnapshot?.profile.displayName ?? "User";
  const primaryDescription = accessSnapshot
    ? `${accessSnapshot.profile.email}${accessSnapshot.profile.title ? ` · ${accessSnapshot.profile.title}` : ""}`
    : `${operationsSnapshot?.profile.email ?? ""}${operationsSnapshot?.profile.title ? ` · ${operationsSnapshot.profile.title}` : ""}`;
  const roleLabel = accessSnapshot?.profile.role ?? operationsSnapshot?.profile.role ?? "—";
  const officeLabel = accessSnapshot?.profile.officeAccessLabel ?? operationsSnapshot?.profile.officeName ?? "—";

  return (
    <PageShell className="office-detail-page office-settings-user-detail-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <Link className="office-button office-button-secondary office-button-sm" href="/office/settings/users">
              Back to users
            </Link>
            {canViewOfficeSignatures(context.currentMembership) ? (
              <Link
                className="office-button office-button-secondary office-button-sm"
                href={`/office/signatures?category=hr&subjectMembershipId=${encodeURIComponent(membershipId)}`}
              >
                HR signatures
              </Link>
            ) : null}
            <SummaryChip label={accessSnapshot ? "Office access" : "Office"} value={officeLabel} />
            <SummaryChip label="Role" value={roleLabel} />
            {accessSnapshot ? (
              <>
                <SummaryChip label="Permissions" tone="accent" value={accessSnapshot.permissions.effectivePermissions.length} />
                <SummaryChip label="Overrides" value={accessSnapshot.permissions.overrides.length} />
              </>
            ) : null}
            {operationsSnapshot && !accessSnapshot ? (
              <>
                <SummaryChip label="Membership" tone="accent" value={operationsSnapshot.profile.membershipStatus} />
                <SummaryChip label="Onboarding" value={operationsSnapshot.profile.onboardingStatus} />
              </>
            ) : null}
          </PageHeaderSummary>
        }
        description={primaryDescription}
        eyebrow="Office admin"
        title={primaryTitle}
      />

      <div className="office-list-page-stack office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsUserWorkspaceDetailClient
          canManageAgents={canManageOfficeAgents(context.currentMembership)}
          canManageGoals={canManageOfficeGoals(context.currentMembership)}
          canManageOnboarding={canManageOfficeOnboarding(context.currentMembership)}
          canManageSensitiveUsers={canManageOfficeSettings(context.currentMembership)}
          canManageTeams={canManageOfficeTeams(context.currentMembership)}
          canManageUsers={canManageOfficeUsers(context.currentMembership)}
          snapshot={snapshot}
        />
      </div>
    </PageShell>
  );
}
