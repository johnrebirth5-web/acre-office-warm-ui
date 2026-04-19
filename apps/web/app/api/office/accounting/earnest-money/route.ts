import { canManageOfficeAccounting } from "@acre/auth";
import { createEarnestMoneyRecord, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createEarnestMoneyRecordBodySchema } from "./route.schema";

type EarnestMoneyRouteDependencies = {
  createEarnestMoneyRecord?: typeof createEarnestMoneyRecord;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateEarnestMoneyRecordPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: EarnestMoneyRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createEarnestMoneyRecordBodySchema,
    {
      error: "Earnest money payload is invalid.",
      invalidJsonError: "Earnest money request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const earnestMoneyRecord = await (
      dependencies.createEarnestMoneyRecord ?? createEarnestMoneyRecord
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId: body.transactionId ?? "",
      expectedAmount: body.expectedAmount ?? "",
      dueAt: body.dueAt ?? "",
      heldByOffice: Boolean(body.heldByOffice),
      heldExternally: Boolean(body.heldExternally),
      trackInLedger: body.trackInLedger ?? true,
      notes: body.notes ?? "",
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

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  return handleCreateEarnestMoneyRecordPost(request, context);
}
