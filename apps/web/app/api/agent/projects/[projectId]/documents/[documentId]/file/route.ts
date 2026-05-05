import { createHash } from "node:crypto";
import { canViewProjectSigning, getSalesProjectDocumentStorageRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { readStoredFile } from "../../../../../../../../lib/document-storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
    documentId: string;
  }>;
};

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing access required." }, { status: 403 });
  }

  const { projectId, documentId } = await routeContext.params;
  const document = await getSalesProjectDocumentStorageRecord({
    ...buildProjectSigningContext(context),
    projectId,
    documentId,
  });

  if (!document) {
    return NextResponse.json({ error: "Project document not found." }, { status: 404 });
  }

  try {
    const file = await readStoredFile(document.storageKey);

    if (document.contentSha256) {
      const actualSha256 = sha256(new Uint8Array(file.fileBuffer));

      if (actualSha256 !== document.contentSha256) {
        return NextResponse.json({ error: "Document integrity check failed." }, { status: 409 });
      }
    }

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Content-Length": String(file.fileSizeBytes || document.fileSizeBytes),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored project document could not be read." }, { status: 404 });
  }
}
