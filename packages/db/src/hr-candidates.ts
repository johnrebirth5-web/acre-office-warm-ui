import { HrCandidateStatus, HrIdentityType, HrSyncState } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type HrCandidateRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  positionTitle: string;
  teamLeadName: string;
  sourceType: string;
  referrerName: string;
  statusKey: HrCandidateStatus;
  statusLabel: string;
  statusTone: BadgeTone;
  identityType: string;
  resumeFileKey: string;
  resumeDriveFileId: string;
  driveFolderId: string;
  driveSyncState: HrSyncState;
  driveSyncLabel: string;
  driveSyncTone: BadgeTone;
  createdAt: string;
  updatedAt: string;
  href: string;
};

export type HrCandidateListSnapshot = {
  summary: {
    totalCount: number;
    activeCount: number;
    interview2Count: number;
    offeredCount: number;
    hiredCount: number;
    syncIssueCount: number;
  };
  filters: {
    status: string;
  };
  candidates: HrCandidateRecord[];
};

export type HrCandidateDetailSnapshot = {
  candidate: HrCandidateRecord;
  interviews: Array<{
    id: string;
    title: string;
    mode: string;
    status: string;
    startsAt: string;
    location: string;
    meetUrl: string;
    googleSyncState: string;
    trackerSyncState: string;
  }>;
  onboardingCases: Array<{
    id: string;
    status: string;
    tokenIssuedAt: string;
    submittedAt: string;
    href: string;
  }>;
  offboardingCases: Array<{
    id: string;
    status: string;
    lastWorkingDate: string;
    href: string;
  }>;
};

export type CreateHrCandidateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  positionTitle?: string | null;
  teamLeadName?: string | null;
  sourceType?: string | null;
  referrerName?: string | null;
  identityType?: string | null;
  resumeFileKey?: string | null;
  resumeDriveFileId?: string | null;
};

export type UpdateHrCandidateInput = Partial<Omit<CreateHrCandidateInput, "organizationId" | "actorMembershipId">> & {
  organizationId: string;
  actorMembershipId: string;
  candidateId: string;
  status?: string | null;
};

const candidateStatusLabelMap: Record<HrCandidateStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interview_1: "Interview 1",
  interview_2: "Interview 2",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const candidateStatusToneMap: Record<HrCandidateStatus, BadgeTone> = {
  applied: "neutral",
  screening: "accent",
  interview_1: "accent",
  interview_2: "warning",
  offered: "warning",
  hired: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

const syncLabelMap: Record<HrSyncState, string> = {
  pending: "Pending",
  synced: "Synced",
  sync_failed: "Needs retry",
  not_applicable: "Not configured",
};

const syncToneMap: Record<HrSyncState, BadgeTone> = {
  pending: "warning",
  synced: "success",
  sync_failed: "danger",
  not_applicable: "neutral",
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

function normalizeEmail(value: string) {
  return normalizeRequired(value, "Email").toLowerCase();
}

function parseCandidateStatus(value: string | null | undefined) {
  return Object.values(HrCandidateStatus).includes(value as HrCandidateStatus)
    ? (value as HrCandidateStatus)
    : null;
}

function parseIdentityType(value: string | null | undefined) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }
  return Object.values(HrIdentityType).includes(normalized as HrIdentityType)
    ? (normalized as HrIdentityType)
    : null;
}

function buildOfficeScope(officeId: string | null | undefined) {
  return officeId ? { OR: [{ officeId }, { officeId: null }] } : {};
}

function mapCandidate(record: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string | null;
  positionTitle: string | null;
  teamLeadName: string | null;
  sourceType: string | null;
  referrerName: string | null;
  status: HrCandidateStatus;
  identityType: string | null;
  resumeFileKey: string | null;
  resumeDriveFileId: string | null;
  driveFolderId: string | null;
  driveSyncState: HrSyncState;
  createdAt: Date;
  updatedAt: Date;
}): HrCandidateRecord {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone ?? "",
    role: record.role ?? "",
    positionTitle: record.positionTitle ?? "",
    teamLeadName: record.teamLeadName ?? "",
    sourceType: record.sourceType ?? "",
    referrerName: record.referrerName ?? "",
    statusKey: record.status,
    statusLabel: candidateStatusLabelMap[record.status],
    statusTone: candidateStatusToneMap[record.status],
    identityType: record.identityType ?? "",
    resumeFileKey: record.resumeFileKey ?? "",
    resumeDriveFileId: record.resumeDriveFileId ?? "",
    driveFolderId: record.driveFolderId ?? "",
    driveSyncState: record.driveSyncState,
    driveSyncLabel: syncLabelMap[record.driveSyncState],
    driveSyncTone: syncToneMap[record.driveSyncState],
    createdAt: formatDateTimeLabel(record.createdAt),
    updatedAt: formatDateTimeLabel(record.updatedAt),
    href: `/office/hr/candidates/${record.id}`,
  };
}

export async function listHrCandidates(input: {
  organizationId: string;
  officeId?: string | null;
  status?: string | null;
}): Promise<HrCandidateListSnapshot> {
  const status = parseCandidateStatus(input.status);
  const where = {
    organizationId: input.organizationId,
    ...buildOfficeScope(input.officeId ?? null),
    ...(status ? { status } : {}),
  };

  const [candidates, allCandidates] = await Promise.all([
    prisma.hrCandidate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    }),
    prisma.hrCandidate.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildOfficeScope(input.officeId ?? null),
      },
      select: {
        status: true,
        driveSyncState: true,
      },
    }),
  ]);

  return {
    summary: {
      totalCount: allCandidates.length,
      activeCount: allCandidates.filter((candidate) =>
        ["applied", "screening", "interview_1", "interview_2"].includes(candidate.status),
      ).length,
      interview2Count: allCandidates.filter((candidate) => candidate.status === "interview_2").length,
      offeredCount: allCandidates.filter((candidate) => candidate.status === "offered").length,
      hiredCount: allCandidates.filter((candidate) => candidate.status === "hired").length,
      syncIssueCount: allCandidates.filter((candidate) => candidate.driveSyncState === "sync_failed").length,
    },
    filters: {
      status: status ?? "all",
    },
    candidates: candidates.map(mapCandidate),
  };
}

export async function getHrCandidateDetail(input: {
  organizationId: string;
  officeId?: string | null;
  candidateId: string;
}): Promise<HrCandidateDetailSnapshot | null> {
  const candidate = await prisma.hrCandidate.findFirst({
    where: {
      id: input.candidateId,
      organizationId: input.organizationId,
      ...buildOfficeScope(input.officeId ?? null),
    },
    include: {
      interviews: {
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      },
      onboardingCases: {
        orderBy: [{ updatedAt: "desc" }],
      },
      offboardingCases: {
        orderBy: [{ updatedAt: "desc" }],
      },
    },
  });

  if (!candidate) {
    return null;
  }

  return {
    candidate: mapCandidate(candidate),
    interviews: candidate.interviews.map((interview) => ({
      id: interview.id,
      title: interview.title,
      mode: interview.mode,
      status: interview.status,
      startsAt: formatDateTimeLabel(interview.startsAt),
      location: interview.location ?? "",
      meetUrl: interview.meetUrl ?? "",
      googleSyncState: syncLabelMap[interview.googleSyncState],
      trackerSyncState: syncLabelMap[interview.trackerSyncState],
    })),
    onboardingCases: candidate.onboardingCases.map((onboardingCase) => ({
      id: onboardingCase.id,
      status: onboardingCase.status,
      tokenIssuedAt: formatDateTimeLabel(onboardingCase.tokenIssuedAt),
      submittedAt: formatDateTimeLabel(onboardingCase.submittedAt),
      href: `/office/hr/onboarding/${onboardingCase.id}`,
    })),
    offboardingCases: candidate.offboardingCases.map((offboardingCase) => ({
      id: offboardingCase.id,
      status: offboardingCase.status,
      lastWorkingDate: formatDateTimeLabel(offboardingCase.lastWorkingDate),
      href: `/office/hr/offboarding/${offboardingCase.id}`,
    })),
  };
}

export async function createHrCandidate(input: CreateHrCandidateInput) {
  const candidate = await prisma.$transaction(async (tx) => {
    const created = await tx.hrCandidate.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        createdByMembershipId: input.actorMembershipId,
        hrOwnerMembershipId: input.actorMembershipId,
        fullName: normalizeRequired(input.fullName, "Full name"),
        email: normalizeEmail(input.email),
        phone: normalizeOptional(input.phone),
        role: normalizeOptional(input.role),
        positionTitle: normalizeOptional(input.positionTitle),
        teamLeadName: normalizeOptional(input.teamLeadName),
        sourceType: normalizeOptional(input.sourceType),
        referrerName: normalizeOptional(input.referrerName),
        identityType: parseIdentityType(input.identityType),
        resumeFileKey: normalizeOptional(input.resumeFileKey),
        resumeDriveFileId: normalizeOptional(input.resumeDriveFileId),
        driveSyncState: input.resumeDriveFileId ? HrSyncState.synced : HrSyncState.pending,
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_candidate",
      entityId: created.id,
      action: activityLogActions.hrCandidateCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: created.fullName,
        contextHref: `/office/hr/candidates/${created.id}`,
      },
    });

    return created;
  });

  return mapCandidate(candidate);
}

export async function updateHrCandidate(input: UpdateHrCandidateInput) {
  const existing = await prisma.hrCandidate.findFirst({
    where: {
      id: input.candidateId,
      organizationId: input.organizationId,
    },
  });

  if (!existing) {
    return null;
  }

  const nextStatus = parseCandidateStatus(input.status);

  const candidate = await prisma.$transaction(async (tx) => {
    const updated = await tx.hrCandidate.update({
      where: { id: existing.id },
      data: {
        officeId: "officeId" in input ? input.officeId ?? null : undefined,
        fullName: input.fullName === undefined ? undefined : normalizeRequired(input.fullName, "Full name"),
        email: input.email === undefined ? undefined : normalizeEmail(input.email),
        phone: input.phone === undefined ? undefined : normalizeOptional(input.phone),
        role: input.role === undefined ? undefined : normalizeOptional(input.role),
        positionTitle: input.positionTitle === undefined ? undefined : normalizeOptional(input.positionTitle),
        teamLeadName: input.teamLeadName === undefined ? undefined : normalizeOptional(input.teamLeadName),
        sourceType: input.sourceType === undefined ? undefined : normalizeOptional(input.sourceType),
        referrerName: input.referrerName === undefined ? undefined : normalizeOptional(input.referrerName),
        identityType: input.identityType === undefined ? undefined : parseIdentityType(input.identityType),
        resumeFileKey: input.resumeFileKey === undefined ? undefined : normalizeOptional(input.resumeFileKey),
        resumeDriveFileId: input.resumeDriveFileId === undefined ? undefined : normalizeOptional(input.resumeDriveFileId),
        status: nextStatus ?? undefined,
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_candidate",
      entityId: updated.id,
      action: nextStatus && nextStatus !== existing.status
        ? activityLogActions.hrCandidateStatusChanged
        : activityLogActions.hrCandidateUpdated,
      payload: {
        officeId: updated.officeId,
        objectLabel: updated.fullName,
        contextHref: `/office/hr/candidates/${updated.id}`,
        changes: nextStatus && nextStatus !== existing.status
          ? [{
              label: "Candidate status",
              previousValue: candidateStatusLabelMap[existing.status],
              nextValue: candidateStatusLabelMap[nextStatus],
            }]
          : undefined,
      },
    });

    return updated;
  });

  return mapCandidate(candidate);
}

export async function getHrHomeSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  const [candidateSnapshot, interviews, onboardingCases, offboardingCases] = await Promise.all([
    listHrCandidates({
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
    }),
    prisma.hrInterview.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildOfficeScope(input.officeId ?? null),
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        candidate: true,
      },
    }),
    prisma.hrOnboardingCase.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildOfficeScope(input.officeId ?? null),
        status: { notIn: ["completed", "closed"] },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      include: { candidate: true },
    }),
    prisma.hrOffboardingCase.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildOfficeScope(input.officeId ?? null),
        status: { notIn: ["completed", "canceled"] },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      include: { candidate: true },
    }),
  ]);

  return {
    summary: candidateSnapshot.summary,
    pendingCandidates: candidateSnapshot.candidates.slice(0, 6),
    interviews: interviews.map((interview) => ({
      id: interview.id,
      title: interview.title,
      candidateName: interview.candidate.fullName,
      startsAt: formatDateTimeLabel(interview.startsAt),
      status: interview.status,
      href: `/office/hr/candidates/${interview.candidateId}`,
    })),
    onboardingCases: onboardingCases.map((onboardingCase) => ({
      id: onboardingCase.id,
      candidateName: onboardingCase.candidate?.fullName ?? "Onboarding case",
      status: onboardingCase.status,
      href: `/office/hr/onboarding/${onboardingCase.id}`,
    })),
    offboardingCases: offboardingCases.map((offboardingCase) => ({
      id: offboardingCase.id,
      candidateName: offboardingCase.candidate?.fullName ?? "Offboarding case",
      status: offboardingCase.status,
      href: `/office/hr/offboarding/${offboardingCase.id}`,
    })),
  };
}
