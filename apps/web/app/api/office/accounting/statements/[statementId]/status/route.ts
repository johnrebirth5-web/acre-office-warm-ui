import { AgentPayoutStatementReviewStatus } from "@prisma/client";
import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { updateAgentPayoutStatementReviewStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

const validReviewStatuses = new Set<AgentPayoutStatementReviewStatus>([
  "draft",
  "awaiting_agent",
  "revision_requested",
  "confirmed",
  "paid"
]);

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const { statementId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        reviewStatus?: unknown;
      }
    | null;

  if (typeof body?.reviewStatus !== "string" || !validReviewStatuses.has(body.reviewStatus as AgentPayoutStatementReviewStatus)) {
    return NextResponse.json({ error: "A valid statement status is required." }, { status: 400 });
  }

  try {
    const result = await updateAgentPayoutStatementReviewStatus({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      reviewStatus: body.reviewStatus as AgentPayoutStatementReviewStatus,
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
