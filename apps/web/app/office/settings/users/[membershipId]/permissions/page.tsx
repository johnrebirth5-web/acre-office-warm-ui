import { canManageOfficeSettings, canViewOfficeUsers } from "@acre/auth";
import { getOfficeAdminUserDetailSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
import { OfficeDetailPageShell } from "../../../../_components/office-detail-page-template";
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
      <OfficeSettingsUserPermissionsClient
        canManagePermissions={canManageOfficeSettings(context.currentMembership)}
        snapshot={snapshot}
      />
    </OfficeDetailPageShell>
  );
}
