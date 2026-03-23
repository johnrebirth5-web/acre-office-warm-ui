import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { getOfficeAgentPayoutStatementsWorkspaceSnapshot } from "@acre/db";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeAccountingClient } from "./accounting-client";

type OfficeAccountingPageProps = {
  searchParams?: Promise<{
    membershipId?: string;
    periodStart?: string;
    periodEnd?: string;
    periodBasis?: string;
    statementId?: string;
  }>;
};

export default async function OfficeAccountingPage(props: OfficeAccountingPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: searchParams.membershipId,
    periodStart: searchParams.periodStart,
    periodEnd: searchParams.periodEnd,
    periodBasis: searchParams.periodBasis,
    statementId: searchParams.statementId
  });

  return (
    <PageShell className="office-list-page office-accounting-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Candidates" tone="accent" value={snapshot.candidateRows.length} />
            <SummaryChip label="Saved statements" value={snapshot.history.length} />
            <SummaryChip
              label="Current basis"
              value={snapshot.filters.periodBasis === "closing_date" ? "Closing date" : "Calculated date"}
            />
          </PageHeaderSummary>
        }
        description="Generate agent payout statements from statement-ready commission rows, save a durable snapshot, and download a PDF."
        eyebrow="Accounting"
        title="Agent Statements"
      />

      <OfficeAccountingClient snapshot={snapshot} />
    </PageShell>
  );
}
