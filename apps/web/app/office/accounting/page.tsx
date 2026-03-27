import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { getOfficeAgentPayoutStatementsWorkspaceSnapshot } from "@acre/db";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeAccountingClient } from "./accounting-client";

type OfficeAccountingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function readSearchParamArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean)));
  }

  if (typeof value !== "string") {
    return [];
  }

  return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
}

export default async function OfficeAccountingPage(props: OfficeAccountingPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: readSearchParamValue(searchParams.membershipId),
    invoiceNumbers: readSearchParamArray(searchParams.invoiceNumber),
    statementId: readSearchParamValue(searchParams.statementId)
  });
  const initialReviewTransactionId = readSearchParamValue(searchParams.reviewTransactionId) ?? null;

  return (
    <PageShell className="office-list-page office-accounting-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Invoice candidates" tone="accent" value={snapshot.filters.invoiceOptions.length} />
            <SummaryChip label="Saved statements" value={snapshot.history.length} />
            <SummaryChip label="Current basis" value="Invoice number" />
          </PageHeaderSummary>
        }
        description="Generate agent payout statements from selected invoice numbers, save a durable snapshot, and download a PDF."
        eyebrow="Accounting"
        title="Agent Statements"
      />

      <OfficeAccountingClient initialReviewTransactionId={initialReviewTransactionId} snapshot={snapshot} />
    </PageShell>
  );
}
