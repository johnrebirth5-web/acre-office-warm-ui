import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  sendAgentPayoutStatementToAgent,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { sendAgentPayoutStatementBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

type StatementSendRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  sendAgentPayoutStatementToAgent?: typeof sendAgentPayoutStatementToAgent;
};

export async function handleSendAccountingStatementPost(
  request: NextRequest,
  statementId: string,
  context: SessionMembershipContext,
  dependencies: StatementSendRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    sendAgentPayoutStatementBodySchema,
    {
      error: "Statement send payload is invalid.",
      invalidJsonError: "Statement send request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const result = await (
      dependencies.sendAgentPayoutStatementToAgent ?? sendAgentPayoutStatementToAgent
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      actorMembershipId: context.currentMembership.id,
      message: body.message ?? ""
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send the payout statement to the agent." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const { statementId } = await params;
  return handleSendAccountingStatementPost(request, statementId, context);
}
