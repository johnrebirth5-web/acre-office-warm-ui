import { canManageOfficePayments } from "@acre/auth";
import {
  applyAgentBillingCreditMemo,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { applyAgentBillingCreditMemoBodySchema } from "./route.schema";

type AgentBillingCreditApplicationsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  applyAgentBillingCreditMemo?: typeof applyAgentBillingCreditMemo;
};

export async function handleCreateAgentBillingCreditApplicationPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingCreditApplicationsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    applyAgentBillingCreditMemoBodySchema,
    {
      error: "Agent billing credit application payload is invalid.",
      invalidJsonError: "Agent billing credit application request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const result = await (
      dependencies.applyAgentBillingCreditMemo ?? applyAgentBillingCreditMemo
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      creditMemoId: body.creditMemoId,
      invoiceId: body.invoiceId,
      amount: body.amount ?? "",
      memo: body.memo ?? "",
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply credit memo." },
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

  return handleCreateAgentBillingCreditApplicationPost(request, context);
}
