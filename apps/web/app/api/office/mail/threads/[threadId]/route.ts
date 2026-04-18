import { canAccessOfficeMail } from "@acre/auth";
import {
  archiveOfficeMailThread,
  getOfficeMailThreadDetail,
  markOfficeMailThreadRead,
  markOfficeMailThreadUnread,
  unarchiveOfficeMailThread,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../../lib/auth-session";
import { updateOfficeMailThreadBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  const { threadId } = await params;

  try {
    const thread = await getOfficeMailThreadDetail({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      threadId,
      mode: request.nextUrl.searchParams.get("mode") ?? undefined
    });

    if (!thread) {
      return NextResponse.json({ error: "Mail thread not found." }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the mail thread." },
      { status: 400 }
    );
  }
}

type OfficeMailThreadRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  markOfficeMailThreadRead?: typeof markOfficeMailThreadRead;
  markOfficeMailThreadUnread?: typeof markOfficeMailThreadUnread;
  archiveOfficeMailThread?: typeof archiveOfficeMailThread;
  unarchiveOfficeMailThread?: typeof unarchiveOfficeMailThread;
};

export async function handleUpdateOfficeMailThreadPatch(
  request: NextRequest,
  threadId: string,
  context: SessionMembershipContext,
  dependencies: OfficeMailThreadRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeMailThreadBodySchema,
    {
      error: "A valid thread action is required.",
      invalidJsonError: "Mail thread request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const input = {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      threadId
    };

    const updated =
      parsedBody.data.action === "mark_read"
        ? await (dependencies.markOfficeMailThreadRead ?? markOfficeMailThreadRead)(input)
        : parsedBody.data.action === "mark_unread"
          ? await (dependencies.markOfficeMailThreadUnread ?? markOfficeMailThreadUnread)(input)
          : parsedBody.data.action === "archive"
            ? await (dependencies.archiveOfficeMailThread ?? archiveOfficeMailThread)(input)
            : await (dependencies.unarchiveOfficeMailThread ?? unarchiveOfficeMailThread)(input);

    if (!updated) {
      return NextResponse.json({ error: "Mail thread not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the mail thread." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  const { threadId } = await params;
  return handleUpdateOfficeMailThreadPatch(request, threadId, context);
}
