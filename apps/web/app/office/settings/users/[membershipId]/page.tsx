import Link from "next/link";
import { canManageOfficeUsers, canViewOfficeUsers } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAdminUserDetailSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeSettingsNav } from "../../settings-nav";
import { OfficeSettingsUserDetailClient } from "./user-detail-client";

type OfficeSettingsUserDetailPageProps = {
  params: Promise<{
    membershipId: string;
  }>;
};

export default async function OfficeSettingsUserDetailPage({ params }: OfficeSettingsUserDetailPageProps) {
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
    <PageShell className="office-detail-page office-settings-user-detail-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <Link className="office-button office-button-secondary office-button-sm" href="/office/settings/users">
              Back to users
            </Link>
            <SummaryChip label="Office access" value={snapshot.profile.officeAccessLabel} />
            <SummaryChip label="Role" value={snapshot.profile.role} />
            <SummaryChip label="Permissions" tone="accent" value={snapshot.permissions.effectivePermissions.length} />
            <SummaryChip label="Overrides" value={snapshot.permissions.overrides.length} />
          </PageHeaderSummary>
        }
        description={`${snapshot.profile.email}${snapshot.profile.title ? ` · ${snapshot.profile.title}` : ""}`}
        eyebrow="Office admin"
        title={snapshot.profile.name}
      />

      <div className="office-list-page-stack office-settings-list-stack">
        <OfficeSettingsNav />
        <OfficeSettingsUserDetailClient canManageUsers={canManageOfficeUsers(context.currentMembership)} snapshot={snapshot} />
      </div>
    </PageShell>
  );
}
