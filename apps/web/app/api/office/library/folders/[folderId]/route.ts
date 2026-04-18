import { canManageOfficeLibrary } from "@acre/auth";
import { updateLibraryFolder, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateLibraryFolderBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    folderId: string;
  }>;
};

type LibraryFolderRouteDependencies = {
  parseJsonBody: typeof parseJsonBody;
  updateLibraryFolder: typeof updateLibraryFolder;
};

export async function handleUpdateLibraryFolderPatch(
  request: NextRequest,
  folderId: string,
  context: SessionMembershipContext,
  dependencies: Partial<LibraryFolderRouteDependencies> = {}
) {
  const parseBody = dependencies.parseJsonBody ?? parseJsonBody;
  const updateFolder = dependencies.updateLibraryFolder ?? updateLibraryFolder;
  const parsedBody = await parseBody(request, updateLibraryFolderBodySchema, {
    error: "Folder payload is invalid.",
    invalidJsonError: "Folder request body must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const folder = await updateFolder({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      folderId,
      name: body.name,
      description: body.description,
      isActive: body.isActive
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  const { folderId } = await params;
  return handleUpdateLibraryFolderPatch(request, folderId, context);
}
