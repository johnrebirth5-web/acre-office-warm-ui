import { Prisma } from "@prisma/client";
import { canReviewOfficeIncomingUpdates } from "@acre/auth";
import {
  createIncomingUpdate,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createOfficeIncomingUpdateBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type OfficeIncomingUpdatesRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createIncomingUpdate?: typeof createIncomingUpdate;
};

export async function handleCreateOfficeIncomingUpdatePost(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeIncomingUpdatesRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeIncomingUpdateBodySchema, {
    error: "Incoming update payload is invalid.",
    invalidJsonError: "Incoming update request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const incomingUpdate = await (
      dependencies.createIncomingUpdate ?? createIncomingUpdate
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      sourceSystem: parsedBody.data.sourceSystem,
      sourceReference: parsedBody.data.sourceReference,
      summary: parsedBody.data.summary,
      payload: (parsedBody.data.payload ?? {}) as Record<string, Prisma.JsonValue>
    });

    if (!incomingUpdate) {
      return NextResponse.json({ error: "Incoming update could not be created." }, { status: 400 });
    }

    return NextResponse.json({ incomingUpdate }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Incoming update could not be created." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canReviewOfficeIncomingUpdates(context.currentMembership)) {
    return NextResponse.json({ error: "Incoming updates access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleCreateOfficeIncomingUpdatePost(request, transactionId, context);
}
