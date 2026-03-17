import { canManageOfficePayments } from "@acre/auth";
import { recordAgentBillingPayment } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficePayments(context.currentMembership)) {
    return NextResponse.json({ error: "Payments management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const paymentId = await recordAgentBillingPayment({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      invoiceIds: Array.isArray(body?.invoiceIds) ? body.invoiceIds.filter((value): value is string => typeof value === "string") : [],
      amount: typeof body?.amount === "string" ? body.amount : "",
      accountingDate: typeof body?.accountingDate === "string" ? body.accountingDate : "",
      paymentMethod: typeof body?.paymentMethod === "string" ? body.paymentMethod : "",
      referenceNumber: typeof body?.referenceNumber === "string" ? body.referenceNumber : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ paymentId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record billing payment." },
      { status: 400 }
    );
  }
}
