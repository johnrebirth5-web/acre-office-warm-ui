import { canCalculateOfficeCommissions } from "@acre/auth";
import { calculateTransactionCommission } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCalculateOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission calculation access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const snapshot = await calculateTransactionCommission({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      commissionPlanId: typeof body?.commissionPlanId === "string" ? body.commissionPlanId : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      actorMembershipId: context.currentMembership.id
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate transaction commission." },
      { status: 400 }
    );
  }
}
