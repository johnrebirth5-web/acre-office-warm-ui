import {
  getAgentPayoutStatementEmailContext,
  respondToAgentPayoutStatement,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import {
  appendOperationalEmailWarning,
  captureOperationalEmailWarning,
  sendPayoutStatementReviewOperationalEmail
} from "../../../../../../../../lib/operational-email";
import { getPublicAppBaseUrl } from "../../../../../../../../lib/request-origin";
import { reviewAgentPayoutStatementBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

type StatementSelfServiceReviewRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  respondToAgentPayoutStatement?: typeof respondToAgentPayoutStatement;
  getAgentPayoutStatementEmailContext?: typeof getAgentPayoutStatementEmailContext;
  sendPayoutStatementReviewOperationalEmail?: typeof sendPayoutStatementReviewOperationalEmail;
};

export async function handleReviewAccountingStatementPost(
  request: NextRequest,
  statementId: string,
  context: SessionMembershipContext,
  dependencies: StatementSelfServiceReviewRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    reviewAgentPayoutStatementBodySchema,
    {
      error: "Statement review payload is invalid.",
      invalidJsonError: "Statement review request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const response = body.response === "request_revision" ? "request_revision" : "confirm";
    const result = await (
      dependencies.respondToAgentPayoutStatement ?? respondToAgentPayoutStatement
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      actorMembershipId: context.currentMembership.id,
      response,
      message: body.message ?? ""
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    const emailWarning = await captureOperationalEmailWarning("payout statement review", async () => {
      const statement = await (
        dependencies.getAgentPayoutStatementEmailContext ?? getAgentPayoutStatementEmailContext
      )({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        statementId
      });

      if (!statement) {
        return;
      }

      await (dependencies.sendPayoutStatementReviewOperationalEmail ?? sendPayoutStatementReviewOperationalEmail)({
        organizationId: context.currentOrganization.id,
        baseUrl: getPublicAppBaseUrl(),
        statement,
        response,
        message: body.message ?? ""
      });
    });

    return NextResponse.json(appendOperationalEmailWarning(result as Record<string, unknown>, emailWarning));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit the payout statement review." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { statementId } = await params;
  return handleReviewAccountingStatementPost(request, statementId, context);
}
