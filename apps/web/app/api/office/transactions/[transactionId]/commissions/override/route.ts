import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { overrideTransactionCommission } from "@acre/db";
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

  if (!canManageOfficeCommissions(context.currentMembership) && !canApproveOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission override access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        overrideReason?: string;
        notes?: string;
        stakeholderAmounts?: Array<{
          key?: string;
          amount?: string;
        }>;
      }
    | null;

  try {
    const snapshot = await overrideTransactionCommission({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      overrideReason: typeof body?.overrideReason === "string" ? body.overrideReason : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      stakeholderAmounts:
        body?.stakeholderAmounts?.map((row) => ({
          key: typeof row?.key === "string" ? row.key : "",
          amount: typeof row?.amount === "string" ? row.amount : ""
        })) ?? [],
      actorMembershipId: context.currentMembership.id
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to override transaction commission." },
      { status: 400 }
    );
  }
}
