import { canManageOfficeSettings, canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureDriveSettingsSnapshot } from "@acre/db";
import { ListPageStack, PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSignatureDriveSettingsClient } from "./signature-drive-settings-client";

export default async function OfficeSettingsSignatureDrivePage() {
  const context = await requireOfficeSession();
  const canManage = canManageOfficeSettings(context.currentMembership) || canManageOfficeSignatureTemplates(context.currentMembership);

  if (!canManage) {
    redirect("/office/settings");
  }

  const snapshot = await getOfficeSignatureDriveSettingsSnapshot({
    organizationId: context.currentOrganization.id
  });

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip label="Status" tone={snapshot.summary.statusTone === "success" ? "accent" : "default"} value={snapshot.summary.statusLabel} />
            <SummaryChip label="Folder targets" tone="accent" value={snapshot.summary.configuredFolderCount} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title="Signature Drive"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSignatureDriveSettingsClient canManageSettings={canManage} snapshot={snapshot} />
      </ListPageStack>
    </PageShell>
  );
}
