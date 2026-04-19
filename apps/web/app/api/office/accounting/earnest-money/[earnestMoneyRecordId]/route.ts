import { canManageOfficeAccounting } from "@acre/auth";
import { updateEarnestMoneyRecord, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateEarnestMoneyRecordBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    earnestMoneyRecordId: string;
  }>;
};

type EarnestMoneyDetailRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateEarnestMoneyRecord?: typeof updateEarnestMoneyRecord;
};

export async function handleUpdateEarnestMoneyRecordPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  earnestMoneyRecordId: string,
  dependencies: EarnestMoneyDetailRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateEarnestMoneyRecordBodySchema,
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
      dependencies.updateEarnestMoneyRecord ?? updateEarnestMoneyRecord
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      earnestMoneyRecordId,
      expectedAmount: body.expectedAmount,
      dueAt: body.dueAt,
      receivedAmount: body.receivedAmount,
      refundedAmount: body.refundedAmount,
      paymentDate: body.paymentDate,
      depositDate: body.depositDate,
      heldByOffice: body.heldByOffice,
      heldExternally: body.heldExternally,
      trackInLedger: body.trackInLedger,
      notes: body.notes,
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  const { earnestMoneyRecordId } = await params;

  return handleUpdateEarnestMoneyRecordPatch(request, context, earnestMoneyRecordId);
}
