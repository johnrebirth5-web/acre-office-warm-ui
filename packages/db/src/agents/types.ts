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

import { ManagedMembershipRecord, applyOnboardingTemplateItems, assertTeamHierarchyAssignableMembership, buildChange, buildGoalProgressSummary, buildLeaderOwnedTeamName, buildOnboardingProgressLabel, buildTransactionSummaryLabel, ensureAgentProfileFoundation, ensureMembershipExists, formatDueDaysOffsetLabel, getActivityActionLabel, getBillingSummaryByMembership, getCurrentOrLatestGoal, getDefaultOnboardingTemplateSeedData, getGoalProgressSourceDate, getMembershipLabel, getPayloadObjectLabel, listActiveOnboardingTemplateItems, materializeImplicitJuniorTeamsForManagementAction, materializeImplicitJuniorTeamsForOrganization, normalizeGoalPeriod, normalizeMembershipStatusFilter, normalizeOnboardingItemStatus, normalizeOnboardingStatus, normalizeOptionalTeamId, normalizeOptionalTeamMembershipId, normalizeTeamRole, redactAgentCommissionSummary, redactAgentGoalFinancials, resolveOnboardingDueDate, syncAgentProfileOnboardingStatus, syncLeaderAccountRoleForTeamAssignment, syncManagedMembershipTitle, syncManagedMembershipTitlesForTeam, syncManagedMembershipTitlesForTeamBranch, validateTeamMembershipHierarchy, validateTeamParentAssignment } from "./helpers";
import { getOfficeAgentProfileSnapshot, getOfficeAgentsRosterSnapshot, saveAgentProfile } from "./roster-profile";
import { addAgentToTeam, applyAgentOnboardingTemplate, assignMembershipToTeamTx, createAgentTeam, deleteAgentTeam, removeAgentFromTeam, updateAgentTeam } from "./team-management";
import { createAgentGoal, createAgentOnboardingItem, updateAgentGoal, updateAgentOnboardingItem } from "./progress";

export const roleLabelMap: Record<UserRole, string> = {
  agent: "Agent",
  office_manager: "Office Manager (Legacy)",
  office_user: "Office User (Legacy)",
  office_admin: "Office Admin",
  owner: "Owner",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead"
};



export const onboardingStatusLabelMap: Record<AgentOnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete"
};



export const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Inactive"
};



export const onboardingItemStatusLabelMap: Record<AgentOnboardingItemStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  reopened: "Reopened"
};



export const teamRoleLabelMap: Record<TeamMembershipRole, string> = {
  team_leader: "Team Leader",
  junior_team_leader: "Junior Team Leader",
  member: "Member"
};



export const goalPeriodLabelMap: Record<AgentGoalPeriodType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual"
};



export const agentBankInformationTaxIdTypeLabelMap: Record<AgentBankInformationTaxIdType, string> = {
  ssn: "SSN",
  ein: "EIN"
};



export const agentBankInformationAccountTypeLabelMap: Record<AgentBankInformationAccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  business_checking: "Business checking",
  business_savings: "Business savings",
  other: "Other"
};



export const defaultOnboardingItems = [
  {
    category: "Compliance",
    title: "Upload license and state ID",
    description: "Provide your active license details and identity documents for office compliance review.",
    dueDaysOffset: 3
  },
  {
    category: "Operations",
    title: "Complete brokerage onboarding packet",
    description: "Review commission setup, office policies, and brokerage-required agreements.",
    dueDaysOffset: 5
  },
  {
    category: "Training",
    title: "Review transaction workflow basics",
    description: "Walk through the Back Office transaction, document, and task flow before going live.",
    dueDaysOffset: 7
  }
] as const;



export function getPurchasedPriceValue(transaction: { purchasedPrice: Prisma.Decimal | null; price: Prisma.Decimal | null }) {
  return transaction.purchasedPrice ?? transaction.price ?? new Prisma.Decimal(0);
}



export type OfficeAgentRosterRow = {
  membershipId: string;
  name: string;
  email: string;
  officeName: string;
  role: string;
  roleValue: UserRole;
  title: string;
  teamLabel: string;
  membershipStatus: string;
  membershipStatusValue: MembershipStatus;
  onboardingStatus: string;
  onboardingProgressLabel: string;
  activeTasksCount: number;
  openTransactionCount: number;
  recentClosedTransactionCount: number;
  transactionSummaryLabel: string;
  goalProgressSummary: string;
  billingBalanceLabel: string;
  billingSummaryLabel: string;
  href: string;
};



export type OfficeAgentRosterFilters = {
  officeId: string;
  role: string;
  teamId: string;
  onboardingStatus: string;
  membershipStatus: string;
  q: string;
  officeOptions: Array<{ id: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  teamOptions: Array<{ id: string; label: string }>;
};



export type OfficeAgentTeamSummary = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  parentTeamId: string | null;
  depth: number;
  teamPathLabel: string;
  childTeamCount: number;
  memberCount: number;
  openTaskCount: number;
  openTransactionCount: number;
  onboardingInProgressCount: number;
  members: Array<{
    teamMembershipId: string;
    membershipId: string;
    label: string;
    role: string;
    roleValue: TeamMembershipRole;
    reportsToTeamMembershipId: string | null;
    reportsToLabel: string;
  }>;
};



export type OfficeAgentsRosterSnapshot = {
  summary: {
    totalMembers: number;
    agentCount: number;
    onboardingInProgressCount: number;
    activeTeamCount: number;
    inactiveMemberCount: number;
  };
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: OfficeAgentRosterFilters;
  rows: OfficeAgentRosterRow[];
  teams: OfficeAgentTeamSummary[];
};



export type OfficeAgentProfileTeam = {
  id: string;
  teamMembershipId: string;
  name: string;
  slug: string;
  isActive: boolean;
  teamPathLabel: string;
  depth: number;
  directManagerMembershipId: string | null;
  rootLeaderLabel: string;
  role: string;
  roleValue: TeamMembershipRole;
  reportsToTeamMembershipId: string | null;
  reportsToLabel: string;
};



export type OfficeAgentProfileAvailableTeamManager = {
  teamMembershipId: string;
  membershipId: string;
  label: string;
  role: string;
  roleValue: TeamMembershipRole;
};



export type OfficeAgentProfileAvailableTeam = {
  id: string;
  label: string;
  managerOptions: OfficeAgentProfileAvailableTeamManager[];
  defaultReportsToTeamMembershipId: string | null;
};



export type OfficeAgentOnboardingItemRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  dueAt: string;
  status: string;
  statusValue: AgentOnboardingItemStatus;
  completedAt: string;
  completedByName: string;
};



export type OfficeAgentGoalRecord = {
  id: string;
  periodType: string;
  startsAt: string;
  endsAt: string;
  targetTransactionCount: string;
  targetClosedVolume: string;
  targetOfficeNet: string;
  targetAgentNet: string;
  actualTransactionCount: string;
  actualClosedVolume: string;
  actualOfficeNet: string;
  actualAgentNet: string;
  notes: string;
};



export type OfficeAgentProfileActivityItem = {
  id: string;
  actionLabel: string;
  objectLabel: string;
  timestampLabel: string;
};



export type OfficeAgentOnboardingTemplateRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  dueDaysOffsetLabel: string;
};



export type OfficeAgentOperationalAgendaItem = {
  id: string;
  kind: string;
  title: string;
  statusLabel: string;
  dueAtLabel: string;
  href: string | null;
};



export type OfficeAgentBankInformationRecord = {
  canView: boolean;
  canManage: boolean;
  payeeName: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  phoneNumber: string;
  taxIdType: string;
  taxIdTypeLabel: string;
  taxIdValue: string;
  dateOfBirth: string;
  accountType: string;
  accountTypeLabel: string;
};



export type OfficeAgentProfileSnapshot = {
  financialsRestricted: boolean;
  profile: {
    membershipId: string;
    userId: string;
    fullName: string;
    displayName: string;
    email: string;
    officeName: string;
    role: string;
    roleValue: UserRole;
    membershipStatus: string;
    membershipStatusValue: MembershipStatus;
    title: string;
    bio: string;
    notes: string;
    licenseNumber: string;
    licenseState: string;
    startDate: string;
    onboardingStatus: string;
    onboardingStatusValue: AgentOnboardingStatus;
    commissionPlanName: string;
    avatarUrl: string;
    internalExtension: string;
  };
  bankInformation: OfficeAgentBankInformationRecord;
  defaultCommission: OfficeMembershipCommissionEditorSnapshot;
  summary: {
    activeTaskCount: number;
    openTransactionCount: number;
    recentClosedTransactionCount: number;
    currentBalanceLabel: string;
    paymentMethodsCount: number;
    openChargesCount: number;
    pendingChargesCount: number;
    currentGoalSummary: string;
    operationalAgendaCount: number;
    pipelineCounts: Array<{ label: string; count: number }>;
  };
  commissions: OfficeAgentCommissionSummary;
  teams: OfficeAgentProfileTeam[];
  availableTeams: OfficeAgentProfileAvailableTeam[];
  onboarding: {
    totalCount: number;
    completedCount: number;
    statusLabel: string;
    templateDefaultsCount: number;
    templateDefaults: OfficeAgentOnboardingTemplateRecord[];
    items: OfficeAgentOnboardingItemRecord[];
  };
  goals: OfficeAgentGoalRecord[];
  operationalAgenda: OfficeAgentOperationalAgendaItem[];
  recentTransactions: Array<{
    id: string;
    label: string;
    status: string;
    priceLabel: string;
    href: string;
  }>;
  recentActivity: OfficeAgentProfileActivityItem[];
};



export type GetOfficeAgentsRosterInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  officeFilterId?: string;
  scopeMode?: "agents" | "teams";
  role?: string;
  teamId?: string;
  onboardingStatus?: string;
  membershipStatus?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};



export type GetOfficeAgentProfileInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  membershipId: string;
};



export type SaveAgentProfileInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  actorMembershipId: string;
  displayName?: string;
  bio?: string;
  notes?: string;
  licenseNumber?: string;
  licenseState?: string;
  startDate?: string;
  commissionPlanName?: string;
  splitTemplateId?: string;
  customAgentPercent?: string;
  commissionEffectiveFrom?: string;
  commissionEffectiveTo?: string;
  avatarUrl?: string;
  internalExtension?: string;
  bankPayeeName?: string;
  bankFirstName?: string;
  bankLastName?: string;
  bankEmail?: string;
  bankAddress?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankPhoneNumber?: string;
  bankTaxIdType?: string;
  bankTaxIdValue?: string;
  bankDateOfBirth?: string;
  bankAccountType?: string;
};



export type CreateAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  name: string;
  parentTeamId?: string | null;
  leaderMembershipId: string;
};



export type UpdateAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  name?: string;
  isActive?: boolean;
  parentTeamId?: string | null;
};



export type DeleteAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
};



export type AddAgentToTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  membershipId: string;
  role?: string;
  reportsToTeamMembershipId?: string | null;
};



export type RemoveAgentFromTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  membershipId: string;
};



export type CreateAgentOnboardingItemInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  title: string;
  description?: string;
  category?: string;
  dueAt?: string;
};



export type ApplyAgentOnboardingTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
};



export type UpdateAgentOnboardingItemInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  itemId: string;
  title?: string;
  description?: string;
  category?: string;
  dueAt?: string;
  status?: string;
};



export type CreateAgentGoalInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  periodType: string;
  startsAt: string;
  endsAt: string;
  targetTransactionCount?: string;
  targetClosedVolume?: string;
  targetOfficeNet?: string;
  targetAgentNet?: string;
  notes?: string;
};



export type UpdateAgentGoalInput = CreateAgentGoalInput & {
  goalId: string;
};



export function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}



export function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}



export function formatDateLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "—";
}



export function formatDateTimeLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "—";
}



export function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}



export function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}



export function parseOptionalDecimal(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}



export function parseOptionalAgentBankInformationTaxIdType(value: string | undefined): AgentBankInformationTaxIdType | null {
  return value === "ssn" || value === "ein" ? value : null;
}



export function parseOptionalAgentBankInformationAccountType(value: string | undefined): AgentBankInformationAccountType | null {
  return value === "checking" ||
    value === "savings" ||
    value === "business_checking" ||
    value === "business_savings" ||
    value === "other"
    ? value
    : null;
}



export function canManageAgentBankInformation(scope: OfficeDataScope, membershipId: string) {
  return scope.viewerPermissions.includes("agents:manage") || scope.viewerMembershipId === membershipId;
}



export type ComparableAgentBankInformationRecord = {
  payeeName: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  phoneNumber: string;
  taxIdType: string;
  taxIdValue: string;
  dateOfBirth: string;
  accountType: string;
};



export function normalizeComparableAgentBankInformationRecord(record: {
  payeeName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  address?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  routingNumber?: string | null;
  phoneNumber?: string | null;
  taxIdType?: AgentBankInformationTaxIdType | null;
  taxIdValue?: string | null;
  dateOfBirth?: Date | null;
  accountType?: AgentBankInformationAccountType | null;
} | null | undefined): ComparableAgentBankInformationRecord {
  return {
    payeeName: record?.payeeName?.trim() ?? "",
    firstName: record?.firstName?.trim() ?? "",
    lastName: record?.lastName?.trim() ?? "",
    email: record?.email?.trim() ?? "",
    address: record?.address?.trim() ?? "",
    bankName: record?.bankName?.trim() ?? "",
    accountNumber: record?.accountNumber?.trim() ?? "",
    routingNumber: record?.routingNumber?.trim() ?? "",
    phoneNumber: record?.phoneNumber?.trim() ?? "",
    taxIdType: record?.taxIdType ?? "",
    taxIdValue: record?.taxIdValue?.trim() ?? "",
    dateOfBirth: record?.dateOfBirth ? record.dateOfBirth.toISOString().slice(0, 10) : "",
    accountType: record?.accountType ?? ""
  };
}



export function buildAgentBankInformationSignature(record: {
  payeeName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  address?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  routingNumber?: string | null;
  phoneNumber?: string | null;
  taxIdType?: AgentBankInformationTaxIdType | null;
  taxIdValue?: string | null;
  dateOfBirth?: Date | null;
  accountType?: AgentBankInformationAccountType | null;
} | null | undefined) {
  return JSON.stringify(normalizeComparableAgentBankInformationRecord(record));
}



export function hasAnyAgentBankInformationValue(record: ComparableAgentBankInformationRecord) {
  return Boolean(
    record.payeeName ||
      record.firstName ||
      record.lastName ||
      record.email ||
      record.address ||
      record.bankName ||
      record.accountNumber ||
      record.routingNumber ||
      record.phoneNumber ||
      record.taxIdType ||
      record.taxIdValue ||
      record.dateOfBirth ||
      record.accountType
  );
}



export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}



export async function buildUniqueTeamSlug(
  tx: Prisma.TransactionClient,
  organizationId: string,
  baseName: string,
  excludedTeamId?: string | null
) {
  const baseSlug = slugify(baseName) || "team";
  const existingTeams = await tx.team.findMany({
    where: {
      organizationId,
      slug: {
        startsWith: baseSlug
      },
      ...(excludedTeamId ? { NOT: { id: excludedTeamId } } : {})
    },
    select: {
      slug: true
    }
  });

  return existingTeams.some((team) => team.slug === baseSlug) ? `${baseSlug}-${existingTeams.length + 1}` : baseSlug;
}
