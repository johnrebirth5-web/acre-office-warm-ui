import { canManageOfficeAgentBilling } from "@acre/auth";
import { updateAgentRecurringChargeRule } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    recurringChargeRuleId: string;
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

  const { recurringChargeRuleId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const updatedId = await updateAgentRecurringChargeRule({
      organizationId: context.currentOrganization.id,
      recurringChargeRuleId,
      officeId: typeof body?.officeId === "string" ? body.officeId : context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : undefined,
      name: typeof body?.name === "string" ? body.name : undefined,
      chargeType: typeof body?.chargeType === "string" ? body.chargeType : undefined,
      description: typeof body?.description === "string" ? body.description : undefined,
      amount: typeof body?.amount === "string" ? body.amount : undefined,
      frequency: typeof body?.frequency === "string" ? body.frequency : undefined,
      customIntervalDays: typeof body?.customIntervalDays === "string" ? body.customIntervalDays : undefined,
      startDate: typeof body?.startDate === "string" ? body.startDate : undefined,
      nextDueDate: typeof body?.nextDueDate === "string" ? body.nextDueDate : undefined,
      endDate: typeof body?.endDate === "string" ? body.endDate : undefined,
      autoGenerateInvoice: typeof body?.autoGenerateInvoice === "boolean" ? body.autoGenerateInvoice : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      actorMembershipId: context.currentMembership.id
    });

    if (!updatedId) {
      return NextResponse.json({ error: "Recurring billing rule not found." }, { status: 404 });
    }

    return NextResponse.json({ recurringChargeRuleId: updatedId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update recurring billing rule." },
      { status: 400 }
    );
  }
}
