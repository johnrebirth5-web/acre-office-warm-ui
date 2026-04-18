import { canManageOfficeLibrary } from "@acre/auth";
import { createLibraryFolder, type SessionMembershipContext } from "@acre/db";
import { LibraryDocumentVisibility } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createLibraryFolderBodySchema } from "./route.schema";

function parseScope(value: string | undefined) {
  return value === LibraryDocumentVisibility.office_only
    ? LibraryDocumentVisibility.office_only
    : LibraryDocumentVisibility.company_wide;
}

type LibraryFoldersRouteDependencies = {
  parseJsonBody: typeof parseJsonBody;
  createLibraryFolder: typeof createLibraryFolder;
};

export async function handleCreateLibraryFolderPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: Partial<LibraryFoldersRouteDependencies> = {}
) {
  const parseBody = dependencies.parseJsonBody ?? parseJsonBody;
  const createFolder = dependencies.createLibraryFolder ?? createLibraryFolder;
  const parsedBody = await parseBody(request, createLibraryFolderBodySchema, {
    error: "Folder payload is invalid.",
    invalidJsonError: "Folder request body must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const folder = await createFolder({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: body.name,
      description: body.description ?? null,
      parentFolderId: body.parentFolderId ?? null,
      scope: parseScope(body.scope)
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Folder creation failed." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  return handleCreateLibraryFolderPost(request, context);
}
