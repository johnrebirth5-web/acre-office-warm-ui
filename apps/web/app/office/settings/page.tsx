import { canAccessOfficeSettings } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeSettingsSummarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { KpiStrip } from "../../_components/kpi-strip";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeSettingsNav } from "./settings-nav";

export default async function OfficeSettingsPage() {
  const context = await requireOfficeSession();

  if (!canAccessOfficeSettings(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeSettingsSummarySnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Active users" tone="accent" value={snapshot.summary.activeUsersCount} />
            <SummaryChip label="Teams" value={snapshot.summary.teamsCount} />
          </>
        }
        title="Settings"
      />

      <KpiStrip
        className="office-settings-summary-strip"
        items={[
          { label: "Users", value: snapshot.summary.usersCount },
          { label: "Teams", value: snapshot.summary.teamsCount },
          { label: "Required roles", value: snapshot.summary.requiredRoleCount },
          { label: "Checklists", value: snapshot.summary.checklistTemplateCount }
        ]}
      />

      <OfficeSettingsNav currentAccess={context.currentMembership} />
      <p className="office-settings-start-hint">Pick a section above to start.</p>
    </OfficeListPageShell>
  );
}
