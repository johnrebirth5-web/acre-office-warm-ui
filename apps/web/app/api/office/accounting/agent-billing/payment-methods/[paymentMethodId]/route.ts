import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  updateAgentPaymentMethod,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateAgentBillingPaymentMethodBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    paymentMethodId: string;
  }>;
};

type AgentBillingPaymentMethodDetailRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateAgentPaymentMethod?: typeof updateAgentPaymentMethod;
};

export async function handleUpdateAgentBillingPaymentMethodPatch(
  request: NextRequest,
  paymentMethodId: string,
  context: SessionMembershipContext,
  dependencies: AgentBillingPaymentMethodDetailRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateAgentBillingPaymentMethodBodySchema,
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
    const updatedId = await (
      dependencies.updateAgentPaymentMethod ?? updateAgentPaymentMethod
    )({
      organizationId: context.currentOrganization.id,
      paymentMethodId,
      officeId:
        body.officeId === undefined || body.officeId === null
          ? context.currentOffice?.id ?? null
          : body.officeId,
      membershipId: body.membershipId,
      type: body.type,
      label: body.label,
      provider: body.provider,
      last4: body.last4,
      isDefault: body.isDefault,
      autoPayEnabled: body.autoPayEnabled,
      externalReferenceId: body.externalReferenceId,
      status: body.status,
      actorMembershipId: context.currentMembership.id
    });

    if (!updatedId) {
      return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
    }

    return NextResponse.json({ paymentMethodId: updatedId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update payment method." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  const { paymentMethodId } = await params;
  return handleUpdateAgentBillingPaymentMethodPatch(request, paymentMethodId, context);
}
