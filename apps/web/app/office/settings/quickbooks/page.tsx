import { canManageOfficeSettings } from "@acre/auth";
import { getOfficeQuickBooksSettingsSnapshot } from "@acre/db";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeQuickBooksSettingsClient } from "./quickbooks-settings-client";

type OfficeSettingsQuickBooksPageProps = {
  searchParams?: Promise<{
    quickbooks?: string;
    message?: string;
  }>;
};

function buildFlashMessage(params: {
  quickbooks?: string;
  message?: string;
}) {
  if (params.quickbooks === "connected") {
    return {
      tone: "success" as const,
      message: "QuickBooks Online connected and company info verified."
    };
  }

  if (params.quickbooks === "error") {
    return {
      tone: "error" as const,
      message: params.message || "QuickBooks connection failed."
    };
  }

  return null;
}

export default async function OfficeSettingsQuickBooksPage(props: OfficeSettingsQuickBooksPageProps) {
  const context = await requireOfficeSession();

  if (!canManageOfficeSettings(context.currentMembership)) {
    redirect("/office/settings");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeQuickBooksSettingsSnapshot({
    organizationId: context.currentOrganization.id
  });

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip label="Status" tone={snapshot.summary.statusTone === "success" ? "accent" : "default"} value={snapshot.summary.statusLabel} />
            <SummaryChip label="Environment" value={snapshot.summary.environmentLabel} />
          </>
        }
        title="QuickBooks"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeQuickBooksSettingsClient
          canManageSettings={canManageOfficeSettings(context.currentMembership)}
          flashMessage={buildFlashMessage(searchParams)}
          snapshot={snapshot}
        />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
