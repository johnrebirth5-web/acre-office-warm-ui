import { canManageOfficeDocuments, canUseOfficeForms } from "@acre/auth";
import {
  createTransactionForm,
  prepareTransactionFormDraft,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { saveStoredTextDocument } from "../../../../../../lib/document-storage";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createOfficeTransactionFormBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export const runtime = "nodejs";

type OfficeTransactionFormsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  prepareTransactionFormDraft?: typeof prepareTransactionFormDraft;
  saveStoredTextDocument?: typeof saveStoredTextDocument;
  createTransactionForm?: typeof createTransactionForm;
};

export async function handleCreateOfficeTransactionFormPost(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionFormsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeTransactionFormBodySchema, {
    error: "Transaction form payload is invalid.",
    invalidJsonError: "Transaction form request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const draft = await (
      dependencies.prepareTransactionFormDraft ?? prepareTransactionFormDraft
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      templateId: parsedBody.data.templateId,
      linkedTaskId: parsedBody.data.linkedTaskId?.trim() || null,
      offerId: parsedBody.data.offerId?.trim() || null,
      name: parsedBody.data.name
    });

    if (!draft) {
      return NextResponse.json({ error: "Template or transaction not found." }, { status: 404 });
    }

    const generatedFile = await (
      dependencies.saveStoredTextDocument ?? saveStoredTextDocument
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      fileName: `${draft.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "form-packet"}.json`,
      content: JSON.stringify(draft.generatedPayload, null, 2)
    });

    const form = await (
      dependencies.createTransactionForm ?? createTransactionForm
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      templateId: draft.templateId,
      linkedTaskId: draft.linkedTaskId,
      offerId: draft.offerId,
      name: draft.name,
      generatedPayload: draft.generatedPayload,
      generatedDocument: {
        title: `${draft.name} document`,
        fileName: generatedFile.fileName,
        mimeType: "application/json",
        fileSizeBytes: generatedFile.fileSizeBytes,
        storageKey: generatedFile.storageKey,
        documentType: draft.documentType
      }
    });

    if (!form) {
      return NextResponse.json({ error: "Form could not be created." }, { status: 400 });
    }

    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Form could not be created." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canUseOfficeForms(context.currentMembership) || !canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Form access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleCreateOfficeTransactionFormPost(request, transactionId, context);
}
