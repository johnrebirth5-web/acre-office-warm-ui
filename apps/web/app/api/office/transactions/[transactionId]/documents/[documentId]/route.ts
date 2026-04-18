import { canManageOfficeDocuments } from "@acre/auth";
import {
  deleteTransactionDocument,
  type SessionMembershipContext,
  updateTransactionDocument,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile } from "../../../../../../../lib/document-storage";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateOfficeTransactionDocumentBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    documentId: string;
  }>;
};

type OfficeTransactionDocumentRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateTransactionDocument?: typeof updateTransactionDocument;
};

export async function handleUpdateOfficeTransactionDocumentPatch(
  request: NextRequest,
  transactionId: string,
  documentId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionDocumentRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeTransactionDocumentBodySchema,
    {
      error: "Transaction document payload is invalid.",
      invalidJsonError: "Transaction document request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const document = await (
      dependencies.updateTransactionDocument ?? updateTransactionDocument
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      documentId,
      actorMembershipId: context.currentMembership.id,
      title: parsedBody.data.title,
      documentType: parsedBody.data.documentType,
      status: parsedBody.data.status as never,
      isRequired: parsedBody.data.isRequired,
      isUnsorted: parsedBody.data.isUnsorted,
      linkedTaskId: parsedBody.data.linkedTaskId ?? undefined,
      offerId: parsedBody.data.offerId ?? undefined
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found or update failed." }, { status: 404 });
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

  if (!canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Document access required." }, { status: 403 });
  }

  const { transactionId, documentId } = await params;
  return handleUpdateOfficeTransactionDocumentPatch(
    request,
    transactionId,
    documentId,
    context,
  );
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Document access required." }, { status: 403 });
  }

  const { transactionId, documentId } = await params;

  try {
    const removed = await deleteTransactionDocument(
      context.currentOrganization.id,
      transactionId,
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
