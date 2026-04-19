import { canAccessOfficeMail, canSendOfficeMail } from "@acre/auth";
import { replyToOfficeMailThread } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../../../lib/auth-session";
import {
  DEFAULT_UPLOAD_BATCH_MAX_BYTES,
  formatUploadLimit,
  isMultipartPayloadTooLarge,
} from "../../../../../../../lib/upload-validation";
import {
  cleanupStoredMailFiles,
  createMailMessageIds,
  getMailAttachmentValidationError,
  parseMailFiles,
  saveMailAttachments,
} from "../../../_helpers";

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

  if (isMultipartPayloadTooLarge(request, DEFAULT_UPLOAD_BATCH_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Attachment batches must stay under ${formatUploadLimit(DEFAULT_UPLOAD_BATCH_MAX_BYTES)}.`,
      },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid mail reply payload." }, { status: 400 });
  }

  const { threadId } = await params;
  const { messageId } = createMailMessageIds(threadId);
  let storedKeys: string[] = [];

  try {
    const files = parseMailFiles(formData);
    const validationError = getMailAttachmentValidationError(files);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 413 });
    }

    const savedAttachments = await saveMailAttachments({
      organizationId: context.currentOrganization.id,
      threadId,
      messageId,
      files,
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
