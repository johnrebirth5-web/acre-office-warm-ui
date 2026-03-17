import { canManageOfficeAccounting } from "@acre/auth";
import { updateEarnestMoneyRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    earnestMoneyRecordId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  const { earnestMoneyRecordId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const earnestMoneyRecord = await updateEarnestMoneyRecord({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      earnestMoneyRecordId,
      expectedAmount: typeof body?.expectedAmount === "string" ? body.expectedAmount : undefined,
      dueAt: typeof body?.dueAt === "string" ? body.dueAt : undefined,
      receivedAmount: typeof body?.receivedAmount === "string" ? body.receivedAmount : undefined,
      refundedAmount: typeof body?.refundedAmount === "string" ? body.refundedAmount : undefined,
      paymentDate: typeof body?.paymentDate === "string" ? body.paymentDate : undefined,
      depositDate: typeof body?.depositDate === "string" ? body.depositDate : undefined,
      heldByOffice: body?.heldByOffice === undefined ? undefined : Boolean(body.heldByOffice),
      heldExternally: body?.heldExternally === undefined ? undefined : Boolean(body.heldExternally),
      trackInLedger: body?.trackInLedger === undefined ? undefined : Boolean(body.trackInLedger),
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      actorMembershipId: context.currentMembership.id
    });

    if (!earnestMoneyRecord) {
      return NextResponse.json({ error: "Earnest money record not found." }, { status: 404 });
    }

    return NextResponse.json({ earnestMoneyRecord });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update earnest money record." },
      { status: 400 }
    );
  }
}
