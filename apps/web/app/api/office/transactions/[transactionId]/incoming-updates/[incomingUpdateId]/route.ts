import { canReviewOfficeIncomingUpdates } from "@acre/auth";
import { reviewIncomingUpdate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    incomingUpdateId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canReviewOfficeIncomingUpdates(context.currentMembership)) {
    return NextResponse.json({ error: "Incoming updates access required." }, { status: 403 });
  }

  const { transactionId, incomingUpdateId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action !== "accept" && body?.action !== "reject") {
    return NextResponse.json({ error: "A valid review action is required." }, { status: 400 });
  }

  try {
    const incomingUpdate = await reviewIncomingUpdate({
      organizationId: context.currentOrganization.id,
      transactionId,
      incomingUpdateId,
      actorMembershipId: context.currentMembership.id,
      action: body.action
    });

    if (!incomingUpdate) {
      return NextResponse.json({ error: "Incoming update not found." }, { status: 404 });
    }

    return NextResponse.json({ incomingUpdate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Incoming update review failed." },
      { status: 400 }
    );
  }
}
