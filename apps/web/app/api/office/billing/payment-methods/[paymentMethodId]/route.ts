import { canViewOfficeAgentBilling } from "@acre/auth";
import { updateOfficeBillingPaymentMethod, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateOfficeBillingPaymentMethodBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    paymentMethodId: string;
  }>;
};

type OfficeBillingPaymentMethodDetailRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateOfficeBillingPaymentMethod?: typeof updateOfficeBillingPaymentMethod;
};

export async function handleUpdateOfficeBillingPaymentMethodPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  paymentMethodId: string,
  dependencies: OfficeBillingPaymentMethodDetailRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeBillingPaymentMethodBodySchema,
    {
      error: "Billing payment method payload is invalid.",
      invalidJsonError: "Billing payment method request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const updatedId = await (
      dependencies.updateOfficeBillingPaymentMethod ?? updateOfficeBillingPaymentMethod
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: context.currentMembership.id,
      paymentMethodId,
      type: body.type,
      label: body.label,
      provider: body.provider,
      last4: body.last4,
      isDefault: body.isDefault,
      autoPayEnabled: body.autoPayEnabled,
      remove: body.action === "remove",
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

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  const { paymentMethodId } = await params;

  return handleUpdateOfficeBillingPaymentMethodPatch(request, context, paymentMethodId);
}
