import { canManageOfficeAgentBilling } from "@acre/auth";
import { updateAgentPaymentMethod } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    paymentMethodId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  const { paymentMethodId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const updatedId = await updateAgentPaymentMethod({
      organizationId: context.currentOrganization.id,
      paymentMethodId,
      officeId: typeof body?.officeId === "string" ? body.officeId : context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : undefined,
      type: typeof body?.type === "string" ? body.type : undefined,
      label: typeof body?.label === "string" ? body.label : undefined,
      provider: typeof body?.provider === "string" ? body.provider : undefined,
      last4: typeof body?.last4 === "string" ? body.last4 : undefined,
      isDefault: typeof body?.isDefault === "boolean" ? body.isDefault : undefined,
      autoPayEnabled: typeof body?.autoPayEnabled === "boolean" ? body.autoPayEnabled : undefined,
      externalReferenceId: typeof body?.externalReferenceId === "string" ? body.externalReferenceId : undefined,
      status: typeof body?.status === "string" ? body.status : undefined,
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
