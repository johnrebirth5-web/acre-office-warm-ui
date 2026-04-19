import { canManageOfficePayments } from "@acre/auth";
import {
  recordAgentBillingPayment,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { recordAgentBillingPaymentBodySchema } from "./route.schema";

type AgentBillingPaymentsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  recordAgentBillingPayment?: typeof recordAgentBillingPayment;
};

export async function handleCreateAgentBillingPaymentPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingPaymentsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    recordAgentBillingPaymentBodySchema,
    {
      error: "Agent billing payment payload is invalid.",
      invalidJsonError: "Agent billing payment request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const paymentId = await (
      dependencies.recordAgentBillingPayment ?? recordAgentBillingPayment
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      invoiceIds: body.invoiceIds,
      amount: body.amount ?? "",
      accountingDate: body.accountingDate,
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber ?? "",
      notes: body.notes ?? "",
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ paymentId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record billing payment." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficePayments(context.currentMembership)) {
    return NextResponse.json({ error: "Payments management access required." }, { status: 403 });
  }

  return handleCreateAgentBillingPaymentPost(request, context);
}
