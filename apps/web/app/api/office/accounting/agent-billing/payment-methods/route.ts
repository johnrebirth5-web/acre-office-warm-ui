import { canManageOfficeAgentBilling } from "@acre/auth";
import { createAgentPaymentMethod } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const paymentMethodId = await createAgentPaymentMethod({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      type: typeof body?.type === "string" ? body.type : "",
      label: typeof body?.label === "string" ? body.label : "",
      provider: typeof body?.provider === "string" ? body.provider : "",
      last4: typeof body?.last4 === "string" ? body.last4 : "",
      isDefault: typeof body?.isDefault === "boolean" ? body.isDefault : undefined,
      autoPayEnabled: typeof body?.autoPayEnabled === "boolean" ? body.autoPayEnabled : undefined,
      externalReferenceId: typeof body?.externalReferenceId === "string" ? body.externalReferenceId : "",
      status: typeof body?.status === "string" ? body.status : "",
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
