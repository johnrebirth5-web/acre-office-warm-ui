import { Prisma } from "@prisma/client";
import { canReviewOfficeIncomingUpdates } from "@acre/auth";
import { createIncomingUpdate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canReviewOfficeIncomingUpdates(context.currentMembership)) {
    return NextResponse.json({ error: "Incoming updates access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        sourceSystem?: string;
        sourceReference?: string;
        summary?: string;
        payload?: Record<string, unknown>;
      }
    | null;

  if (!body?.sourceSystem?.trim() || !body.sourceReference?.trim() || !body.summary?.trim()) {
    return NextResponse.json({ error: "Source system, source reference, and summary are required." }, { status: 400 });
  }

  try {
    const incomingUpdate = await createIncomingUpdate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      sourceSystem: body.sourceSystem,
      sourceReference: body.sourceReference,
      summary: body.summary,
      payload: (body.payload ?? {}) as Record<string, Prisma.JsonValue>
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
