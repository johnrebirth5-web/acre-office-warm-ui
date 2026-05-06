import {
  SignatureArtifactKind,
  SignatureAuditEventType,
  SignatureDriveSyncStatus,
  SignatureRecipientRole,
  SignatureRecipientStatus,
  SignatureRequestStatus,
  type SignatureContextType,
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import {
  mapSignatureRequest,
  recordSignatureAuditEntry,
} from "./transaction-documents/readers";

export type CreateContextSignatureRequestInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  contextType: SignatureContextType;
  contextId: string;
  contextLabel?: string | null;
  subjectMembershipId?: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl?: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  senderDisplayName?: string | null;
  senderReplyTo?: string | null;
  expiresAt?: Date | null;
};

export type CreateStandaloneSignatureArtifactInput = {
  organizationId: string;
  officeId?: string | null;
  signatureRequestId: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl?: string | null;
  kind?: SignatureArtifactKind;
};

function normalizeRequired(value: string | null | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function createStandaloneSignatureArtifact(
  input: CreateStandaloneSignatureArtifactInput,
) {
  return prisma.signatureArtifact.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      signatureRequestId: input.signatureRequestId,
      kind: input.kind ?? SignatureArtifactKind.signed_copy,
      title: normalizeRequired(input.title, "Artifact title"),
      fileName: normalizeRequired(input.fileName, "Artifact file name"),
      mimeType: normalizeRequired(input.mimeType, "Artifact MIME type"),
      fileSizeBytes: input.fileSizeBytes,
      storageKey: normalizeRequired(input.storageKey, "Artifact storage key"),
      storageUrl: normalizeOptional(input.storageUrl),
      driveSyncStatus: SignatureDriveSyncStatus.not_configured,
    },
  });
}

export async function createContextSignatureRequest(
  input: CreateContextSignatureRequestInput,
) {
  const requestId = await prisma.$transaction(async (tx) => {
    const recipientName = normalizeRequired(input.recipientName, "Recipient name");
    const recipientEmail = normalizeRequired(input.recipientEmail, "Recipient email").toLowerCase();
    const title = normalizeRequired(input.title, "Document title");
    const fileName = normalizeRequired(input.fileName, "Document file name");

    const request = await tx.signatureRequest.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        transactionId: null,
        requestedByMembershipId: input.actorMembershipId,
        subjectMembershipId: normalizeOptional(input.subjectMembershipId),
        contextType: input.contextType,
        contextId: normalizeRequired(input.contextId, "Context ID"),
        contextLabel: normalizeOptional(input.contextLabel),
        recipientName,
        recipientEmail,
        recipientRole: normalizeOptional(input.recipientRole) ?? "Signer",
        emailSubject: normalizeOptional(input.emailSubject),
        emailBody: normalizeOptional(input.emailBody),
        senderDisplayName: normalizeOptional(input.senderDisplayName),
        senderReplyTo: normalizeOptional(input.senderReplyTo),
        expiresAt: input.expiresAt ?? null,
        status: SignatureRequestStatus.draft,
      },
    });

    await tx.signatureRecipient.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        transactionId: null,
        signatureRequestId: request.id,
        role: SignatureRecipientRole.signer,
        name: recipientName,
        email: recipientEmail,
        recipientRole: normalizeOptional(input.recipientRole) ?? "Signer",
        routingStep: 1,
        sortOrder: 0,
        status: SignatureRecipientStatus.draft,
      },
    });

    await tx.signatureArtifact.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        signatureRequestId: request.id,
        kind: SignatureArtifactKind.original,
        title,
        fileName,
        mimeType: normalizeRequired(input.mimeType, "Document MIME type"),
        fileSizeBytes: input.fileSizeBytes,
        storageKey: normalizeRequired(input.storageKey, "Document storage key"),
        storageUrl: normalizeOptional(input.storageUrl),
        driveSyncStatus: SignatureDriveSyncStatus.not_configured,
      },
    });

    await recordSignatureAuditEntry(tx, {
      signatureRequestId: request.id,
      eventType: SignatureAuditEventType.request_created,
      actorMembershipId: input.actorMembershipId,
      actorLabel: "Internal team member",
      details: {
        recipient: recipientEmail,
        document: title,
        contextType: input.contextType,
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "signature_request",
      entityId: request.id,
      action: activityLogActions.hrSignatureRequestCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: title,
        contextHref: input.contextType === "hr_onboarding"
          ? `/office/hr/onboarding/${input.contextId}`
          : input.contextType === "hr_offboarding"
            ? `/office/hr/offboarding/${input.contextId}`
            : undefined,
      },
    });

    return request.id;
  });

  const request = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      document: {
        select: {
          id: true,
          title: true,
          transactionId: true,
        },
      },
      completedDocument: {
        select: {
          id: true,
          title: true,
          transactionId: true,
        },
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }],
      },
      artifacts: true,
    },
  });

  return request ? mapSignatureRequest(request) : null;
}
