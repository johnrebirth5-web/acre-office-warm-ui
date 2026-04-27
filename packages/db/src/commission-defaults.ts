import { Prisma } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

type ScopedPrismaClient = Prisma.TransactionClient | typeof prisma;

const hundred = new Prisma.Decimal(100);

export type OfficeCommissionSplitTemplateOption = {
  id: string;
  label: string;
  agentPercent: string;
  companyPercent: string;
};

export type OfficeCommissionSplitTemplateRecord = {
  id: string;
  name: string;
  label: string;
  agentPercent: string;
  companyPercent: string;
  isActive: boolean;
  usageCount: number;
};

export type OfficeMembershipCommissionSettingRecord = {
  id: string;
  membershipId: string;
  membershipLabel: string;
  splitTemplateId: string;
  splitTemplateLabel: string;
  agentPercent: string;
  companyPercent: string;
  effectiveFrom: string;
  effectiveTo: string;
  sourceType: "template" | "custom";
  sourceLabel: string;
  settingLabel: string;
};

export type OfficeMembershipCommissionEditorSnapshot = {
  settingId: string;
  splitTemplateId: string;
  customAgentPercent: string;
  effectiveFrom: string;
  effectiveTo: string;
  settingLabel: string;
  sourceLabel: string;
  agentPercent: string;
  companyPercent: string;
  templateOptions: OfficeCommissionSplitTemplateOption[];
};

export type SaveCommissionSplitTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  splitTemplateId?: string;
  name: string;
  agentPercent: string;
  isActive?: boolean;
  actorMembershipId: string;
};

export type DeleteCommissionSplitTemplateInput = {
  organizationId: string;
  splitTemplateId: string;
  actorMembershipId: string;
};

export type SaveMembershipCommissionSettingInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  splitTemplateId?: string;
  customAgentPercent?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  actorMembershipId?: string | null;
  contextHref?: string | null;
  recordActivity?: boolean;
};

export type ResolveMembershipCommissionSettingInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  effectiveAt?: Date | null;
};

export type ResolvedMembershipCommissionSetting = {
  id: string;
  membershipId: string;
  membershipLabel: string;
  splitTemplateId: string;
  splitTemplateLabel: string;
  agentPercent: Prisma.Decimal;
  companyPercent: Prisma.Decimal;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceType: "template" | "custom";
  sourceLabel: string;
  settingLabel: string;
};

function parseOptionalDate(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parsePercentValue(value: string | undefined | null, label: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  const numericText = normalized.replaceAll(",", "").replace(/\s*%$/, "").trim();

  if (!numericText) {
    throw new Error(`${label} must be a valid percentage.`);
  }

  const numeric = Number(numericText);

  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a valid percentage.`);
  }

  if (numeric < 0 || numeric > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }

  return new Prisma.Decimal(numeric);
}

function decimalToPercentLabel(value: Prisma.Decimal | number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "0";
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return numeric.toFixed(2).replace(/\.?0+$/, "");
}

export function buildCommissionSplitLabel(agentPercent: Prisma.Decimal | number | string | null | undefined) {
  const normalizedAgentPercent = new Prisma.Decimal(agentPercent ?? 0);
  const companyPercent = Prisma.Decimal.max(new Prisma.Decimal(0), hundred.minus(normalizedAgentPercent));

  return `${decimalToPercentLabel(normalizedAgentPercent)}/${decimalToPercentLabel(companyPercent)} split`;
}

function compareSettingPriority(
  left: { officeId: string | null; effectiveFrom: Date; updatedAt: Date; createdAt: Date },
  right: { officeId: string | null; effectiveFrom: Date; updatedAt: Date; createdAt: Date },
  officeId?: string | null
) {
  const leftOfficeScore = left.officeId === officeId ? 2 : left.officeId ? 1 : 0;
  const rightOfficeScore = right.officeId === officeId ? 2 : right.officeId ? 1 : 0;

  if (leftOfficeScore !== rightOfficeScore) {
    return rightOfficeScore - leftOfficeScore;
  }

  if (left.effectiveFrom.getTime() !== right.effectiveFrom.getTime()) {
    return right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
  }

  if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function mapSplitTemplateRecord(
  template: Prisma.CommissionSplitTemplateGetPayload<{
    include: {
      membershipSettings: true;
    };
  }>
): OfficeCommissionSplitTemplateRecord {
  const companyPercent = Prisma.Decimal.max(new Prisma.Decimal(0), hundred.minus(template.agentPercent));

  return {
    id: template.id,
    name: template.name,
    label: buildCommissionSplitLabel(template.agentPercent),
    agentPercent: decimalToPercentLabel(template.agentPercent),
    companyPercent: decimalToPercentLabel(companyPercent),
    isActive: template.isActive,
    usageCount: template.membershipSettings.length
  };
}

function mapMembershipCommissionSettingRecord(
  setting: Prisma.MembershipCommissionSettingGetPayload<{
    include: {
      membership: {
        include: {
          user: true;
        };
      };
      splitTemplate: true;
    };
  }>
): OfficeMembershipCommissionSettingRecord {
  const companyPercent = Prisma.Decimal.max(new Prisma.Decimal(0), hundred.minus(setting.agentPercent));
  const splitTemplateLabel = setting.splitTemplate?.name ?? buildCommissionSplitLabel(setting.agentPercent);
  const sourceType = setting.splitTemplateId ? "template" : "custom";

  return {
    id: setting.id,
    membershipId: setting.membershipId,
    membershipLabel: `${setting.membership.user.firstName} ${setting.membership.user.lastName}`.trim() || setting.membership.user.email,
    splitTemplateId: setting.splitTemplateId ?? "",
    splitTemplateLabel,
    agentPercent: decimalToPercentLabel(setting.agentPercent),
    companyPercent: decimalToPercentLabel(companyPercent),
    effectiveFrom: formatDateValue(setting.effectiveFrom),
    effectiveTo: formatDateValue(setting.effectiveTo),
    sourceType,
    sourceLabel: sourceType === "template" ? `Template: ${splitTemplateLabel}` : "Custom split",
    settingLabel: buildCommissionSplitLabel(setting.agentPercent)
  };
}

function parseLegacyCommissionPlanName(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);

  if (!match) {
    return null;
  }

  const agentPercent = Number(match[1]);
  const companyPercent = Number(match[2]);

  if (!Number.isFinite(agentPercent) || !Number.isFinite(companyPercent)) {
    return null;
  }

  if (Math.abs(agentPercent + companyPercent - 100) > 0.01) {
    return null;
  }

  return new Prisma.Decimal(agentPercent);
}

function isSimpleBaseSplitPlan(plan: {
  rules: Array<{
    ruleType: string;
    splitPercent: Prisma.Decimal | null;
    isActive?: boolean;
  }>;
}) {
  const activeRules = plan.rules.filter((rule) => rule.isActive ?? true);

  if (activeRules.length !== 1) {
    return false;
  }

  return activeRules[0]?.ruleType === "base_split" && Boolean(activeRules[0]?.splitPercent);
}

async function ensureSplitTemplateFromSimplePlan(
  tx: ScopedPrismaClient,
  plan: {
    id: string;
    organizationId: string;
    officeId: string | null;
    name: string;
    rules: Array<{
      ruleType: string;
      splitPercent: Prisma.Decimal | null;
      isActive?: boolean;
    }>;
  }
) {
  if (!isSimpleBaseSplitPlan(plan)) {
    return null;
  }

  const splitPercent = plan.rules[0]?.splitPercent;

  if (!splitPercent) {
    return null;
  }

  const existing = await tx.commissionSplitTemplate.findFirst({
    where: {
      organizationId: plan.organizationId,
      officeId: plan.officeId,
      name: plan.name
    }
  });

  if (existing) {
    return existing;
  }

  return tx.commissionSplitTemplate.create({
    data: {
      organizationId: plan.organizationId,
      officeId: plan.officeId,
      name: plan.name,
      agentPercent: splitPercent,
      isActive: true
    }
  });
}

async function syncAgentProfileCommissionLabel(
  tx: ScopedPrismaClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    membershipId: string;
    commissionLabel: string;
  }
) {
  const membership = await tx.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    select: {
      id: true,
      officeId: true
    }
  });

  if (!membership) {
    return;
  }

  await tx.agentProfile.upsert({
    where: {
      membershipId: input.membershipId
    },
    update: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId ?? null,
      commissionPlanName: input.commissionLabel
    },
    create: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId ?? null,
      membershipId: input.membershipId,
      commissionPlanName: input.commissionLabel
    }
  });
}

export async function backfillCommissionSplitTemplatesFromLegacy(
  organizationId: string,
  officeId?: string | null,
  tx: ScopedPrismaClient = prisma
) {
  const plans = await tx.commissionPlan.findMany({
    where: {
      organizationId,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    include: {
      rules: {
        where: {
          isActive: true
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  const createdTemplates = await Promise.all(plans.map((plan) => ensureSplitTemplateFromSimplePlan(tx, plan)));
  return createdTemplates.filter((template): template is NonNullable<typeof template> => Boolean(template));
}

export async function backfillMembershipCommissionSettingsFromLegacy(
  organizationId: string,
  officeId?: string | null,
  membershipIds?: string[],
  tx: ScopedPrismaClient = prisma
) {
  await backfillCommissionSplitTemplatesFromLegacy(organizationId, officeId, tx);

  const memberships = await tx.membership.findMany({
    where: {
      organizationId,
      ...(membershipIds?.length ? { id: { in: membershipIds } } : {}),
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    include: {
      agentProfile: true
    }
  });

  if (memberships.length === 0) {
    return;
  }

  const existingCounts = await tx.membershipCommissionSetting.groupBy({
    by: ["membershipId"],
    where: {
      organizationId,
      membershipId: {
        in: memberships.map((membership) => membership.id)
      }
    },
    _count: {
      _all: true
    }
  });
  const existingMembershipIds = new Set(existingCounts.map((entry) => entry.membershipId));

  for (const membership of memberships) {
    if (existingMembershipIds.has(membership.id)) {
      continue;
    }

    const directAssignment = await tx.commissionPlanAssignment.findFirst({
      where: {
        organizationId,
        membershipId: membership.id
      },
      include: {
        commissionPlan: {
          include: {
            rules: {
              where: {
                isActive: true
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        }
      },
      orderBy: [{ effectiveFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }]
    });

    if (directAssignment?.commissionPlan && isSimpleBaseSplitPlan(directAssignment.commissionPlan)) {
      const template = await ensureSplitTemplateFromSimplePlan(tx, directAssignment.commissionPlan);
      const splitPercent = directAssignment.commissionPlan.rules[0]?.splitPercent;

      if (template && splitPercent) {
        await tx.membershipCommissionSetting.create({
          data: {
            organizationId,
            officeId: officeId ?? membership.officeId ?? null,
            membershipId: membership.id,
            splitTemplateId: template.id,
            agentPercent: splitPercent,
            effectiveFrom: directAssignment.effectiveFrom,
            effectiveTo: directAssignment.effectiveTo
          }
        });

        await syncAgentProfileCommissionLabel(tx, {
          organizationId,
          officeId: officeId ?? membership.officeId ?? null,
          membershipId: membership.id,
          commissionLabel: buildCommissionSplitLabel(splitPercent)
        });
        continue;
      }
    }

    const legacyPercent = parseLegacyCommissionPlanName(membership.agentProfile?.commissionPlanName);

    if (!legacyPercent) {
      continue;
    }

    await tx.membershipCommissionSetting.create({
      data: {
        organizationId,
        officeId: officeId ?? membership.officeId ?? null,
        membershipId: membership.id,
        agentPercent: legacyPercent,
        effectiveFrom: membership.createdAt,
        effectiveTo: null
      }
    });

    await syncAgentProfileCommissionLabel(tx, {
      organizationId,
      officeId: officeId ?? membership.officeId ?? null,
      membershipId: membership.id,
      commissionLabel: buildCommissionSplitLabel(legacyPercent)
    });
  }
}

export async function listCommissionSplitTemplateOptions(organizationId: string, officeId?: string | null) {
  await backfillCommissionSplitTemplatesFromLegacy(organizationId, officeId);

  const templates = await prisma.commissionSplitTemplate.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    orderBy: [{ name: "asc" }]
  });

  return templates.map((template) => ({
    id: template.id,
    label: template.name,
    agentPercent: decimalToPercentLabel(template.agentPercent),
    companyPercent: decimalToPercentLabel(Prisma.Decimal.max(new Prisma.Decimal(0), hundred.minus(template.agentPercent)))
  }));
}

export async function listCommissionSplitTemplates(organizationId: string, officeId?: string | null) {
  await backfillCommissionSplitTemplatesFromLegacy(organizationId, officeId);

  const templates = await prisma.commissionSplitTemplate.findMany({
    where: {
      organizationId,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    include: {
      membershipSettings: true
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return templates.map(mapSplitTemplateRecord);
}

export async function resolveActiveMembershipCommissionSetting(
  tx: ScopedPrismaClient,
  input: ResolveMembershipCommissionSettingInput
): Promise<ResolvedMembershipCommissionSetting | null> {
  const effectiveAt = input.effectiveAt ?? new Date();
  const settings = await tx.membershipCommissionSetting.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      effectiveFrom: {
        lte: effectiveAt
      },
      AND: [
        {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }]
        },
        ...(input.officeId
          ? [
              {
                OR: [{ officeId: input.officeId }, { officeId: null }]
              }
            ]
          : [])
      ]
    },
    include: {
      membership: {
        include: {
          user: true
        }
      },
      splitTemplate: true
    }
  });

  if (settings.length === 0) {
    return null;
  }

  settings.sort((left, right) => compareSettingPriority(left, right, input.officeId));
  const setting = settings[0];
  const companyPercent = Prisma.Decimal.max(new Prisma.Decimal(0), hundred.minus(setting.agentPercent));
  const splitTemplateLabel = setting.splitTemplate?.name ?? buildCommissionSplitLabel(setting.agentPercent);
  const sourceType = setting.splitTemplateId ? "template" : "custom";
  const membershipLabel = `${setting.membership.user.firstName} ${setting.membership.user.lastName}`.trim() || setting.membership.user.email;

  return {
    id: setting.id,
    membershipId: setting.membershipId,
    membershipLabel,
    splitTemplateId: setting.splitTemplateId ?? "",
    splitTemplateLabel,
    agentPercent: setting.agentPercent,
    companyPercent,
    effectiveFrom: setting.effectiveFrom,
    effectiveTo: setting.effectiveTo,
    sourceType,
    sourceLabel: sourceType === "template" ? `Template: ${splitTemplateLabel}` : "Custom split",
    settingLabel: buildCommissionSplitLabel(setting.agentPercent)
  };
}

export async function getMembershipCommissionEditorSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
}) : Promise<OfficeMembershipCommissionEditorSnapshot> {
  await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId, [input.membershipId]);

  const [setting, templateOptions] = await Promise.all([
    resolveActiveMembershipCommissionSetting(prisma, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipId: input.membershipId
    }),
    listCommissionSplitTemplateOptions(input.organizationId, input.officeId)
  ]);

  return {
    settingId: setting?.id ?? "",
    splitTemplateId: setting?.sourceType === "template" ? setting.splitTemplateId : "",
    customAgentPercent: setting?.sourceType === "custom" ? decimalToPercentLabel(setting.agentPercent) : "",
    effectiveFrom: formatDateValue(setting?.effectiveFrom),
    effectiveTo: formatDateValue(setting?.effectiveTo),
    settingLabel: setting?.settingLabel ?? "",
    sourceLabel: setting?.sourceLabel ?? "",
    agentPercent: setting ? decimalToPercentLabel(setting.agentPercent) : "",
    companyPercent: setting ? decimalToPercentLabel(setting.companyPercent) : "",
    templateOptions
  };
}

export async function listCurrentMembershipCommissionSettings(input: {
  organizationId: string;
  officeId?: string | null;
  membershipIds?: string[];
}) {
  await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId, input.membershipIds);

  const now = new Date();
  const settings = await prisma.membershipCommissionSetting.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.membershipIds?.length ? { membershipId: { in: input.membershipIds } } : {}),
      effectiveFrom: {
        lte: now
      },
      AND: [
        {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
        },
        ...(input.officeId
          ? [
              {
                OR: [{ officeId: input.officeId }, { officeId: null }]
              }
            ]
          : [])
      ]
    },
    include: {
      membership: {
        include: {
          user: true
        }
      },
      splitTemplate: true
    },
    orderBy: [{ effectiveFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const byMembership = new Map<string, typeof settings[number]>();

  for (const setting of settings) {
    const existing = byMembership.get(setting.membershipId);

    if (!existing) {
      byMembership.set(setting.membershipId, setting);
      continue;
    }

    const comparison = compareSettingPriority(setting, existing, input.officeId);

    if (comparison >= 0) {
      continue;
    }

    byMembership.set(setting.membershipId, setting);
  }

  return [...byMembership.values()].map(mapMembershipCommissionSettingRecord);
}

export async function saveCommissionSplitTemplate(input: SaveCommissionSplitTemplateInput): Promise<OfficeCommissionSplitTemplateRecord> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Split template name is required.");
  }

  const agentPercent = parsePercentValue(input.agentPercent, "Agent split");

  const saved = await prisma.$transaction(async (tx) => {
    const existing = input.splitTemplateId
      ? await tx.commissionSplitTemplate.findFirst({
          where: {
            id: input.splitTemplateId,
            organizationId: input.organizationId
          },
          include: {
            membershipSettings: true
          }
        })
      : null;

    const template = existing
      ? await tx.commissionSplitTemplate.update({
          where: {
            id: existing.id
          },
          data: {
            officeId: input.officeId ?? existing.officeId,
            name,
            agentPercent,
            isActive: input.isActive ?? existing.isActive
          },
          include: {
            membershipSettings: true
          }
        })
      : await tx.commissionSplitTemplate.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            name,
            agentPercent,
            isActive: input.isActive ?? true
          },
          include: {
            membershipSettings: true
          }
        });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_plan",
      entityId: template.id,
      action: existing ? activityLogActions.commissionPlanUpdated : activityLogActions.commissionPlanCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: name,
        contextHref: "/office/settings/commission-plans",
        details: [`Split: ${buildCommissionSplitLabel(agentPercent)}`]
      }
    });

    return template;
  });

  return mapSplitTemplateRecord(saved);
}

export async function deleteCommissionSplitTemplate(input: DeleteCommissionSplitTemplateInput) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.commissionSplitTemplate.findFirst({
      where: {
        id: input.splitTemplateId,
        organizationId: input.organizationId
      }
    });

    if (!template) {
      throw new Error("Split template was not found.");
    }

    await tx.commissionSplitTemplate.delete({
      where: {
        id: template.id
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_plan",
      entityId: template.id,
      action: activityLogActions.commissionPlanUpdated,
      payload: {
        officeId: template.officeId,
        objectLabel: template.name,
        contextHref: "/office/settings/commission-plans",
        details: ["Split template deleted"]
      }
    });

    return {
      id: template.id
    };
  });
}

async function saveMembershipCommissionSettingWithDb(tx: ScopedPrismaClient, input: SaveMembershipCommissionSettingInput) {
  const effectiveFrom = parseOptionalDate(input.effectiveFrom);

  if (!effectiveFrom) {
    throw new Error("Effective-from date is required.");
  }

  const effectiveTo = parseOptionalDate(input.effectiveTo);

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("Effective-to date must be on or after the start date.");
  }

  const normalizedTemplateId = input.splitTemplateId?.trim() || null;
  const normalizedCustomPercent = input.customAgentPercent?.trim() || null;

  if (!normalizedTemplateId && !normalizedCustomPercent) {
    throw new Error("Choose a split template or enter a custom agent split.");
  }

  const membership = await tx.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      user: true
    }
  });

  if (!membership) {
    throw new Error("Membership was not found.");
  }

  const splitTemplate = normalizedTemplateId
    ? await tx.commissionSplitTemplate.findFirst({
        where: {
          id: normalizedTemplateId,
          organizationId: input.organizationId
        }
      })
    : null;

  if (normalizedTemplateId && !splitTemplate) {
    throw new Error("Selected split template was not found.");
  }

  const agentPercent = splitTemplate ? splitTemplate.agentPercent : parsePercentValue(normalizedCustomPercent, "Agent split");
  const targetOfficeId = input.officeId ?? membership.officeId ?? null;

  await tx.membershipCommissionSetting.updateMany({
    where: {
      organizationId: input.organizationId,
      officeId: targetOfficeId,
      membershipId: input.membershipId,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
    },
    data: {
      effectiveTo: effectiveFrom
    }
  });

  const setting = await tx.membershipCommissionSetting.create({
    data: {
      organizationId: input.organizationId,
      officeId: targetOfficeId,
      membershipId: input.membershipId,
      splitTemplateId: splitTemplate?.id ?? null,
      agentPercent,
      effectiveFrom,
      effectiveTo
    },
    include: {
      membership: {
        include: {
          user: true
        }
      },
      splitTemplate: true
    }
  });

  const settingLabel = buildCommissionSplitLabel(agentPercent);

  await syncAgentProfileCommissionLabel(tx, {
    organizationId: input.organizationId,
    officeId: targetOfficeId,
    membershipId: input.membershipId,
    commissionLabel: settingLabel
  });

  if ((input.recordActivity ?? true) && input.actorMembershipId) {
    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_profile",
      entityId: membership.id,
      action: activityLogActions.agentProfileUpdated,
      payload: {
        officeId: targetOfficeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email,
        contextHref: input.contextHref ?? `/office/settings/users/${membership.id}`,
        details: [`Default split: ${settingLabel}`]
      }
    });
  }

  return mapMembershipCommissionSettingRecord(setting);
}

export async function saveMembershipCommissionSetting(
  input: SaveMembershipCommissionSettingInput,
  db: ScopedPrismaClient = prisma
) {
  if (db === prisma) {
    return prisma.$transaction(async (tx) => saveMembershipCommissionSettingWithDb(tx, input));
  }

  return saveMembershipCommissionSettingWithDb(db, input);
}
