import { canManageOfficeLibrary } from "@acre/auth";
import { updateLibraryFolder } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    folderId: string;
  }>;
};

type FolderUpdateBody = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  const { folderId } = await params;
  const body = (await request.json().catch(() => null)) as FolderUpdateBody | null;

  try {
    const folder = await updateLibraryFolder({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      folderId,
      name: body?.name,
      description: body?.description,
      isActive: body?.isActive
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Folder update failed." },
      { status: 400 }
    );
  }
}
