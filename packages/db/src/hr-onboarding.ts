import { createHash, randomBytes } from "node:crypto";
import { HrOnboardingCaseStatus, HrOnboardingDocumentKind, HrSyncState } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export const ACRE_ONBOARDING_FORM_URL = "https://forms.gle/zALYVvygYPJWpZSn8";
const onboardingTokenTtlDays = 21;

export type HrOnboardingCaseRecord = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  status: HrOnboardingCaseStatus;
  position: string;
  teamLeadName: string;
  legalFormUrl: string;
  tokenIssuedAt: string;
  tokenExpiresAt: string;
  submittedAt: string;
  completedAt: string;
  driveSyncState: HrSyncState;
  driveSyncError: string;
  href: string;
};

export type PublicOnboardingSnapshot = {
  caseId: string;
  organizationId: string;
  officeId: string | null;
  candidateName: string;
  candidateEmail: string;
  status: HrOnboardingCaseStatus;
  legalFormUrl: string;
  expiresAt: string;
  documents: Array<{
    id: string;
    kind: HrOnboardingDocumentKind;
    title: string;
    fileName: string;
    createdAt: string;
  }>;
};

export function createHrOnboardingToken() {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashHrOnboardingToken(rawToken),
  };
}

export function hashHrOnboardingToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDocumentKind(value: string | null | undefined) {
  return Object.values(HrOnboardingDocumentKind).includes(value as HrOnboardingDocumentKind)
    ? (value as HrOnboardingDocumentKind)
    : HrOnboardingDocumentKind.other;
}

function buildOfficeScope(officeId: string | null | undefined) {
  return officeId ? { OR: [{ officeId }, { officeId: null }] } : {};
}

function mapCase(record: {
  id: string;
  candidateId: string | null;
  position: string | null;
  teamLeadName: string | null;
  status: HrOnboardingCaseStatus;
  legalFormUrl: string;
  tokenIssuedAt: Date | null;
  tokenExpiresAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  driveSyncState: HrSyncState;
  driveSyncError: string | null;
  candidate?: {
    fullName: string;
    email: string;
  } | null;
}): HrOnboardingCaseRecord {
  return {
    id: record.id,
    candidateId: record.candidateId ?? "",
    candidateName: record.candidate?.fullName ?? "Onboarding case",
    candidateEmail: record.candidate?.email ?? "",
    status: record.status,
    position: record.position ?? "",
    teamLeadName: record.teamLeadName ?? "",
    legalFormUrl: record.legalFormUrl,
    tokenIssuedAt: formatDateTimeLabel(record.tokenIssuedAt),
    tokenExpiresAt: formatDateTimeLabel(record.tokenExpiresAt),
    submittedAt: formatDateTimeLabel(record.submittedAt),
    completedAt: formatDateTimeLabel(record.completedAt),
    driveSyncState: record.driveSyncState,
    driveSyncError: record.driveSyncError ?? "",
    href: `/office/hr/onboarding/${record.id}`,
  };
}

export async function listHrOnboardingCases(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  const cases = await prisma.hrOnboardingCase.findMany({
    where: {
      organizationId: input.organizationId,
      ...buildOfficeScope(input.officeId ?? null),
    },
    include: { candidate: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return cases.map(mapCase);
}

export async function getHrOnboardingCaseDetail(input: {
  organizationId: string;
  officeId?: string | null;
  caseId: string;
}) {
  const onboardingCase = await prisma.hrOnboardingCase.findFirst({
    where: {
      id: input.caseId,
      organizationId: input.organizationId,
      ...buildOfficeScope(input.officeId ?? null),
    },
    include: {
      candidate: true,
      documents: { orderBy: [{ createdAt: "desc" }] },
      checklistInstances: {
        include: { items: { orderBy: [{ sortOrder: "asc" }] } },
      },
    },
  });

  if (!onboardingCase) {
    return null;
  }

  return {
    case: mapCase(onboardingCase),
    documents: onboardingCase.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      fileName: document.fileName,
      createdAt: formatDateTimeLabel(document.createdAt),
    })),
    checklistInstances: onboardingCase.checklistInstances.map((instance) => ({
      id: instance.id,
      title: instance.title,
      items: instance.items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        completedAt: formatDateTimeLabel(item.completedAt),
      })),
    })),
  };
}

export async function createHrOnboardingCase(input: {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  candidateId?: string | null;
  membershipId?: string | null;
}) {
  const candidate = input.candidateId
    ? await prisma.hrCandidate.findFirst({
        where: {
          id: input.candidateId,
          organizationId: input.organizationId,
        },
      })
    : null;

  const onboardingCase = await prisma.$transaction(async (tx) => {
    const created = await tx.hrOnboardingCase.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? candidate?.officeId ?? null,
        createdByMembershipId: input.actorMembershipId,
        candidateId: candidate?.id ?? null,
        membershipId: normalizeOptional(input.membershipId),
        position: candidate?.positionTitle ?? candidate?.role ?? null,
        teamLeadName: candidate?.teamLeadName ?? null,
        legalFormUrl: ACRE_ONBOARDING_FORM_URL,
      },
      include: { candidate: true },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_onboarding_case",
      entityId: created.id,
      action: activityLogActions.hrOnboardingCaseCreated,
      payload: {
        officeId: created.officeId,
        objectLabel: created.candidate?.fullName ?? "Onboarding case",
        contextHref: `/office/hr/onboarding/${created.id}`,
      },
    });

    return created;
  });

  return mapCase(onboardingCase);
}

export async function issueHrOnboardingToken(input: {
  organizationId: string;
  actorMembershipId: string;
  caseId: string;
}) {
  const { rawToken, tokenHash } = createHrOnboardingToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + onboardingTokenTtlDays * 24 * 60 * 60 * 1000);

  const onboardingCase = await prisma.hrOnboardingCase.update({
    where: {
      id: input.caseId,
      organizationId: input.organizationId,
    },
    data: {
      tokenHash,
      tokenIssuedAt: now,
      tokenExpiresAt: expiresAt,
      status: HrOnboardingCaseStatus.token_issued,
    },
    include: { candidate: true },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "hr_onboarding_case",
    entityId: onboardingCase.id,
    action: activityLogActions.hrOnboardingCaseCreated,
    payload: {
      officeId: onboardingCase.officeId,
      objectLabel: onboardingCase.candidate?.fullName ?? "Onboarding token",
      details: ["Onboarding token issued."],
      contextHref: `/office/hr/onboarding/${onboardingCase.id}`,
    },
  });

  return {
    case: mapCase(onboardingCase),
    token: rawToken,
    publicUrl: `/onboarding/${encodeURIComponent(rawToken)}`,
  };
}

export async function resolveHrOnboardingToken(token: string): Promise<PublicOnboardingSnapshot | null> {
  const tokenHash = hashHrOnboardingToken(token);
  const onboardingCase = await prisma.hrOnboardingCase.findUnique({
    where: { tokenHash },
    include: {
      candidate: true,
      documents: { orderBy: [{ createdAt: "desc" }] },
    },
  });

  if (!onboardingCase?.candidate || !onboardingCase.tokenExpiresAt) {
    return null;
  }

  if (onboardingCase.tokenExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    caseId: onboardingCase.id,
    organizationId: onboardingCase.organizationId,
    officeId: onboardingCase.officeId,
    candidateName: onboardingCase.candidate.fullName,
    candidateEmail: onboardingCase.candidate.email,
    status: onboardingCase.status,
    legalFormUrl: onboardingCase.legalFormUrl,
    expiresAt: formatDateTimeLabel(onboardingCase.tokenExpiresAt),
    documents: onboardingCase.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      fileName: document.fileName,
      createdAt: formatDateTimeLabel(document.createdAt),
    })),
  };
}

export async function createHrOnboardingDocument(input: {
  organizationId: string;
  officeId?: string | null;
  onboardingCaseId: string;
  uploadedByMembershipId?: string | null;
  kind?: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  submittedByEmail?: string | null;
}) {
  const document = await prisma.$transaction(async (tx) => {
    const onboardingCase = await tx.hrOnboardingCase.findFirst({
      where: {
        id: input.onboardingCaseId,
        organizationId: input.organizationId,
      },
      include: { candidate: true },
    });

    if (!onboardingCase) {
      throw new Error("Onboarding case not found.");
    }

    const created = await tx.hrOnboardingDocument.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? onboardingCase.officeId,
        onboardingCaseId: onboardingCase.id,
        uploadedByMembershipId: input.uploadedByMembershipId ?? null,
        kind: parseDocumentKind(input.kind),
        title: normalizeOptional(input.title) ?? input.fileName,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        storageKey: input.storageKey,
        submittedByEmail: normalizeOptional(input.submittedByEmail),
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.uploadedByMembershipId ?? null,
      entityType: "hr_onboarding_document",
      entityId: created.id,
      action: activityLogActions.hrOnboardingDocumentUploaded,
      payload: {
        officeId: created.officeId,
        objectLabel: `${onboardingCase.candidate?.fullName ?? "Onboarding"} · ${created.title}`,
        fileName: created.fileName,
        fileSizeBytes: created.fileSizeBytes,
        contextHref: `/office/hr/onboarding/${onboardingCase.id}`,
      },
    });

    return created;
  });

  return {
    id: document.id,
    kind: document.kind,
    title: document.title,
    fileName: document.fileName,
    createdAt: formatDateTimeLabel(document.createdAt),
  };
}

export async function submitHrOnboardingCase(input: {
  token: string;
  submittedByEmail?: string | null;
}) {
  const tokenHash = hashHrOnboardingToken(input.token);
  const onboardingCase = await prisma.hrOnboardingCase.findUnique({
    where: { tokenHash },
    include: { candidate: true },
  });

  if (!onboardingCase?.candidate || !onboardingCase.tokenExpiresAt || onboardingCase.tokenExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  const updated = await prisma.hrOnboardingCase.update({
    where: { id: onboardingCase.id },
    data: {
      status: HrOnboardingCaseStatus.submitted,
      submittedAt: new Date(),
    },
    include: { candidate: true },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: updated.organizationId,
    membershipId: null,
    entityType: "hr_onboarding_case",
    entityId: updated.id,
    action: activityLogActions.hrOnboardingDocumentUploaded,
    payload: {
      officeId: updated.officeId,
      objectLabel: updated.candidate?.fullName ?? "Onboarding submitted",
      details: [`Submitted by: ${input.submittedByEmail ?? updated.candidate?.email ?? "candidate"}`],
      contextHref: `/office/hr/onboarding/${updated.id}`,
    },
  });

  return mapCase(updated);
}
