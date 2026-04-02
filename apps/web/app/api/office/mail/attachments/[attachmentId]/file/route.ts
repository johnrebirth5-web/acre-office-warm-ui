import { canAccessOfficeMail } from "@acre/auth";
import { getOfficeMailAttachmentStorageRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../../lib/document-storage";
import { requireRequestOfficeSession } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
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

  const { attachmentId } = await params;

  try {
    const attachment = await getOfficeMailAttachmentStorageRecord({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      attachmentId,
      mode: request.nextUrl.searchParams.get("mode") ?? undefined
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const file = await readStoredFile(attachment.storageKey);

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Content-Length": String(file.fileSizeBytes)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stored attachment could not be read." },
      { status: 404 }
    );
  }
}
