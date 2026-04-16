import { can } from "@acre/auth";
import { getOfficeResourceStorageRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    resourceId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!can(context.currentMembership, "resources:view")) {
    return NextResponse.json(
      { error: "Resources access required." },
      { status: 403 },
    );
  }

  const { resourceId } = await params;
  const resource = await getOfficeResourceStorageRecord({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    resourceId,
  });

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  if (!resource.storageKey?.trim()) {
    if (!resource.url?.trim()) {
      return NextResponse.json(
        { error: "Stored file could not be read." },
        { status: 404 },
      );
    }

    return NextResponse.redirect(new URL(resource.url, request.nextUrl.origin));
  }

  try {
    const file = await readStoredFile(resource.storageKey);
    const download = request.nextUrl.searchParams.get("download") === "1";
    const fileName = resource.originalFileName?.trim() || `${resource.title}.pdf`;
    const mimeType = resource.mimeType?.trim() || "application/pdf";

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(file.fileSizeBytes),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Stored file could not be read." },
      { status: 404 },
    );
  }
}
