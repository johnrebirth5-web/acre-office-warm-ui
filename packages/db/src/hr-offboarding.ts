import { HrOffboardingCaseStatus } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export const ACRE_OFFBOARDING_FORM_URL = "https://forms.gle/pi4AMjwgybYeH2JF9";

export type HrOffboardingCaseRecord = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  status: HrOffboardingCaseStatus;
  position: string;
  directSupervisor: string;
  lastWorkingDate: string;
  reason: string;
  externalFormUrl: string;
  financeHandoffStatus: string;
  salespersonLicenseUnlinkRequired: boolean;
  salespersonLicenseUnlinkedAt: string;
  commissionSettlementTriggeredAt: string;
  accessClosedAt: string;
  href: string;
};

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDate(value: string | null | undefined) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date is invalid.");
  }
  return parsed;
}

function parseStatus(value: string | null | undefined) {
  return Object.values(HrOffboardingCaseStatus).includes(value as HrOffboardingCaseStatus)
    ? (value as HrOffboardingCaseStatus)
    : null;
}

function buildOfficeScope(officeId: string | null | undefined) {
  return officeId ? { OR: [{ officeId }, { officeId: null }] } : {};
}

function mapCase(record: {
  id: string;
  candidateId: string | null;
  status: HrOffboardingCaseStatus;
  position: string | null;
  directSupervisor: string | null;
  lastWorkingDate: Date | null;
  reason: string | null;
  externalFormUrl: string | null;
  financeHandoffStatus: string | null;
  salespersonLicenseUnlinkRequired: boolean;
  salespersonLicenseUnlinkedAt: Date | null;
  commissionSettlementTriggeredAt: Date | null;
  accessClosedAt: Date | null;
  candidate?: { fullName: string; email: string } | null;
}): HrOffboardingCaseRecord {
  return {
    id: record.id,
    candidateId: record.candidateId ?? "",
    candidateName: record.candidate?.fullName ?? "Offboarding case",
    candidateEmail: record.candidate?.email ?? "",
    status: record.status,
    position: record.position ?? "",
    directSupervisor: record.directSupervisor ?? "",
    lastWorkingDate: formatDateTimeLabel(record.lastWorkingDate),
    reason: record.reason ?? "",
    externalFormUrl: record.externalFormUrl ?? ACRE_OFFBOARDING_FORM_URL,
    financeHandoffStatus: record.financeHandoffStatus ?? "",
    salespersonLicenseUnlinkRequired: record.salespersonLicenseUnlinkRequired,
    salespersonLicenseUnlinkedAt: formatDateTimeLabel(record.salespersonLicenseUnlinkedAt),
    commissionSettlementTriggeredAt: formatDateTimeLabel(record.commissionSettlementTriggeredAt),
    accessClosedAt: formatDateTimeLabel(record.accessClosedAt),
    href: `/office/hr/offboarding/${record.id}`,
  };
}

export async function listHrOffboardingCases(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  const cases = await prisma.hrOffboardingCase.findMany({
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

export async function getHrOffboardingCaseDetail(input: {
  organizationId: string;
  officeId?: string | null;
  caseId: string;
}) {
  const offboardingCase = await prisma.hrOffboardingCase.findFirst({
    where: {
      id: input.caseId,
      organizationId: input.organizationId,
      ...buildOfficeScope(input.officeId ?? null),
    },
    include: {
      candidate: true,
      checklistInstances: {
        include: {
          items: { orderBy: [{ sortOrder: "asc" }] },
        },
      },
    },
  });

  if (!offboardingCase) {
    return null;
  }

  return {
    case: mapCase(offboardingCase),
    checklistInstances: offboardingCase.checklistInstances.map((instance) => ({
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

export async function createHrOffboardingCase(input: {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  candidateId?: string | null;
  membershipId?: string | null;
  position?: string | null;
  directSupervisor?: string | null;
  lastWorkingDate?: string | null;
  reason?: string | null;
  salespersonLicenseUnlinkRequired?: boolean | null;
}) {
  const candidate = input.candidateId
    ? await prisma.hrCandidate.findFirst({
        where: {
          id: input.candidateId,
          organizationId: input.organizationId,
        },
      })
    : null;

  const offboardingCase = await prisma.$transaction(async (tx) => {
    const created = await tx.hrOffboardingCase.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? candidate?.officeId ?? null,
        candidateId: candidate?.id ?? null,
        membershipId: normalizeOptional(input.membershipId),
        createdByMembershipId: input.actorMembershipId,
        position: normalizeOptional(input.position) ?? candidate?.positionTitle ?? candidate?.role ?? null,
        directSupervisor: normalizeOptional(input.directSupervisor) ?? candidate?.teamLeadName ?? null,
        lastWorkingDate: parseDate(input.lastWorkingDate),
        reason: normalizeOptional(input.reason),
        externalFormUrl: ACRE_OFFBOARDING_FORM_URL,
        salespersonLicenseUnlinkRequired: Boolean(input.salespersonLicenseUnlinkRequired),
      },
      include: { candidate: true },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_offboarding_case",
      entityId: created.id,
      action: activityLogActions.hrOffboardingCaseCreated,
      payload: {
        officeId: created.officeId,
        objectLabel: created.candidate?.fullName ?? "Offboarding case",
        contextHref: `/office/hr/offboarding/${created.id}`,
      },
    });

    return created;
  });

  return mapCase(offboardingCase);
}

export async function updateHrOffboardingCase(input: {
  organizationId: string;
  actorMembershipId: string;
  caseId: string;
  status?: string | null;
  financeHandoffStatus?: string | null;
  commissionSettlementTriggered?: boolean | null;
  accessClosed?: boolean | null;
  salespersonLicenseUnlinked?: boolean | null;
  notes?: string | null;
}) {
  const existing = await prisma.hrOffboardingCase.findFirst({
    where: {
      id: input.caseId,
      organizationId: input.organizationId,
    },
    include: { candidate: true },
  });

  if (!existing) {
    return null;
  }

  const status = parseStatus(input.status);
  const now = new Date();
  const updated = await prisma.hrOffboardingCase.update({
    where: { id: existing.id },
    data: {
      status: status ?? undefined,
      financeHandoffStatus: input.financeHandoffStatus === undefined ? undefined : normalizeOptional(input.financeHandoffStatus),
      commissionSettlementTriggeredAt: input.commissionSettlementTriggered ? now : undefined,
      accessClosedAt: input.accessClosed ? now : undefined,
      salespersonLicenseUnlinkedAt: input.salespersonLicenseUnlinked ? now : undefined,
      notes: input.notes === undefined ? undefined : normalizeOptional(input.notes),
    },
    include: { candidate: true },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "hr_offboarding_case",
    entityId: updated.id,
    action: activityLogActions.hrOffboardingCaseCreated,
    payload: {
      officeId: updated.officeId,
      objectLabel: updated.candidate?.fullName ?? "Offboarding case",
      contextHref: `/office/hr/offboarding/${updated.id}`,
    },
  });

  return mapCase(updated);
}
