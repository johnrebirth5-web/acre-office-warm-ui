import { canManageOfficeSettings } from "@acre/auth";
import { getOrganizationRoleTemplatesSnapshot } from "@acre/db";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSettingsRolesClient } from "./roles-client";

export default async function OfficeSettingsRolesPage() {
  const context = await requireOfficeSession();

  if (!canManageOfficeSettings(context.currentMembership)) {
    redirect("/office/settings");
  }

  const snapshot = await getOrganizationRoleTemplatesSnapshot(context.currentOrganization.id);
  const totalMembers = snapshot.roles.reduce((sum, roleTemplate) => sum + roleTemplate.memberCount, 0);

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip label="Role templates" tone="accent" value={snapshot.roles.length} />
            <SummaryChip label="Assigned members" value={totalMembers} />
          </PageHeaderSummary>
        }
        description="Manage the organization-level permission template for each fixed Back Office role. Template changes flow into every member on that role unless a user-specific allow or deny override exists."
        eyebrow="Office admin"
        title="Roles"
      />

      <div className="office-list-page-stack office-settings-list-stack">
        <OfficeSettingsNav />
        <OfficeSettingsRolesClient canManageSettings={canManageOfficeSettings(context.currentMembership)} snapshot={snapshot} />
      </div>
    </PageShell>
  );
}
