import { canManageOfficeTransactionFinance } from "@acre/auth";
import { updateTransactionFinance } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

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
  const body = (await request.json().catch(() => null)) as
    | {
        grossCommission?: string;
        referralFee?: string;
        officeNet?: string;
        agentNet?: string;
        financeNotes?: string;
        clientReferralFormApproved?: boolean;
        rebateAgreementSigned?: boolean;
        rebateGoogleFormSubmitted?: boolean;
        fees?: Array<{
          feeType?: string;
          rate?: string;
          amount?: string;
          selectedCalculationType?: string;
          approvalStatus?: string;
          notes?: string;
        }>;
      }
    | null;

  const transaction = await updateTransactionFinance({
    organizationId: context.currentOrganization.id,
    transactionId,
    grossCommission: body?.grossCommission,
    referralFee: body?.referralFee,
    officeNet: body?.officeNet,
    agentNet: body?.agentNet,
    financeNotes: body?.financeNotes,
    clientReferralFormApproved: body?.clientReferralFormApproved,
    rebateAgreementSigned: body?.rebateAgreementSigned,
    rebateGoogleFormSubmitted: body?.rebateGoogleFormSubmitted,
    fees: body?.fees?.map((fee) => ({
      feeType: typeof fee?.feeType === "string" ? fee.feeType : "",
      rate: typeof fee?.rate === "string" ? fee.rate : undefined,
      amount: typeof fee?.amount === "string" ? fee.amount : undefined,
      selectedCalculationType: typeof fee?.selectedCalculationType === "string" ? fee.selectedCalculationType : undefined,
      approvalStatus: typeof fee?.approvalStatus === "string" ? fee.approvalStatus : undefined,
      notes: typeof fee?.notes === "string" ? fee.notes : undefined
    })),
    actorMembershipId: context.currentMembership.id
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}
