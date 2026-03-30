import { canManageOfficeSettings } from "@acre/auth";
import { getOfficeEmailDeliverySettingsSnapshot } from "@acre/db";
import { ListPageStack, PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeEmailDeliveryClient } from "./smtp-settings-client";

export default async function OfficeSettingsEmailDeliveryPage() {
  const context = await requireOfficeSession();

  if (!canManageOfficeSettings(context.currentMembership)) {
    redirect("/office/settings");
  }

  const snapshot = await getOfficeEmailDeliverySettingsSnapshot({
    organizationId: context.currentOrganization.id
  });

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip label="Source" tone="accent" value={snapshot.summary.sourceLabel} />
            <SummaryChip label="Status" value={snapshot.summary.statusLabel} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title="Email delivery"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeEmailDeliveryClient canManageSettings={canManageOfficeSettings(context.currentMembership)} snapshot={snapshot} />
      </ListPageStack>
    </PageShell>
  );
}
