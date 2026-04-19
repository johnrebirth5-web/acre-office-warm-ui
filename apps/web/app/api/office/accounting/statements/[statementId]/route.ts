import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  updateAgentPayoutStatementManualLineItems,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateAgentPayoutStatementManualLineItemsBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

type StatementManualLineItemsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateAgentPayoutStatementManualLineItems?: typeof updateAgentPayoutStatementManualLineItems;
};

export async function handleUpdateAccountingStatementPatch(
  request: NextRequest,
  statementId: string,
  context: SessionMembershipContext,
  dependencies: StatementManualLineItemsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateAgentPayoutStatementManualLineItemsBodySchema,
    {
      error: "Statement manual line items payload is invalid.",
      invalidJsonError: "Statement manual line items request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const result = await (
      dependencies.updateAgentPayoutStatementManualLineItems ??
      updateAgentPayoutStatementManualLineItems
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      manualLineItems: (body.manualLineItems ?? []).map((lineItem) => ({
        ...(lineItem.id === undefined ? {} : { id: lineItem.id }),
        memo: lineItem.memo ?? "",
        amount: lineItem.amount ?? ""
      })),
      actorMembershipId: context.currentMembership.id
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update statement manual line items." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const { statementId } = await params;
  return handleUpdateAccountingStatementPatch(request, statementId, context);
}
