import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  createAgentPayoutStatement,
  getAgentPayoutStatementEmailContext,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import {
  appendOperationalEmailWarning,
  captureOperationalEmailWarning,
  sendPayoutStatementGeneratedOperationalEmail
} from "../../../../../lib/operational-email";
import { getPublicAppBaseUrl } from "../../../../../lib/request-origin";
import { createAgentPayoutStatementBodySchema } from "./route.schema";

type AccountingStatementsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createAgentPayoutStatement?: typeof createAgentPayoutStatement;
  getAgentPayoutStatementEmailContext?: typeof getAgentPayoutStatementEmailContext;
  sendPayoutStatementGeneratedOperationalEmail?: typeof sendPayoutStatementGeneratedOperationalEmail;
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
    const statementId = result.statementId;
    const emailWarning = statementId
      ? await captureOperationalEmailWarning("payout statement generated", async () => {
          const statement = await (dependencies.getAgentPayoutStatementEmailContext ?? getAgentPayoutStatementEmailContext)({
            organizationId: context.currentOrganization.id,
            officeId: context.currentOffice?.id ?? null,
            statementId
          });

          if (!statement) {
            return;
          }

          await (dependencies.sendPayoutStatementGeneratedOperationalEmail ?? sendPayoutStatementGeneratedOperationalEmail)({
            organizationId: context.currentOrganization.id,
            baseUrl: getPublicAppBaseUrl(),
            statement
          });
        })
      : null;

    return NextResponse.json(appendOperationalEmailWarning(result, emailWarning), { status: 201 });
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
