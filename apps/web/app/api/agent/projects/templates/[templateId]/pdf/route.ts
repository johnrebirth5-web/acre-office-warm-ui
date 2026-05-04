import { canCreateProjectSigning, getProjectSigningTemplatePdfStorageRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { readStoredFile } from "../../../../../../../lib/document-storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    templateId: string;
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

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const { templateId } = await routeContext.params;

  const document = await getProjectSigningTemplatePdfStorageRecord({
    ...buildProjectSigningContext(context),
    templateId,
  });

  if (!document) {
    return NextResponse.json({ error: "Template PDF not found." }, { status: 404 });
  }

  try {
    const file = await readStoredFile(document.storageKey);

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Content-Length": String(file.fileSizeBytes || document.fileSizeBytes),
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored template PDF could not be read." }, { status: 404 });
  }
}
