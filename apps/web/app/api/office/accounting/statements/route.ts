import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { createAgentPayoutStatement, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createAgentPayoutStatementBodySchema } from "./route.schema";

type AccountingStatementsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createAgentPayoutStatement?: typeof createAgentPayoutStatement;
};

export async function handleCreateAccountingStatementPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AccountingStatementsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createAgentPayoutStatementBodySchema,
    {
      error: "Accounting statement payload is invalid.",
      invalidJsonError: "Accounting statement request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const result = await (dependencies.createAgentPayoutStatement ?? createAgentPayoutStatement)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      invoiceNumbers: body.invoiceNumbers ?? [],
      commissionCalculationIds: body.commissionCalculationIds ?? [],
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate the agent payout statement." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  return handleCreateAccountingStatementPost(request, context);
}
