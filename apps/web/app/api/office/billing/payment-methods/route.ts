import { canViewOfficeAgentBilling } from "@acre/auth";
import { createOfficeBillingPaymentMethod } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const paymentMethodId = await createOfficeBillingPaymentMethod({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: context.currentMembership.id,
      type: typeof body?.type === "string" ? body.type : "",
      label: typeof body?.label === "string" ? body.label : "",
      provider: typeof body?.provider === "string" ? body.provider : "",
      last4: typeof body?.last4 === "string" ? body.last4 : "",
      isDefault: typeof body?.isDefault === "boolean" ? body.isDefault : undefined,
      autoPayEnabled: typeof body?.autoPayEnabled === "boolean" ? body.autoPayEnabled : undefined,
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
