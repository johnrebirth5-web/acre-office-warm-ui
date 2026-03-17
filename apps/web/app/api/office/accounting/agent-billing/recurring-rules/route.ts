import { canManageOfficeAgentBilling } from "@acre/auth";
import { createAgentRecurringChargeRule } from "@acre/db";
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
    const recurringChargeRuleId = await createAgentRecurringChargeRule({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      name: typeof body?.name === "string" ? body.name : "",
      chargeType: typeof body?.chargeType === "string" ? body.chargeType : "",
      description: typeof body?.description === "string" ? body.description : "",
      amount: typeof body?.amount === "string" ? body.amount : "",
      frequency: typeof body?.frequency === "string" ? body.frequency : "",
      customIntervalDays: typeof body?.customIntervalDays === "string" ? body.customIntervalDays : "",
      startDate: typeof body?.startDate === "string" ? body.startDate : "",
      nextDueDate: typeof body?.nextDueDate === "string" ? body.nextDueDate : "",
      endDate: typeof body?.endDate === "string" ? body.endDate : "",
      autoGenerateInvoice: Boolean(body?.autoGenerateInvoice),
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ recurringChargeRuleId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recurring billing rule." },
      { status: 400 }
    );
  }
}
