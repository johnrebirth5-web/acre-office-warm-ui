import { canAccessOfficeMail, canSendOfficeMail } from "@acre/auth";
import { replyToOfficeMailThread } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../../../lib/auth-session";
import { cleanupStoredMailFiles, createMailMessageIds, parseMailFiles, saveMailAttachments } from "../../../_helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  if (!canSendOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail send access required." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid mail reply payload." }, { status: 400 });
  }

  const { threadId } = await params;
  const { messageId } = createMailMessageIds(threadId);
  let storedKeys: string[] = [];

  try {
    const savedAttachments = await saveMailAttachments({
      organizationId: context.currentOrganization.id,
      threadId,
      messageId,
      files: parseMailFiles(formData)
    });

    storedKeys = savedAttachments.storedKeys;

    const thread = await replyToOfficeMailThread({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      threadId,
      messageId,
      body: String(formData.get("body") ?? ""),
      attachments: savedAttachments.attachments
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    await cleanupStoredMailFiles(storedKeys);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the reply." },
      { status: 400 }
    );
  }
}
