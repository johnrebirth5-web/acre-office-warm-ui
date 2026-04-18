import { canManageOfficeTransactionFinance } from "@acre/auth";
import { updateTransactionFinance } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { transactionFinanceBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTransactionFinance(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction finance access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const parsedBody = await parseJsonBody(request, transactionFinanceBodySchema, {
    error: "Finance update payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const transaction = await updateTransactionFinance({
    organizationId: context.currentOrganization.id,
    transactionId,
    grossCommission: parsedBody.data.grossCommission,
    referralFee: parsedBody.data.referralFee,
    officeNet: parsedBody.data.officeNet,
    agentNet: parsedBody.data.agentNet,
    financeNotes: parsedBody.data.financeNotes,
    clientReferralFormApproved: parsedBody.data.clientReferralFormApproved,
    rebateAgreementSigned: parsedBody.data.rebateAgreementSigned,
    rebateGoogleFormSubmitted: parsedBody.data.rebateGoogleFormSubmitted,
    fees: parsedBody.data.fees?.map((fee) => ({
      feeType: fee.feeType,
      rate: fee.rate,
      amount: fee.amount,
      selectedCalculationType: fee.selectedCalculationType,
      approvalStatus: fee.approvalStatus,
      notes: fee.notes,
    })),
    actorMembershipId: context.currentMembership.id
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}
