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
import { assignCommissionPlanToMembership, calculateTransactionCommission, overrideTransactionCommission, updateCommissionCalculationStatus } from "./transactions";

export async function generateCommissionStatementSnapshot(
  input: GenerateCommissionStatementSnapshotInput
): Promise<OfficeCommissionStatementSnapshot | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      user: true
    }
  });

  if (!membership) {
    return null;
  }

  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const calculations = await prisma.commissionCalculation.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { officeId: input.officeId } : {}),
      membershipId: membership.id,
      ...(startDate || endDate
        ? {
            calculatedAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          }
        : {})
    },
    include: {
      transaction: true
    },
    orderBy: [{ calculatedAt: "desc" }],
    take: 100
  });

  const summary = buildCommissionStatementSnapshot(membership.id, `${membership.user.firstName} ${membership.user.lastName}`, calculations);

  if (input.actorMembershipId) {
    await recordActivityLogEvent(prisma, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_statement",
      entityId: randomUUID(),
      action: activityLogActions.commissionStatementGenerated,
      payload: {
        officeId: input.officeId ?? membership.officeId ?? null,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} commission statement`,
        contextHref: `/office/settings/commission-plans`,
        details: [
          `Agent: ${membership.user.firstName} ${membership.user.lastName}`,
          `Statement-ready: ${summary.statementReadyLabel}`,
          `Payable: ${summary.payableLabel}`
        ]
      }
    });
  }

  return summary;
}



export function buildCommissionStatementSnapshot(
  membershipId: string,
  agentLabel: string,
  calculations: Array<
    Prisma.CommissionCalculationGetPayload<{
      include: {
        transaction: true;
      };
    }>
  >
): OfficeCommissionStatementSnapshot {
  const totalForStatus = (status: CommissionCalculationStatus) =>
    calculations
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum.plus(row.statementAmount), new Prisma.Decimal(0));
  const totalGross = calculations.reduce((sum, row) => sum.plus(row.grossCommission), new Prisma.Decimal(0));
  const totalOfficeNet = calculations.reduce((sum, row) => sum.plus(row.officeNet), new Prisma.Decimal(0));
  const totalAgentNet = calculations.reduce((sum, row) => sum.plus(row.agentNet), new Prisma.Decimal(0));

  return {
    membershipId,
    agentLabel,
    generatedAt: new Date().toISOString(),
    openCalculatedLabel: formatCurrency(totalForStatus("calculated").plus(totalForStatus("reviewed"))),
    statementReadyLabel: formatCurrency(totalForStatus("statement_ready")),
    payableLabel: formatCurrency(totalForStatus("payable")),
    paidLabel: formatCurrency(totalForStatus("paid")),
    totalGrossCommissionLabel: formatCurrency(totalGross),
    totalOfficeNetLabel: formatCurrency(totalOfficeNet),
    totalAgentNetLabel: formatCurrency(totalAgentNet),
    lineItems: calculations.map((calculation) => ({
      id: calculation.id,
      transactionId: calculation.transactionId,
      transactionLabel: buildTransactionLabel(calculation.transaction),
      transactionHref: `/office/transactions/${calculation.transactionId}`,
      status: commissionCalculationStatusLabelMap[calculation.status],
      statementAmountLabel: formatCurrency(calculation.statementAmount),
      calculatedAt: formatDateValue(calculation.calculatedAt)
    }))
  };
}



export function sumAgentStatementAmounts(
  calculations: Array<{
    recipientType: CommissionRecipientType;
    status: CommissionCalculationStatus;
    statementAmount: Prisma.Decimal;
  }>,
  status: CommissionCalculationStatus
) {
  return calculations
    .filter((row) => row.recipientType === "agent" && row.status === status)
    .reduce((sum, row) => sum.plus(row.statementAmount), new Prisma.Decimal(0));
}



export async function getOfficeCommissionManagementSnapshot(
  input: GetOfficeCommissionManagementSnapshotInput
): Promise<OfficeCommissionManagementSnapshot> {
  const scope =
    input.viewerMembershipId
      ? await resolveOfficeDataScope({
          organizationId: input.organizationId,
          viewerMembershipId: input.viewerMembershipId,
          officeId: input.officeId ?? null,
          resource: "commissions"
        })
      : null;

  await backfillCommissionSplitTemplatesFromLegacy(input.organizationId, input.officeId);
  await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId);

  const visibleMembershipIds = scope?.visibleMembershipIds ?? null;
  const visibleTeamIds = scope?.visibleTeamIds ?? null;
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
      ...(visibleTeamIds ? { id: { in: visibleTeamIds.length > 0 ? visibleTeamIds : ["__no_team__"] } } : {})
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      parentTeamId: true
    }
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const selectedTeamIds = input.teamId?.trim() ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const teamPathLabelById = new Map(
    scopedTeams.map((team) => [team.id, buildTeamPathLabel(teamHierarchyIndex, team.id) || team.name])
  );
  const calculationWhere: Prisma.CommissionCalculationWhereInput = {
    organizationId: input.organizationId,
    ...(input.officeId ? { officeId: input.officeId } : {})
  };

  if (input.membershipId) {
    calculationWhere.membershipId = input.membershipId;
  }

  if (input.teamId?.trim()) {
    const membershipFilterId = input.membershipId?.trim() || "";
    const teamMemberships = await prisma.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        teamId: {
          in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
        },
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      select: {
        membershipId: true
      }
    });

    const teamMembershipIds = teamMemberships.map((row) => row.membershipId);
    const filteredMembershipIds =
      membershipFilterId
        ? teamMembershipIds.filter((membershipId) => membershipId === membershipFilterId)
        : teamMembershipIds;

    calculationWhere.membershipId = {
      in: filteredMembershipIds.length > 0 ? filteredMembershipIds : ["__no_membership__"]
    };
  }

  const parsedStatus = parseCommissionCalculationStatus(input.status);
  if (parsedStatus) {
    calculationWhere.status = parsedStatus;
  }

  if (input.commissionPlanId?.trim()) {
    calculationWhere.commissionPlanId = input.commissionPlanId.trim();
  }

  if (input.transactionId?.trim()) {
    calculationWhere.transactionId = input.transactionId.trim();
  }

  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  if (startDate || endDate) {
    calculationWhere.calculatedAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    };
  }

  const assignmentWhere: Prisma.CommissionPlanAssignmentWhereInput = {
    organizationId: input.organizationId,
    AND: [
      ...(input.officeId
        ? [
            {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          ]
        : []),
      ...(
        input.membershipId?.trim() && input.teamId?.trim()
          ? [
              {
                OR: [
                  { membershipId: input.membershipId.trim() },
                  {
                    teamId: {
                      in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
                    }
                  }
                ]
              }
            ]
          : input.membershipId?.trim()
            ? [{ membershipId: input.membershipId.trim() }]
            : input.teamId?.trim()
              ? [
                  {
                    teamId: {
                      in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
                    }
                  }
                ]
              : []
      )
    ]
  };

  const [plans, assignments, calculations, memberships, transactions, splitTemplates, memberDefaults] = await Promise.all([
    prisma.commissionPlan.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      include: {
        rules: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        assignments: true
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.commissionPlanAssignment.findMany({
      where: assignmentWhere,
      include: {
        membership: {
          include: {
            user: true
          }
        },
        team: true,
        commissionPlan: true
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 100
    }),
    prisma.commissionCalculation.findMany({
      where: calculationWhere,
      include: {
        transaction: true,
        membership: {
          include: {
            user: true
          }
        },
        commissionPlan: true,
        accountingTransaction: true
      },
      orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }],
      take: 200
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: "active",
        ...(input.officeId ? { officeId: input.officeId } : {}),
        ...(visibleMembershipIds ? { id: { in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"] } } : {})
      },
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }]
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {}),
        ...(visibleMembershipIds ? { ownerMembershipId: { in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"] } } : {})
      },
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        state: true
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100
    }),
    listCommissionSplitTemplates(input.organizationId, input.officeId),
    listCurrentMembershipCommissionSettings({
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipIds: visibleMembershipIds ?? undefined
    })
  ]);

  const filteredAssignments = assignments.filter((assignment) => {
    if (!scope || scope.visibleMembershipIds === null) {
      return true;
    }

    if (assignment.membershipId) {
      return scope.visibleMembershipIds.includes(assignment.membershipId);
    }

    if (assignment.teamId && scope.visibleTeamIds) {
      return scope.visibleTeamIds.includes(assignment.teamId);
    }

    return false;
  });
  const visibility = filterVisibleCommissionRows(
    calculations.map((calculation) => ({
      membershipId: calculation.membershipId,
      recipientType: calculation.recipientType
    })),
    scope
  );
  const visibleCalculations = visibility.visibleRowIndexes.map((index) => calculations[index]);
  const memberById = new Map(memberships.map((membership) => [membership.id, membership]));
  const statementMembershipId = input.membershipId?.trim() || visibleCalculations.find((row) => row.membershipId)?.membershipId || "";
  const statementMembership = statementMembershipId ? memberById.get(statementMembershipId) : null;
  const statement = statementMembershipId
    ? buildCommissionStatementSnapshot(
        statementMembershipId,
        statementMembership ? `${statementMembership.user.firstName} ${statementMembership.user.lastName}`.trim() : "Selected agent",
        visibleCalculations.filter((row) => row.membershipId === statementMembershipId)
      )
    : null;
  const mappedPlans = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? "",
    isActive: plan.isActive,
    calculationMode: commissionCalculationModeLabelMap[plan.calculationMode],
    calculationModeValue: plan.calculationMode,
    defaultCurrency: plan.defaultCurrency ?? "USD",
    assignmentCount: plan.assignments.length,
    rules: plan.rules.map(mapCommissionRule)
  }));
  const mappedAssignments = filteredAssignments.map((assignment) => ({
    ...mapCommissionAssignmentRecord(assignment),
    targetLabel:
      assignment.membership
        ? `${assignment.membership.user.firstName} ${assignment.membership.user.lastName}`.trim()
        : assignment.teamId
          ? teamPathLabelById.get(assignment.teamId) ?? assignment.team?.name ?? "Unassigned target"
          : "Unassigned target"
  }));

  return {
    overview: {
      activeSplitTemplatesCount: splitTemplates.filter((template) => template.isActive).length,
      membersWithDefaultSplitCount: memberDefaults.length,
      activePlansCount: mappedPlans.filter((plan) => plan.isActive).length,
      activeAssignmentsCount: mappedAssignments.filter((assignment) => !assignment.effectiveTo || new Date(assignment.effectiveTo) >= new Date()).length,
      calculatedRowsCount: visibleCalculations.length,
      statementReadyLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "statement_ready")),
      payableLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "payable")),
      paidLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "paid"))
    },
    filters: {
      membershipId: input.membershipId ?? "",
      teamId: input.teamId ?? "",
      commissionPlanId: input.commissionPlanId ?? "",
      status: parsedStatus ?? "",
      transactionId: input.transactionId ?? "",
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      memberOptions: memberships.map((membership) => ({
        id: membership.id,
        label: `${membership.user.firstName} ${membership.user.lastName}`
      })),
      teamOptions: scopedTeams.map((team) => ({
        id: team.id,
        label: teamPathLabelById.get(team.id) ?? team.name
      })),
      commissionPlanOptions: plans.map((plan) => ({
        id: plan.id,
        label: plan.name
      })),
      transactionOptions: transactions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`
      }))
    },
    splitTemplates,
    memberDefaults,
    advancedReviewItems: buildLegacyReviewItems({
      plans: mappedPlans,
      assignments: mappedAssignments
    }),
    plans: mappedPlans,
    assignments: mappedAssignments,
    calculations: visibleCalculations.map(mapCommissionCalculationRow),
    statement
  };
}



export async function getTransactionCommissionSnapshot(
  organizationId: string,
  transactionId: string,
  officeId?: string | null,
  viewerMembershipId?: string
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const scope =
    viewerMembershipId
      ? await resolveOfficeDataScope({
          organizationId,
          viewerMembershipId,
          officeId: officeId ?? null,
          resource: "commissions"
        })
      : null;
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      organizationId
    },
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      },
      office: true
    }
  });

  if (!transaction) {
    return null;
  }

  const effectiveAt = transaction.createdAt ?? new Date();
  if (transaction.ownerMembershipId) {
    await backfillMembershipCommissionSettingsFromLegacy(organizationId, officeId ?? transaction.officeId, [transaction.ownerMembershipId]);
  }
  const financeFees = await prisma.$transaction((tx) =>
    ensureTransactionFinanceFees(tx, {
      organizationId,
      officeId: officeId ?? transaction.officeId,
      transactionId: transaction.id,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    })
  );

  const [assignment, defaultSetting, plans, calculations, versions] = await Promise.all([
    transaction.ownerMembershipId
      ? resolveActiveCommissionPlanAssignment(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt
        })
      : Promise.resolve(null),
    transaction.ownerMembershipId
      ? resolveActiveMembershipCommissionSetting(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt
        })
      : Promise.resolve(null),
    listCommissionPlanOptions(organizationId, officeId ?? transaction.officeId),
    prisma.commissionCalculation.findMany({
      where: {
        organizationId,
        transactionId
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
      },
      orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.transactionFinanceCalculationVersion.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        createdByMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ versionNumber: "desc" }]
    })
  ]);
  const storedContext = parseStoredTransactionCommissionContext(transaction.commissionContext);
  const prerequisites = buildTransactionFinancePrerequisiteSnapshot({
    clientReferralFormApproved: transaction.clientReferralFormApproved,
    rebateAgreementSigned: transaction.rebateAgreementSigned,
    rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
  });
  const previewChain =
    transaction.grossCommission && transaction.ownerMembershipId
      ? await buildDefaultTransactionCommissionChain(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          ownerMembershipId: transaction.ownerMembershipId,
          effectiveAt,
          transactionCommissionContext: transaction.commissionContext
        })
      : [];
  const previewCalculation =
    transaction.grossCommission
      ? calculateTransactionFinanceResult({
          grossCommission: transaction.grossCommission,
          fees: financeFees,
          chain: previewChain,
          prerequisites
        })
      : null;
  const visibility = filterVisibleCommissionRows(
    calculations.map((calculation) => ({
      membershipId: calculation.membershipId,
      recipientType: calculation.recipientType
    })),
    scope
  );
  const visibleCalculations = visibility.visibleRowIndexes.map((index) => calculations[index]);
  const restrictedTotals = Boolean(scope && scope.visibleMembershipIds !== null && visibility.hiddenRowCount > 0);
  const defaultSplitLabel =
    storedContext?.members[0]?.agentPercent
      ? buildCommissionSplitLabel(storedContext.members[0].agentPercent)
      : defaultSetting?.settingLabel ??
        (transaction.ownerMembership
          ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName} default split`
          : "Default split chain");
  const defaultSplitSourceLabel =
    storedContext
      ? `Locked on ${formatDateValue(new Date(storedContext.sourceDate)) || formatDateValue(effectiveAt)}`
      : defaultSetting?.sourceLabel ?? "No default split configured";
  const latestCalculatedPlan = calculations.find((row) => Boolean(row.commissionPlanId)) ?? null;
  const currentVersion = versions.find((version) => version.isCurrent) ?? versions[0] ?? null;
  const summary = buildTransactionCommissionSummary(transaction, visibleCalculations, {
    restrictTotals: restrictedTotals,
    currentVersion:
      currentVersion
        ? {
            versionNumber: currentVersion.versionNumber,
            sourceType: currentVersion.sourceType,
            preSplitTotal: currentVersion.preSplitTotal,
            postSplitTotal: currentVersion.postSplitTotal,
            netCommissionBase: currentVersion.netCommissionBase,
            reimbursementAmount: currentVersion.reimbursementAmount,
            finalAgentNet: currentVersion.finalAgentNet,
            finalOfficeNet: currentVersion.finalOfficeNet
          }
        : null,
    feeRows: financeFees
  });
  const rawStakeholderBreakdown =
    currentVersion
      ? parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown)
      : previewCalculation?.stakeholderRows.map((row) => ({
          key: row.key,
          membershipId: row.membershipId,
          recipientLabel: row.recipientLabel,
          recipientRole: row.recipientRole,
          recipientRoleValue: row.recipientRoleValue,
          recipientType: row.recipientType,
          isManualParticipant: row.isManualParticipant,
          sharePercent: String(row.sharePercent),
          baseAmount: String(row.baseAmount),
          postSplitAdjustment: String(row.postSplitAdjustment),
          reimbursementAdjustment: String(row.reimbursementAdjustment),
          finalAmount: String(row.finalAmount)
        })) ?? [];
  const displayStakeholderBreakdown =
    currentVersion?.sourceType === "overridden"
      ? applyEffectiveSharePercentsToStoredStakeholderRows(rawStakeholderBreakdown)
      : rawStakeholderBreakdown;
  const manualParticipantLockActive = hasManualParticipantRows(rawStakeholderBreakdown);
  const existingStakeholderMembershipIds = new Set(
    rawStakeholderBreakdown
      .filter((row) => row.recipientType !== "brokerage" && row.membershipId.trim().length > 0)
      .map((row) => row.membershipId)
  );
  const manualParticipantOptions =
    scope?.viewerRole === "office_admin"
      ? (
          await prisma.membership.findMany({
            where: {
              organizationId,
              status: {
                in: selectableOperationalMembershipStatuses
              }
            },
            include: {
              user: true,
              office: true
            },
            orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
          })
        )
          .filter((membership) => !existingStakeholderMembershipIds.has(membership.id))
          .map((membership) =>
            buildManualParticipantOption({
              membershipId: membership.id,
              firstName: membership.user.firstName,
              lastName: membership.user.lastName,
              email: membership.user.email,
              role: membership.role,
              status: membership.status,
              title: membership.title,
              officeName: membership.office?.name ?? null
            })
          )
      : [];
  const stakeholderVisibility = filterVisibleCommissionRows(
    displayStakeholderBreakdown.map((row) => ({
      membershipId: row.membershipId || null,
      recipientType: row.recipientType
    })),
    scope
  );
  const stakeholderBreakdown = stakeholderVisibility.visibleRowIndexes.map((index) =>
    mapStoredTransactionFinanceStakeholderRow(displayStakeholderBreakdown[index]!)
  );
  const versionHistory = versions.map((version) => {
    const mapped = mapTransactionFinanceVersionRecord(version);

    if (!restrictedTotals) {
      return mapped;
    }

    return {
      ...mapped,
      finalAgentNetLabel: "Restricted",
      finalOfficeNetLabel: "Restricted"
    };
  });

  return {
    transactionId: transaction.id,
    mode: latestCalculatedPlan ? "legacy_plan" : "default_split_chain",
    defaultSplitLabel,
    defaultSplitSourceLabel,
    hiddenRowCount: visibility.hiddenRowCount,
    visibilityNote: visibility.visibilityNote,
    planLabel: latestCalculatedPlan?.commissionPlan?.name ?? assignment?.commissionPlan.name ?? defaultSplitLabel,
    planId: latestCalculatedPlan?.commissionPlanId ?? assignment?.commissionPlanId ?? "",
    planSourceLabel:
      latestCalculatedPlan?.commissionPlanId
        ? "Used for latest calculation"
        : assignment?.sourceLabel ?? defaultSplitSourceLabel,
    planSourceValue: latestCalculatedPlan?.commissionPlanId ? "manual" : assignment?.sourceType ?? "manual",
    availablePlans: plans,
    manualParticipantOptions,
    manualParticipantLockActive,
    feeBreakdown: financeFees.map((fee) =>
      mapTransactionFinanceFeeRecord(fee, {
        restrictAmounts: restrictedTotals
      })
    ),
    stakeholderBreakdown,
    versionHistory,
    approvalBlockers: previewCalculation?.approvalBlockers ?? [],
    calculations: visibleCalculations.map(mapCommissionCalculationRow),
    summary
  };
}



export async function getAgentCommissionSummary(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
}): Promise<OfficeAgentCommissionSummary> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      agentProfile: true
    }
  });

  if (!membership) {
    return {
      defaultSettingId: "",
      defaultSplitLabel: "",
      defaultSplitSourceLabel: "",
      defaultAgentPercentLabel: "",
      defaultCompanyPercentLabel: "",
      defaultEffectiveFrom: "",
      activePlanId: "",
      activePlanLabel: "",
      activePlanSourceLabel: "",
      calculatedCount: 0,
      statementReadyLabel: formatCurrency(0),
      payableLabel: formatCurrency(0),
      paidLabel: formatCurrency(0),
      recentCalculations: []
    };
  }

  await backfillMembershipCommissionSettingsFromLegacy(
    input.organizationId,
    input.officeId ?? membership.officeId,
    [membership.id]
  );

  const [assignment, defaultSetting, calculations, allTotals] = await Promise.all([
    resolveActiveCommissionPlanAssignment(prisma, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId,
      membershipId: membership.id,
      effectiveAt: new Date()
    }),
    resolveActiveMembershipCommissionSetting(prisma, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId,
      membershipId: membership.id,
      effectiveAt: new Date()
    }),
    prisma.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id
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
      },
      orderBy: [{ calculatedAt: "desc" }],
      take: 5
    }),
    prisma.commissionCalculation.groupBy({
      by: ["status"],
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id
      },
      _sum: {
        statementAmount: true
      },
      _count: {
        _all: true
      }
    })
  ]);

  const getStatusTotal = (status: CommissionCalculationStatus) =>
    allTotals.find((entry) => entry.status === status)?._sum.statementAmount ?? new Prisma.Decimal(0);
  const totalCount = allTotals.reduce((sum, entry) => sum + entry._count._all, 0);

  return {
    defaultSettingId: defaultSetting?.id ?? "",
    defaultSplitLabel: defaultSetting?.settingLabel ?? membership.agentProfile?.commissionPlanName ?? "",
    defaultSplitSourceLabel: defaultSetting?.sourceLabel ?? "",
    defaultAgentPercentLabel: defaultSetting ? `${String(defaultSetting.agentPercent)}%` : "",
    defaultCompanyPercentLabel: defaultSetting ? `${String(defaultSetting.companyPercent)}%` : "",
    defaultEffectiveFrom: defaultSetting ? formatDateValue(defaultSetting.effectiveFrom) : "",
    activePlanId: assignment?.commissionPlanId ?? defaultSetting?.id ?? "",
    activePlanLabel: assignment?.commissionPlan.name ?? defaultSetting?.settingLabel ?? membership.agentProfile?.commissionPlanName ?? "",
    activePlanSourceLabel: assignment?.sourceLabel ?? defaultSetting?.sourceLabel ?? "",
    calculatedCount: totalCount,
    statementReadyLabel: formatCurrency(getStatusTotal("statement_ready")),
    payableLabel: formatCurrency(getStatusTotal("payable")),
    paidLabel: formatCurrency(getStatusTotal("paid")),
    recentCalculations: calculations.map(mapCommissionCalculationRow)
  };
}
