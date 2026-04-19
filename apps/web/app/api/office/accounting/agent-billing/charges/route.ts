import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  createAgentBillingCharges,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createAgentBillingChargesBodySchema } from "./route.schema";

type AgentBillingChargesRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createAgentBillingCharges?: typeof createAgentBillingCharges;
};

export async function handleCreateAgentBillingChargesPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingChargesRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createAgentBillingChargesBodySchema,
    {
      error: "Agent billing charges payload is invalid.",
      invalidJsonError: "Agent billing charges request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const transactionIds = await (
      dependencies.createAgentBillingCharges ?? createAgentBillingCharges
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipIds: body.membershipIds,
      chargeType: body.chargeType,
      description: body.description ?? "",
      amount: body.amount,
      accountingDate: body.accountingDate,
      dueDate: body.dueDate ?? "",
      relatedTransactionId: body.relatedTransactionId ?? "",
      notes: body.notes ?? "",
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ transactionIds }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create agent billing charge." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  return handleCreateAgentBillingChargesPost(request, context);
}
