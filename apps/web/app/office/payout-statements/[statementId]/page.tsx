import Link from "next/link";
import { getOfficeAgentPayoutStatementDetail } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import {
  OfficeDetailPageHeader,
  OfficeDetailPageShell,
} from "../../_components/office-detail-page-template";
import { PayoutStatementReviewClient } from "./payout-statement-review-client";

type OfficePayoutStatementPageProps = {
  params: Promise<{
    statementId: string;
  }>;
};

export default async function OfficePayoutStatementPage({
  params,
}: OfficePayoutStatementPageProps) {
  const context = await requireOfficeSession();
  const { statementId } = await params;
  const statement = await getOfficeAgentPayoutStatementDetail({
    organizationId: context.currentOrganization.id,
    statementId,
  });

  if (!statement) {
    redirect("/office/dashboard");
  }

  if (
    statement.membershipId !== context.currentMembership.id ||
    statement.reviewStatus === "draft"
  ) {
    redirect("/office/dashboard");
  }

  return (
    <OfficeDetailPageShell className="office-payout-statement-page">
      <OfficeDetailPageHeader
        description="Review your payout statement, confirm it, or request a finance revision directly inside Acre."
        eyebrow="My payout statement"
        summary={
          <>
            <Link
              className="office-button-secondary office-button-sm"
              href="/office/dashboard"
            >
              Back to dashboard
            </Link>
            <a
              className="office-button-secondary office-button-sm"
              href={`/api/office/accounting/self-service/statements/${statement.id}/pdf`}
              rel="noreferrer"
              target="_blank"
            >
              Download PDF
            </a>
            <SummaryChip
              label="Status"
              tone="accent"
              value={statement.reviewStatusLabel}
            />
            <SummaryChip label="Period" value={statement.periodLabel} />
            <SummaryChip
              label="Final payout"
              tone="accent"
              value={statement.totalStatementAmountLabel}
            />
          </>
        }
        title={statement.agentLabel}
      />

      <PayoutStatementReviewClient statement={statement} />
    </OfficeDetailPageShell>
  );
}
