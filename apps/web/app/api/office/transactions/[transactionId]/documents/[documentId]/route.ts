import { canManageOfficeDocuments } from "@acre/auth";
import { deleteTransactionDocument, updateTransactionDocument } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile } from "../../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    documentId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Document access required." }, { status: 403 });
  }

  const { transactionId, documentId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        documentType?: string;
        status?: string;
        isRequired?: boolean;
        isUnsorted?: boolean;
        linkedTaskId?: string | null;
        offerId?: string | null;
      }
    | null;

  try {
    const document = await updateTransactionDocument({
      organizationId: context.currentOrganization.id,
      transactionId,
      documentId,
      actorMembershipId: context.currentMembership.id,
      title: body?.title,
      documentType: body?.documentType,
      status: body?.status as never,
      isRequired: body?.isRequired,
      isUnsorted: body?.isUnsorted,
      linkedTaskId: body?.linkedTaskId ?? undefined,
      offerId: body?.offerId ?? undefined
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
