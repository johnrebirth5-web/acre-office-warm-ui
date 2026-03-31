import { getOfficeAgentPayoutStatementDetail } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { PayoutStatementReviewClient } from "./payout-statement-review-client";

type OfficePayoutStatementPageProps = {
  params: Promise<{
    statementId: string;
  }>;
};

export default async function OfficePayoutStatementPage({ params }: OfficePayoutStatementPageProps) {
  const context = await requireOfficeSession();
  const { statementId } = await params;
  const statement = await getOfficeAgentPayoutStatementDetail({
    organizationId: context.currentOrganization.id,
    statementId
  });

  if (!statement) {
    redirect("/office/dashboard");
  }

  if (statement.membershipId !== context.currentMembership.id || statement.reviewStatus === "draft") {
    redirect("/office/dashboard");
  }

  return <PayoutStatementReviewClient statement={statement} />;
}
