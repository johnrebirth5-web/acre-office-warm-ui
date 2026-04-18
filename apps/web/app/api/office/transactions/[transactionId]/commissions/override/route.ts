import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { overrideTransactionCommission } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { overrideTransactionCommissionBodySchema } from "./route.schema";

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
  const parsedBody = await parseJsonBody(request, overrideTransactionCommissionBodySchema, {
    error: "Commission override payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const snapshot = await overrideTransactionCommission({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      overrideReason: parsedBody.data.overrideReason,
      notes: parsedBody.data.notes ?? "",
      stakeholderRows: parsedBody.data.stakeholderRows.map((row) => ({
        key: row.key,
        membershipId: row.membershipId,
        amount: row.amount
      })),
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
