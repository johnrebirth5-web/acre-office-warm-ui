import { canManageOfficeDocuments, canUseOfficeForms } from "@acre/auth";
import { createTransactionForm, prepareTransactionFormDraft } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { saveStoredTextDocument } from "../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canUseOfficeForms(context.currentMembership) || !canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Form access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        templateId?: string;
        linkedTaskId?: string;
        offerId?: string;
        name?: string;
      }
    | null;

  if (!body?.templateId?.trim()) {
    return NextResponse.json({ error: "Template is required." }, { status: 400 });
  }

  try {
    const draft = await prepareTransactionFormDraft({
      organizationId: context.currentOrganization.id,
      transactionId,
      templateId: body.templateId,
      linkedTaskId: body.linkedTaskId?.trim() || null,
      offerId: body.offerId?.trim() || null,
      name: body.name
    });

    if (!draft) {
      return NextResponse.json({ error: "Template or transaction not found." }, { status: 404 });
    }

    const generatedFile = await saveStoredTextDocument({
      organizationId: context.currentOrganization.id,
      transactionId,
      fileName: `${draft.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "form-packet"}.json`,
      content: JSON.stringify(draft.generatedPayload, null, 2)
    });

    const form = await createTransactionForm({
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
