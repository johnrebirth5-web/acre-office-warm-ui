import { canManageOfficeSettings } from "@acre/auth";
import { getOfficeEmailDeliverySettingsSnapshot } from "@acre/db";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
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
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip label="Source" tone="accent" value={snapshot.summary.sourceLabel} />
            <SummaryChip
              label="Transport"
              tone={snapshot.summary.transportTone === "accent" ? "accent" : "default"}
              value={snapshot.summary.transportLabel}
            />
            <SummaryChip label="Status" value={snapshot.summary.statusLabel} />
          </>
        }
        title="Email delivery"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeEmailDeliveryClient canManageSettings={canManageOfficeSettings(context.currentMembership)} snapshot={snapshot} />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
