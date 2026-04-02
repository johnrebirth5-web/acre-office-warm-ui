import { canAccessOfficeMail } from "@acre/auth";
import {
  archiveOfficeMailThread,
  getOfficeMailThreadDetail,
  markOfficeMailThreadRead,
  markOfficeMailThreadUnread,
  unarchiveOfficeMailThread
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../../lib/auth-session";

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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  const { threadId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "A valid thread action is required." }, { status: 400 });
  }

  try {
    const input = {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      threadId
    };

    const updated =
      body.action === "mark_read"
        ? await markOfficeMailThreadRead(input)
        : body.action === "mark_unread"
          ? await markOfficeMailThreadUnread(input)
          : body.action === "archive"
            ? await archiveOfficeMailThread(input)
            : body.action === "unarchive"
              ? await unarchiveOfficeMailThread(input)
              : null;

    if (updated == null) {
      return NextResponse.json({ error: "A valid thread action is required." }, { status: 400 });
    }

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
