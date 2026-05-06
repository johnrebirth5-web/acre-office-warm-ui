import { createStandaloneSignatureArtifact, createTransactionDocument, getPublicSignatureDocumentStorageRecord, getPublicSignatureRequestSnapshot, updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { readStoredFile, saveStoredFile, saveStoredSignatureRequestFile } from "../../../../../../lib/document-storage";
import { getPublicAppBaseUrl } from "../../../../../../lib/request-origin";
import {
  buildRateLimitKey,
  consumeRateLimit,
  hashRateLimitSegment,
} from "../../../../../../lib/rate-limit";
import { listSignatureCompletionRecipients } from "../../../../../../lib/signature-completion-recipients";
import { validateRecipientFieldSubmission } from "../../../../../../lib/public-signature-access";
import { attemptSignatureDriveSync } from "../../../../../../lib/signature-drive-sync";
import { buildSignedPdf } from "../../../../../../lib/signature-pdf";
import { sendSignatureCompletionEmails, sendSignatureRequestEmail } from "../../../../../../lib/signature-email";
import { createSignatureToken } from "../../../../../../lib/signature-token";
import { withApiGuard } from "../../../../../../lib/with-api-guard";
import { publicSignatureSubmitBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const PUBLIC_SIGNATURE_SUBMIT_RATE_LIMIT_OPTIONS = {
  limit: 15,
  windowMs: 10 * 60 * 1000,
};

function buildSignedFileName(fileName: string) {
  const normalized = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  return `${normalized}-signed.pdf`;
}

export const runtime = "nodejs";

type PublicSignatureSubmitRouteDependencies = {
  createTransactionDocument?: typeof createTransactionDocument;
  getAppBaseUrl?: typeof getPublicAppBaseUrl;
  getPublicSignatureDocumentStorageRecord?: typeof getPublicSignatureDocumentStorageRecord;
  getPublicSignatureRequestSnapshot?: typeof getPublicSignatureRequestSnapshot;
  parseJsonBody?: typeof parseJsonBody;
  rateLimit?: typeof consumeRateLimit;
  readStoredFile?: typeof readStoredFile;
  saveStoredFile?: typeof saveStoredFile;
  saveStoredSignatureRequestFile?: typeof saveStoredSignatureRequestFile;
  sendSignatureCompletionEmails?: typeof sendSignatureCompletionEmails;
  sendSignatureRequestEmail?: typeof sendSignatureRequestEmail;
  updateSignatureRequest?: typeof updateSignatureRequest;
  withApiGuard?: typeof withApiGuard;
};

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

function buildSignatureSubmitRateLimitResponse(retryAfterSeconds: number) {
  const response = NextResponse.json(
    { error: "Too many signature submit attempts. Please try again in a moment." },
    { status: 429 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

function getPublicSignatureSubmitRateLimitKey(request: NextRequest, token: string) {
  return buildRateLimitKey(
    "public/signatures/submit",
    request,
    hashRateLimitSegment(token),
  );
}

export async function handlePublicSignatureSubmitPost(
  request: NextRequest,
  routeContext: Awaited<RouteContext["params"]>,
  dependencies: PublicSignatureSubmitRouteDependencies = {},
) {
  const { token } = routeContext;
  const guard = dependencies.withApiGuard ?? withApiGuard;
  const getSnapshot =
    dependencies.getPublicSignatureRequestSnapshot ??
    getPublicSignatureRequestSnapshot;
  const getDocumentRecord =
    dependencies.getPublicSignatureDocumentStorageRecord ??
    getPublicSignatureDocumentStorageRecord;
  const parseBody = dependencies.parseJsonBody ?? parseJsonBody;
  const updateRequest =
    dependencies.updateSignatureRequest ?? updateSignatureRequest;
  const getBaseUrl = dependencies.getAppBaseUrl ?? getPublicAppBaseUrl;
  const sendRequestEmail =
    dependencies.sendSignatureRequestEmail ?? sendSignatureRequestEmail;
  const readFile = dependencies.readStoredFile ?? readStoredFile;
  const saveFile = dependencies.saveStoredFile ?? saveStoredFile;
  const saveSignatureRequestFile =
    dependencies.saveStoredSignatureRequestFile ?? saveStoredSignatureRequestFile;
  const createDocument =
    dependencies.createTransactionDocument ?? createTransactionDocument;
  const sendCompletionEmails =
    dependencies.sendSignatureCompletionEmails ?? sendSignatureCompletionEmails;

  return guard(
    request,
    async () => {
      const snapshot = await getSnapshot(token);
      const documentRecord = await getDocumentRecord(token);

      if (!snapshot || !documentRecord) {
        return NextResponse.json(
          { error: "Signature request not found." },
          { status: 404 },
        );
      }

      if (
        ["completed", "declined", "canceled", "voided", "expired"].includes(
          snapshot.request.statusKey,
        ) ||
        ["acted", "declined", "voided", "expired"].includes(
          snapshot.currentRecipient.statusKey,
        )
      ) {
        return NextResponse.json(
          { error: "This signature request can no longer be signed." },
          { status: 400 },
        );
      }

      if (["draft", "pending"].includes(snapshot.currentRecipient.statusKey)) {
        return NextResponse.json(
          { error: "This signing step is not active yet." },
          { status: 400 },
        );
      }

      const parsedBody = await parseBody(
        request,
        publicSignatureSubmitBodySchema,
        {
          error: "A values array is required.",
        },
      );

      if (!parsedBody.ok) {
        return parsedBody.response;
      }

      try {
        const submissionValidation = validateRecipientFieldSubmission({
          fields: snapshot.fields,
          recipients: snapshot.request.recipients,
          currentRecipientId: snapshot.currentRecipient.id,
          submittedValues: parsedBody.data.values,
        });

        if (submissionValidation.unauthorizedFieldIds.length > 0) {
          return NextResponse.json(
            {
              error:
                "You can only complete fields assigned to your signing step.",
            },
            { status: 400 },
          );
        }

        if (submissionValidation.missingRequiredFieldLabels.length > 0) {
          const fieldLabelList = submissionValidation.missingRequiredFieldLabels
            .slice(0, 3)
            .join(", ");
          const suffix =
            submissionValidation.missingRequiredFieldLabels.length > 3
              ? ", and more"
              : "";

          return NextResponse.json(
            {
              error: `Complete every required field assigned to you before submitting. Missing: ${fieldLabelList}${suffix}.`,
            },
            { status: 400 },
          );
        }

        const submittedValues = parsedBody.data.values
          .filter((value) =>
            submissionValidation.editableFieldIds.has(value.fieldId),
          )
          .map((value) => ({
            ...value,
            recipientId: snapshot.currentRecipient.id,
          }));

        await updateRequest({
          organizationId: documentRecord.organizationId,
          transactionId: documentRecord.transactionId,
          signatureRequestId: snapshot.request.id,
          action: "signed",
          recipientId: documentRecord.currentRecipientId,
          submittedValues,
        });

        const latestSnapshot = await getSnapshot(token);

        if (!latestSnapshot) {
          throw new Error(
            "Signature request could not be refreshed after signing.",
          );
        }

        const currentActiveRecipients = getActiveRecipients(
          latestSnapshot.request.recipients,
        );
        const shouldAdvanceStep =
          currentActiveRecipients.length > 0 &&
          currentActiveRecipients.every(
            (recipient) =>
              recipient.statusKey === "pending" ||
              recipient.statusKey === "draft",
          );

        if (shouldAdvanceStep) {
          const baseUrl = getBaseUrl();
          const senderDisplayName =
            latestSnapshot.request.senderDisplayName || "Acre Signatures";
          const subject =
            latestSnapshot.request.emailSubject ||
            `Signature requested: ${latestSnapshot.document.title}`;
          const message =
            latestSnapshot.request.emailBody ||
            `${senderDisplayName} sent you a document to review and sign in Acre.`;
          const recipientTokens = currentActiveRecipients.map((recipient) => {
            const { rawToken, tokenHash } = createSignatureToken();
            return {
              recipient,
              rawToken,
              tokenHash,
            };
          });

          for (const entry of recipientTokens) {
            await sendRequestEmail({
              organizationId: documentRecord.organizationId,
              to: entry.recipient.email,
              subject,
              message,
              signingLink: `${baseUrl}/sign/${encodeURIComponent(entry.rawToken)}`,
              documentTitle: latestSnapshot.document.title,
              expiresAt: latestSnapshot.request.expiresAt || null,
              senderDisplayName,
              replyTo: latestSnapshot.request.senderReplyTo || null,
            });
          }

          await updateRequest({
            organizationId: documentRecord.organizationId,
            transactionId: documentRecord.transactionId,
            signatureRequestId: latestSnapshot.request.id,
            action: "advance",
            recipientTokens: recipientTokens.map((entry) => ({
              recipientId: entry.recipient.id,
              tokenHash: entry.tokenHash,
            })),
          });
        }

        const refreshedSnapshot = shouldAdvanceStep
          ? await getSnapshot(token)
          : latestSnapshot;

        if (!refreshedSnapshot) {
          throw new Error("Signature request could not be refreshed.");
        }

        const allActionableRecipients =
          refreshedSnapshot.request.recipients.filter(
            (recipient) => recipient.roleKey !== "cc",
          );
        const isCompleted = allActionableRecipients.every(
          (recipient) => recipient.statusKey === "acted",
        );

        if (!isCompleted) {
          return NextResponse.json({
            signatureRequest: refreshedSnapshot.request,
          });
        }

        const originalFile = await readFile(
          documentRecord.storageKey,
        );
        const signedPdfBytes = await buildSignedPdf({
          originalPdfBytes: new Uint8Array(originalFile.fileBuffer),
          fields: refreshedSnapshot.fields,
          values: refreshedSnapshot.submittedValues.map((value) => ({
            fieldId: value.fieldId,
            fieldType: value.fieldType,
            textValue: value.textValue || undefined,
            signatureMode: value.signatureMode || undefined,
            imageDataUrl: value.imageDataUrl || undefined,
          })),
        });
        const signedPdfBuffer = new Uint8Array(signedPdfBytes);
        const signedFileName = buildSignedFileName(documentRecord.fileName);

        const signedDocument = documentRecord.transactionId
          ? await (async () => {
              const signedFile = await saveFile({
                organizationId: documentRecord.organizationId,
                transactionId: documentRecord.transactionId!,
                fileName: signedFileName,
                bytes: signedPdfBuffer,
              });

              return createDocument({
                organizationId: documentRecord.organizationId,
                officeId: documentRecord.officeId,
                transactionId: documentRecord.transactionId!,
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
                linkedTaskId: documentRecord.linkedTaskId,
              });
            })()
          : await (async () => {
              const signedFile = await saveSignatureRequestFile({
                organizationId: documentRecord.organizationId,
                signatureRequestId: refreshedSnapshot.request.id,
                fileName: signedFileName,
                bytes: signedPdfBuffer,
              });

              return createStandaloneSignatureArtifact({
                organizationId: documentRecord.organizationId,
                officeId: documentRecord.officeId,
                signatureRequestId: refreshedSnapshot.request.id,
                title: `${documentRecord.title} · signed`,
                fileName: signedFileName,
                mimeType: "application/pdf",
                fileSizeBytes: signedFile.fileSizeBytes,
                storageKey: signedFile.storageKey,
              });
            })();

        if (!signedDocument) {
          throw new Error("Signed PDF could not be archived.");
        }

        const completedRequest = await updateRequest({
          organizationId: documentRecord.organizationId,
          transactionId: documentRecord.transactionId,
          signatureRequestId: refreshedSnapshot.request.id,
          action: "completed",
          completedDocumentId: documentRecord.transactionId ? signedDocument.id : null,
        });

        try {
          await attemptSignatureDriveSync({
            organizationId: documentRecord.organizationId,
            signatureRequestId: refreshedSnapshot.request.id,
          });
        } catch (driveError) {
          console.error(
            "Failed to sync completed signature artifacts to Google Drive.",
            driveError,
          );
        }

        try {
          await sendCompletionEmails({
            organizationId: documentRecord.organizationId,
            recipients: listSignatureCompletionRecipients(
              refreshedSnapshot.request,
            ),
            documentTitle: refreshedSnapshot.document.title,
            signerName: snapshot.currentRecipient.name,
            signerEmail: snapshot.currentRecipient.email,
            signedFileName,
            signedPdfBytes: signedPdfBuffer,
          });
        } catch (emailError) {
          console.error(
            "Failed to send signature completion email.",
            emailError,
          );
        }

        return NextResponse.json({
          signatureRequest: completedRequest,
          signedDocument,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Signature submission failed.",
          },
          { status: 400 },
        );
      }
    },
    {
      cacheControlNoStore: true,
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: () => getPublicSignatureSubmitRateLimitKey(request, token),
        message: "Too many signature submit attempts. Please try again in a moment.",
        onRejected: ({ decision }) =>
          buildSignatureSubmitRateLimitResponse(decision.retryAfterSeconds),
        options: PUBLIC_SIGNATURE_SUBMIT_RATE_LIMIT_OPTIONS,
      },
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handlePublicSignatureSubmitPost(request, await params);
}
