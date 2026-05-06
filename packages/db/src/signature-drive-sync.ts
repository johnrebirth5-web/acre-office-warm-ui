import { Prisma, SignatureArtifactKind, SignatureDriveSyncStatus } from "@prisma/client";
import { prisma } from "./client";

export type SignatureDriveSyncArtifactJob = {
  id: string;
  kind: SignatureArtifactKind;
  title: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  storageUrl: string | null;
  driveSyncStatus: SignatureDriveSyncStatus;
  driveSyncError: string | null;
  driveSyncedAt: Date | null;
  driveFolderId: string | null;
  driveFileId: string | null;
  driveWebViewLink: string | null;
};

export type SignatureDriveSyncJob = {
  signatureRequestId: string;
  organizationId: string;
  transactionId: string | null;
  contextType: string;
  contextLabel: string | null;
  templateCategory: "hr" | "finance" | "admin" | "transaction" | "project_sales" | "" | null;
  artifacts: SignatureDriveSyncArtifactJob[];
};

type SignatureRequestDriveSyncRecord = Awaited<ReturnType<typeof loadSignatureRequestForDriveSync>>;

async function loadSignatureRequestForDriveSync(organizationId: string, signatureRequestId: string) {
  return prisma.signatureRequest.findFirst({
    where: {
      id: signatureRequestId,
      organizationId
    },
    include: {
      template: {
        select: {
          id: true,
          category: true
        }
      },
      document: {
        select: {
          id: true,
          title: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          storageKey: true,
          storageUrl: true
        }
      },
      completedDocument: {
        select: {
          id: true,
          title: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          storageKey: true,
          storageUrl: true
        }
      },
      artifacts: {
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}

function mapSyncArtifact(
  artifact: NonNullable<SignatureRequestDriveSyncRecord>["artifacts"][number]
): SignatureDriveSyncArtifactJob {
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    storageKey: artifact.storageKey,
    storageUrl: artifact.storageUrl ?? null,
    driveSyncStatus: artifact.driveSyncStatus,
    driveSyncError: artifact.driveSyncError ?? null,
    driveSyncedAt: artifact.driveSyncedAt ?? null,
    driveFolderId: artifact.driveFolderId ?? null,
    driveFileId: artifact.driveFileId ?? null,
    driveWebViewLink: artifact.driveWebViewLink ?? null
  };
}

async function ensureRequestArtifact(
  tx: Prisma.TransactionClient,
  input: {
    request: NonNullable<SignatureRequestDriveSyncRecord>;
    kind: SignatureArtifactKind;
    transactionDocument:
      | NonNullable<NonNullable<SignatureRequestDriveSyncRecord>["document"]>
      | NonNullable<NonNullable<SignatureRequestDriveSyncRecord>["completedDocument"]>;
  }
) {
  const existing = input.request.artifacts.find((artifact) => artifact.kind === input.kind);

  if (existing) {
    return tx.signatureArtifact.update({
      where: {
        id: existing.id
      },
      data: {
        transactionDocumentId: input.transactionDocument.id,
        title: input.transactionDocument.title,
        fileName: input.transactionDocument.fileName,
        mimeType: input.transactionDocument.mimeType,
        fileSizeBytes: input.transactionDocument.fileSizeBytes,
        storageKey: input.transactionDocument.storageKey,
        storageUrl: input.transactionDocument.storageUrl ?? null
      }
    });
  }

  return tx.signatureArtifact.create({
    data: {
      organizationId: input.request.organizationId,
      officeId: input.request.officeId,
      transactionId: input.request.transactionId,
      subjectMembershipId: input.request.subjectMembershipId,
      offerId: input.request.offerId,
      signatureRequestId: input.request.id,
      transactionDocumentId: input.transactionDocument.id,
      kind: input.kind,
      title: input.transactionDocument.title,
      fileName: input.transactionDocument.fileName,
      mimeType: input.transactionDocument.mimeType,
      fileSizeBytes: input.transactionDocument.fileSizeBytes,
      storageKey: input.transactionDocument.storageKey,
      storageUrl: input.transactionDocument.storageUrl ?? null
    }
  });
}

function deriveRequestDriveSyncStatus(statuses: SignatureDriveSyncStatus[]) {
  if (statuses.length === 0) {
    return SignatureDriveSyncStatus.not_configured;
  }

  if (statuses.every((status) => status === SignatureDriveSyncStatus.synced)) {
    return SignatureDriveSyncStatus.synced;
  }

  if (statuses.some((status) => status === SignatureDriveSyncStatus.failed)) {
    return SignatureDriveSyncStatus.failed;
  }

  if (statuses.some((status) => status === SignatureDriveSyncStatus.pending)) {
    return SignatureDriveSyncStatus.pending;
  }

  return SignatureDriveSyncStatus.not_configured;
}

export async function ensureSignatureDriveArtifacts(input: {
  organizationId: string;
  signatureRequestId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.signatureRequest.findFirst({
      where: {
        id: input.signatureRequestId,
        organizationId: input.organizationId
      },
      include: {
        template: {
          select: {
            id: true,
            category: true
          }
        },
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            mimeType: true,
            fileSizeBytes: true,
            storageKey: true,
            storageUrl: true
          }
        },
        completedDocument: {
          select: {
            id: true,
            title: true,
            fileName: true,
            mimeType: true,
            fileSizeBytes: true,
            storageKey: true,
            storageUrl: true
          }
        },
        artifacts: true
      }
    });

    if (!request) {
      return;
    }

    if (request.document) {
      await ensureRequestArtifact(tx, {
        request,
        kind: SignatureArtifactKind.original,
        transactionDocument: request.document
      });
    }

    if (request.completedDocument) {
      await ensureRequestArtifact(tx, {
        request,
        kind: SignatureArtifactKind.signed_copy,
        transactionDocument: request.completedDocument
      });
    }
  });

  return getSignatureDriveSyncJob(input);
}

export async function getSignatureDriveSyncJob(input: {
  organizationId: string;
  signatureRequestId: string;
}): Promise<SignatureDriveSyncJob | null> {
  const request = await loadSignatureRequestForDriveSync(input.organizationId, input.signatureRequestId);

  if (!request) {
    return null;
  }

  return {
    signatureRequestId: request.id,
    organizationId: request.organizationId,
    transactionId: request.transactionId,
    contextType: request.contextType,
    contextLabel: request.contextLabel ?? null,
    templateCategory: request.template?.category ?? null,
    artifacts: request.artifacts.map(mapSyncArtifact)
  };
}

export async function saveSignatureDriveSyncResult(input: {
  organizationId: string;
  signatureRequestId: string;
  requestStatus: SignatureDriveSyncStatus;
  requestError?: string | null;
  requestSyncedAt?: Date | null;
  artifactResults: Array<{
    artifactId: string;
    driveSyncStatus: SignatureDriveSyncStatus;
    driveSyncError?: string | null;
    driveSyncedAt?: Date | null;
    driveFolderId?: string | null;
    driveFileId?: string | null;
    driveWebViewLink?: string | null;
  }>;
}) {
  await prisma.$transaction(async (tx) => {
    for (const artifactResult of input.artifactResults) {
      await tx.signatureArtifact.updateMany({
        where: {
          id: artifactResult.artifactId,
          signatureRequestId: input.signatureRequestId,
          organizationId: input.organizationId
        },
        data: {
          driveSyncStatus: artifactResult.driveSyncStatus,
          driveSyncError: artifactResult.driveSyncError ?? null,
          driveSyncedAt: artifactResult.driveSyncedAt ?? null,
          driveFolderId: artifactResult.driveFolderId ?? null,
          driveFileId: artifactResult.driveFileId ?? null,
          driveWebViewLink: artifactResult.driveWebViewLink ?? null
        }
      });
    }

    const statuses =
      input.artifactResults.length > 0
        ? input.artifactResults.map((artifactResult) => artifactResult.driveSyncStatus)
        : [input.requestStatus];

    await tx.signatureRequest.updateMany({
      where: {
        id: input.signatureRequestId,
        organizationId: input.organizationId
      },
      data: {
        driveSyncStatus: deriveRequestDriveSyncStatus(statuses),
        driveSyncError: input.requestError ?? null,
        driveSyncedAt: input.requestSyncedAt ?? null,
        driveFolderId:
          input.artifactResults.find((artifactResult) => artifactResult.driveFolderId)?.driveFolderId ?? null,
        driveFileId:
          input.artifactResults.find((artifactResult) => artifactResult.driveFileId)?.driveFileId ?? null
      }
    });
  });
}

export async function markSignatureDriveSyncPending(input: {
  organizationId: string;
  signatureRequestId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.signatureRequest.updateMany({
      where: {
        id: input.signatureRequestId,
        organizationId: input.organizationId
      },
      data: {
        driveSyncStatus: SignatureDriveSyncStatus.pending,
        driveSyncError: null,
        driveSyncedAt: null
      }
    });

    await tx.signatureArtifact.updateMany({
      where: {
        signatureRequestId: input.signatureRequestId,
        organizationId: input.organizationId
      },
      data: {
        driveSyncStatus: SignatureDriveSyncStatus.pending,
        driveSyncError: null,
        driveSyncedAt: null
      }
    });
  });
}
