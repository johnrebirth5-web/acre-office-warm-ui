import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  type AgentBankInformationAccountType,
  type AgentBankInformationTaxIdType,
  type AgentGoalPeriodType,
  type AgentOnboardingItemStatus,
  type AgentOnboardingStatus,
  type MembershipStatus,
  type TeamMembershipRole,
  type UserRole
} from "@prisma/client";

import {
  activityLogActions,
  recordActivityLogEvent,
  type ActivityLogAction,
  type ActivityLogChange
} from "../activity-log";

import {
  buildMembershipVisibilityWhere,
  canAccessMembership,
  canViewFinancialsForMembership,
  redactCurrency,
  resolveOfficeDataScope,
  type OfficeDataScope
} from "../access";

import { prisma } from "../client";

import {
  getMembershipCommissionEditorSnapshot,
  saveMembershipCommissionSetting,
  type OfficeMembershipCommissionEditorSnapshot
} from "../commission-defaults";

import { getAgentCommissionSummary, type OfficeAgentCommissionSummary } from "../commissions";

import { resolveManagedMembershipStoredTitle, resolveMembershipDisplayTitle } from "../membership-titles";

import { createNotificationsForMemberships } from "../notifications";

import {
  buildTeamMembershipHierarchyMap,
  buildTeamPathLabel,
  createTeamHierarchyIndex,
  expandSelectedTeamIds,
  formatAssignableTeamLabel,
  formatTeamMembershipRoleLabel,
  getExpectedBranchLeaderRole,
  getDescendantTeamIds,
  getTeamDepth,
  isLeaderTeamMembershipRole,
  isTeamHierarchyAssignableUserRole,
  isValidBranchLeaderRole,
  resolveUserRoleForTeamMembershipRole
} from "../team-hierarchy";

import { AddAgentToTeamInput, ApplyAgentOnboardingTemplateInput, ComparableAgentBankInformationRecord, CreateAgentGoalInput, CreateAgentOnboardingItemInput, CreateAgentTeamInput, DeleteAgentTeamInput, GetOfficeAgentProfileInput, GetOfficeAgentsRosterInput, OfficeAgentBankInformationRecord, OfficeAgentGoalRecord, OfficeAgentOnboardingItemRecord, OfficeAgentOnboardingTemplateRecord, OfficeAgentOperationalAgendaItem, OfficeAgentProfileActivityItem, OfficeAgentProfileAvailableTeam, OfficeAgentProfileAvailableTeamManager, OfficeAgentProfileSnapshot, OfficeAgentProfileTeam, OfficeAgentRosterFilters, OfficeAgentRosterRow, OfficeAgentTeamSummary, OfficeAgentsRosterSnapshot, RemoveAgentFromTeamInput, SaveAgentProfileInput, UpdateAgentGoalInput, UpdateAgentOnboardingItemInput, UpdateAgentTeamInput, agentBankInformationAccountTypeLabelMap, agentBankInformationTaxIdTypeLabelMap, buildAgentBankInformationSignature, buildUniqueTeamSlug, canManageAgentBankInformation, defaultOnboardingItems, formatCurrency, formatDateLabel, formatDateTimeLabel, formatDateValue, getPurchasedPriceValue, goalPeriodLabelMap, hasAnyAgentBankInformationValue, membershipStatusLabelMap, normalizeComparableAgentBankInformationRecord, onboardingItemStatusLabelMap, onboardingStatusLabelMap, parseOptionalAgentBankInformationAccountType, parseOptionalAgentBankInformationTaxIdType, parseOptionalDate, parseOptionalDecimal, parseOptionalText, roleLabelMap, slugify, teamRoleLabelMap } from "./types";
import { ManagedMembershipRecord, applyOnboardingTemplateItems, assertTeamHierarchyAssignableMembership, buildChange, buildGoalProgressSummary, buildLeaderOwnedTeamName, buildOnboardingProgressLabel, buildTransactionSummaryLabel, ensureAgentProfileFoundation, ensureMembershipExists, formatDueDaysOffsetLabel, getActivityActionLabel, getBillingSummaryByMembership, getCurrentOrLatestGoal, getDefaultOnboardingTemplateSeedData, getGoalProgressSourceDate, getMembershipLabel, getPayloadObjectLabel, listActiveOnboardingTemplateItems, materializeImplicitJuniorTeamsForManagementAction, materializeImplicitJuniorTeamsForOrganization, normalizeGoalPeriod, normalizeMembershipStatusFilter, normalizeOnboardingItemStatus, normalizeOnboardingStatus, normalizeOptionalTeamId, normalizeOptionalTeamMembershipId, normalizeTeamRole, redactAgentCommissionSummary, redactAgentGoalFinancials, resolveOnboardingDueDate, syncAgentProfileOnboardingStatus, syncLeaderAccountRoleForTeamAssignment, syncManagedMembershipTitle, syncManagedMembershipTitlesForTeam, syncManagedMembershipTitlesForTeamBranch, validateTeamMembershipHierarchy, validateTeamParentAssignment } from "./helpers";
import { getOfficeAgentProfileSnapshot, getOfficeAgentsRosterSnapshot, saveAgentProfile } from "./roster-profile";
import { createAgentGoal, createAgentOnboardingItem, updateAgentGoal, updateAgentOnboardingItem } from "./progress";

export async function applyAgentOnboardingTemplate(input: ApplyAgentOnboardingTemplateInput) {
  return prisma.$transaction(async (tx) => {
    const { membership, appliedCount } = await applyOnboardingTemplateItems(
      tx,
      input.organizationId,
      input.membershipId,
      input.officeId
    );

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, input.officeId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_onboarding_item",
      entityId: input.membershipId,
      action: activityLogActions.agentOnboardingTemplateApplied,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · Standard onboarding`,
        contextHref: `/office/agents/${input.membershipId}#onboarding`,
        details: [`Applied ${appliedCount} template item${appliedCount === 1 ? "" : "s"}`]
      }
    });

    return {
      appliedCount
    };
  });
}



export async function createAgentTeam(input: CreateAgentTeamInput) {
  const name = input.name.trim();
  const leaderMembershipId = input.leaderMembershipId.trim();

  if (!name) {
    throw new Error("Team name is required.");
  }

  if (!leaderMembershipId) {
    throw new Error("A team owner is required when creating a Team or Junior Team.");
  }

  return prisma.$transaction(async (tx) => {
    await materializeImplicitJuniorTeamsForManagementAction(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      actorMembershipId: input.actorMembershipId
    });
    const parentTeamId = await validateTeamParentAssignment(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      parentTeamId: input.parentTeamId ?? null
    });
    const [leaderMembership, parentTeam] = await Promise.all([
      ensureMembershipExists(tx, input.organizationId, leaderMembershipId, input.officeId),
      parentTeamId
        ? tx.team.findUnique({
            where: {
              id: parentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null)
    ]);
    assertTeamHierarchyAssignableMembership(leaderMembership, "team_owner");
    const reusableParentMembership =
      parentTeamId
        ? await tx.teamMembership.findFirst({
            where: {
              organizationId: input.organizationId,
              membershipId: leaderMembership.id,
              teamId: parentTeamId,
              role: {
                in: ["member", "junior_team_leader"]
              },
              team: {
                isActive: true
              }
            },
            select: {
              id: true,
              role: true
            }
          })
        : null;
    const reusableDirectReports =
      reusableParentMembership
        ? await tx.teamMembership.findMany({
            where: {
              organizationId: input.organizationId,
              teamId: parentTeamId ?? undefined,
              reportsToTeamMembershipId: reusableParentMembership.id
            },
            select: {
              id: true,
              membershipId: true
            }
          })
        : [];

    if (reusableParentMembership) {
      if (reusableParentMembership.role === "member" && reusableDirectReports.length > 0) {
        throw new Error("Reassign this future child-team leader's direct reports before creating the new child team.");
      }
    }

    const slug = await buildUniqueTeamSlug(tx, input.organizationId, name);
    const team = await tx.team.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        name,
        slug,
        parentTeamId
      }
    });
    const leaderRole = getExpectedBranchLeaderRole(parentTeamId);
    if (!reusableParentMembership) {
      await assignMembershipToTeamTx(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        actorMembershipId: input.actorMembershipId,
        teamId: team.id,
        membershipId: leaderMembership.id,
        role: leaderRole,
        reportsToTeamMembershipId: null
      });
    } else if (reusableParentMembership.role === "member") {
      await tx.teamMembership.delete({
        where: {
          id: reusableParentMembership.id
        }
      });
      await assignMembershipToTeamTx(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        actorMembershipId: input.actorMembershipId,
        teamId: team.id,
        membershipId: leaderMembership.id,
        role: leaderRole,
        reportsToTeamMembershipId: null
      });
    } else {
      await tx.teamMembership.update({
        where: {
          id: reusableParentMembership.id
        },
        data: {
          officeId: team.officeId,
          teamId: team.id,
          role: leaderRole,
          reportsToTeamMembershipId: null
        }
      });
      await syncLeaderAccountRoleForTeamAssignment(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId,
        membership: leaderMembership,
        teamRole: leaderRole
      });
      if (reusableDirectReports.length > 0) {
        await tx.teamMembership.updateMany({
          where: {
            id: {
              in: reusableDirectReports.map((teamMembership) => teamMembership.id)
            }
          },
          data: {
            officeId: team.officeId,
            teamId: team.id
          }
        });
      }
      await syncManagedMembershipTitlesForTeamBranch(tx, input.organizationId, parentTeamId ?? team.id, input.officeId);
    }

    const createdLeaderRole = resolveUserRoleForTeamMembershipRole(leaderMembership.role, leaderRole);
    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: team.id,
      action: activityLogActions.teamCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: team.name,
        contextHref: `/office/agents?teamId=${team.id}`,
        details: [
          `Status: Active`,
          `Parent team: ${parentTeam?.name ?? "None"}`,
          `${teamRoleLabelMap[leaderRole]}: ${getMembershipLabel(leaderMembership)}`,
          ...(createdLeaderRole !== leaderMembership.role
            ? [`Account role auto-upgraded: ${roleLabelMap[leaderMembership.role]} -> ${roleLabelMap[createdLeaderRole]}`]
            : [])
        ]
      }
    });

    return team;
  });
}



export async function updateAgentTeam(input: UpdateAgentTeamInput) {
  return prisma.$transaction(async (tx) => {
    await materializeImplicitJuniorTeamsForManagementAction(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      actorMembershipId: input.actorMembershipId
    });
    const team = await tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      }
    });

    if (!team) {
      throw new Error("Team was not found.");
    }

    const nextName = parseOptionalText(input.name) ?? team.name;
    const nextIsActive = typeof input.isActive === "boolean" ? input.isActive : team.isActive;
    const nextParentTeamId =
      input.parentTeamId === undefined
        ? team.parentTeamId
        : await validateTeamParentAssignment(tx, {
            organizationId: input.organizationId,
            officeId: input.officeId,
            teamId: team.id,
            parentTeamId: input.parentTeamId
          });
    const [currentParentTeam, nextParentTeam] = await Promise.all([
      team.parentTeamId
        ? tx.team.findUnique({
            where: {
              id: team.parentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null),
      nextParentTeamId
        ? tx.team.findUnique({
            where: {
              id: nextParentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null)
    ]);
    const changes = [
      buildChange("Name", team.name, nextName),
      buildChange("Status", team.isActive ? "Active" : "Inactive", nextIsActive ? "Active" : "Inactive"),
      buildChange("Parent team", currentParentTeam?.name ?? "None", nextParentTeam?.name ?? "None")
    ].filter((change): change is ActivityLogChange => Boolean(change));

    const updatedTeam = await tx.team.update({
      where: {
        id: input.teamId
      },
      data: {
        name: nextName,
        slug: nextName === team.name ? team.slug : slugify(nextName),
        isActive: nextIsActive,
        parentTeamId: nextParentTeamId
      }
    });

    const nextLeaderRole = getExpectedBranchLeaderRole(updatedTeam.parentTeamId);
    const leaderMemberships = await tx.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        teamId: updatedTeam.id,
        role: {
          in: ["team_leader", "junior_team_leader"]
        }
      },
      include: {
        membership: {
          include: {
            user: true,
            office: true,
            agentProfile: true
          }
        }
      }
    });
    await tx.teamMembership.updateMany({
      where: {
        organizationId: input.organizationId,
        teamId: updatedTeam.id,
        role: {
          in: ["team_leader", "junior_team_leader"]
        }
      },
      data: {
        role: nextLeaderRole,
        reportsToTeamMembershipId: null
      }
    });
    for (const leaderMembership of leaderMemberships) {
      await syncLeaderAccountRoleForTeamAssignment(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId,
        membership: leaderMembership.membership,
        teamRole: nextLeaderRole
      });
    }

    await syncManagedMembershipTitlesForTeamBranch(tx, input.organizationId, updatedTeam.id, input.officeId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: updatedTeam.id,
      action: nextIsActive ? activityLogActions.teamUpdated : activityLogActions.teamDeactivated,
      payload: {
        officeId: updatedTeam.officeId,
        objectLabel: updatedTeam.name,
        contextHref: `/office/agents?teamId=${updatedTeam.id}`,
        details: [],
        changes
      }
    });

    return updatedTeam;
  });
}



export async function deleteAgentTeam(input: DeleteAgentTeamInput) {
  return prisma.$transaction(async (tx) => {
    await materializeImplicitJuniorTeamsForManagementAction(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      actorMembershipId: input.actorMembershipId
    });
    const team = await tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      }
    });

    if (!team) {
      throw new Error("Team was not found.");
    }

    const expectedLeaderRole = getExpectedBranchLeaderRole(team.parentTeamId);
    const [teamMemberships, childTeamCount, commissionAssignmentCount] = await Promise.all([
      tx.teamMembership.findMany({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId
        },
        select: {
          membershipId: true,
          role: true
        }
      }),
      tx.team.count({
        where: {
          organizationId: input.organizationId,
          parentTeamId: input.teamId
        }
      }),
      tx.commissionPlanAssignment.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId
        }
      })
    ]);
    const allowOwnerCascadeDelete =
      teamMemberships.length === 1 && teamMemberships[0]?.role === expectedLeaderRole;
    const impactedMembershipIds = [...new Set(teamMemberships.map((teamMembership) => teamMembership.membershipId))];
    const impactedMemberships =
      allowOwnerCascadeDelete && impactedMembershipIds.length > 0
        ? await tx.membership.findMany({
            where: {
              id: {
                in: impactedMembershipIds
              }
            },
            select: {
              id: true,
              role: true,
              title: true,
              teamMemberships: {
                where: {
                  NOT: {
                    teamId: input.teamId
                  }
                },
                include: {
                  team: {
                    select: {
                      id: true,
                      name: true,
                      isActive: true,
                      parentTeamId: true
                    }
                  }
                }
              }
            }
          })
        : [];

    if (teamMemberships.length > 0 && !allowOwnerCascadeDelete) {
      throw new Error("Remove all team members before deleting this team.");
    }

    if (childTeamCount > 0) {
      throw new Error("Remove or reassign this team's child teams before deleting it.");
    }

    if (commissionAssignmentCount > 0) {
      throw new Error("Remove this team's commission plan assignments before deleting it.");
    }

    if (allowOwnerCascadeDelete) {
      await tx.teamMembership.deleteMany({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId
        }
      });
    }

    await tx.team.delete({
      where: {
        id: input.teamId
      }
    });

    for (const membership of impactedMemberships) {
      const nextTitle = resolveManagedMembershipStoredTitle({
        role: membership.role,
        fallbackTitle: membership.title,
        teamMemberships: membership.teamMemberships
      });

      if ((membership.title ?? null) === nextTitle) {
        continue;
      }

      await tx.membership.update({
        where: {
          id: membership.id
        },
        data: {
          title: nextTitle
        }
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: input.teamId,
      action: activityLogActions.teamDeleted,
      payload: {
        officeId: team.officeId,
        objectLabel: team.name,
        contextHref: "/office/settings/teams",
        details: allowOwnerCascadeDelete
          ? [`Final ${teamRoleLabelMap[expectedLeaderRole]} assignment removed with team deletion`]
          : []
      }
    });

    return {
      id: input.teamId
    };
  });
}



export async function addAgentToTeam(input: AddAgentToTeamInput) {
  return prisma.$transaction(async (tx) => {
    await materializeImplicitJuniorTeamsForManagementAction(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      actorMembershipId: input.actorMembershipId
    });
    return assignMembershipToTeamTx(tx, input);
  });
}



export async function assignMembershipToTeamTx(tx: Prisma.TransactionClient, input: AddAgentToTeamInput) {
  const [team, membership, existingTeamMembership, otherTeamMembership] = await Promise.all([
    tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      }
    }),
    ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
    tx.teamMembership.findUnique({
      where: {
        teamId_membershipId: {
          teamId: input.teamId,
          membershipId: input.membershipId
        }
      }
    }),
    tx.teamMembership.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        NOT: {
          teamId: input.teamId
        },
        team: {
          isActive: true
        }
      },
      include: {
        team: true
      }
    })
  ]);

  if (!team) {
    throw new Error("Team was not found.");
  }

  assertTeamHierarchyAssignableMembership(membership);

  if (otherTeamMembership) {
    throw new Error(
      `Each membership can only belong to one active team per organization. Remove the existing team assignment from ${otherTeamMembership.team.name} first.`
    );
  }

  const nextRole = normalizeTeamRole(input.role);
  const expectedLeaderRole = getExpectedBranchLeaderRole(team.parentTeamId);
  const validLeaderMemberships = await tx.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      teamId: input.teamId,
      role: expectedLeaderRole
    },
    select: {
      id: true,
      membershipId: true,
      role: true
    }
  });
  const currentMembershipIsValidLeader = existingTeamMembership
    ? validLeaderMemberships.some((leader) => leader.id === existingTeamMembership.id)
    : false;
  const otherValidLeaders = validLeaderMemberships.filter((leader) => leader.id !== existingTeamMembership?.id);

  if (nextRole !== "member" && nextRole !== expectedLeaderRole) {
    throw new Error(
      team.parentTeamId
        ? "Child teams can only assign a Junior Team Leader as the owner."
        : "Teams can only assign a Team Leader as the owner."
    );
  }

  if (nextRole !== "member" && otherValidLeaders.length > 1) {
    throw new Error("This team currently has multiple active leaders. Clean that up before assigning a new owner.");
  }
  const transferLeader = nextRole === expectedLeaderRole ? otherValidLeaders[0] ?? null : null;

  const directReports = existingTeamMembership
    ? await tx.teamMembership.findMany({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          reportsToTeamMembershipId: existingTeamMembership.id
        },
        select: {
          id: true,
          role: true
        }
      })
    : [];

  if (nextRole === "member" && currentMembershipIsValidLeader && otherValidLeaders.length === 0) {
    throw new Error(
      team.parentTeamId
        ? "Transfer this child team to another Junior Team Leader before changing the current owner."
        : "Transfer this Team to another Team Leader before changing the current owner."
    );
  }

  if (nextRole === "member" && directReports.length > 0) {
    throw new Error("Members cannot keep direct reports. Reassign direct reports first.");
  }

  const nextReportsToTeamMembershipId = await validateTeamMembershipHierarchy(tx, {
    organizationId: input.organizationId,
    officeId: input.officeId,
    teamId: input.teamId,
    teamParentTeamId: team.parentTeamId,
    membershipId: input.membershipId,
    role: nextRole,
    reportsToTeamMembershipId: input.reportsToTeamMembershipId,
    existingTeamMembershipId: existingTeamMembership?.id ?? null
  });

  const teamMembership = await tx.teamMembership.upsert({
    where: {
      teamId_membershipId: {
        teamId: input.teamId,
        membershipId: input.membershipId
      }
    },
    update: {
      role: nextRole,
      officeId: team.officeId,
      reportsToTeamMembershipId: nextReportsToTeamMembershipId
    },
    create: {
      organizationId: input.organizationId,
      officeId: team.officeId,
      teamId: input.teamId,
      membershipId: input.membershipId,
      role: nextRole,
      reportsToTeamMembershipId: nextReportsToTeamMembershipId
    }
  });
  const roleSync = await syncLeaderAccountRoleForTeamAssignment(tx, {
    organizationId: input.organizationId,
    actorMembershipId: input.actorMembershipId,
    membership,
    teamRole: nextRole
  });

  if (transferLeader) {
    await tx.teamMembership.update({
      where: {
        id: transferLeader.id
      },
      data: {
        role: "member",
        reportsToTeamMembershipId: teamMembership.id
      }
    });
    await tx.teamMembership.updateMany({
      where: {
        organizationId: input.organizationId,
        teamId: input.teamId,
        reportsToTeamMembershipId: transferLeader.id
      },
      data: {
        reportsToTeamMembershipId: teamMembership.id
      }
    });
    await syncManagedMembershipTitle(tx, transferLeader.membershipId);
  }

  await syncManagedMembershipTitle(tx, input.membershipId);

  const directManager =
    teamMembership.reportsToTeamMembershipId
      ? await tx.teamMembership.findUnique({
          where: {
            id: teamMembership.reportsToTeamMembershipId
          },
          include: {
            membership: {
              include: {
                user: true
              }
            }
          }
        })
      : team.parentTeamId && nextRole !== "member"
        ? await tx.teamMembership.findFirst({
            where: {
              organizationId: input.organizationId,
              teamId: team.parentTeamId,
              role: {
                in: ["team_leader", "junior_team_leader"]
              }
            },
            include: {
              membership: {
                include: {
                  user: true
                }
              }
            }
          })
        : null;

  await recordActivityLogEvent(tx, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "team",
    entityId: team.id,
    action: activityLogActions.teamMemberAdded,
    payload: {
      officeId: team.officeId,
      objectLabel: `${team.name} · ${getMembershipLabel(membership)}`,
      contextHref: `/office/settings/users/${input.membershipId}`,
      details: [
        `Team role: ${teamRoleLabelMap[teamMembership.role]}`,
        `Direct manager: ${directManager ? getMembershipLabel(directManager.membership) : "None"}`,
        ...(roleSync.promotionDetail ? [roleSync.promotionDetail] : []),
        ...(transferLeader ? [`Leadership transferred from another ${teamRoleLabelMap[expectedLeaderRole]}`] : [])
      ]
    }
  });

  return teamMembership;
}



export async function removeAgentFromTeam(input: RemoveAgentFromTeamInput) {
  return prisma.$transaction(async (tx) => {
    await materializeImplicitJuniorTeamsForManagementAction(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      actorMembershipId: input.actorMembershipId
    });
    const [team, membership, teamMembership] = await Promise.all([
      tx.team.findFirst({
        where: {
          id: input.teamId,
          organizationId: input.organizationId,
          ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
        }
      }),
      ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
      tx.teamMembership.findFirst({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          membershipId: input.membershipId
        }
      })
    ]);

    if (!team || !teamMembership) {
      throw new Error("Team membership was not found.");
    }

    const expectedLeaderRole = getExpectedBranchLeaderRole(team.parentTeamId);
    const [directReportCount, childTeamCount, otherValidLeaderCount] = await Promise.all([
      tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          reportsToTeamMembershipId: teamMembership.id
        }
      }),
      isLeaderTeamMembershipRole(teamMembership.role)
        ? tx.team.count({
            where: {
              organizationId: input.organizationId,
              parentTeamId: input.teamId
            }
          })
        : Promise.resolve(0),
      tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          role: expectedLeaderRole,
          NOT: {
            id: teamMembership.id
          }
        }
      })
    ]);

    if (teamMembership.role === expectedLeaderRole && otherValidLeaderCount === 0) {
      throw new Error(
        team.parentTeamId
          ? "Transfer this child team to another Junior Team Leader before removing the current owner."
          : "Transfer this Team to another Team Leader before removing the current owner."
      );
    }

    if (directReportCount > 0) {
      throw new Error("Reassign or remove this member's direct reports before removing them from the team.");
    }

    if (childTeamCount > 0) {
      throw new Error("Reassign this team's child teams before removing its leader.");
    }

    await tx.teamMembership.delete({
      where: {
        id: teamMembership.id
      }
    });

    await syncManagedMembershipTitle(tx, input.membershipId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: team.id,
      action: activityLogActions.teamMemberRemoved,
      payload: {
        officeId: team.officeId,
        objectLabel: `${team.name} · ${getMembershipLabel(membership)}`,
        contextHref: `/office/agents/${input.membershipId}`,
        details: [`Previous role: ${teamRoleLabelMap[teamMembership.role]}`]
      }
    });

    return true;
  });
}
