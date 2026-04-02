import { canAccessOfficeDocumentApprovals, canSecondaryReviewOfficeTasks, getRoleSummary } from "@acre/auth";
import { AgentOnboardingStatus, MembershipStatus, TaskStatus, TransactionTaskStatus, TransactionStatus } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";
import { resolveMembershipDisplayTitle } from "./membership-titles";
import { officeNotificationInboxTypes } from "./notifications";
import { formatTeamMembershipRoleLabel as formatHierarchyRoleLabel } from "./team-hierarchy";
import { listOfficeDocumentApprovalQueue } from "./transaction-tasks";

const notificationPreferenceDefaults = {
  inAppEnabled: true,
  approvalAlertsEnabled: true,
  taskRemindersEnabled: true,
  offerAlertsEnabled: true,
  messageAlertsEnabled: true
} as const;

const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Disabled"
};

const onboardingStatusLabelMap: Record<AgentOnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete"
};

export type OfficeAccountNotificationPreferenceState = {
  inAppEnabled: boolean;
  approvalAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;
  offerAlertsEnabled: boolean;
  messageAlertsEnabled: boolean;
};

export type OfficeAccountSnapshot = {
  profile: {
    fullName: string;
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    phone: string;
    internalExtension: string;
    avatarUrl: string;
    bio: string;
    licenseNumber: string;
    licenseState: string;
    timezone: string;
    locale: string;
  };
  officeTeam: {
    officeName: string;
    officeMarket: string;
    roleLabel: string;
    title: string;
    membershipStatusLabel: string;
    startDateLabel: string;
    onboardingStatusLabel: string;
    teams: Array<{
      id: string;
      name: string;
      roleLabel: string;
      isActive: boolean;
    }>;
  };
  notifications: {
    preferences: OfficeAccountNotificationPreferenceState;
    lastUpdatedLabel: string;
    unreadCount: number;
    recentCount: number;
  };
  security: {
    authMethodLabel: string;
    authMethodDescription: string;
    passwordStatusLabel: string;
    passwordStatusDescription: string;
    twoStepStatusLabel: string;
    twoStepStatusDescription: string;
    sessionStatusLabel: string;
    sessionStatusDescription: string;
  };
  summary: {
    openTaskCount: number;
    openTransactionTaskCount: number;
    openFollowUpTaskCount: number;
    reviewQueueCount: number;
    openTransactionCount: number;
    recentTransactionCount: number;
    recentNotificationsCount: number;
    unreadNotificationsCount: number;
  };
};

export type GetOfficeAccountSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
};

export type SaveOfficeAccountProfileInput = {
  organizationId: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  internalExtension: string;
  avatarUrl: string;
  bio: string;
  licenseNumber: string;
  licenseState: string;
  timezone: string;
  locale: string;
};

export type SaveOfficeAccountNotificationPreferencesInput = {
  organizationId: string;
  membershipId: string;
  inAppEnabled: boolean;
  approvalAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;
  offerAlertsEnabled: boolean;
  messageAlertsEnabled: boolean;
};

function parseOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

function buildFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function formatDateLabel(date: Date | null | undefined) {
  if (!date) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildChange(label: string, previousValue: string | null | undefined, nextValue: string | null | undefined) {
  const previous = previousValue?.trim() ? previousValue.trim() : "—";
  const next = nextValue?.trim() ? nextValue.trim() : "—";

  if (previous === next) {
    return null;
  }

  return {
    label,
    previousValue: previous,
    nextValue: next
  } satisfies ActivityLogChange;
}

function hasEditableProfileData(input: {
  displayName: string;
  internalExtension: string;
  avatarUrl: string;
  bio: string;
  licenseNumber: string;
  licenseState: string;
}) {
  return Boolean(
    parseOptionalText(input.displayName) ||
      parseOptionalText(input.internalExtension) ||
      parseOptionalText(input.avatarUrl) ||
      parseOptionalText(input.bio) ||
      parseOptionalText(input.licenseNumber) ||
      parseOptionalText(input.licenseState)
  );
}

function getNotificationPreferenceState(
  preference:
    | {
        inAppEnabled: boolean;
        approvalAlertsEnabled: boolean;
        taskRemindersEnabled: boolean;
        offerAlertsEnabled: boolean;
        messageAlertsEnabled: boolean;
      }
    | null
    | undefined
): OfficeAccountNotificationPreferenceState {
  return {
    inAppEnabled: preference?.inAppEnabled ?? notificationPreferenceDefaults.inAppEnabled,
    approvalAlertsEnabled: preference?.approvalAlertsEnabled ?? notificationPreferenceDefaults.approvalAlertsEnabled,
    taskRemindersEnabled: preference?.taskRemindersEnabled ?? notificationPreferenceDefaults.taskRemindersEnabled,
    offerAlertsEnabled: preference?.offerAlertsEnabled ?? notificationPreferenceDefaults.offerAlertsEnabled,
    messageAlertsEnabled: preference?.messageAlertsEnabled ?? notificationPreferenceDefaults.messageAlertsEnabled
  };
}

async function getScopedMembership(input: {
  organizationId: string;
  membershipId: string;
}) {
  return prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      user: {
        include: {
          credential: true
        }
      },
      office: true,
      agentProfile: true,
      teamMemberships: {
        include: {
          team: true
        }
      },
      notificationPreference: true
    }
  });
}

export async function getOfficeAccountSnapshot(input: GetOfficeAccountSnapshotInput): Promise<OfficeAccountSnapshot | null> {
  const membership = await getScopedMembership({
    organizationId: input.organizationId,
    membershipId: input.membershipId
  });

  if (!membership) {
    return null;
  }

  const recentTransactionCutoff = new Date();
  recentTransactionCutoff.setDate(recentTransactionCutoff.getDate() - 30);
  const recentNotificationCutoff = new Date();
  recentNotificationCutoff.setDate(recentNotificationCutoff.getDate() - 14);
  const credential = membership.user.credential;
  const isLocked = Boolean(credential?.lockedUntil && credential.lockedUntil > new Date());
  const passwordStatusLabel = isLocked
    ? "Temporarily locked"
    : !credential
      ? membership.status === "invited"
        ? "Setup required"
        : "Password setup required"
      : credential.mustChangePassword
        ? "Password change required"
        : "Password set";
  const passwordStatusDescription = isLocked
    ? `This account is locked until ${formatDateTimeLabel(credential?.lockedUntil)} after repeated failed sign-in attempts.`
    : !credential
      ? membership.status === "invited"
        ? "Accept the invitation and set a password before this account can sign in."
        : "Issue a setup link from Users to create an internal password for this account."
      : credential.mustChangePassword
        ? "This account must change its password before continuing into Back Office."
        : "This account signs in with an internal Acre password and can change it in-app.";

  const [
    openTransactionTaskCount,
    openFollowUpTaskCount,
    openTransactionCount,
    recentTransactionCount,
    unreadNotificationsCount,
    recentNotificationsCount,
    reviewQueueSnapshot
  ] = await Promise.all([
    prisma.transactionTask.count({
      where: {
        organizationId: input.organizationId,
        assigneeMembershipId: input.membershipId,
        status: {
          in: [
            TransactionTaskStatus.todo,
            TransactionTaskStatus.in_progress,
            TransactionTaskStatus.review_requested,
            TransactionTaskStatus.reopened
          ]
        },
        transaction: input.officeId
          ? {
              officeId: input.officeId
            }
          : undefined
      }
    }),
    prisma.followUpTask.count({
      where: {
        organizationId: input.organizationId,
        assigneeMemberId: input.membershipId,
        status: {
          in: [TaskStatus.queued, TaskStatus.in_progress]
        }
      }
    }),
    prisma.transaction.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.membershipId,
        ...(input.officeId ? { officeId: input.officeId } : {}),
        status: {
          in: [TransactionStatus.opportunity, TransactionStatus.active, TransactionStatus.pending]
        }
      }
    }),
    prisma.transaction.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.membershipId,
        ...(input.officeId ? { officeId: input.officeId } : {}),
        updatedAt: {
          gte: recentTransactionCutoff
        }
      }
    }),
    prisma.notification.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        type: {
          in: officeNotificationInboxTypes
        },
        readAt: null,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          : {})
      }
    }),
    prisma.notification.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        type: {
          in: officeNotificationInboxTypes
        },
        createdAt: {
          gte: recentNotificationCutoff
        },
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          : {})
      }
    }),
    canAccessOfficeDocumentApprovals(membership.role)
      ? listOfficeDocumentApprovalQueue({
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          membershipId: input.membershipId,
          canSecondaryReviewTasks: canSecondaryReviewOfficeTasks(membership.role)
        })
      : Promise.resolve(null)
  ]);

  const fullName = buildFullName(membership.user.firstName, membership.user.lastName);
  const notificationPreferences = getNotificationPreferenceState(membership.notificationPreference);

  return {
    profile: {
      fullName,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      displayName: membership.agentProfile?.displayName?.trim() || fullName,
      email: membership.user.email,
      phone: membership.user.phone ?? "",
      internalExtension: membership.agentProfile?.internalExtension ?? "",
      avatarUrl: membership.agentProfile?.avatarUrl ?? "",
      bio: membership.agentProfile?.bio ?? "",
      licenseNumber: membership.agentProfile?.licenseNumber ?? "",
      licenseState: membership.agentProfile?.licenseState ?? "",
      timezone: membership.user.timezone,
      locale: membership.user.locale
    },
    officeTeam: {
      officeName: membership.office?.name ?? "All offices",
      officeMarket: membership.office?.market ?? "Organization-wide",
      roleLabel: getRoleSummary(membership.role).label,
      title:
        resolveMembershipDisplayTitle({
          role: membership.role,
          fallbackTitle: membership.title,
          teamMemberships: membership.teamMemberships
        }) || "Not assigned",
      membershipStatusLabel: membershipStatusLabelMap[membership.status],
      startDateLabel: formatDateLabel(membership.agentProfile?.startDate),
      onboardingStatusLabel: onboardingStatusLabelMap[membership.agentProfile?.onboardingStatus ?? AgentOnboardingStatus.not_started],
      teams: membership.teamMemberships.map((teamMembership) => ({
        id: teamMembership.team.id,
        name: teamMembership.team.name,
        roleLabel: formatHierarchyRoleLabel(teamMembership.role),
        isActive: teamMembership.team.isActive
      }))
    },
    notifications: {
      preferences: notificationPreferences,
      lastUpdatedLabel: membership.notificationPreference ? formatDateTimeLabel(membership.notificationPreference.updatedAt) : "Default inbox settings",
      unreadCount: unreadNotificationsCount,
      recentCount: recentNotificationsCount
    },
    security: {
      authMethodLabel: "Internal password account",
      authMethodDescription: "Office access now uses invitation onboarding plus email and password sign-in.",
      passwordStatusLabel,
      passwordStatusDescription,
      twoStepStatusLabel: "Unavailable",
      twoStepStatusDescription: "2-step verification has not been implemented in the current internal account flow.",
      sessionStatusLabel: "12-hour HTTP-only session",
      sessionStatusDescription: "The active session is stored in an HTTP-only cookie with a 12-hour max age."
    },
    summary: {
      openTaskCount: openTransactionTaskCount + openFollowUpTaskCount,
      openTransactionTaskCount,
      openFollowUpTaskCount,
      reviewQueueCount: reviewQueueSnapshot?.summary.awaiting_my_review ?? 0,
      openTransactionCount,
      recentTransactionCount,
      recentNotificationsCount,
      unreadNotificationsCount
    }
  };
}

export async function saveOfficeAccountProfile(input: SaveOfficeAccountProfileInput) {
  const membership = await getScopedMembership({
    organizationId: input.organizationId,
    membershipId: input.membershipId
  });

  if (!membership) {
    return null;
  }

  const nextFirstName = normalizeRequiredText(input.firstName, "First name");
  const nextLastName = normalizeRequiredText(input.lastName, "Last name");
  const nextTimezone = normalizeRequiredText(input.timezone, "Timezone");
  const nextLocale = normalizeRequiredText(input.locale, "Locale");
  const nextPhone = parseOptionalText(input.phone);
  const nextDisplayName = parseOptionalText(input.displayName);
  const nextInternalExtension = parseOptionalText(input.internalExtension);
  const nextAvatarUrl = parseOptionalText(input.avatarUrl);
  const nextBio = parseOptionalText(input.bio);
  const nextLicenseNumber = parseOptionalText(input.licenseNumber);
  const nextLicenseState = parseOptionalText(input.licenseState);
  const nextFullName = buildFullName(nextFirstName, nextLastName);
  const previousFullName = buildFullName(membership.user.firstName, membership.user.lastName);

  const changes = [
    buildChange("First name", membership.user.firstName, nextFirstName),
    buildChange("Last name", membership.user.lastName, nextLastName),
    buildChange("Display name", membership.agentProfile?.displayName ?? previousFullName, nextDisplayName ?? nextFullName),
    buildChange("Phone", membership.user.phone ?? "", nextPhone ?? ""),
    buildChange("Internal extension", membership.agentProfile?.internalExtension ?? "", nextInternalExtension ?? ""),
    buildChange("Avatar URL", membership.agentProfile?.avatarUrl ?? "", nextAvatarUrl ?? ""),
    buildChange("License number", membership.agentProfile?.licenseNumber ?? "", nextLicenseNumber ?? ""),
    buildChange("License state", membership.agentProfile?.licenseState ?? "", nextLicenseState ?? ""),
    buildChange("Timezone", membership.user.timezone, nextTimezone),
    buildChange("Locale", membership.user.locale, nextLocale),
    buildChange("Bio", membership.agentProfile?.bio ?? "", nextBio ?? "")
  ].flatMap((change) => (change ? [change] : [] satisfies ActivityLogChange[]));

  if (changes.length === 0) {
    return {
      fullName: previousFullName,
      displayName: membership.agentProfile?.displayName?.trim() || previousFullName
    };
  }

  const shouldPersistProfile = Boolean(membership.agentProfile) || hasEditableProfileData({
    displayName: input.displayName,
    internalExtension: input.internalExtension,
    avatarUrl: input.avatarUrl,
    bio: input.bio,
    licenseNumber: input.licenseNumber,
    licenseState: input.licenseState
  });

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: membership.userId
      },
      data: {
        firstName: nextFirstName,
        lastName: nextLastName,
        phone: nextPhone,
        timezone: nextTimezone,
        locale: nextLocale
      }
    });

    if (shouldPersistProfile) {
      await tx.agentProfile.upsert({
        where: {
          membershipId: input.membershipId
        },
        update: {
          organizationId: input.organizationId,
          officeId: membership.officeId,
          displayName: nextDisplayName,
          bio: nextBio,
          licenseNumber: nextLicenseNumber,
          licenseState: nextLicenseState,
          avatarUrl: nextAvatarUrl,
          internalExtension: nextInternalExtension
        },
        create: {
          organizationId: input.organizationId,
          officeId: membership.officeId,
          membershipId: input.membershipId,
          displayName: nextDisplayName,
          bio: nextBio,
          licenseNumber: nextLicenseNumber,
          licenseState: nextLicenseState,
          avatarUrl: nextAvatarUrl,
          internalExtension: nextInternalExtension
        }
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      entityType: "account_profile",
      entityId: input.membershipId,
      action: activityLogActions.accountProfileUpdated,
      payload: {
        officeId: membership.officeId,
        objectLabel: nextDisplayName ?? nextFullName,
        contextHref: "/office/account",
        details: [`Role: ${getRoleSummary(membership.role).label}`, `Office: ${membership.office?.name ?? "All offices"}`],
        changes
      }
    });

    return {
      fullName: nextFullName,
      displayName: nextDisplayName ?? nextFullName
    };
  });
}

export async function saveOfficeAccountNotificationPreferences(input: SaveOfficeAccountNotificationPreferencesInput) {
  const membership = await getScopedMembership({
    organizationId: input.organizationId,
    membershipId: input.membershipId
  });

  if (!membership) {
    return null;
  }

  const previousPreferences = getNotificationPreferenceState(membership.notificationPreference);
  const nextPreferences = {
    inAppEnabled: input.inAppEnabled,
    approvalAlertsEnabled: input.approvalAlertsEnabled,
    taskRemindersEnabled: input.taskRemindersEnabled,
    offerAlertsEnabled: input.offerAlertsEnabled,
    messageAlertsEnabled: input.messageAlertsEnabled
  } satisfies OfficeAccountNotificationPreferenceState;
  const changes = [
    buildChange("In-app notifications", previousPreferences.inAppEnabled ? "Enabled" : "Disabled", nextPreferences.inAppEnabled ? "Enabled" : "Disabled"),
    buildChange("Approval alerts", previousPreferences.approvalAlertsEnabled ? "Enabled" : "Disabled", nextPreferences.approvalAlertsEnabled ? "Enabled" : "Disabled"),
    buildChange("Task reminders", previousPreferences.taskRemindersEnabled ? "Enabled" : "Disabled", nextPreferences.taskRemindersEnabled ? "Enabled" : "Disabled"),
    buildChange("Offer alerts", previousPreferences.offerAlertsEnabled ? "Enabled" : "Disabled", nextPreferences.offerAlertsEnabled ? "Enabled" : "Disabled"),
    buildChange("Mail notifications", previousPreferences.messageAlertsEnabled ? "Enabled" : "Disabled", nextPreferences.messageAlertsEnabled ? "Enabled" : "Disabled")
  ].flatMap((change) => (change ? [change] : [] satisfies ActivityLogChange[]));

  if (changes.length === 0) {
    return nextPreferences;
  }

  return prisma.$transaction(async (tx) => {
    await tx.membershipNotificationPreference.upsert({
      where: {
        membershipId: input.membershipId
      },
      update: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        inAppEnabled: nextPreferences.inAppEnabled,
        approvalAlertsEnabled: nextPreferences.approvalAlertsEnabled,
        taskRemindersEnabled: nextPreferences.taskRemindersEnabled,
        offerAlertsEnabled: nextPreferences.offerAlertsEnabled,
        messageAlertsEnabled: nextPreferences.messageAlertsEnabled
      },
      create: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        membershipId: input.membershipId,
        inAppEnabled: nextPreferences.inAppEnabled,
        approvalAlertsEnabled: nextPreferences.approvalAlertsEnabled,
        taskRemindersEnabled: nextPreferences.taskRemindersEnabled,
        offerAlertsEnabled: nextPreferences.offerAlertsEnabled,
        messageAlertsEnabled: nextPreferences.messageAlertsEnabled
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      entityType: "notification_preference",
      entityId: input.membershipId,
      action: activityLogActions.notificationPreferencesUpdated,
      payload: {
        officeId: membership.officeId,
        objectLabel: buildFullName(membership.user.firstName, membership.user.lastName),
        contextHref: "/office/account",
        details: ["Channel: In-app inbox only", "Email / SMS / push delivery is not implemented"],
        changes
      }
    });

    return nextPreferences;
  });
}
