import { canManageOfficeLibrary } from "@acre/auth";
import { LibraryDocumentVisibility } from "@prisma/client";
import { createLibraryFolder } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

type FolderRequestBody = {
  name?: string;
  description?: string | null;
  parentFolderId?: string | null;
  scope?: string;
};

function parseScope(value: string | undefined) {
  return value === LibraryDocumentVisibility.office_only
    ? LibraryDocumentVisibility.office_only
    : LibraryDocumentVisibility.company_wide;
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as FolderRequestBody | null;

  try {
    const folder = await createLibraryFolder({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: String(body?.name ?? ""),
      description: body?.description ?? null,
      parentFolderId: body?.parentFolderId ?? null,
      scope: parseScope(body?.scope)
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Folder creation failed." },
      { status: 400 }
    );
  }
}
