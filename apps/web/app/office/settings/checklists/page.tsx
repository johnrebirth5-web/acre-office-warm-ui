import { canManageOfficeChecklists, canViewOfficeChecklists } from "@acre/auth";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { getOfficeChecklistTemplatesSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSettingsChecklistsClient } from "./checklists-client";

export default async function OfficeSettingsChecklistsPage() {
  const context = await requireOfficeSession();

  if (!canViewOfficeChecklists(context.currentMembership)) {
    redirect("/office/settings");
  }

  const snapshot = await getOfficeChecklistTemplatesSnapshot({
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
            <SummaryChip label="Templates" tone="accent" value={snapshot.summary.totalTemplates} />
            <SummaryChip label="Checklist items" value={snapshot.summary.totalItems} />
            <SummaryChip label="Active templates" value={snapshot.summary.activeTemplates} />
          </>
        }
        title="Checklists"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsChecklistsClient canManageChecklists={canManageOfficeChecklists(context.currentMembership)} snapshot={snapshot} />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
