import Link from "next/link";
import { canManageOfficeSettings, canViewOfficeUsers } from "@acre/auth";
import { getOfficeAdminUserDetailSnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../../../_components/office-detail-page-template";
import { OfficeSettingsUserPermissionsClient } from "./permissions-client";

type OfficeSettingsUserPermissionsPageProps = {
  params: Promise<{
    membershipId: string;
  }>;
};

export default async function OfficeSettingsUserPermissionsPage({ params }: OfficeSettingsUserPermissionsPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeUsers(context.currentMembership)) {
    redirect("/office/settings");
  }

  const { membershipId } = await params;
  const snapshot = await getOfficeAdminUserDetailSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <OfficeDetailPageShell className="office-user-permissions-route">
      <OfficeDetailPageHeader
        description={`Review and override the ${snapshot.permissions.roleLabel} permission template for ${snapshot.profile.name}.`}
        eyebrow="Office admin"
        summary={
          <>
            <Link className="office-button-secondary office-button-sm" href={`/office/settings/users/${snapshot.profile.membershipId}`}>
              Back to user
            </Link>
            <SummaryChip label="Role template" value={snapshot.permissions.roleLabel} />
            <SummaryChip label="Effective permissions" tone="accent" value={snapshot.permissions.effectivePermissions.length} />
            <SummaryChip label="Overrides" value={snapshot.permissions.overrides.length} />
          </>
        }
        title="Permissions"
      />
      <OfficeSettingsUserPermissionsClient
        canManagePermissions={canManageOfficeSettings(context.currentMembership)}
        snapshot={snapshot}
      />
    </OfficeDetailPageShell>
  );
}
