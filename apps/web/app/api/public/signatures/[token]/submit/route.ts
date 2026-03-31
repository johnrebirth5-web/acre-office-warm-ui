import { createTransactionDocument, getPublicSignatureDocumentStorageRecord, getPublicSignatureRequestSnapshot, updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile, saveStoredFile } from "../../../../../../lib/document-storage";
import { attemptSignatureDriveSync } from "../../../../../../lib/signature-drive-sync";
import { buildSignedPdf, type SubmittedSignatureFieldValue } from "../../../../../../lib/signature-pdf";
import { sendSignatureCompletionEmail, sendSignatureRequestEmail } from "../../../../../../lib/signature-email";
import { createSignatureToken } from "../../../../../../lib/signature-token";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function buildSignedFileName(fileName: string) {
  const normalized = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  return `${normalized}-signed.pdf`;
}

export const runtime = "nodejs";

function isRecipientTerminalStatus(statusKey: string) {
  return statusKey === "acted" || statusKey === "declined" || statusKey === "voided" || statusKey === "expired";
}

function getActiveRecipients(
  recipients: Array<{
    id: string;
    email: string;
    roleKey: string;
    routingStep: number;
    statusKey: string;
  }>
) {
  const actionable = recipients.filter((recipient) => recipient.roleKey !== "cc" && !isRecipientTerminalStatus(recipient.statusKey));

  if (actionable.length === 0) {
    return [];
  }

  const routingStep = actionable.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), actionable[0]!.routingStep);
  return actionable.filter((recipient) => recipient.routingStep === routingStep);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const snapshot = await getPublicSignatureRequestSnapshot(token);
  const documentRecord = await getPublicSignatureDocumentStorageRecord(token);

  if (!snapshot || !documentRecord) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }

  if (
    ["completed", "declined", "canceled", "voided", "expired"].includes(snapshot.request.statusKey) ||
    ["acted", "declined", "voided", "expired"].includes(snapshot.currentRecipient.statusKey)
  ) {
    return NextResponse.json({ error: "This signature request can no longer be signed." }, { status: 400 });
  }

  if (["draft", "pending"].includes(snapshot.currentRecipient.statusKey)) {
    return NextResponse.json({ error: "This signing step is not active yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { values?: SubmittedSignatureFieldValue[] } | null;

  if (!body?.values || !Array.isArray(body.values)) {
    return NextResponse.json({ error: "A values array is required." }, { status: 400 });
  }

  try {
    const actionableRecipients = snapshot.request.recipients.filter((recipient) => recipient.roleKey !== "cc");
    const allowUnassignedFields = actionableRecipients.length <= 1;
    const editableFieldIds = new Set(
      snapshot.fields
        .filter((field) => !field.assignedRecipientId || allowUnassignedFields || field.assignedRecipientId === snapshot.currentRecipient.id)
        .map((field) => field.id)
    );
    const submittedValues = body.values
      .filter((value) => editableFieldIds.has(value.fieldId))
      .map((value) => ({
        ...value,
        recipientId: snapshot.currentRecipient.id
      }));

    await updateSignatureRequest({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      signatureRequestId: snapshot.request.id,
      action: "signed",
      recipientId: documentRecord.currentRecipientId,
      submittedValues
    });

    const latestSnapshot = await getPublicSignatureRequestSnapshot(token);

    if (!latestSnapshot) {
      throw new Error("Signature request could not be refreshed after signing.");
    }

    const currentActiveRecipients = getActiveRecipients(latestSnapshot.request.recipients);
    const shouldAdvanceStep =
      currentActiveRecipients.length > 0 &&
      currentActiveRecipients.every((recipient) => recipient.statusKey === "pending" || recipient.statusKey === "draft");

    if (shouldAdvanceStep) {
      const baseUrl = new URL(request.url).origin;
      const senderDisplayName = latestSnapshot.request.senderDisplayName || "Acre Signatures";
      const subject = latestSnapshot.request.emailSubject || `Signature requested: ${latestSnapshot.document.title}`;
      const message =
        latestSnapshot.request.emailBody || `${senderDisplayName} sent you a document to review and sign in Acre.`;
      const recipientTokens = currentActiveRecipients.map((recipient) => {
        const { rawToken, tokenHash } = createSignatureToken();
        return {
          recipient,
          rawToken,
          tokenHash
        };
      });

      for (const entry of recipientTokens) {
        await sendSignatureRequestEmail({
          organizationId: documentRecord.organizationId,
          to: entry.recipient.email,
          subject,
          message,
          signingLink: `${baseUrl}/sign/${encodeURIComponent(entry.rawToken)}`,
          documentTitle: latestSnapshot.document.title,
          expiresAt: latestSnapshot.request.expiresAt || null,
          senderDisplayName,
          replyTo: latestSnapshot.request.senderReplyTo || null
        });
      }

      await updateSignatureRequest({
        organizationId: documentRecord.organizationId,
        transactionId: documentRecord.transactionId,
        signatureRequestId: latestSnapshot.request.id,
        action: "advance",
        recipientTokens: recipientTokens.map((entry) => ({
          recipientId: entry.recipient.id,
          tokenHash: entry.tokenHash
        }))
      });
    }

    const refreshedSnapshot = shouldAdvanceStep ? await getPublicSignatureRequestSnapshot(token) : latestSnapshot;

    if (!refreshedSnapshot) {
      throw new Error("Signature request could not be refreshed.");
    }

    const allActionableRecipients = refreshedSnapshot.request.recipients.filter((recipient) => recipient.roleKey !== "cc");
    const isCompleted = allActionableRecipients.every((recipient) => recipient.statusKey === "acted");

    if (!isCompleted) {
      return NextResponse.json({
        signatureRequest: refreshedSnapshot.request
      });
    }

    const originalFile = await readStoredFile(documentRecord.storageKey);
    const signedPdfBytes = await buildSignedPdf({
      originalPdfBytes: new Uint8Array(originalFile.fileBuffer),
      fields: refreshedSnapshot.fields,
      values: refreshedSnapshot.submittedValues.map((value) => ({
        fieldId: value.fieldId,
        fieldType: value.fieldType,
        textValue: value.textValue || undefined,
        signatureMode: value.signatureMode || undefined,
        imageDataUrl: value.imageDataUrl || undefined
      }))
    });
    const signedPdfBuffer = new Uint8Array(signedPdfBytes);
    const signedFileName = buildSignedFileName(documentRecord.fileName);

    const signedFile = await saveStoredFile({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      fileName: signedFileName,
      bytes: signedPdfBuffer
    });

    const signedDocument = await createTransactionDocument({
      organizationId: documentRecord.organizationId,
      officeId: documentRecord.officeId,
      transactionId: documentRecord.transactionId,
      offerId: documentRecord.offerId,
      title: `${documentRecord.title} · signed`,
      fileName: signedFileName,
      mimeType: "application/pdf",
      fileSizeBytes: signedFile.fileSizeBytes,
      storageKey: signedFile.storageKey,
      documentType: documentRecord.documentType,
      source: "signature_output",
      status: "signed",
      isSigned: true,
      signedAt: new Date().toISOString(),
      linkedTaskId: documentRecord.linkedTaskId
    });

    if (!signedDocument) {
      throw new Error("Signed PDF could not be archived.");
    }

    const completedRequest = await updateSignatureRequest({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      signatureRequestId: refreshedSnapshot.request.id,
      action: "completed",
      completedDocumentId: signedDocument.id
    });

    try {
      await attemptSignatureDriveSync({
        organizationId: documentRecord.organizationId,
        signatureRequestId: refreshedSnapshot.request.id
      });
    } catch (driveError) {
      console.error("Failed to sync completed signature artifacts to Google Drive.", driveError);
    }

    try {
      await sendSignatureCompletionEmail({
        organizationId: documentRecord.organizationId,
        to: refreshedSnapshot.request.senderReplyTo || null,
        documentTitle: refreshedSnapshot.document.title,
        signerName: snapshot.currentRecipient.name,
        signerEmail: snapshot.currentRecipient.email,
        signedFileName,
        signedPdfBytes: signedPdfBuffer
      });
    } catch (emailError) {
      console.error("Failed to send signature completion email.", emailError);
    }

    return NextResponse.json({
      signatureRequest: completedRequest,
      signedDocument
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature submission failed." },
      { status: 400 }
    );
  }
}
