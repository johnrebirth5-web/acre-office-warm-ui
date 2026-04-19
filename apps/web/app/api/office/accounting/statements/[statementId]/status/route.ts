import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  updateAgentPayoutStatementReviewStatus,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateAgentPayoutStatementStatusBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

type StatementStatusRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateAgentPayoutStatementReviewStatus?: typeof updateAgentPayoutStatementReviewStatus;
};

export async function handleUpdateAccountingStatementStatusPatch(
  request: NextRequest,
  statementId: string,
  context: SessionMembershipContext,
  dependencies: StatementStatusRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateAgentPayoutStatementStatusBodySchema,
    {
      error: "A valid statement status is required.",
      invalidJsonError: "Statement status request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const result = await (
      dependencies.updateAgentPayoutStatementReviewStatus ??
      updateAgentPayoutStatementReviewStatus
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      reviewStatus: body.reviewStatus,
      actorMembershipId: context.currentMembership.id
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the payout statement status." },
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
  return handleUpdateAccountingStatementStatusPatch(request, statementId, context);
}
