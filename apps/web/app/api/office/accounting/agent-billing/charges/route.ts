import { canManageOfficeAgentBilling } from "@acre/auth";
import { createAgentBillingCharges } from "@acre/db";
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
    const transactionIds = await createAgentBillingCharges({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipIds: Array.isArray(body?.membershipIds) ? body.membershipIds.filter((value): value is string => typeof value === "string") : [],
      chargeType: typeof body?.chargeType === "string" ? body.chargeType : "",
      description: typeof body?.description === "string" ? body.description : "",
      amount: typeof body?.amount === "string" ? body.amount : "",
      accountingDate: typeof body?.accountingDate === "string" ? body.accountingDate : "",
      dueDate: typeof body?.dueDate === "string" ? body.dueDate : "",
      relatedTransactionId: typeof body?.relatedTransactionId === "string" ? body.relatedTransactionId : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ transactionIds }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create agent billing charge." },
      { status: 400 }
    );
  }
}
