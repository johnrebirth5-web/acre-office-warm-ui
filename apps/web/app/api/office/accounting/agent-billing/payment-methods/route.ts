import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  createAgentPaymentMethod,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createAgentBillingPaymentMethodBodySchema } from "./route.schema";

type AgentBillingPaymentMethodsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createAgentPaymentMethod?: typeof createAgentPaymentMethod;
};

export async function handleCreateAgentBillingPaymentMethodPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingPaymentMethodsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createAgentBillingPaymentMethodBodySchema,
    {
      error: "Agent billing payment method payload is invalid.",
      invalidJsonError: "Agent billing payment method request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const paymentMethodId = await (
      dependencies.createAgentPaymentMethod ?? createAgentPaymentMethod
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      type: body.type,
      label: body.label,
      provider: body.provider ?? "",
      last4: body.last4 ?? "",
      isDefault: body.isDefault,
      autoPayEnabled: body.autoPayEnabled,
      externalReferenceId: body.externalReferenceId ?? "",
      status: body.status ?? "",
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ paymentMethodId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add payment method." },
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

  return handleCreateAgentBillingPaymentMethodPost(request, context);
}
