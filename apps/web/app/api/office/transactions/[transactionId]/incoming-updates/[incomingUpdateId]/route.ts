import { canReviewOfficeIncomingUpdates } from "@acre/auth";
import {
  reviewIncomingUpdate,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { reviewOfficeIncomingUpdateBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    incomingUpdateId: string;
  }>;
};

type OfficeIncomingUpdateRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  reviewIncomingUpdate?: typeof reviewIncomingUpdate;
};

export async function handleReviewOfficeIncomingUpdatePatch(
  request: NextRequest,
  transactionId: string,
  incomingUpdateId: string,
  context: SessionMembershipContext,
  dependencies: OfficeIncomingUpdateRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, reviewOfficeIncomingUpdateBodySchema, {
    error: "Incoming update review payload is invalid.",
    invalidJsonError: "Incoming update review request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const incomingUpdate = await (
      dependencies.reviewIncomingUpdate ?? reviewIncomingUpdate
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      incomingUpdateId,
      actorMembershipId: context.currentMembership.id,
      action: parsedBody.data.action as "accept" | "reject"
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canReviewOfficeIncomingUpdates(context.currentMembership)) {
    return NextResponse.json({ error: "Incoming updates access required." }, { status: 403 });
  }

  const { transactionId, incomingUpdateId } = await params;
  return handleReviewOfficeIncomingUpdatePatch(
    request,
    transactionId,
    incomingUpdateId,
    context,
  );
}
