import { respondToAgentPayoutStatement } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { statementId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        response?: unknown;
        message?: unknown;
      }
    | null;

  try {
    const result = await respondToAgentPayoutStatement({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      actorMembershipId: context.currentMembership.id,
      response: body?.response === "request_revision" ? "request_revision" : "confirm",
      message: typeof body?.message === "string" ? body.message : ""
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit the payout statement review." },
      { status: 400 }
    );
  }
}
