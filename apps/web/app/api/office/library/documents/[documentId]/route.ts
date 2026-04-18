import { canManageOfficeLibrary, canViewOfficeLibrary } from "@acre/auth";
import {
  deleteLibraryDocument,
  getLibraryDocumentStorageRecord,
  updateLibraryDocument,
  type SessionMembershipContext
} from "@acre/db";
import { LibraryDocumentVisibility } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { deleteStoredFile, readStoredFile } from "../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { extractPdfMetadata, isPdfFileLike } from "../../_shared/pdf-metadata";
import { updateLibraryDocumentBodySchema } from "./route.schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

type LibraryDocumentRouteDependencies = {
  parseJsonBody: typeof parseJsonBody;
  updateLibraryDocument: typeof updateLibraryDocument;
};

function parseVisibility(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value === LibraryDocumentVisibility.office_only
    ? LibraryDocumentVisibility.office_only
    : LibraryDocumentVisibility.company_wide;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library access required." }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await getLibraryDocumentStorageRecord(
    context.currentOrganization.id,
    context.currentOffice?.id ?? null,
    documentId
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!isPdfFileLike(document.originalFileName, document.mimeType)) {
    return NextResponse.json({
      document: {
        id: document.id,
        isPdf: false,
        pdfMetadata: null
      }
    });
  }

  try {
    const storedFile = await readStoredFile(document.storageKey);
    const pdfMetadata = await extractPdfMetadata(new Uint8Array(storedFile.fileBuffer));

    return NextResponse.json({
      document: {
        id: document.id,
        isPdf: true,
        pdfMetadata
      }
    });
  } catch {
    return NextResponse.json({
      document: {
        id: document.id,
        isPdf: true,
        pdfMetadata: null
      }
    });
  }
}

export async function handleUpdateLibraryDocumentPatch(
  request: NextRequest,
  documentId: string,
  context: SessionMembershipContext,
  dependencies: Partial<LibraryDocumentRouteDependencies> = {}
) {
  const parseBody = dependencies.parseJsonBody ?? parseJsonBody;
  const updateDocument = dependencies.updateLibraryDocument ?? updateLibraryDocument;
  const parsedBody = await parseBody(request, updateLibraryDocumentBodySchema, {
    error: "Document payload is invalid.",
    invalidJsonError: "Document request body must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const document = await updateDocument({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      documentId,
      title: body.title,
      folderId: body.folderId === undefined ? undefined : body.folderId,
      summary: body.summary,
      category: body.category,
      tags: body.tags,
      visibility: parseVisibility(body.visibility)
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document update failed." },
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

  const { documentId } = await params;
  return handleUpdateLibraryDocumentPatch(request, documentId, context);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  const { documentId } = await params;

  try {
    const removed = await deleteLibraryDocument(
      context.currentOrganization.id,
      context.currentOffice?.id ?? null,
      documentId,
      context.currentMembership.id
    );

    if (!removed) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await deleteStoredFile(removed.storageKey).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document delete failed." },
      { status: 400 }
    );
  }
}
