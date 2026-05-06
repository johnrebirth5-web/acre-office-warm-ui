import { HrChecklistCaseType, HrChecklistItemStatus } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

export const defaultHrOnboardingChecklistItems = [
  "Legal documents uploaded",
  "Onboarding information form reviewed",
  "Direct deposit information uploaded",
  "Offer letter signed",
  "NDA signed",
  "Employee handbook sent",
  "Welcome email reviewed",
];

export const defaultHrOffboardingChecklistItems = [
  "Termination request form received",
  "Company files and forms returned",
  "Device and materials returned",
  "Company Drive access closed or limited",
  "Finance commission settlement triggered",
  "Commission After Termination agreement signed",
  "Salesperson license unlink checked",
];

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseCaseType(value: string | null | undefined) {
  return value === HrChecklistCaseType.offboarding
    ? HrChecklistCaseType.offboarding
    : HrChecklistCaseType.onboarding;
}

export async function createHrChecklistInstance(input: {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  title: string;
  caseType: string;
  onboardingCaseId?: string | null;
  offboardingCaseId?: string | null;
  checklistTemplateId?: string | null;
  items?: string[];
}) {
  const caseType = parseCaseType(input.caseType);
  const fallbackItems =
    caseType === HrChecklistCaseType.offboarding
      ? defaultHrOffboardingChecklistItems
      : defaultHrOnboardingChecklistItems;
  const itemTitles = (input.items?.length ? input.items : fallbackItems)
    .map((item) => item.trim())
    .filter(Boolean);

  const instance = await prisma.hrChecklistInstance.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      createdByMembershipId: input.actorMembershipId,
      title: normalizeOptional(input.title) ?? (caseType === "offboarding" ? "Offboarding checklist" : "Onboarding checklist"),
      caseType,
      onboardingCaseId: normalizeOptional(input.onboardingCaseId),
      offboardingCaseId: normalizeOptional(input.offboardingCaseId),
      checklistTemplateId: normalizeOptional(input.checklistTemplateId),
      items: {
        create: itemTitles.map((title, index) => ({
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          title,
          sortOrder: index,
        })),
      },
    },
    include: { items: { orderBy: [{ sortOrder: "asc" }] } },
  });

  return instance;
}

export async function updateHrChecklistItemStatus(input: {
  organizationId: string;
  actorMembershipId: string;
  itemId: string;
  completed: boolean;
}) {
  const existing = await prisma.hrChecklistInstanceItem.findFirst({
    where: {
      id: input.itemId,
      organizationId: input.organizationId,
    },
    include: { checklistInstance: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.hrChecklistInstanceItem.update({
      where: { id: existing.id },
      data: input.completed
        ? {
            status: HrChecklistItemStatus.completed,
            completedByMembershipId: input.actorMembershipId,
            completedAt: new Date(),
          }
        : {
            status: HrChecklistItemStatus.reopened,
            completedByMembershipId: null,
            completedAt: null,
          },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_checklist_instance_item",
      entityId: saved.id,
      action: input.completed
        ? activityLogActions.hrChecklistItemCompleted
        : activityLogActions.hrChecklistItemReopened,
      payload: {
        officeId: saved.officeId,
        objectLabel: saved.title,
        contextHref: existing.checklistInstance.onboardingCaseId
          ? `/office/hr/onboarding/${existing.checklistInstance.onboardingCaseId}`
          : existing.checklistInstance.offboardingCaseId
            ? `/office/hr/offboarding/${existing.checklistInstance.offboardingCaseId}`
            : undefined,
      },
    });

    return saved;
  });

  return updated;
}
