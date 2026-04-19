import { randomUUID } from "node:crypto";

import {
  CommissionCalculationMode,
  CommissionCalculationStatus,
  CommissionPlanRuleType,
  CommissionRecipientType,
  CommissionRuleFeeType,
  MembershipStatus,
  UserRole,
  Prisma,
  TransactionFinanceApprovalStatus,
  TransactionFinanceCalculationType,
  TransactionFinanceFeeType,
  TransactionFinanceVersionSource,
  TeamMembershipRole
} from "@prisma/client";

import { resolveOfficeDataScope } from "../access";

import { activityLogActions, recordActivityLogEvent } from "../activity-log";

import { prisma } from "../client";

import {
  backfillCommissionSplitTemplatesFromLegacy,
  backfillMembershipCommissionSettingsFromLegacy,
  buildCommissionSplitLabel,
  listCommissionSplitTemplates,
  listCurrentMembershipCommissionSettings,
  resolveActiveMembershipCommissionSetting,
  type OfficeCommissionSplitTemplateRecord,
  type OfficeMembershipCommissionSettingRecord
} from "../commission-defaults";

import { buildTeamMembershipHierarchyMap, buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds, formatTeamMembershipRoleLabel } from "../team-hierarchy";

import { CalculateTransactionCommissionInput, CommissionPlanWithRules, GenerateCommissionStatementSnapshotInput, GetOfficeCommissionManagementSnapshotInput, OfficeAgentCommissionSummary, OfficeCommissionAssignmentRecord, OfficeCommissionAssignmentSourceType, OfficeCommissionAssignmentTargetType, OfficeCommissionCalculationRecipientLabel, OfficeCommissionCalculationRow, OfficeCommissionCalculationStatusLabel, OfficeCommissionManagementOverview, OfficeCommissionManagementSnapshot, OfficeCommissionPlanOption, OfficeCommissionPlanRecord, OfficeCommissionPlanRuleRecord, OfficeCommissionStatementLine, OfficeCommissionStatementSnapshot, OfficeCommissionTeamOption, OfficeCreateTransactionCommissionPreview, OfficeTransactionCommissionManualParticipantOption, OfficeTransactionCommissionSnapshot, OfficeTransactionCommissionStakeholderRow, OfficeTransactionFinanceApprovalLabel, OfficeTransactionFinanceCalculationLabel, OfficeTransactionFinanceFeeRecord, OfficeTransactionFinancePrerequisiteSnapshot, OfficeTransactionFinanceVersionRecord, OverrideTransactionCommissionInput, ResolvedCommissionPlanAssignment, SaveCommissionPlanAssignmentInput, SaveCommissionPlanInput, SaveCommissionPlanRuleInput, ScopedPrismaClient, TransactionFinanceFeeDefinition, UpdateCommissionCalculationStatusInput, activeFinanceFeeDefinitions, buildInitialTransactionFinanceFeeSeed, buildTransactionFinancePrerequisiteSnapshot, channelDevelopmentApprovalPrompt, commissionCalculationModeLabelMap, commissionCalculationStatusLabelMap, commissionRecipientLabelMap, commissionRuleFeeTypeLabelMap, commissionRuleTypeLabelMap, decimalToString, deriveRateFromAmount, endOfDay, ensureTransactionFinanceFees, filterActiveTransactionFinanceFees, financeFeeDefinitionByType, financeFeeDefinitions, formatCurrency, formatDateValue, formatFallbackRoleLabel, formatMembershipParticipantRole, formatPercentLabel, formatRecipientRoleLabel, getTransactionFinanceFeeDefinition, getTransactionFinanceFeeSortOrder, isActiveTransactionFinanceFeeType, mapTransactionFinanceFeeRecord, membershipStatusLabelMap, normalizeFinanceFeeApprovalStatus, normalizeTransactionFinanceFeeForPersistence, parseOptionalDate, parseOptionalDecimal, parseOptionalText, parseTransactionFinanceApprovalStatus, parseTransactionFinanceCalculationType, parseTransactionFinanceFeeType, selectableOperationalMembershipStatuses, sortTransactionFinanceFees, startOfDay, transactionFinanceApprovalStatusLabelMap, transactionFinanceCalculationTypeLabelMap, transactionFinanceVersionSourceLabelMap, userRoleLabelMap } from "./types";
import { ComputedTransactionFinanceResult, ComputedTransactionFinanceStakeholderRow, DerivedTransactionCommissionChainMember, NormalizedTransactionFinanceFee, PreviewCreateTransactionCommissionCalculatorInput, StoredTransactionCommissionChainMember, StoredTransactionCommissionContext, StoredTransactionFinanceFeeBreakdownRow, StoredTransactionFinanceStakeholderBreakdownRow, applyEffectiveSharePercentsToStoredStakeholderRows, buildCommissionChanges, buildCommissionStakeholderKey, buildDefaultSplitCalculationRows, buildDefaultTransactionCommissionChain, buildLegacyReviewItems, buildManualParticipantOption, buildPreviousCommissionChangeBaseline, buildStoredTransactionCommissionContext, buildStoredTransactionFinanceFeeBreakdownRows, buildStoredTransactionFinanceStakeholderBreakdownRows, buildTransactionCommissionSummary, buildTransactionFinanceBlockingIssues, buildTransactionLabel, calculatePlanDrivenValues, calculateTransactionFinanceResult, compareAssignmentPriority, computeRuleAmount, determineBaseSplitPercent, filterVisibleCommissionRows, findPrimaryAgentStakeholderRow, formatMembershipFullName, getAssignmentTargetLabel, getCommissionRoleLabel, getCommissionRoleValue, hasManualParticipantRows, listCommissionPlanOptions, managedTransactionMembershipLinkRoles, mapCommissionAssignmentRecord, mapCommissionCalculationRow, mapCommissionRule, mapStoredTransactionFinanceStakeholderRow, mapTransactionFinanceVersionRecord, normalizeCurrencyDecimal, normalizeSharePercentDecimal, normalizeTransactionFinanceFees, parseCommissionCalculationMode, parseCommissionCalculationStatus, parseCommissionPlanRuleType, parseCommissionRecipientType, parseCommissionRuleFeeType, parseStoredTransactionCommissionContext, parseStoredTransactionFinanceFeeBreakdown, parseStoredTransactionFinanceStakeholderBreakdown, previewCreateTransactionCommissionCalculator, resolveActiveCommissionPlanAssignment, saveCommissionPlan, sumStakeholderFinalAmounts, syncTransactionParticipantMembershipLinks } from "./planning";
import { buildCommissionStatementSnapshot, generateCommissionStatementSnapshot, getAgentCommissionSummary, getOfficeCommissionManagementSnapshot, getTransactionCommissionSnapshot, sumAgentStatementAmounts } from "./statements";

export async function assignCommissionPlanToMembership(input: SaveCommissionPlanAssignmentInput) {
  const effectiveFrom = parseOptionalDate(input.effectiveFrom);

  if (!effectiveFrom) {
    throw new Error("Effective-from date is required.");
  }

  const effectiveTo = parseOptionalDate(input.effectiveTo);

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("Effective-to date must be on or after the start date.");
  }

  return prisma.$transaction(async (tx) => {
    const normalizedMembershipId = input.membershipId?.trim() || null;
    const normalizedTeamId = input.teamId?.trim() || null;

    if (!normalizedMembershipId && !normalizedTeamId) {
      throw new Error("Select an agent or a team for the commission assignment.");
    }

    if (normalizedMembershipId && normalizedTeamId) {
      throw new Error("Commission assignments can target either an agent or a team, not both.");
    }

    const [membership, team, plan] = await Promise.all([
      normalizedMembershipId
        ? tx.membership.findFirst({
            where: {
              id: normalizedMembershipId,
              organizationId: input.organizationId
            },
            include: {
              user: true,
              agentProfile: true
            }
          })
        : Promise.resolve(null),
      normalizedTeamId
        ? tx.team.findFirst({
            where: {
              id: normalizedTeamId,
              organizationId: input.organizationId
            }
          })
        : Promise.resolve(null),
      tx.commissionPlan.findFirst({
        where: {
          id: input.commissionPlanId,
          organizationId: input.organizationId
        }
      })
    ]);

    if (normalizedMembershipId && !membership) {
      throw new Error("Selected agent was not found.");
    }

    if (normalizedTeamId && !team) {
      throw new Error("Selected team was not found.");
    }

    if (!plan) {
      throw new Error("Commission plan was not found.");
    }

    await tx.commissionPlanAssignment.updateMany({
      where: {
        organizationId: input.organizationId,
        ...(membership ? { membershipId: membership.id } : { teamId: team!.id }),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
      },
      data: {
        effectiveTo: effectiveFrom
      }
    });

    const assignment = await tx.commissionPlanAssignment.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership?.officeId ?? team?.officeId ?? null,
        membershipId: membership?.id ?? null,
        teamId: team?.id ?? null,
        commissionPlanId: plan.id,
        effectiveFrom,
        effectiveTo
      }
    });

    if (membership) {
      await tx.agentProfile.upsert({
        where: {
          membershipId: membership.id
        },
        update: {
          commissionPlanName: plan.name
        },
        create: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId ?? null,
          membershipId: membership.id,
          commissionPlanName: plan.name
        }
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_plan",
      entityId: assignment.id,
      action: activityLogActions.commissionPlanAssigned,
      payload: {
        officeId: input.officeId ?? membership?.officeId ?? team?.officeId ?? null,
        objectLabel: `${plan.name} · ${membership ? `${membership.user.firstName} ${membership.user.lastName}` : team?.name ?? "Assignment target"}`,
        contextHref: membership ? `/office/agents/${membership.id}` : "/office/settings/commission-plans",
        details: [
          `Plan: ${plan.name}`,
          `${membership ? "Agent" : "Team"}: ${membership ? `${membership.user.firstName} ${membership.user.lastName}` : team?.name ?? "—"}`,
          `Effective from: ${formatDateValue(effectiveFrom)}`
        ]
      }
    });

    return assignment.id;
  });
}



export async function calculateTransactionCommission(
  input: CalculateTransactionCommissionInput
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId
    },
    include: {
      office: true,
      ownerMembership: {
        include: {
          user: true
        }
      }
    }
  });

  if (!transaction) {
    return null;
  }

  if (transaction.grossCommission === null) {
    throw new Error("Set Gross commission in Finance before calculating commission.");
  }

  const effectiveAt = transaction.createdAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    const currentVersion = await tx.transactionFinanceCalculationVersion.findFirst({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      orderBy: [{ versionNumber: "desc" }]
    });

    if (
      currentVersion &&
      hasManualParticipantRows(parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown))
    ) {
      throw new Error("This transaction has manual override participants. Continue using Override instead of Recalculate.");
    }

    const storedContext = parseStoredTransactionCommissionContext(transaction.commissionContext);
    const fees = await ensureTransactionFinanceFees(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId,
      transactionId: transaction.id,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    });
    const previousRows = await tx.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const previousAgentRow = buildPreviousCommissionChangeBaseline({
      rows: previousRows,
      ownerMembershipId: transaction.ownerMembershipId,
      fallbackGrossCommission: new Prisma.Decimal(0),
      fallbackReferralFee: new Prisma.Decimal(0),
      fallbackOfficeNet: new Prisma.Decimal(0),
      fallbackAgentNet: new Prisma.Decimal(0)
    });
    const grossCommission = transaction.grossCommission ?? new Prisma.Decimal(0);
    const note = parseOptionalText(input.notes) ?? parseOptionalText(transaction.financeNotes);
    const chain =
      transaction.ownerMembershipId
        ? await buildDefaultTransactionCommissionChain(tx, {
            organizationId: input.organizationId,
            officeId: input.officeId ?? transaction.officeId,
            ownerMembershipId: transaction.ownerMembershipId,
            effectiveAt,
            transactionCommissionContext: transaction.commissionContext
          })
        : [];
    const prerequisites = buildTransactionFinancePrerequisiteSnapshot({
      clientReferralFormApproved: transaction.clientReferralFormApproved,
      rebateAgreementSigned: transaction.rebateAgreementSigned,
      rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
    });
    const calculated = calculateTransactionFinanceResult({
      grossCommission,
      fees,
      chain,
      prerequisites
    });

    if (calculated.approvalBlockers.length > 0) {
      throw new Error(calculated.approvalBlockers.join(" "));
    }

    if (transaction.ownerMembershipId && (!storedContext || storedContext.ownerMembershipId !== transaction.ownerMembershipId)) {
      await tx.transaction.update({
        where: {
          id: transaction.id
        },
        data: {
          commissionContext: buildStoredTransactionCommissionContext({
            ownerMembershipId: transaction.ownerMembershipId,
            effectiveAt,
            members: chain
          }) satisfies Prisma.InputJsonValue
        }
      });
    }

    const previousVersion = await tx.transactionFinanceCalculationVersion.findFirst({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ versionNumber: "desc" }]
    });
    const versionNumber = (previousVersion?.versionNumber ?? 0) + 1;

    await tx.transactionFinanceCalculationVersion.updateMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    const version = await tx.transactionFinanceCalculationVersion.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        versionNumber,
        sourceType: "calculated",
        isCurrent: true,
        grossCommission,
        preSplitTotal: calculated.preSplitTotal,
        postSplitTotal: calculated.postSplitTotal,
        netCommissionBase: calculated.netCommissionBase,
        reimbursementAmount: calculated.reimbursementAmount,
        finalAgentNet: calculated.finalAgentNet,
        finalOfficeNet: calculated.finalOfficeNet,
        feeBreakdown: buildStoredTransactionFinanceFeeBreakdownRows(calculated.normalizedFees) satisfies Prisma.InputJsonValue,
        stakeholderBreakdown: buildStoredTransactionFinanceStakeholderBreakdownRows(calculated.stakeholderRows) satisfies Prisma.InputJsonValue,
        blockingIssues: [] satisfies Prisma.InputJsonValue,
        notes: note,
        createdByMembershipId: input.actorMembershipId
      }
    });

    await tx.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        referralFee: calculated.preSplitTotal,
        officeNet: calculated.finalOfficeNet,
        agentNet: calculated.finalAgentNet
      }
    });

    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      }
    });

    const rows: Prisma.CommissionCalculationCreateManyInput[] = calculated.stakeholderRows.map((row) => ({
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId ?? null,
      transactionId: transaction.id,
      transactionFinanceCalculationVersionId: version.id,
      membershipId: row.membershipId || null,
      commissionPlanId: null,
      accountingTransactionId: null,
      recipientType: row.recipientType,
      recipientRole: row.recipientRoleValue,
      recipientName: row.recipientLabel,
      grossCommission,
      referralFee: calculated.preSplitTotal,
      fees: calculated.postSplitTotal,
      officeNet: row.recipientType === "brokerage" ? row.finalAmount : new Prisma.Decimal(0),
      agentNet: row.recipientType === "agent" ? row.finalAmount : new Prisma.Decimal(0),
      statementAmount: row.finalAmount,
      status: "calculated",
      notes: note,
      calculatedAt: new Date(),
      calculatedByMembershipId: input.actorMembershipId
    }));

    await tx.commissionCalculation.createMany({
      data: rows
    });

    await syncTransactionParticipantMembershipLinks(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId ?? null,
      transactionId: transaction.id,
      stakeholderRows: buildStoredTransactionFinanceStakeholderBreakdownRows(calculated.stakeholderRows)
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: version.id,
      action: previousRows.length > 0 ? activityLogActions.commissionRecalculated : activityLogActions.commissionCalculated,
      payload: {
        officeId: transaction.officeId,
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        objectLabel: buildTransactionLabel(transaction),
        contextHref: `/office/transactions/${transaction.id}#commission`,
        changes: buildCommissionChanges(previousAgentRow, {
          grossCommission,
          referralFee: calculated.preSplitTotal,
          officeNet: calculated.finalOfficeNet,
          agentNet: calculated.finalAgentNet,
          fees: calculated.postSplitTotal
        }),
        details: [
          "Mode: Finance rule engine",
          `Reference: ${chain[0] ? buildCommissionSplitLabel(chain[0].agentPercent) : "Default split chain"}`,
          `Version: ${versionNumber}`,
          `Agent net: ${formatCurrency(calculated.finalAgentNet)}`,
          `Office net: ${formatCurrency(calculated.finalOfficeNet)}`
        ]
      }
    });
  });

  return getTransactionCommissionSnapshot(
    input.organizationId,
    input.transactionId,
    input.officeId ?? transaction.officeId ?? null,
    input.actorMembershipId
  );
}



export async function overrideTransactionCommission(
  input: OverrideTransactionCommissionInput
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId
    },
    include: {
      office: true
    }
  });

  if (!transaction) {
    return null;
  }

  const overrideReason = parseOptionalText(input.overrideReason);

  if (!overrideReason) {
    throw new Error("Override reason is required.");
  }

  await prisma.$transaction(async (tx) => {
    const [currentVersion, actorMembership] = await Promise.all([
      tx.transactionFinanceCalculationVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          transactionId: transaction.id,
          isCurrent: true
        },
        orderBy: [{ versionNumber: "desc" }]
      }),
      tx.membership.findFirst({
        where: {
          id: input.actorMembershipId,
          organizationId: input.organizationId
        },
        select: {
          role: true
        }
      })
    ]);

    if (!currentVersion) {
      throw new Error("Run the finance calculation before applying a manual override.");
    }

    if (!actorMembership) {
      throw new Error("Actor membership not found.");
    }

    const currentStakeholderRows = parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown);

    if (currentStakeholderRows.length === 0) {
      throw new Error("Current calculation does not have stakeholder rows to override.");
    }

    const overrideEntries = input.stakeholderRows
      .map((entry) => ({
        key: entry.key.trim(),
        membershipId: entry.membershipId.trim(),
        amount: parseOptionalDecimal(entry.amount)
      }))
      .filter((entry) => entry.key || entry.membershipId || entry.amount !== null);

    if (overrideEntries.length === 0) {
      throw new Error("Enter at least one stakeholder override row.");
    }

    const actorCanManageOverrideParticipants = actorMembership.role === "office_admin";
    const currentRowByKey = new Map(currentStakeholderRows.map((row) => [row.key, row]));
    const incomingKeys = new Set<string>();
    const incomingMembershipIds = new Set<string>();
    let companyRowCount = 0;

    for (const entry of overrideEntries) {
      const isCompanyRow = entry.key === "company";

      if (!entry.key) {
        throw new Error("Each override row must include a stable key.");
      }

      if (incomingKeys.has(entry.key)) {
        throw new Error("Duplicate override rows are not allowed.");
      }

      incomingKeys.add(entry.key);

      if (entry.amount === null) {
        throw new Error("Every override row must include a valid amount.");
      }

      entry.amount = normalizeCurrencyDecimal(entry.amount);

      if (entry.amount.lt(0)) {
        throw new Error("Override amounts must be zero or greater.");
      }

      if (isCompanyRow) {
        companyRowCount += 1;
        entry.membershipId = "";
        continue;
      }

      if (!entry.membershipId) {
        throw new Error("Every participant row must include a valid membership.");
      }

      if (entry.key !== entry.membershipId) {
        throw new Error("Manual participant keys must match the selected membership.");
      }

      if (incomingMembershipIds.has(entry.membershipId)) {
        throw new Error("Duplicate participant memberships are not allowed.");
      }

      incomingMembershipIds.add(entry.membershipId);
    }

    if (companyRowCount !== 1) {
      throw new Error("Manual override must include exactly one company row.");
    }

    const requiredPersistentKeys = currentStakeholderRows
      .filter((row) => row.recipientType !== "brokerage" && !row.isManualParticipant)
      .map((row) => row.key);

    for (const key of requiredPersistentKeys) {
      if (!incomingKeys.has(key)) {
        throw new Error("Only manually added participants can be removed from an override.");
      }
    }

    const participantSetChanged =
      currentStakeholderRows.length !== overrideEntries.length ||
      currentStakeholderRows.some((row) => !incomingKeys.has(row.key)) ||
      overrideEntries.some((entry) => !currentRowByKey.has(entry.key));

    if (participantSetChanged && !actorCanManageOverrideParticipants) {
      throw new Error("Only Office Admin can add or remove override participants.");
    }

    const addedMembershipIds = overrideEntries
      .filter((entry) => entry.key !== "company" && !currentRowByKey.has(entry.key))
      .map((entry) => entry.membershipId);
    const addedMemberships =
      addedMembershipIds.length > 0
        ? await tx.membership.findMany({
            where: {
              organizationId: input.organizationId,
              id: {
                in: addedMembershipIds
              },
              status: {
                in: selectableOperationalMembershipStatuses
              }
            },
            include: {
              user: true,
              office: true
            }
          })
        : [];

    if (addedMemberships.length !== new Set(addedMembershipIds).size) {
      throw new Error("One or more added participants are not active or invited memberships in this organization.");
    }

    const addedMembershipById = new Map(addedMemberships.map((membership) => [membership.id, membership]));
    const addedParticipantLabels: string[] = [];
    const nextStakeholderRows = overrideEntries.map((entry) => {
      const existingRow = currentRowByKey.get(entry.key) ?? null;

      if (existingRow) {
        return {
          ...existingRow,
          finalAmount: String(entry.amount ?? new Prisma.Decimal(0))
        };
      }

      const membership = addedMembershipById.get(entry.membershipId);

      if (!membership) {
        throw new Error("One or more added participants are no longer available. Refresh and try again.");
      }

      const recipientLabel = formatMembershipFullName({
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email
      });
      addedParticipantLabels.push(recipientLabel);

      return {
        key: membership.id,
        membershipId: membership.id,
        recipientLabel,
        recipientRole: formatMembershipParticipantRole({
          role: membership.role,
          title: membership.title
        }),
        recipientRoleValue: membership.role,
        recipientType: "agent",
        isManualParticipant: true,
        sharePercent: "0",
        baseAmount: "0",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: String(entry.amount ?? new Prisma.Decimal(0))
      } satisfies StoredTransactionFinanceStakeholderBreakdownRow;
    });

    const currentTotal = normalizeCurrencyDecimal(sumStakeholderFinalAmounts(currentStakeholderRows));
    const nextTotal = normalizeCurrencyDecimal(sumStakeholderFinalAmounts(nextStakeholderRows));

    if (!currentTotal.eq(nextTotal)) {
      throw new Error("Override amounts must keep the total allocated payout unchanged.");
    }

    const nextStoredStakeholderRows = applyEffectiveSharePercentsToStoredStakeholderRows(nextStakeholderRows);
    const ownerAgentRow = findPrimaryAgentStakeholderRow(nextStoredStakeholderRows, transaction.ownerMembershipId);
    const companyRow = nextStoredStakeholderRows.find((row) => row.recipientType === "brokerage" && row.key === "company") ?? null;

    if (!companyRow) {
      throw new Error("Manual override must retain the company payout row.");
    }

    const nextFinalAgentNet = ownerAgentRow ? parseOptionalDecimal(ownerAgentRow.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const nextFinalOfficeNet = companyRow ? parseOptionalDecimal(companyRow.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const note = parseOptionalText(input.notes) ?? currentVersion.notes;
    const previousRows = await tx.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const previousAgentRow = buildPreviousCommissionChangeBaseline({
      rows: previousRows,
      ownerMembershipId: transaction.ownerMembershipId,
      fallbackGrossCommission: currentVersion.grossCommission,
      fallbackReferralFee: currentVersion.preSplitTotal,
      fallbackOfficeNet: currentVersion.finalOfficeNet,
      fallbackAgentNet: currentVersion.finalAgentNet
    });
    const removedParticipantLabels = currentStakeholderRows
      .filter((row) => row.isManualParticipant && !incomingKeys.has(row.key))
      .map((row) => row.recipientLabel);
    const versionNumber = currentVersion.versionNumber + 1;

    await tx.transactionFinanceCalculationVersion.updateMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    const version = await tx.transactionFinanceCalculationVersion.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        versionNumber,
        sourceType: "overridden",
        isCurrent: true,
        grossCommission: currentVersion.grossCommission,
        preSplitTotal: currentVersion.preSplitTotal,
        postSplitTotal: currentVersion.postSplitTotal,
        netCommissionBase: currentVersion.netCommissionBase,
        reimbursementAmount: currentVersion.reimbursementAmount,
        finalAgentNet: nextFinalAgentNet,
        finalOfficeNet: nextFinalOfficeNet,
        feeBreakdown: currentVersion.feeBreakdown ?? ([] satisfies Prisma.InputJsonValue),
        stakeholderBreakdown: nextStoredStakeholderRows satisfies Prisma.InputJsonValue,
        blockingIssues: currentVersion.blockingIssues ?? ([] satisfies Prisma.InputJsonValue),
        notes: note,
        overrideReason,
        createdByMembershipId: input.actorMembershipId
      }
    });

    await tx.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        referralFee: currentVersion.preSplitTotal,
        officeNet: nextFinalOfficeNet,
        agentNet: nextFinalAgentNet
      }
    });

    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      }
    });

    await tx.commissionCalculation.createMany({
      data: nextStakeholderRows.map((row) => ({
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        transactionFinanceCalculationVersionId: version.id,
        membershipId: row.membershipId || null,
        commissionPlanId: null,
        accountingTransactionId: null,
        recipientType: row.recipientType,
        recipientRole: row.recipientRoleValue,
        recipientName: row.recipientLabel,
        grossCommission: currentVersion.grossCommission,
        referralFee: currentVersion.preSplitTotal,
        fees: currentVersion.postSplitTotal,
        officeNet: row.recipientType === "brokerage" ? parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0),
        agentNet: row.recipientType === "agent" ? parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0),
        statementAmount: parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0),
        status: "calculated",
        notes: note,
        calculatedAt: new Date(),
        calculatedByMembershipId: input.actorMembershipId
      }))
    });

    await syncTransactionParticipantMembershipLinks(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId ?? null,
      transactionId: transaction.id,
      stakeholderRows: nextStoredStakeholderRows
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: version.id,
      action: activityLogActions.commissionRecalculated,
      payload: {
        officeId: transaction.officeId,
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        objectLabel: buildTransactionLabel(transaction),
        contextHref: `/office/transactions/${transaction.id}#commission`,
        changes: buildCommissionChanges(previousAgentRow, {
          grossCommission: currentVersion.grossCommission,
          referralFee: currentVersion.preSplitTotal,
          officeNet: nextFinalOfficeNet,
          agentNet: nextFinalAgentNet,
          fees: currentVersion.postSplitTotal
        }),
        details: [
          "Mode: Manual override",
          `Version: ${versionNumber}`,
          `Reason: ${overrideReason}`,
          ...(addedParticipantLabels.length > 0 ? [`Added participants: ${addedParticipantLabels.join(", ")}`] : []),
          ...(removedParticipantLabels.length > 0 ? [`Removed participants: ${removedParticipantLabels.join(", ")}`] : []),
          `Primary agent net: ${formatCurrency(nextFinalAgentNet)}`,
          `Office net: ${formatCurrency(nextFinalOfficeNet)}`
        ]
      }
    });
  });

  return getTransactionCommissionSnapshot(
    input.organizationId,
    input.transactionId,
    input.officeId ?? transaction.officeId ?? null,
    input.actorMembershipId
  );
}



export async function updateCommissionCalculationStatus(input: UpdateCommissionCalculationStatusInput) {
  const nextStatus = parseCommissionCalculationStatus(input.status);

  if (!nextStatus) {
    throw new Error("Unsupported commission status.");
  }

  const existing = await prisma.commissionCalculation.findFirst({
    where: {
      id: input.calculationId,
      organizationId: input.organizationId
    },
    include: {
      transaction: true
    }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.commissionCalculation.update({
      where: {
        id: existing.id
      },
      data: {
        status: nextStatus,
        notes: parseOptionalText(input.notes) ?? existing.notes
      },
      include: {
        transaction: true,
        membership: {
          include: {
            user: true
          }
        },
        commissionPlan: true,
        accountingTransaction: true
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: saved.id,
      action: activityLogActions.commissionStatusUpdated,
      payload: {
        officeId: saved.officeId,
        transactionId: saved.transactionId,
        transactionLabel: buildTransactionLabel(saved.transaction),
        objectLabel: `${saved.commissionPlan?.name ?? "Manual commission"} · ${saved.recipientName ?? commissionRecipientLabelMap[saved.recipientType]}`,
        contextHref: `/office/transactions/${saved.transactionId}#commission`,
        changes: [
          {
            label: "Status",
            previousValue: commissionCalculationStatusLabelMap[existing.status],
            nextValue: commissionCalculationStatusLabelMap[nextStatus]
          }
        ],
        details: [
          `Recipient: ${saved.recipientName ?? commissionRecipientLabelMap[saved.recipientType]}`,
          `Statement amount: ${formatCurrency(saved.statementAmount)}`
        ]
      }
    });

    return saved;
  });

  return mapCommissionCalculationRow(updated);
}
