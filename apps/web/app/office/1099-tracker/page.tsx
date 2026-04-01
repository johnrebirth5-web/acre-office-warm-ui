import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099TrackerWorkspaceSnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { Office1099TrackerClient } from "./1099-tracker-client";

type Office1099TrackerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function Office1099TrackerPage(props: Office1099TrackerPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOffice1099TrackerWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    tab: readSearchParamValue(searchParams.tab),
    taxYear: readSearchParamValue(searchParams.taxYear),
    membershipId: readSearchParamValue(searchParams.membershipId)
  });

  return (
    <OfficeListPageShell className="office-1099-tracker-page">
      <OfficeListPageHeader
        description="Track actual payments made to agents by tax year, review the internal 1099 summary, and export a backup PDF per agent."
        eyebrow="Accounting"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Tax year" tone="accent" value={snapshot.filters.taxYear} />
            <SummaryChip
              label={snapshot.tab === "summary" ? "Summary rows" : "Selectable agents"}
              value={snapshot.tab === "summary" ? snapshot.summaryRows.length : snapshot.filters.memberOptions.length}
            />
          </>
        }
        title="1099 Tracker"
      />

      <Office1099TrackerClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
