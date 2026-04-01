import { canManageOfficeFields, canViewOfficeFields } from "@acre/auth";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { getOfficeFieldSettingsSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
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
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
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
          </>
        }
        title="Fields"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsFieldsClient canManageFields={canManageFields} snapshot={snapshot} />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
