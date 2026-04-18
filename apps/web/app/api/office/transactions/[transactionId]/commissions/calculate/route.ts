import { canCalculateOfficeCommissions } from "@acre/auth";
import { calculateTransactionCommission } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { calculateTransactionCommissionBodySchema } from "./route.schema";

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
  const parsedBody = await parseJsonBody(request, calculateTransactionCommissionBodySchema, {
    error: "Commission calculation payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const snapshot = await calculateTransactionCommission({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      commissionPlanId: parsedBody.data.commissionPlanId ?? "",
      notes: parsedBody.data.notes ?? "",
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
