import { canManageOfficeAccounting } from "@acre/auth";
import { createEarnestMoneyRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const earnestMoneyRecord = await createEarnestMoneyRecord({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId: typeof body?.transactionId === "string" ? body.transactionId : "",
      expectedAmount: typeof body?.expectedAmount === "string" ? body.expectedAmount : "",
      dueAt: typeof body?.dueAt === "string" ? body.dueAt : "",
      heldByOffice: Boolean(body?.heldByOffice),
      heldExternally: Boolean(body?.heldExternally),
      trackInLedger: body?.trackInLedger === undefined ? true : Boolean(body.trackInLedger),
      notes: typeof body?.notes === "string" ? body.notes : "",
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ earnestMoneyRecord }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create earnest money record." },
      { status: 400 }
    );
  }
}
