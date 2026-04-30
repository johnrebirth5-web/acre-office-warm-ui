import { createHash, randomBytes } from "node:crypto";
import {
  buildProjectSignatureJobIdempotencyKey,
  completeProjectSigningSessionIfReady,
  createProjectDistributionRows,
  enqueueProjectSignatureJob,
  markProjectSessionDocumentCompleted,
  prisma,
} from "@acre/db";
import {
  ProjectDocumentDistributionMode,
  ProjectDocumentDistributionRecipientKind,
  ProjectDocumentDistributionStatus,
  ProjectSigningJobStatus,
  ProjectSigningJobType,
  SignatureArtifactKind,
} from "@prisma/client";
import { readStoredFile, saveStoredProjectFile } from "./document-storage";
import { sendSignatureDownloadLinkEmail } from "./signature-email";
import { attemptSignatureDriveSync } from "./signature-drive-sync";
import { buildSignedPdf, type SubmittedSignatureFieldValue } from "./signature-pdf";
import { hashSignatureToken } from "./signature-token";

const scannerIntervalMs = 5 * 60 * 1000;
const staleJobThresholdMs = 10 * 60 * 1000;
const maxJobsPerScan = 10;
const workerId = `project-signing-${process.pid}-${randomBytes(4).toString("hex")}`;

const globalForProjectSigningJobs = globalThis as typeof globalThis & {
  __acreProjectSigningJobScanner?: NodeJS.Timeout;
};

function getWorkerBaseUrl() {
  return (process.env.ACRE_BASE_URL?.trim() || "http://localhost:3105").replace(/\/+$/, "");
}

function buildSignedFileName(fileName: string) {
  const normalized = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  return `${normalized}-signed.pdf`;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function readSubmittedValues(values: unknown): SubmittedSignatureFieldValue[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is SubmittedSignatureFieldValue => {
      if (!value || typeof value !== "object") {
        return false;
      }

      const candidate = value as Partial<SubmittedSignatureFieldValue>;
      return typeof candidate.fieldId === "string";
    })
    .map((value) => ({
      fieldId: value.fieldId,
      fieldType: value.fieldType,
      textValue: value.textValue,
      signatureMode: value.signatureMode,
      imageDataUrl: value.imageDataUrl,
    }));
}

async function markJobSucceeded(jobId: string) {
  await prisma.projectSignatureJob.update({
    where: {
      id: jobId,
    },
    data: {
      status: ProjectSigningJobStatus.succeeded,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

async function markJobFailedOrRetry(
  job: {
    id: string;
    attempts: number;
    maxAttempts: number;
    type: ProjectSigningJobType;
    distributionId: string | null;
    sessionDocumentId: string | null;
  },
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown project signing job error.";
  const nextAttempts = job.attempts + 1;
  const retryDelayMs = Math.min(30 * 60 * 1000, 60_000 * Math.max(1, nextAttempts));
  const shouldRetry = nextAttempts < job.maxAttempts;

  await prisma.projectSignatureJob.update({
    where: {
      id: job.id,
    },
    data: {
      attempts: nextAttempts,
      status: shouldRetry ? ProjectSigningJobStatus.queued : ProjectSigningJobStatus.failed,
      runAfter: new Date(Date.now() + retryDelayMs),
      lockedAt: null,
      lockedBy: null,
      lastError: message,
    },
  });

  if (shouldRetry) {
    return;
  }

  if (job.type === ProjectSigningJobType.send_completion_email && job.distributionId) {
    await prisma.projectDocumentDistribution.update({
      where: {
        id: job.distributionId,
      },
      data: {
        status: ProjectDocumentDistributionStatus.failed,
        lastError: message,
      },
    });
  }

  if (job.type === ProjectSigningJobType.finalize_pdf && job.sessionDocumentId) {
    await prisma.projectSigningSessionDocument.update({
      where: {
        id: job.sessionDocumentId,
      },
      data: {
        finalizationStatus: ProjectSigningJobStatus.failed,
        finalizationError: message,
      },
    });
  }
}

async function finalizeProjectSigningPdf(job: {
  sessionDocumentId: string | null;
}) {
  if (!job.sessionDocumentId) {
    throw new Error("Project signing finalize job is missing sessionDocumentId.");
  }

  const sessionDocument = await prisma.projectSigningSessionDocument.findUnique({
    where: {
      id: job.sessionDocumentId,
    },
    include: {
      project: true,
      session: {
        include: {
          responsibleMembership: {
            include: {
              user: true,
            },
          },
          recipients: true,
        },
      },
      signatureRequest: {
        include: {
          fields: {
            orderBy: [{ sortOrder: "asc" }],
          },
          recipients: true,
        },
      },
    },
  });

  if (!sessionDocument) {
    throw new Error("Project signing session document was not found.");
  }

  if (sessionDocument.signedArtifactId) {
    return;
  }

  const sourceFile = await readStoredFile(sessionDocument.snapshotPdfStorageKey);
  const submittedValues = sessionDocument.signatureRequest.recipients.flatMap((recipient) => readSubmittedValues(recipient.submittedValues));
  const signedPdfBytes = await buildSignedPdf({
    originalPdfBytes: new Uint8Array(sourceFile.fileBuffer),
    fields: sessionDocument.signatureRequest.fields.map((field) => ({
      ...field,
      defaultValue: field.defaultValue ?? "",
      fontStyle: field.fontStyle ?? "",
      fieldKey: field.fieldKey ?? "",
      mirrorGroup: field.mirrorGroup ?? "",
    })) as never,
    values: submittedValues,
    allowIncomplete: true,
  });
  const signedBytes = new Uint8Array(signedPdfBytes);
  const contentSha256 = sha256(signedBytes);
  const signedFileName = buildSignedFileName(sessionDocument.snapshotPdfFileName);
  const savedFile = await saveStoredProjectFile({
    organizationId: sessionDocument.organizationId,
    projectId: sessionDocument.projectId,
    fileName: signedFileName,
    bytes: signedBytes,
  });

  const artifact = await prisma.signatureArtifact.create({
    data: {
      organizationId: sessionDocument.organizationId,
      officeId: sessionDocument.officeId,
      transactionId: sessionDocument.signatureRequest.transactionId,
      signatureRequestId: sessionDocument.signatureRequestId,
      kind: SignatureArtifactKind.signed_copy,
      title: `${sessionDocument.title} · signed`,
      fileName: signedFileName,
      mimeType: "application/pdf",
      fileSizeBytes: savedFile.fileSizeBytes,
      storageKey: savedFile.storageKey,
      contentSha256,
    },
  });

  await markProjectSessionDocumentCompleted({
    organizationId: sessionDocument.organizationId,
    sessionDocumentId: sessionDocument.id,
    signatureArtifactId: artifact.id,
    signedArtifactStorageKey: savedFile.storageKey,
    signedArtifactSha256: contentSha256,
  });

  await prisma.salesProjectDocument.create({
    data: {
      organizationId: sessionDocument.organizationId,
      officeId: sessionDocument.officeId,
      projectId: sessionDocument.projectId,
      sessionId: sessionDocument.sessionId,
      sessionDocumentId: sessionDocument.id,
      signatureRequestId: sessionDocument.signatureRequestId,
      signatureArtifactId: artifact.id,
      templateId: sessionDocument.templateId,
      responsibleMembershipId: sessionDocument.session.responsibleMembershipId,
      buyerName: sessionDocument.session.buyerName,
      buyerEmail: sessionDocument.session.buyerEmail,
      title: artifact.title,
      documentType: sessionDocument.documentType,
      fileName: signedFileName,
      mimeType: "application/pdf",
      fileSizeBytes: savedFile.fileSizeBytes,
      storageKey: savedFile.storageKey,
      contentSha256,
      source: "signature_output",
      signedAt: new Date(),
    },
  });

  const distributionRecipients = [
    ...sessionDocument.session.recipients
      .filter((recipient) => recipient.email)
      .map((recipient) => ({
        recipientKind: ProjectDocumentDistributionRecipientKind.signer,
        recipientEmail: recipient.email!,
        recipientName: recipient.name,
        deliveryMode: ProjectDocumentDistributionMode.secure_link,
      })),
    ...(sessionDocument.session.responsibleMembership?.user.email
      ? [
          {
            recipientKind: ProjectDocumentDistributionRecipientKind.responsible_agent,
            recipientEmail: sessionDocument.session.responsibleMembership.user.email,
            recipientName: `${sessionDocument.session.responsibleMembership.user.firstName} ${sessionDocument.session.responsibleMembership.user.lastName}`.trim(),
            deliveryMode: ProjectDocumentDistributionMode.secure_link,
          },
        ]
      : []),
    ...sessionDocument.project.archiveSinkEmails.map((email) => ({
      recipientKind: ProjectDocumentDistributionRecipientKind.archive_sink,
      recipientEmail: email,
      recipientName: "Project archive",
      deliveryMode: ProjectDocumentDistributionMode.secure_link,
    })),
  ];

  const distributions = await createProjectDistributionRows({
    organizationId: sessionDocument.organizationId,
    officeId: sessionDocument.officeId,
    projectId: sessionDocument.projectId,
    sessionId: sessionDocument.sessionId,
    sessionDocumentId: sessionDocument.id,
    signatureArtifactId: artifact.id,
    recipients: distributionRecipients,
  });

  for (const distribution of distributions) {
    await enqueueProjectSignatureJob({
      organizationId: distribution.organizationId,
      officeId: distribution.officeId,
      projectId: distribution.projectId,
      sessionId: distribution.sessionId,
      sessionDocumentId: distribution.sessionDocumentId,
      signatureArtifactId: distribution.signatureArtifactId,
      distributionId: distribution.id,
      type: ProjectSigningJobType.send_completion_email,
      idempotencyKey: buildProjectSignatureJobIdempotencyKey({
        type: ProjectSigningJobType.send_completion_email,
        distributionId: distribution.id,
      }),
    });
  }

  await enqueueProjectSignatureJob({
    organizationId: sessionDocument.organizationId,
    officeId: sessionDocument.officeId,
    projectId: sessionDocument.projectId,
    sessionId: sessionDocument.sessionId,
    sessionDocumentId: sessionDocument.id,
    signatureArtifactId: artifact.id,
    type: ProjectSigningJobType.drive_sync,
    idempotencyKey: buildProjectSignatureJobIdempotencyKey({
      type: ProjectSigningJobType.drive_sync,
      signatureArtifactId: artifact.id,
    }),
  });

  await completeProjectSigningSessionIfReady({
    organizationId: sessionDocument.organizationId,
    sessionId: sessionDocument.sessionId,
  });
}

async function sendProjectCompletionEmail(job: {
  distributionId: string | null;
}) {
  if (!job.distributionId) {
    throw new Error("Project signing email job is missing distributionId.");
  }

  const distribution = await prisma.projectDocumentDistribution.findUnique({
    where: {
      id: job.distributionId,
    },
    include: {
      signatureArtifact: true,
      sessionDocument: true,
    },
  });

  if (!distribution || !distribution.signatureArtifact) {
    throw new Error("Project document distribution could not be loaded.");
  }

  if (distribution.status === ProjectDocumentDistributionStatus.sent) {
    return;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.projectDocumentDownloadToken.create({
    data: {
      organizationId: distribution.organizationId,
      officeId: distribution.officeId,
      distributionId: distribution.id,
      signatureArtifactId: distribution.signatureArtifactId!,
      tokenHash: hashSignatureToken(rawToken),
      expiresAt,
      maxUses: 3,
    },
  });

  await prisma.projectDocumentDistribution.update({
    where: {
      id: distribution.id,
    },
    data: {
      status: ProjectDocumentDistributionStatus.sending,
      lastError: null,
    },
  });

  await sendSignatureDownloadLinkEmail({
    organizationId: distribution.organizationId,
    to: distribution.recipientEmail,
    recipientName: distribution.recipientName,
    documentTitle: distribution.signatureArtifact.title,
    downloadLink: `${getWorkerBaseUrl()}/api/project-document-download/${encodeURIComponent(rawToken)}`,
    expiresAt,
  });

  await prisma.projectDocumentDistribution.update({
    where: {
      id: distribution.id,
    },
    data: {
      status: ProjectDocumentDistributionStatus.sent,
      sentAt: new Date(),
      lastError: null,
    },
  });
}

async function syncProjectArtifactToDrive(job: {
  organizationId: string;
  sessionDocumentId: string | null;
}) {
  if (!job.sessionDocumentId) {
    throw new Error("Project signing Drive job is missing sessionDocumentId.");
  }

  const sessionDocument = await prisma.projectSigningSessionDocument.findUnique({
    where: {
      id: job.sessionDocumentId,
    },
    select: {
      signatureRequestId: true,
    },
  });

  if (!sessionDocument) {
    throw new Error("Project signing session document was not found.");
  }

  await attemptSignatureDriveSync({
    organizationId: job.organizationId,
    signatureRequestId: sessionDocument.signatureRequestId,
  });
}

async function processClaimedJob(job: Awaited<ReturnType<typeof claimProjectSignatureJob>>) {
  if (!job) {
    return;
  }

  try {
    if (job.type === ProjectSigningJobType.finalize_pdf) {
      await finalizeProjectSigningPdf(job);
    } else if (job.type === ProjectSigningJobType.send_completion_email) {
      await sendProjectCompletionEmail(job);
    } else {
      await syncProjectArtifactToDrive(job);
    }

    await markJobSucceeded(job.id);
  } catch (error) {
    await markJobFailedOrRetry(job, error);
  }
}

async function claimProjectSignatureJob(jobId: string) {
  const staleBefore = new Date(Date.now() - staleJobThresholdMs);
  const claimed = await prisma.projectSignatureJob.updateMany({
    where: {
      id: jobId,
      OR: [
        {
          status: ProjectSigningJobStatus.queued,
          runAfter: {
            lte: new Date(),
          },
        },
        {
          status: ProjectSigningJobStatus.running,
          lockedAt: {
            lt: staleBefore,
          },
        },
      ],
    },
    data: {
      status: ProjectSigningJobStatus.running,
      lockedAt: new Date(),
      lockedBy: workerId,
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  return prisma.projectSignatureJob.findUnique({
    where: {
      id: jobId,
    },
  });
}

export async function scanProjectSignatureJobs() {
  const staleBefore = new Date(Date.now() - staleJobThresholdMs);
  const jobs = await prisma.projectSignatureJob.findMany({
    where: {
      OR: [
        {
          status: ProjectSigningJobStatus.queued,
          runAfter: {
            lte: new Date(),
          },
        },
        {
          status: ProjectSigningJobStatus.running,
          lockedAt: {
            lt: staleBefore,
          },
        },
      ],
    },
    orderBy: [{ runAfter: "asc" }],
    take: maxJobsPerScan,
  });

  for (const job of jobs) {
    const claimed = await claimProjectSignatureJob(job.id);
    await processClaimedJob(claimed);
  }

  return jobs.length;
}

export function triggerProjectSignatureJobScanSoon() {
  setImmediate(() => {
    void scanProjectSignatureJobs().catch((error) => {
      console.error("Project signing job scan failed.", error);
    });
  });
}

export function startProjectSignatureJobScanner() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (globalForProjectSigningJobs.__acreProjectSigningJobScanner) {
    return;
  }

  triggerProjectSignatureJobScanSoon();
  globalForProjectSigningJobs.__acreProjectSigningJobScanner = setInterval(() => {
    void scanProjectSignatureJobs().catch((error) => {
      console.error("Project signing job scan failed.", error);
    });
  }, scannerIntervalMs);
}
