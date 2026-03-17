import { canManageOfficeFields, canViewOfficeFields } from "@acre/auth";
import { ListPageStack, PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeFieldSettingsSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSettingsFieldsClient } from "./fields-client";

type OfficeSettingsFieldsPageProps = {
  searchParams?: Promise<{
    module?: string;
  }>;
};

export default async function OfficeSettingsFieldsPage({ searchParams }: OfficeSettingsFieldsPageProps) {
  const context = await requireOfficeSession();
  const canManageFields = canManageOfficeFields(context.currentMembership);
  const params = (await searchParams) ?? {};

  if (!canViewOfficeFields(context.currentMembership) || !canManageFields) {
    redirect("/office/settings");
  }

  const snapshot = await getOfficeFieldSettingsSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    selectedModule: params.module
  });
  const currentModule = snapshot.currentModule;

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip
              label="Editing"
              tone="accent"
              value={currentModule.label}
            />
            <SummaryChip
              label="Scope"
              value={
                currentModule.module === "contact"
                  ? context.currentOrganization.name
                  : context.currentOffice?.name ?? context.currentOrganization.name
              }
            />
            <SummaryChip label="Visible fields" value={currentModule.summary.visibleFieldCount} />
            <SummaryChip label="Hidden fields" value={currentModule.summary.hiddenFieldCount} />
            <SummaryChip label="Custom fields" value={currentModule.summary.customFieldCount} />
          </PageHeaderSummary>
        }
        description="Manage field structure for transaction, contact, and offer workflows from one centralized admin surface."
        eyebrow="Office admin"
        title="Fields"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsFieldsClient canManageFields={canManageFields} snapshot={snapshot} />
      </ListPageStack>
    </PageShell>
  );
}
