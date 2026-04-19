import { canViewOfficeAgentBilling } from "@acre/auth";
import { createOfficeBillingPaymentMethod, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createOfficeBillingPaymentMethodBodySchema } from "./route.schema";

type OfficeBillingPaymentMethodsRouteDependencies = {
  createOfficeBillingPaymentMethod?: typeof createOfficeBillingPaymentMethod;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateOfficeBillingPaymentMethodPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeBillingPaymentMethodsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createOfficeBillingPaymentMethodBodySchema,
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
    const paymentMethodId = await (
      dependencies.createOfficeBillingPaymentMethod ?? createOfficeBillingPaymentMethod
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: context.currentMembership.id,
      type: body.type,
      label: body.label,
      provider: body.provider ?? "",
      last4: body.last4 ?? "",
      isDefault: body.isDefault,
      autoPayEnabled: body.autoPayEnabled,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ paymentMethodId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save payment method." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  return handleCreateOfficeBillingPaymentMethodPost(request, context);
}
