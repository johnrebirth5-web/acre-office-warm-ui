import { canManageOfficePayments } from "@acre/auth";
import { applyAgentBillingCreditMemo } from "@acre/db";
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
    const result = await applyAgentBillingCreditMemo({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      creditMemoId: typeof body?.creditMemoId === "string" ? body.creditMemoId : "",
      invoiceId: typeof body?.invoiceId === "string" ? body.invoiceId : "",
      amount: typeof body?.amount === "string" ? body.amount : "",
      memo: typeof body?.memo === "string" ? body.memo : "",
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply credit memo." },
      { status: 400 }
    );
  }
}
