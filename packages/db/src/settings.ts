import {
  AgentOnboardingItemStatus,
  AgentOnboardingStatus,
  MembershipStatus,
  Prisma,
  TeamMembershipRole,
  TransactionContactRole,
  TransactionCustomFieldType,
  TransactionFieldKey,
  TransactionType,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { resolveOfficeDataScope } from "./access";
import { prisma } from "./client";
import { listCommissionSplitTemplateOptions, type OfficeCommissionSplitTemplateOption } from "./commission-defaults";
import { getAgentCommissionSummary, type OfficeAgentCommissionSummary } from "./commissions";
import {
  membershipHasAccessToOffice,
  normalizeSelectedOfficeIds,
  resolveCurrentOfficeSelection,
  resolveMembershipAccessibleOffices,
  resolveMembershipOfficeAssignment,
  roleHasImplicitAllOfficeAccess,
  type MembershipOfficeAccessRecord,
  type OfficeScopeRecord,
} from "./membership-office-access";
import { resolveMembershipDisplayTitle } from "./membership-titles";
import {
  getMembershipEffectivePermissionKeys,
  getMembershipEffectivePermissions,
  type MembershipEffectivePermissionsSnapshot
} from "./permissions";
import {
  buildTeamMembershipHierarchyMap,
  buildTeamPathLabel,
  createTeamHierarchyIndex,
  formatAssignableTeamLabel,
  formatTeamMembershipRoleLabel as formatHierarchyRoleLabel,
  isLeaderTeamMembershipRole,
  isTeamHierarchyAssignableUserRole,
  isValidBranchLeaderRole
} from "./team-hierarchy";
import { retiredTransactionCustomFieldKeys } from "./transaction-retired-custom-fields";

const userRoleLabelMap: Record<UserRole, string> = {
  owner: "Owner",
  office_admin: "Office Admin",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead",
  agent: "Agent",
  office_manager: "Office Manager",
  office_user: "Office User"
};

const backOfficeUserRoleCatalog: UserRole[] = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_user",
  "office_manager"
];

const privilegedBackOfficeRoles = new Set<UserRole>(["owner", "office_admin"]);
const managedUserEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPrivilegedBackOfficeRole(role: UserRole) {
  return privilegedBackOfficeRoles.has(role);
}

function canManageSensitiveUserAccess(permissionKeys: string[]) {
  return permissionKeys.includes("settings:manage");
}

function canManageUserLifecycle(permissionKeys: string[]) {
  return permissionKeys.includes("users:manage") || canManageSensitiveUserAccess(permissionKeys);
}

function assertActorCanManageUsers(permissionKeys: string[]) {
  if (!canManageUserLifecycle(permissionKeys)) {
    throw new Error("User management permission is required.");
  }
}

function assertActorCanAssignPrivilegedRole(permissionKeys: string[], role: UserRole) {
  if (isPrivilegedBackOfficeRole(role) && !canManageSensitiveUserAccess(permissionKeys)) {
    throw new Error("Only Owner / Office Admin can assign Owner or Office Admin roles.");
  }
}

function assertActorCanManagePrivilegedMembership(permissionKeys: string[], role: UserRole) {
  if (isPrivilegedBackOfficeRole(role) && !canManageSensitiveUserAccess(permissionKeys)) {
    throw new Error("Only Owner / Office Admin can manage Owner or Office Admin accounts.");
  }
}

const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Inactive"
};

const contactRoleLabelMap: Record<TransactionContactRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  co_buyer: "Co-buyer",
  co_seller: "Co-seller",
  tenant: "Tenant",
  landlord: "Landlord",
  other: "Other"
};

const transactionTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales listing",
  rental_leasing: "Rental leasing",
  rental_listing: "Rental listing",
  commercial_sales: "Commercial sales",
  commercial_lease: "Commercial lease",
  other: "Other"
};

type BuiltInSelectOptionCatalogEntry = {
  value: string;
  label: string;
};

const transactionIntakeBuiltInFieldCatalog: Array<{
  key: TransactionFieldKey;
  label: string;
  inputName: string;
  section: "top" | "primary";
  control: "text" | "date" | "select";
  className?: string;
  options?: BuiltInSelectOptionCatalogEntry[];
}> = [
  {
    key: "transaction_type",
    label: "Type",
    inputName: "transactionType",
    section: "top",
    control: "select",
    options: [
      { value: "sales", label: "Sales" },
      { value: "sales_listing", label: "Sales (listing)" },
      { value: "rental_leasing", label: "Rental/Leasing" },
      { value: "rental_listing", label: "Rental (listing)" },
      { value: "commercial_sales", label: "Commercial Sales" },
      { value: "commercial_lease", label: "Commercial Lease" },
      { value: "other", label: "Other" }
    ]
  },
  {
    key: "transaction_status",
    label: "Status",
    inputName: "transactionStatus",
    section: "top",
    control: "select",
    options: [
      { value: "opportunity", label: "Opportunity" },
      { value: "active", label: "Active" },
      { value: "pending", label: "Pending" },
      { value: "closed", label: "Closed" },
      { value: "cancelled", label: "Cancelled" }
    ]
  },
  {
    key: "representing",
    label: "Representing",
    inputName: "representing",
    section: "top",
    control: "select",
    options: [
      { value: "buyer", label: "Buyer" },
      { value: "seller", label: "Seller" },
      { value: "both", label: "Both" },
      { value: "tenant", label: "Tenant" },
      { value: "landlord", label: "Landlord" }
    ]
  },
  { key: "address", label: "Address", inputName: "address", section: "primary", control: "text" },
  { key: "city", label: "City", inputName: "city", section: "primary", control: "text" },
  { key: "state", label: "State", inputName: "state", section: "primary", control: "text", className: "is-compact" },
  { key: "zip_code", label: "Zip", inputName: "zipCode", section: "primary", control: "text", className: "is-compact" },
  { key: "transaction_name", label: "Transaction Name", inputName: "transactionName", section: "primary", control: "text", className: "is-span-4" },
  { key: "asking_price", label: "Asking Price", inputName: "askingPrice", section: "primary", control: "text" },
  { key: "purchased_price", label: "Purchased Price", inputName: "purchasedPrice", section: "primary", control: "text" },
  { key: "move_in_date", label: "Move-In Date", inputName: "moveInDate", section: "primary", control: "date" },
  { key: "buyer_agreement_date", label: "Buyer Agreement Date", inputName: "buyerAgreementDate", section: "primary", control: "date" },
  { key: "buyer_expiration_date", label: "Buyer Expiration Date", inputName: "buyerExpirationDate", section: "primary", control: "date" },
  { key: "acceptance_date", label: "Acceptance Date", inputName: "acceptanceDate", section: "primary", control: "date" },
  { key: "listing_date", label: "Listing Date", inputName: "listingDate", section: "primary", control: "date" },
  { key: "listing_expiration_date", label: "Listing Expiration Date", inputName: "listingExpirationDate", section: "primary", control: "date" },
  { key: "closing_date", label: "Closing Date", inputName: "closingDate", section: "primary", control: "date" }
];

const legacyCustomFieldSettingKeyMap: Partial<Record<string, TransactionFieldKey>> = {
  companyReferral: "company_referral",
  companyReferralEmployeeName: "company_referral_employee_name"
};

const defaultTransactionCustomFieldCatalog: Array<{
  fieldKey: string;
  label: string;
  type: TransactionCustomFieldType;
  sortOrder: number;
  options: string[];
}> = [
  { fieldKey: "agentName", label: "Agent Name", type: "text", sortOrder: 0, options: [] },
  { fieldKey: "teamLeader", label: "Team Leader", type: "select", sortOrder: 1, options: ["Simon Park", "Naomi Chen", "Alice Tang"] },
  { fieldKey: "licensedAgentName", label: "Licensed Agent Name", type: "text", sortOrder: 2, options: [] },
  { fieldKey: "invoiceNumber", label: "Invoice Number", type: "text", sortOrder: 3, options: [] },
  { fieldKey: "buyerTenant", label: "Buyer/Tenant", type: "text", sortOrder: 4, options: [] },
  { fieldKey: "buildingName", label: "Building Name", type: "text", sortOrder: 5, options: [] },
  { fieldKey: "additionalAddress", label: "Address", type: "text", sortOrder: 6, options: [] },
  { fieldKey: "unitNumber", label: "Unit # (If it's a house, fill out \"house\")", type: "text", sortOrder: 7, options: [] },
  { fieldKey: "layout", label: "Layout", type: "text", sortOrder: 8, options: [] },
  { fieldKey: "additionalCity", label: "City", type: "text", sortOrder: 9, options: [] },
  { fieldKey: "additionalState", label: "State", type: "text", sortOrder: 10, options: [] },
  { fieldKey: "additionalZipCode", label: "Zip Code", type: "text", sortOrder: 11, options: [] },
  { fieldKey: "moveInDateClosingDate", label: "Move-In Date/Closing Date", type: "text", sortOrder: 12, options: [] },
  { fieldKey: "commissionType", label: "Commission Type", type: "select", sortOrder: 13, options: ["Gross", "Net", "Custom"] },
  { fieldKey: "leasingContact", label: "Leasing Contact", type: "text", sortOrder: 14, options: [] },
  { fieldKey: "invoiceBillTo", label: "Invoice Bill To", type: "text", sortOrder: 15, options: [] },
  { fieldKey: "currencyType", label: "Currency Type", type: "select", sortOrder: 16, options: ["USD"] },
  { fieldKey: "commissionAmount", label: "Commission($)", type: "text", sortOrder: 17, options: [] },
  { fieldKey: "yourCommissionRate", label: "Your Commission Rate", type: "text", sortOrder: 18, options: [] },
  { fieldKey: "rebate", label: "Rebate", type: "text", sortOrder: 19, options: [] },
  { fieldKey: "reimbursement", label: "Reimbursement", type: "text", sortOrder: 20, options: [] },
  { fieldKey: "coAgentLegalName", label: "Co-Agent Legal Name", type: "text", sortOrder: 21, options: [] },
  { fieldKey: "commissionBreakdown", label: "Commission Breakdown", type: "text", sortOrder: 22, options: [] },
  { fieldKey: "companyReferral", label: "Company Referral", type: "select", sortOrder: 23, options: ["Yes", "No"] },
  { fieldKey: "outsideReferral", label: "Outside Referral", type: "select", sortOrder: 24, options: ["Yes", "No"] },
  { fieldKey: "referralFee", label: "Referral Fee", type: "text", sortOrder: 25, options: [] },
  { fieldKey: "externalPartners", label: "External Partners", type: "text", sortOrder: 26, options: [] },
  { fieldKey: "companyReferralEmployeeName", label: "Company Referral Employee's Name", type: "text", sortOrder: 27, options: [] },
  { fieldKey: "clientEmail", label: "Client's Email", type: "text", sortOrder: 28, options: [] },
  { fieldKey: "uploadInvoiceToVendorCafe", label: "Upload Invoice to VendorCafe", type: "select", sortOrder: 29, options: ["Yes", "No"] },
  { fieldKey: "note", label: "Note(Rebate, Referral, Others)", type: "text", sortOrder: 30, options: [] },
  { fieldKey: "commissionReceivedStatus", label: "Status of Commission Received(For Admin)", type: "select", sortOrder: 31, options: ["No", "Yes", "Partial"] },
  { fieldKey: "commissionConfirmation", label: "Commission Confirmation(For Agent, we'll process the payment once you select yes)", type: "select", sortOrder: 32, options: ["Yes", "No"] }
];

const activeDefaultTransactionCustomFieldCatalog = defaultTransactionCustomFieldCatalog.filter(
  (entry) => !retiredTransactionCustomFieldKeys.has(entry.fieldKey)
);

const contactRoleCatalog: Array<{ role: TransactionContactRole; label: string }> = [
  { role: "buyer", label: contactRoleLabelMap.buyer },
  { role: "seller", label: contactRoleLabelMap.seller },
  { role: "co_buyer", label: contactRoleLabelMap.co_buyer },
  { role: "co_seller", label: contactRoleLabelMap.co_seller },
  { role: "tenant", label: contactRoleLabelMap.tenant },
  { role: "landlord", label: contactRoleLabelMap.landlord },
  { role: "other", label: contactRoleLabelMap.other }
];

export type OfficeSettingsSummarySnapshot = {
  summary: {
    usersCount: number;
    activeUsersCount: number;
    inactiveUsersCount: number;
    teamsCount: number;
    requiredRoleCount: number;
    checklistTemplateCount: number;
  };
};

export type OfficeAdminUserRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleValue: UserRole;
  roleEditorValue: string;
  officeAccessLabel: string;
  officeAccessValue: string;
  defaultOfficeId: string | null;
  defaultOfficeName: string;
  accessibleOfficeIds: string[];
  accessibleOfficeNames: string[];
  hasAllOfficeAccess: boolean;
  status: string;
  statusValue: MembershipStatus;
  title: string;
  authStatusLabel: string;
  onboardingStatusLabel: string;
  onboardingStatusValue: AgentOnboardingStatus | null;
  lockStatusLabel: string;
  lockedUntilLabel: string;
  invitationStatusLabel: string;
  invitationExpiresAtLabel: string;
  hasCredential: boolean;
  hasActiveInvitation: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  href: string | null;
};

export type OfficeAdminUsersSnapshot = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    invitedUsers: number;
    disabledUsers: number;
    lockedUsers: number;
    pendingInvitationCount: number;
    allOfficeAccessCount: number;
  };
  filters: {
    q: string;
    role: string;
    status: string;
    officeId: string;
    commissionTemplateOptions: OfficeCommissionSplitTemplateOption[];
    roleOptions: Array<{ value: string; label: string }>;
    statusOptions: Array<{ value: string; label: string }>;
    officeOptions: Array<{ id: string; label: string }>;
  };
  createOptions: {
    assignableTeams: OfficeAdminAssignableTeam[];
    officeOptions: Array<{ id: string; label: string }>;
  };
  rows: OfficeAdminUserRow[];
};

export type OfficeAdminAssignableTeamManager = {
  teamMembershipId: string;
  membershipId: string;
  label: string;
  role: string;
  roleValue: TeamMembershipRole;
};

export type OfficeAdminAssignableTeam = {
  id: string;
  officeId: string | null;
  officeName: string;
  label: string;
  managerOptions: OfficeAdminAssignableTeamManager[];
  defaultReportsToTeamMembershipId: string | null;
};

export type OfficeAdminUserDetailActivityItem = {
  id: string;
  actionLabel: string;
  actorDisplayName: string;
  detail: string;
  timestampLabel: string;
  href: string | null;
};

export type OfficeAdminUserDetailSnapshot = {
  profile: {
    membershipId: string;
    userId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: string;
    roleValue: UserRole;
    status: string;
    statusValue: MembershipStatus;
    title: string;
    officeAccessLabel: string;
    officeAccessValue: string;
    officeName: string;
    defaultOfficeId: string | null;
    defaultOfficeName: string;
    accessibleOfficeIds: string[];
    accessibleOfficeNames: string[];
    hasAllOfficeAccess: boolean;
    authStatusLabel: string;
    invitationStatusLabel: string;
    invitationExpiresAtLabel: string;
    lockStatusLabel: string;
    lockedUntilLabel: string;
    hasCredential: boolean;
    hasActiveInvitation: boolean;
    isLocked: boolean;
    mustChangePassword: boolean;
    lastLoginAtLabel: string;
    lastFailedLoginAtLabel: string;
    passwordChangedAtLabel: string;
    createdAtLabel: string;
    onboardingStatusLabel: string;
    onboardingStatusValue: AgentOnboardingStatus;
    hasActiveTeamAssignments: boolean;
    hasActiveLeaderAssignments: boolean;
    teamSummary: string;
    agentProfileHref: string | null;
  };
  editors: {
    officeOptions: Array<{ id: string; label: string }>;
  };
  teams: Array<{
    id: string;
    teamMembershipId: string;
    name: string;
    teamPathLabel: string;
    rootLeaderLabel: string;
    roleLabel: string;
    roleValue: TeamMembershipRole;
    reportsToTeamMembershipId: string | null;
    reportsToLabel: string;
    isActive: boolean;
  }>;
  availableTeams: OfficeAdminAssignableTeam[];
  onboarding: {
    totalCount: number;
    completedCount: number;
    statusLabel: string;
    statusValue: AgentOnboardingStatus;
    items: Array<{
      id: string;
      title: string;
      category: string;
      statusLabel: string;
      statusValue: AgentOnboardingItemStatus;
      dueAtLabel: string;
      completedAtLabel: string;
    }>;
  };
  commission: OfficeAgentCommissionSummary;
  permissions: MembershipEffectivePermissionsSnapshot;
  companyPermissions: Array<{
    officeId: string;
    officeName: string;
    permissions: MembershipEffectivePermissionsSnapshot;
  }>;
  recentActivity: OfficeAdminUserDetailActivityItem[];
};

export type OfficeRequiredContactRoleRecord = {
  role: TransactionContactRole;
  label: string;
  isRequired: boolean;
};

export type OfficeTransactionBuiltInSelectOptionRecord = {
  value: string;
  label: string;
  isEnabled: boolean;
};

export type OfficeTransactionFieldSettingRecord = {
  fieldKey: TransactionFieldKey;
  inputName: string;
  label: string;
  section: "top" | "primary";
  control: "text" | "date" | "select";
  className: string;
  options: string[];
  selectOptions: OfficeTransactionBuiltInSelectOptionRecord[];
  isRequired: boolean;
  isVisible: boolean;
  isLockedRequired: boolean;
  isLockedVisible: boolean;
};

export type OfficeTransactionCustomFieldDefinitionRecord = {
  id: string | null;
  fieldKey: string;
  inputName: string;
  label: string;
  type: TransactionCustomFieldType;
  isRequired: boolean;
  isVisible: boolean;
  sortOrder: number;
  options: string[];
  isDefault: boolean;
};

export type OfficeTransactionIntakeSchema = {
  summary: {
    builtInFieldCount: number;
    visibleBuiltInFieldCount: number;
    requiredBuiltInFieldCount: number;
    customFieldCount: number;
    visibleCustomFieldCount: number;
    requiredCustomFieldCount: number;
  };
  builtInFields: OfficeTransactionFieldSettingRecord[];
  customFields: OfficeTransactionCustomFieldDefinitionRecord[];
};

export type OfficeFieldSettingsSnapshot = {
  summary: {
    requiredRoleCount: number;
    requiredFieldCount: number;
    visibleFieldCount: number;
  };
  contactRoleSettings: OfficeRequiredContactRoleRecord[];
  transactionFieldSettings: OfficeTransactionFieldSettingRecord[];
  transactionCustomFieldDefinitions: OfficeTransactionCustomFieldDefinitionRecord[];
  transactionIntakeSchema: OfficeTransactionIntakeSchema;
};

export type OfficeChecklistTemplateItemRecord = {
  id: string;
  checklistGroup: string;
  title: string;
  description: string;
  dueDaysOffset: string;
  sortOrder: number;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
};

export type OfficeChecklistTemplateRecord = {
  id: string;
  name: string;
  description: string;
  transactionTypeLabel: string;
  transactionTypeValue: string;
  isActive: boolean;
  itemCount: number;
  createdByName: string;
  updatedByName: string;
  items: OfficeChecklistTemplateItemRecord[];
};

export type OfficeChecklistTemplatesSnapshot = {
  summary: {
    totalTemplates: number;
    activeTemplates: number;
    totalItems: number;
  };
  transactionTypeOptions: Array<{ value: string; label: string }>;
  templates: OfficeChecklistTemplateRecord[];
};

export type GetOfficeAdminUsersInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  q?: string;
  role?: string;
  status?: string;
  officeFilterId?: string;
};

export type GetOfficeAdminUserDetailInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  viewerMembershipId?: string | null;
};

export type UpdateOfficeAdminUserInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
  viewerOfficeId?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  status?: string;
  defaultOfficeId?: string | null;
  accessibleOfficeIds?: string[];
  officeId?: string | null;
};

export type SaveOfficeFieldSettingsInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  contactRoleSettings: Array<{
    role: string;
    isRequired: boolean;
  }>;
  transactionFieldSettings: Array<{
    fieldKey: string;
    isRequired: boolean;
    isVisible: boolean;
    selectOptions?: Array<{
      value: string;
      label: string;
      isEnabled: boolean;
    }>;
  }>;
  transactionCustomFieldDefinitions?: Array<{
    fieldKey: string;
    label?: string;
    type?: string;
    isRequired: boolean;
    isVisible: boolean;
    sortOrder?: number;
    options?: string[];
  }>;
};

export type CreateOfficeTransactionCustomFieldDefinitionInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  label: string;
  type: string;
  isRequired?: boolean;
  isVisible?: boolean;
  options?: string[];
};

export type UpdateOfficeTransactionCustomFieldDefinitionInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  fieldKey: string;
  label?: string;
  type?: string;
  isRequired?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
  options?: string[];
};

export type ChecklistTemplateItemInput = {
  checklistGroup?: string;
  title?: string;
  description?: string;
  dueDaysOffset?: string;
  sortOrder?: number;
  requiresDocument?: boolean;
  requiresDocumentApproval?: boolean;
  requiresSecondaryApproval?: boolean;
};

export type CreateChecklistTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  name: string;
  description?: string;
  transactionType?: string;
  isActive?: boolean;
  items: ChecklistTemplateItemInput[];
};

export type UpdateChecklistTemplateInput = CreateChecklistTemplateInput & {
  templateId: string;
};

function buildChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue ? null : { label, previousValue, nextValue };
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredText(
  value: string | undefined,
  label: string,
  fallback: string,
) {
  if (value === undefined) {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

function normalizeManagedUserEmail(value: string | undefined, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    throw new Error("Email is required.");
  }

  if (!managedUserEmailPattern.test(trimmed)) {
    throw new Error("Email must be a valid email address.");
  }

  return trimmed;
}

function parseOptionalInteger(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`;
}

function formatMembershipStatusLabel(status: MembershipStatus) {
  return membershipStatusLabelMap[status];
}

function formatUserRoleLabel(role: UserRole) {
  return role === "office_manager"
    ? "Office Manager (Legacy)"
    : role === "office_user"
      ? "Office User (Legacy)"
      : userRoleLabelMap[role];
}

function formatOfficeAccessLabel(input: {
  allOffices: readonly OfficeScopeRecord[];
  role: UserRole;
  defaultOfficeId: string | null;
  officeAccesses?: readonly MembershipOfficeAccessRecord[];
}) {
  const accessibleOffices = resolveMembershipAccessibleOffices({
    role: input.role,
    allOffices: input.allOffices,
    defaultOfficeId: input.defaultOfficeId,
    officeAccesses: input.officeAccesses,
  });

  if (accessibleOffices.length === 0) {
    return "No companies";
  }

  if (accessibleOffices.length === input.allOffices.length) {
    return "All companies";
  }

  const defaultOffice = resolveCurrentOfficeSelection({
    defaultOfficeId: input.defaultOfficeId,
    accessibleOffices,
  });

  if (accessibleOffices.length === 1) {
    return accessibleOffices[0]?.name ?? "No companies";
  }

  return `${defaultOffice?.name ?? accessibleOffices[0]?.name ?? "Company"} +${accessibleOffices.length - 1} more`;
}

function buildMembershipOfficeScope(input: {
  allOffices: readonly OfficeScopeRecord[];
  role: UserRole;
  defaultOfficeId: string | null;
  officeAccesses?: readonly MembershipOfficeAccessRecord[];
}) {
  const accessibleOffices = resolveMembershipAccessibleOffices({
    role: input.role,
    allOffices: input.allOffices,
    defaultOfficeId: input.defaultOfficeId,
    officeAccesses: input.officeAccesses,
  });
  const defaultOffice = resolveCurrentOfficeSelection({
    defaultOfficeId: input.defaultOfficeId,
    accessibleOffices,
  });

  return {
    accessibleOffices,
    accessibleOfficeIds: accessibleOffices.map((office) => office.id),
    accessibleOfficeNames: accessibleOffices.map((office) => office.name),
    defaultOffice,
    defaultOfficeId: defaultOffice?.id ?? null,
    defaultOfficeName: defaultOffice?.name ?? "No companies",
    hasAllOfficeAccess: accessibleOffices.length > 0 && accessibleOffices.length === input.allOffices.length,
    officeAccessLabel: formatOfficeAccessLabel(input),
    officeAccessValue: accessibleOffices.length > 0 && accessibleOffices.length === input.allOffices.length
      ? "__all__"
      : defaultOffice?.id ?? accessibleOffices[0]?.id ?? "__none__",
    hasImplicitAllOfficeAccess: roleHasImplicitAllOfficeAccess(input.role),
  };
}

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isBackOfficeUserRole(role: UserRole) {
  return backOfficeUserRoleCatalog.includes(role);
}

function formatOnboardingStatusLabel(status: AgentOnboardingStatus) {
  if (status === "complete") {
    return "Complete";
  }

  if (status === "in_progress") {
    return "In progress";
  }

  return "Not started";
}

function formatOnboardingItemStatusLabel(status: AgentOnboardingItemStatus) {
  if (status === "in_progress") {
    return "In progress";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "reopened") {
    return "Reopened";
  }

  return "Pending";
}

function formatActionLabel(action: string) {
  const segments = action.split(".");
  const raw = segments[segments.length - 1] ?? action;

  return raw
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getJsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function getJsonStringArray(value: Prisma.JsonValue | undefined) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function getActivityDetailSummary(payload: Prisma.JsonValue | null) {
  const data = getJsonObject(payload);

  if (!data) {
    return "No additional detail recorded.";
  }

  const details = getJsonStringArray(data.details);
  if (details.length > 0) {
    return details[0]!;
  }

  const objectLabel = typeof data.objectLabel === "string" ? data.objectLabel.trim() : "";
  if (objectLabel) {
    return objectLabel;
  }

  const changes = Array.isArray(data.changes) ? data.changes : [];
  const firstChange = changes[0];
  if (firstChange && typeof firstChange === "object" && !Array.isArray(firstChange)) {
    const label = typeof firstChange.label === "string" ? firstChange.label.trim() : "";
    const previousValue = typeof firstChange.previousValue === "string" ? firstChange.previousValue.trim() : "";
    const nextValue = typeof firstChange.nextValue === "string" ? firstChange.nextValue.trim() : "";

    if (label || previousValue || nextValue) {
      return `${label || "Updated"}: ${previousValue || "—"} -> ${nextValue || "—"}`;
    }
  }

  return "No additional detail recorded.";
}

function getActivityHref(payload: Prisma.JsonValue | null) {
  const data = getJsonObject(payload);
  return data && typeof data.contextHref === "string" && data.contextHref.trim() ? data.contextHref : null;
}

function mapOfficeAdminUserRow(membership: {
  id: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  title: string | null;
  teamMemberships?: Array<{
    id?: string;
    membershipId?: string;
    role: TeamMembershipRole;
    teamPathLabel?: string;
    reportsToTeamMembershipId?: string | null;
    team: {
      id?: string;
      name: string;
      isActive: boolean;
      parentTeamId?: string | null;
    };
  }>;
  officeId: string | null;
  office: { name: string } | null;
  officeAccesses?: MembershipOfficeAccessRecord[];
  allOffices: OfficeScopeRecord[];
  user: {
    email: string;
    firstName: string;
    lastName: string;
    credential: {
      mustChangePassword: boolean;
      lockedUntil: Date | null;
    } | null;
  };
  agentProfile?: {
    onboardingStatus: AgentOnboardingStatus;
  } | null;
  invitations: Array<{
    expiresAt: Date;
  }>;
}): OfficeAdminUserRow {
  const pendingInvitation = membership.invitations[0] ?? null;
  const isLocked = Boolean(membership.user.credential?.lockedUntil && membership.user.credential.lockedUntil > new Date());
  const hasCredential = Boolean(membership.user.credential);
  const name = `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
  const mustChangePassword = membership.user.credential?.mustChangePassword ?? false;
  const officeScope = buildMembershipOfficeScope({
    allOffices: membership.allOffices,
    role: membership.role,
    defaultOfficeId: membership.officeId,
    officeAccesses: membership.officeAccesses,
  });

  let authStatusLabel = "Setup required";
  if (mustChangePassword) {
    authStatusLabel = "Password change required";
  } else if (hasCredential) {
    authStatusLabel = "Password set";
  } else if (membership.status === "invited") {
    authStatusLabel = "Pending password setup";
  }

  let invitationStatusLabel = "Not issued";
  if (pendingInvitation) {
    invitationStatusLabel = "Pending";
  } else if (membership.status === "invited") {
    invitationStatusLabel = "Reissue needed";
  } else if (hasCredential) {
    invitationStatusLabel = "Complete";
  } else {
    invitationStatusLabel = "Setup required";
  }

  return {
    membershipId: membership.id,
    userId: membership.userId,
    name,
    email: membership.user.email,
    role: formatUserRoleLabel(membership.role),
    roleValue: membership.role,
    roleEditorValue: membership.role,
    officeAccessLabel: officeScope.officeAccessLabel,
    officeAccessValue: officeScope.officeAccessValue,
    defaultOfficeId: officeScope.defaultOfficeId,
    defaultOfficeName: officeScope.defaultOfficeName,
    accessibleOfficeIds: officeScope.accessibleOfficeIds,
    accessibleOfficeNames: officeScope.accessibleOfficeNames,
    hasAllOfficeAccess: officeScope.hasAllOfficeAccess,
    status: formatMembershipStatusLabel(membership.status),
    statusValue: membership.status,
    title: resolveMembershipDisplayTitle({
      role: membership.role,
      fallbackTitle: membership.title,
      teamMemberships: membership.teamMemberships ?? []
    }),
    authStatusLabel,
    onboardingStatusLabel: membership.agentProfile ? formatOnboardingStatusLabel(membership.agentProfile.onboardingStatus) : "—",
    onboardingStatusValue: membership.agentProfile?.onboardingStatus ?? null,
    lockStatusLabel: isLocked ? "Locked" : "Not locked",
    lockedUntilLabel: formatDateTimeLabel(membership.user.credential?.lockedUntil),
    invitationStatusLabel,
    invitationExpiresAtLabel: formatDateTimeLabel(pendingInvitation?.expiresAt),
    hasCredential,
    hasActiveInvitation: Boolean(pendingInvitation),
    isLocked,
    mustChangePassword,
    href: `/office/settings/users/${membership.id}`
  };
}

function hasActiveLeaderAssignments(
  teamMemberships:
    | Array<{
        role: TeamMembershipRole;
        team: {
          isActive: boolean;
        };
      }>
    | undefined
) {
  return (teamMemberships ?? []).some((teamMembership) => teamMembership.team.isActive && isLeaderTeamMembershipRole(teamMembership.role));
}

function hasActiveTeamAssignments(
  teamMemberships:
    | Array<{
        role: TeamMembershipRole;
        team: {
          isActive: boolean;
        };
      }>
    | undefined
) {
  return (teamMemberships ?? []).some((teamMembership) => teamMembership.team.isActive);
}

function normalizeUserRole(value: string | undefined): UserRole | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value === "owner" ||
    value === "office_admin" ||
    value === "accountant" ||
    value === "human_resources" ||
    value === "team_lead" ||
    value === "agent" ||
    value === "office_manager" ||
    value === "office_user"
  ) {
    return value;
  }

  throw new Error("A valid user role is required.");
}

function normalizeMembershipStatus(value: string | undefined): MembershipStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "active" || value === "invited" || value === "disabled") {
    return value;
  }

  throw new Error("A valid membership status is required.");
}

function normalizeContactRole(value: string): TransactionContactRole {
  if (
    value === "buyer" ||
    value === "seller" ||
    value === "co_buyer" ||
    value === "co_seller" ||
    value === "tenant" ||
    value === "landlord" ||
    value === "other"
  ) {
    return value;
  }

  throw new Error("A valid contact role is required.");
}

function normalizeTransactionFieldKey(value: string): TransactionFieldKey {
  if (
    value === "transaction_type" ||
    value === "transaction_status" ||
    value === "representing" ||
    value === "address" ||
    value === "city" ||
    value === "state" ||
    value === "zip_code" ||
    value === "transaction_name" ||
    value === "asking_price" ||
    value === "purchased_price" ||
    value === "price" ||
    value === "move_in_date" ||
    value === "buyer_agreement_date" ||
    value === "important_date" ||
    value === "closing_date" ||
    value === "buyer_expiration_date" ||
    value === "acceptance_date" ||
    value === "listing_date" ||
    value === "listing_expiration_date" ||
    value === "company_referral" ||
    value === "company_referral_employee_name"
  ) {
    return value;
  }

  throw new Error("A valid transaction field key is required.");
}

function normalizeTransactionCustomFieldType(value: string): TransactionCustomFieldType {
  if (value === "text" || value === "select" || value === "date") {
    return value;
  }

  throw new Error("A valid transaction custom field type is required.");
}

function normalizeTransactionCustomFieldKey(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error("A valid transaction custom field key is required.");
  }

  return trimmed;
}

function normalizeTransactionType(value: string | undefined): TransactionType | null {
  if (!value) {
    return null;
  }

  if (
    value === "sales" ||
    value === "sales_listing" ||
    value === "rental_leasing" ||
    value === "rental_listing" ||
    value === "commercial_sales" ||
    value === "commercial_lease" ||
    value === "other"
  ) {
    return value;
  }

  throw new Error("A valid checklist transaction context is required.");
}

function normalizeTransactionCustomFieldOptions(type: TransactionCustomFieldType, options: string[] | undefined) {
  if (type !== "select") {
    return [];
  }

  const normalizedOptions = (options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);

  if (!normalizedOptions.length) {
    throw new Error("Select fields require at least one option.");
  }

  return Array.from(new Set(normalizedOptions));
}

function readTransactionCustomFieldOptions(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function getTransactionBuiltInFieldCatalogEntry(fieldKey: TransactionFieldKey) {
  return transactionIntakeBuiltInFieldCatalog.find((entry) => entry.key === fieldKey) ?? null;
}

function getTransactionBuiltInSelectCatalogOptions(fieldKey: TransactionFieldKey) {
  const catalogEntry = getTransactionBuiltInFieldCatalogEntry(fieldKey);

  return catalogEntry?.control === "select" ? catalogEntry.options ?? [] : [];
}

function normalizeTransactionBuiltInSelectOptionValue(fieldKey: TransactionFieldKey, value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const option = getTransactionBuiltInSelectCatalogOptions(fieldKey).find(
    (entry) => entry.value === trimmed || entry.label === trimmed
  );

  return option?.value ?? null;
}

function readTransactionBuiltInSelectOptions(
  fieldKey: TransactionFieldKey,
  value: Prisma.JsonValue | null | undefined
): OfficeTransactionBuiltInSelectOptionRecord[] {
  const catalogOptions = getTransactionBuiltInSelectCatalogOptions(fieldKey);

  if (!catalogOptions.length) {
    return [];
  }

  if (!Array.isArray(value)) {
    return catalogOptions.map((option) => ({
      value: option.value,
      label: option.label,
      isEnabled: true
    }));
  }

  const persistedOptions = new Map<string, { label: string }>();

  for (const entry of value) {
    if (typeof entry === "string") {
      const normalizedValue = normalizeTransactionBuiltInSelectOptionValue(fieldKey, entry);

      if (normalizedValue) {
        const defaultOption = catalogOptions.find((option) => option.value === normalizedValue);
        persistedOptions.set(normalizedValue, { label: defaultOption?.label ?? normalizedValue });
      }

      continue;
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const optionRecord = entry as Record<string, Prisma.JsonValue>;
    const normalizedValue = normalizeTransactionBuiltInSelectOptionValue(
      fieldKey,
      typeof optionRecord.value === "string" ? optionRecord.value : typeof optionRecord.label === "string" ? optionRecord.label : undefined
    );

    if (!normalizedValue) {
      continue;
    }

    const defaultOption = catalogOptions.find((option) => option.value === normalizedValue);
    const nextLabel = typeof optionRecord.label === "string" && optionRecord.label.trim() ? optionRecord.label.trim() : defaultOption?.label ?? normalizedValue;
    persistedOptions.set(normalizedValue, { label: nextLabel });
  }

  return catalogOptions.map((option) => ({
    value: option.value,
    label: persistedOptions.get(option.value)?.label ?? option.label,
    isEnabled: persistedOptions.has(option.value)
  }));
}

function normalizeTransactionBuiltInSelectOptions(
  fieldKey: TransactionFieldKey,
  options:
    | Array<{
        value: string;
        label: string;
        isEnabled: boolean;
      }>
    | undefined,
  fallbackOptions: OfficeTransactionBuiltInSelectOptionRecord[]
) {
  const catalogOptions = getTransactionBuiltInSelectCatalogOptions(fieldKey);

  if (!catalogOptions.length) {
    return [] as Array<{ value: string; label: string }>;
  }

  const sourceOptions = options ?? fallbackOptions;
  const normalizedOptions: Array<{ value: string; label: string }> = [];
  const seenValues = new Set<string>();

  for (const option of sourceOptions) {
    if (!option.isEnabled) {
      continue;
    }

    const normalizedValue = normalizeTransactionBuiltInSelectOptionValue(fieldKey, option.value);

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    const defaultOption = catalogOptions.find((entry) => entry.value === normalizedValue);
    const normalizedLabel = option.label.trim() || defaultOption?.label || normalizedValue;

    normalizedOptions.push({
      value: normalizedValue,
      label: normalizedLabel
    });
    seenValues.add(normalizedValue);
  }

  return normalizedOptions;
}

function formatTransactionBuiltInSelectOptions(options: Array<{ value: string; label: string }>) {
  return options.map((option) => `${option.label} [${option.value}]`).join(", ") || "—";
}

function slugifyTransactionCustomFieldLabel(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) {
    throw new Error("Field label is required.");
  }

  return `custom_${slug}`;
}

function buildOfficeTransactionBuiltInFieldRecord(input: {
  fieldKey: TransactionFieldKey;
  isRequired: boolean;
  isVisible: boolean;
  options?: Prisma.JsonValue | null;
  isLockedRequired?: boolean;
  isLockedVisible?: boolean;
}): OfficeTransactionFieldSettingRecord {
  const catalogEntry = getTransactionBuiltInFieldCatalogEntry(input.fieldKey);

  if (!catalogEntry) {
    throw new Error("Unsupported transaction built-in field.");
  }

  const selectOptions = catalogEntry.control === "select" ? readTransactionBuiltInSelectOptions(input.fieldKey, input.options) : [];

  return {
    fieldKey: catalogEntry.key,
    inputName: catalogEntry.inputName,
    label: catalogEntry.label,
    section: catalogEntry.section,
    control: catalogEntry.control,
    className: catalogEntry.className ?? "",
    options: selectOptions.filter((option) => option.isEnabled).map((option) => option.value),
    selectOptions,
    isRequired: input.isRequired,
    isVisible: input.isVisible,
    isLockedRequired: Boolean(input.isLockedRequired),
    isLockedVisible: Boolean(input.isLockedVisible)
  };
}

function buildOfficeTransactionCustomFieldRecord(input: {
  id?: string | null;
  fieldKey: string;
  label: string;
  type: TransactionCustomFieldType;
  isRequired: boolean;
  isVisible: boolean;
  sortOrder: number;
  options?: string[];
  isDefault: boolean;
}): OfficeTransactionCustomFieldDefinitionRecord {
  return {
    id: input.id ?? null,
    fieldKey: input.fieldKey,
    inputName: input.fieldKey,
    label: input.label,
    type: input.type,
    isRequired: input.isRequired,
    isVisible: input.isVisible,
    sortOrder: input.sortOrder,
    options: input.options ?? [],
    isDefault: input.isDefault
  };
}

function applyTransactionIdentityFallback(
  builtInFields: OfficeTransactionFieldSettingRecord[]
): OfficeTransactionFieldSettingRecord[] {
  const addressFieldKeys = new Set<TransactionFieldKey>(["address", "city", "state", "zip_code"]);
  const isAddressGroupHidden = builtInFields
    .filter((entry) => addressFieldKeys.has(entry.fieldKey))
    .every((entry) => !entry.isVisible);

  if (!isAddressGroupHidden) {
    return builtInFields;
  }

  return builtInFields.map((entry) =>
    entry.fieldKey === "transaction_name"
      ? {
          ...entry,
          isRequired: true,
          isVisible: true,
          isLockedRequired: true,
          isLockedVisible: true
        }
      : entry
  );
}

function buildLegacyCustomFieldFallbackState(
  fieldKey: string,
  transactionFieldSettingsMap: Map<TransactionFieldKey, { isRequired: boolean; isVisible: boolean }>
) {
  const legacyKey = legacyCustomFieldSettingKeyMap[fieldKey];

  if (!legacyKey) {
    return null;
  }

  return transactionFieldSettingsMap.get(legacyKey) ?? null;
}

function mapChecklistTemplateRecord(
  template: {
    id: string;
    name: string;
    description: string | null;
    transactionType: TransactionType | null;
    isActive: boolean;
    items: Array<{
      id: string;
      checklistGroup: string;
      title: string;
      description: string | null;
      dueDaysOffset: number | null;
      sortOrder: number;
      requiresDocument: boolean;
      requiresDocumentApproval: boolean;
      requiresSecondaryApproval: boolean;
    }>;
    createdByMembership: { user: { firstName: string; lastName: string } } | null;
    updatedByMembership: { user: { firstName: string; lastName: string } } | null;
  }
): OfficeChecklistTemplateRecord {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    transactionTypeLabel: template.transactionType ? transactionTypeLabelMap[template.transactionType] : "Office default",
    transactionTypeValue: template.transactionType ?? "",
    isActive: template.isActive,
    itemCount: template.items.length,
    createdByName: template.createdByMembership ? formatMembershipLabel(template.createdByMembership) : "System",
    updatedByName: template.updatedByMembership ? formatMembershipLabel(template.updatedByMembership) : "System",
    items: template.items.map((item) => ({
      id: item.id,
      checklistGroup: item.checklistGroup,
      title: item.title,
      description: item.description ?? "",
      dueDaysOffset: item.dueDaysOffset === null ? "" : String(item.dueDaysOffset),
      sortOrder: item.sortOrder,
      requiresDocument: item.requiresDocument,
      requiresDocumentApproval: item.requiresDocumentApproval,
      requiresSecondaryApproval: item.requiresSecondaryApproval
    }))
  };
}

function buildChecklistTemplateItems(items: ChecklistTemplateItemInput[]) {
  const normalizedItems = items
    .map((item, index) => ({
      checklistGroup: parseOptionalText(item.checklistGroup) ?? "General",
      title: item.title?.trim() ?? "",
      description: parseOptionalText(item.description),
      dueDaysOffset: parseOptionalInteger(item.dueDaysOffset),
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
      requiresDocument: Boolean(item.requiresDocument),
      requiresDocumentApproval: Boolean(item.requiresDocumentApproval),
      requiresSecondaryApproval: Boolean(item.requiresSecondaryApproval)
    }))
    .filter((item) => item.title.length > 0);

  if (!normalizedItems.length) {
    throw new Error("At least one checklist task row is required.");
  }

  return normalizedItems;
}

export async function getOfficeSettingsSummarySnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeSettingsSummarySnapshot> {
  const [membershipSummary, teamCount, requiredRoleCount, checklistTemplateCount] = await Promise.all([
    prisma.membership.groupBy({
      by: ["status"],
      where: {
        organizationId: input.organizationId
      },
      _count: {
        _all: true
      }
    }),
    prisma.team.count({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      }
    }),
    prisma.requiredContactRoleSetting.count({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        isRequired: true
      }
    }),
    prisma.checklistTemplate.count({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    })
  ]);

  const totalUsers = membershipSummary.reduce((sum, entry) => sum + entry._count._all, 0);
  const activeUsers = membershipSummary.find((entry) => entry.status === "active")?._count._all ?? 0;
  const inactiveUsers = totalUsers - activeUsers;

  return {
    summary: {
      usersCount: totalUsers,
      activeUsersCount: activeUsers,
      inactiveUsersCount: inactiveUsers,
      teamsCount: teamCount,
      requiredRoleCount,
      checklistTemplateCount
    }
  };
}

export async function getOfficeAdminUsersSnapshot(input: GetOfficeAdminUsersInput): Promise<OfficeAdminUsersSnapshot> {
  const officeFilterId = input.officeFilterId?.trim() ?? "";
  const currentOfficeId = input.officeId?.trim() ?? "";
  const effectiveOfficeFilterId =
    officeFilterId === "__all__" ||
    !currentOfficeId ||
    officeFilterId === currentOfficeId
      ? officeFilterId || currentOfficeId
      : currentOfficeId;
  const roleFilter = normalizeUserRole(input.role);
  const q = input.q?.trim() ?? "";
  const statusFilter = input.status?.trim() ?? "";
  const now = new Date();

  const where: Prisma.MembershipWhereInput = {
    organizationId: input.organizationId,
    role: {
      in: backOfficeUserRoleCatalog
    }
  };

  if (roleFilter) {
    where.role = roleFilter;
  }

  if (statusFilter === "active" || statusFilter === "invited" || statusFilter === "disabled") {
    where.status = statusFilter;
  } else if (statusFilter === "locked") {
    where.user = {
      is: {
        credential: {
          is: {
            lockedUntil: {
              gt: now
            }
          }
        }
      }
    };
  }

  if (q) {
    where.OR = [
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { title: { contains: q, mode: "insensitive" } },
      { office: { name: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [memberships, offices, teams, summary, commissionTemplateOptions, assignableTeams] = await Promise.all([
    prisma.membership.findMany({
      where,
      include: {
        user: {
          include: {
            credential: true
          }
        },
        agentProfile: {
          select: {
            onboardingStatus: true
          }
        },
        office: true,
        officeAccesses: {
          include: {
            office: {
              select: {
                id: true,
                name: true,
                slug: true,
                market: true,
                isPrimary: true
              }
            }
          }
        },
        teamMemberships: {
          select: {
            id: true,
            membershipId: true,
            role: true,
            reportsToTeamMembershipId: true,
            team: {
              select: {
                id: true,
                name: true,
                isActive: true,
                parentTeamId: true
              }
            }
          }
        },
        invitations: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: now
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        }
      },
      orderBy: [{ office: { name: "asc" } }, { user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true
      }
    }),
    prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        ...(effectiveOfficeFilterId && effectiveOfficeFilterId !== "__all__"
          ? { OR: [{ officeId: effectiveOfficeFilterId }, { officeId: null }] }
          : {})
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentTeamId: true
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: backOfficeUserRoleCatalog
        }
      },
      select: {
        id: true,
        status: true,
        officeId: true,
        role: true,
        title: true,
        userId: true,
        office: {
          select: {
            name: true
          }
        },
        officeAccesses: {
          include: {
            office: {
              select: {
                id: true,
                name: true,
                slug: true,
                market: true,
                isPrimary: true
              }
            }
          }
        },
        agentProfile: {
          select: {
            onboardingStatus: true
          }
        },
        teamMemberships: {
          select: {
            id: true,
            membershipId: true,
            role: true,
            reportsToTeamMembershipId: true,
            team: {
              select: {
                id: true,
                name: true,
                isActive: true,
                parentTeamId: true
              }
            }
          }
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            credential: {
              select: {
                mustChangePassword: true,
                lockedUntil: true
              }
            }
          }
        },
        invitations: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: now
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            expiresAt: true
          }
        }
      }
    }),
    listCommissionSplitTemplateOptions(
      input.organizationId,
      effectiveOfficeFilterId && effectiveOfficeFilterId !== "__all__"
        ? effectiveOfficeFilterId
        : null
    ),
    listOfficeAdminAssignableTeams({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null
    })
  ]);
  const teamHierarchyIndex = createTeamHierarchyIndex(teams);
  const withTeamPathLabels = <T extends { teamMemberships?: Array<{ team: { id?: string; name: string } }> }>(entry: T) => ({
    ...entry,
    teamMemberships: entry.teamMemberships?.map((teamMembership) => ({
      ...teamMembership,
      teamPathLabel: teamMembership.team.id ? buildTeamPathLabel(teamHierarchyIndex, teamMembership.team.id) || teamMembership.team.name : teamMembership.team.name
    }))
  });
  const matchesOfficeFilter = (
    membership: {
      role: UserRole;
      officeId: string | null;
      officeAccesses?: MembershipOfficeAccessRecord[];
    },
  ) => {
    if (!effectiveOfficeFilterId) {
      return true;
    }

    const officeScope = buildMembershipOfficeScope({
      allOffices: offices,
      role: membership.role,
      defaultOfficeId: membership.officeId,
      officeAccesses: membership.officeAccesses,
    });

    if (effectiveOfficeFilterId === "__all__") {
      return officeScope.hasAllOfficeAccess;
    }

    return officeScope.accessibleOfficeIds.includes(effectiveOfficeFilterId);
  };

  const summaryRows = summary.map((membership) =>
    mapOfficeAdminUserRow({
      ...withTeamPathLabels(membership),
      title: membership.title ?? null,
      allOffices: offices
    })
  );
  const scopedSummaryRows = summaryRows.filter((entry) => matchesOfficeFilter({
    role: entry.roleValue,
    officeId: entry.defaultOfficeId,
    officeAccesses: entry.accessibleOfficeIds.map((accessibleOfficeId) => {
      const office = offices.find((entry) => entry.id === accessibleOfficeId);

      if (!office) {
        throw new Error("Office access could not be resolved.");
      }

      return {
        officeId: accessibleOfficeId,
        office,
      };
    }),
  }));
  const totalUsers = scopedSummaryRows.length;
  const activeUsers = scopedSummaryRows.filter((entry) => entry.statusValue === "active").length;
  const invitedUsers = scopedSummaryRows.filter((entry) => entry.statusValue === "invited").length;
  const disabledUsers = scopedSummaryRows.filter((entry) => entry.statusValue === "disabled").length;
  const lockedUsers = scopedSummaryRows.filter((entry) => entry.isLocked).length;
  const pendingInvitationCount = scopedSummaryRows.filter((entry) => entry.hasActiveInvitation).length;
  const allOfficeAccessCount = scopedSummaryRows.filter((entry) => entry.officeAccessValue === "__all__").length;

  const roleOptions = [
    { value: "owner", label: "Owner" },
    { value: "office_admin", label: "Office Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "human_resources", label: "Human Resources" },
    { value: "team_lead", label: "Team Lead" },
    { value: "agent", label: "Agent" }
  ];

  if (summaryRows.some((entry) => entry.roleValue === "office_manager")) {
    roleOptions.push({ value: "office_manager", label: "Office Manager (Legacy)" });
  }

  if (summaryRows.some((entry) => entry.roleValue === "office_user")) {
    roleOptions.push({ value: "office_user", label: "Office User (Legacy)" });
  }

  const filteredMemberships = memberships.filter((membership) => matchesOfficeFilter(membership));
  const filterOfficeOptions =
    currentOfficeId && offices.some((office) => office.id === currentOfficeId)
      ? [
          { id: "__all__", label: "All companies" },
          ...offices
            .filter((office) => office.id === currentOfficeId)
            .map((office) => ({ id: office.id, label: office.name })),
        ]
      : [{ id: "__all__", label: "All companies" }, ...offices.map((office) => ({ id: office.id, label: office.name }))];

  return {
    summary: {
      totalUsers,
      activeUsers,
      invitedUsers,
      disabledUsers,
      lockedUsers,
      pendingInvitationCount,
      allOfficeAccessCount
    },
    filters: {
      q,
      role: roleFilter ?? "",
      status: statusFilter,
      officeId: effectiveOfficeFilterId,
      commissionTemplateOptions,
      roleOptions,
      statusOptions: [
        { value: "active", label: "Active" },
        { value: "invited", label: "Invited" },
        { value: "disabled", label: "Disabled" },
        { value: "locked", label: "Locked" }
      ],
      officeOptions: filterOfficeOptions,
    },
    createOptions: {
      assignableTeams,
      officeOptions: offices.map((office) => ({ id: office.id, label: office.name })),
    },
    rows: filteredMemberships.map((membership) =>
      mapOfficeAdminUserRow({
        ...withTeamPathLabels(membership),
        title: membership.title ?? null,
        allOffices: offices
      })
    )
  };
}

async function listOfficeAdminAssignableTeams(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
}): Promise<OfficeAdminAssignableTeam[]> {
  const permissionKeys = await getMembershipEffectivePermissionKeys({
    organizationId: input.organizationId,
    membershipId: input.viewerMembershipId
  });
  const canManageTeams = permissionKeys.includes("teams:manage");
  const scope = canManageTeams
    ? null
    : await resolveOfficeDataScope({
        organizationId: input.organizationId,
        viewerMembershipId: input.viewerMembershipId,
        officeId: input.officeId ?? null,
        resource: "agents"
      });

  if (scope?.visibleTeamIds !== null && scope?.visibleTeamIds.length === 0) {
    return [];
  }

  const teams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
      ...(scope?.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      parentTeamId: true,
      officeId: true,
      office: {
        select: {
          name: true
        }
      }
    },
    orderBy: [{ office: { name: "asc" } }, { name: "asc" }]
  });

  if (teams.length === 0) {
    return [];
  }

  const teamMemberships = await prisma.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      teamId: {
        in: teams.map((team) => team.id)
      }
    },
    include: {
      membership: {
        include: {
          user: true
        }
      }
    }
  });

  const hierarchy = buildTeamMembershipHierarchyMap({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      isActive: team.isActive,
      parentTeamId: team.parentTeamId ?? null
    })),
    teamMemberships: teamMemberships.map((teamMembership) => ({
      id: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      role: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      label: `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() || teamMembership.membership.user.email
    }))
  });
  const teamPathLabelMap = new Map(teams.map((team) => [team.id, buildTeamPathLabel(hierarchy.index, team.id) || team.name]));
  const teamManagerOptionsMap = new Map<string, OfficeAdminAssignableTeamManager[]>(
    teams.map((team) => {
      const managers = teamMemberships
        .filter(
          (teamMembership) =>
            teamMembership.teamId === team.id && isValidBranchLeaderRole(team.parentTeamId ?? null, teamMembership.role)
        )
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === "team_leader" ? -1 : 1;
          }

          const leftLabel = `${left.membership.user.firstName} ${left.membership.user.lastName}`.trim() || left.membership.user.email;
          const rightLabel = `${right.membership.user.firstName} ${right.membership.user.lastName}`.trim() || right.membership.user.email;
          return leftLabel.localeCompare(rightLabel);
        })
        .map((teamMembership) => ({
          teamMembershipId: teamMembership.id,
          membershipId: teamMembership.membershipId,
          label: `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() || teamMembership.membership.user.email,
          role: formatHierarchyRoleLabel(teamMembership.role),
          roleValue: teamMembership.role
        }));

      return [team.id, managers];
    })
  );

  return teams.map((team) => {
    const managerOptions = teamManagerOptionsMap.get(team.id) ?? [];
    const teamPathLabel = teamPathLabelMap.get(team.id) ?? team.name;

    return {
      id: team.id,
      officeId: team.officeId ?? null,
      officeName: team.office?.name ?? "All companies",
      label: formatAssignableTeamLabel(teamPathLabel, managerOptions.map((manager) => manager.label)),
      managerOptions,
      defaultReportsToTeamMembershipId: managerOptions.length === 1 ? managerOptions[0]?.teamMembershipId ?? null : null
    };
  });
}

function deriveOnboardingStatus(
  profileStatus: AgentOnboardingStatus | null | undefined,
  totalCount: number,
  completedCount: number
): AgentOnboardingStatus {
  if (profileStatus) {
    return profileStatus;
  }

  if (totalCount > 0 && completedCount >= totalCount) {
    return "complete";
  }

  if (completedCount > 0 || totalCount > 0) {
    return "in_progress";
  }

  return "not_started";
}

export async function getOfficeAdminUserDetailSnapshot(input: GetOfficeAdminUserDetailInput): Promise<OfficeAdminUserDetailSnapshot | null> {
  const now = new Date();

  const [membership, offices] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
        role: {
          in: backOfficeUserRoleCatalog
        }
      },
      include: {
        office: true,
        officeAccesses: {
          include: {
            office: {
              select: {
                id: true,
                name: true,
                slug: true,
                market: true,
                isPrimary: true
              }
            }
          }
        },
        user: {
          include: {
            credential: true
          }
        },
        agentProfile: true,
        invitations: {
          orderBy: [{ createdAt: "desc" }],
          take: 8
        },
        teamMemberships: {
          include: {
            team: true,
            reportsToTeamMembership: {
              include: {
                membership: {
                  include: {
                    user: true
                  }
                }
              }
            }
          },
          orderBy: [{ team: { name: "asc" } }, { createdAt: "asc" }]
        }
      }
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true
      }
    })
  ]);

  if (!membership) {
    return null;
  }

  const membershipOfficeScope = buildMembershipOfficeScope({
    allOffices: offices,
    role: membership.role,
    defaultOfficeId: membership.officeId,
    officeAccesses: membership.officeAccesses
  });

  if (
    input.officeId &&
    !membershipHasAccessToOffice({
      role: membership.role,
      allOffices: offices,
      defaultOfficeId: membership.officeId,
      officeAccesses: membership.officeAccesses,
      officeId: input.officeId,
    })
  ) {
    return null;
  }

  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(membershipOfficeScope.hasAllOfficeAccess
        ? {}
        : {
            OR: [{ officeId: null }, { officeId: { in: membershipOfficeScope.accessibleOfficeIds } }]
          })
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      parentTeamId: true
    },
    orderBy: [{ name: "asc" }]
  });
  const scopedTeamMemberships = scopedTeams.length
    ? await prisma.teamMembership.findMany({
        where: {
          organizationId: input.organizationId,
          teamId: {
            in: scopedTeams.map((team) => team.id)
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
    : [];
  const teamHierarchy = buildTeamMembershipHierarchyMap({
    teams: scopedTeams,
    teamMemberships: scopedTeamMemberships.map((teamMembership) => ({
      id: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      role: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      label: `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() || teamMembership.membership.user.email
    }))
  });
  const teamPathLabelMap = new Map(scopedTeams.map((team) => [team.id, buildTeamPathLabel(teamHierarchy.index, team.id) || team.name]));

  const activeInvitation =
    membership.invitations.find((invitation) => !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now) ?? null;

  const row = mapOfficeAdminUserRow({
    ...membership,
    title: membership.title ?? null,
    invitations: activeInvitation ? [{ expiresAt: activeInvitation.expiresAt }] : [],
    allOffices: offices
  });

  const activityEntityIds = [
    membership.id,
    membership.user.credential?.id ?? null,
    ...membership.invitations.map((invitation) => invitation.id)
  ].filter((value): value is string => Boolean(value));

  const [onboardingItems, recentActivity, commission, permissions, companyPermissions] = await Promise.all([
    prisma.agentOnboardingItem.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 8
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: input.organizationId,
        OR: [{ entityId: { in: activityEntityIds } }, { membershipId: input.membershipId }]
      },
      include: {
        membership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10
    }),
    getAgentCommissionSummary({
      organizationId: input.organizationId,
      officeId: membership.officeId,
      membershipId: input.membershipId
    }),
    getMembershipEffectivePermissions({
      organizationId: input.organizationId,
      membershipId: input.membershipId
    }),
    Promise.all(
      membershipOfficeScope.accessibleOffices.map(async (office) => ({
        officeId: office.id,
        officeName: office.name,
        permissions: await getMembershipEffectivePermissions({
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          officeId: office.id
        })
      }))
    )
  ]);
  const availableTeams = input.viewerMembershipId
    ? (await listOfficeAdminAssignableTeams({
        organizationId: input.organizationId,
        viewerMembershipId: input.viewerMembershipId,
        officeId: input.officeId ?? membership.officeId ?? null
      })).filter((team) => !membership.teamMemberships.some((teamMembership) => teamMembership.teamId === team.id))
    : [];

  const completedCount = onboardingItems.filter((item) => item.status === "completed").length;
  const onboardingStatusValue = deriveOnboardingStatus(membership.agentProfile?.onboardingStatus, onboardingItems.length, completedCount);
  const activeTeamAssignments = hasActiveTeamAssignments(membership.teamMemberships);
  const activeLeaderAssignments = hasActiveLeaderAssignments(membership.teamMemberships);
  const teamSummary = membership.teamMemberships.length
    ? membership.teamMemberships
        .map((teamMembership) => teamPathLabelMap.get(teamMembership.team.id) ?? teamMembership.team.name)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join(" • ")
    : "No team assignments";

  return {
    profile: {
      membershipId: membership.id,
      userId: membership.userId,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      name: row.name,
      email: membership.user.email,
      role: formatUserRoleLabel(membership.role),
      roleValue: membership.role,
      status: formatMembershipStatusLabel(membership.status),
      statusValue: membership.status,
      title: resolveMembershipDisplayTitle({
        role: membership.role,
        fallbackTitle: membership.title,
        teamMemberships: membership.teamMemberships.map((teamMembership) => ({
          ...teamMembership,
          teamPathLabel: teamPathLabelMap.get(teamMembership.team.id) ?? teamMembership.team.name
        }))
      }),
      officeAccessLabel: row.officeAccessLabel,
      officeAccessValue: row.officeAccessValue,
      officeName: row.defaultOfficeName,
      defaultOfficeId: row.defaultOfficeId,
      defaultOfficeName: row.defaultOfficeName,
      accessibleOfficeIds: row.accessibleOfficeIds,
      accessibleOfficeNames: row.accessibleOfficeNames,
      hasAllOfficeAccess: row.hasAllOfficeAccess,
      authStatusLabel: row.authStatusLabel,
      invitationStatusLabel: row.invitationStatusLabel,
      invitationExpiresAtLabel: row.invitationExpiresAtLabel,
      lockStatusLabel: row.lockStatusLabel,
      lockedUntilLabel: row.lockedUntilLabel,
      hasCredential: row.hasCredential,
      hasActiveInvitation: row.hasActiveInvitation,
      isLocked: row.isLocked,
      mustChangePassword: row.mustChangePassword,
      lastLoginAtLabel: formatDateTimeLabel(membership.user.credential?.lastLoginAt),
      lastFailedLoginAtLabel: formatDateTimeLabel(membership.user.credential?.lastFailedLoginAt),
      passwordChangedAtLabel: formatDateTimeLabel(membership.user.credential?.passwordChangedAt),
      createdAtLabel: formatDateLabel(membership.createdAt),
      onboardingStatusLabel: formatOnboardingStatusLabel(onboardingStatusValue),
      onboardingStatusValue,
      hasActiveTeamAssignments: activeTeamAssignments,
      hasActiveLeaderAssignments: activeLeaderAssignments,
      teamSummary,
      agentProfileHref: membership.agentProfile ? `/office/agents/${membership.id}` : null
    },
    editors: {
      officeOptions: [{ id: "__all__", label: "All companies" }, ...offices.map((office) => ({ id: office.id, label: office.name }))]
    },
    teams: membership.teamMemberships.map((teamMembership) => ({
      id: teamMembership.team.id,
      teamMembershipId: teamMembership.id,
      name: teamMembership.team.name,
      teamPathLabel: teamPathLabelMap.get(teamMembership.team.id) ?? teamMembership.team.name,
      rootLeaderLabel: teamHierarchy.hierarchyMap.get(teamMembership.id)?.rootLeader?.label ?? "—",
      roleLabel: formatHierarchyRoleLabel(teamMembership.role),
      roleValue: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      reportsToLabel:
        teamHierarchy.hierarchyMap.get(teamMembership.id)?.directManagerLabel ??
        (teamMembership.reportsToTeamMembership
          ? `${teamMembership.reportsToTeamMembership.membership.user.firstName} ${teamMembership.reportsToTeamMembership.membership.user.lastName}`.trim() ||
            teamMembership.reportsToTeamMembership.membership.user.email
          : "No direct manager"),
      isActive: teamMembership.team.isActive
    })),
    availableTeams,
    onboarding: {
      totalCount: onboardingItems.length,
      completedCount,
      statusLabel: formatOnboardingStatusLabel(onboardingStatusValue),
      statusValue: onboardingStatusValue,
      items: onboardingItems.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        statusLabel: formatOnboardingItemStatusLabel(item.status),
        statusValue: item.status,
        dueAtLabel: formatDateLabel(item.dueAt),
        completedAtLabel: formatDateTimeLabel(item.completedAt)
      }))
    },
    commission,
    permissions,
    companyPermissions,
    recentActivity: recentActivity.map((item) => ({
      id: item.id,
      actionLabel: formatActionLabel(item.action),
      actorDisplayName:
        item.membership?.user
          ? `${item.membership.user.firstName} ${item.membership.user.lastName}`.trim() || item.membership.user.email
          : "System",
      detail: getActivityDetailSummary(item.payload),
      timestampLabel: formatDateTimeLabel(item.createdAt),
      href: getActivityHref(item.payload)
    }))
  };
}

export async function updateOfficeAdminUser(input: UpdateOfficeAdminUserInput) {
  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId
      },
      tx
    );

    assertActorCanManageUsers(actorPermissionKeys);

    const membership = await tx.membership.findFirst({
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
        officeAccesses: {
          include: {
            office: {
              select: {
                id: true,
                name: true,
                slug: true,
                market: true,
                isPrimary: true
              }
            }
          }
        },
        teamMemberships: {
          select: {
            role: true,
            team: {
              select: {
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!membership) {
      throw new Error("User membership was not found.");
    }

    if (!isBackOfficeUserRole(membership.role)) {
      throw new Error("This membership cannot be managed from the Back Office users page.");
    }

    assertActorCanManagePrivilegedMembership(actorPermissionKeys, membership.role);

    const nextRole = normalizeUserRole(input.role) ?? membership.role;
    const nextStatus = normalizeMembershipStatus(input.status) ?? membership.status;
    const nextFirstName = normalizeRequiredText(
      input.firstName,
      "First name",
      membership.user.firstName,
    );
    const nextLastName = normalizeRequiredText(
      input.lastName,
      "Last name",
      membership.user.lastName,
    );
    const nextEmail = normalizeManagedUserEmail(input.email, membership.user.email);
    const nextUserLabel =
      `${nextFirstName} ${nextLastName}`.trim() || nextEmail;

    assertActorCanAssignPrivilegedRole(actorPermissionKeys, nextRole);

    if (nextRole === "office_manager" && membership.role !== "office_manager") {
      throw new Error("The legacy Office Manager role cannot be assigned from this page.");
    }

    if (nextRole === "office_user" && membership.role !== "office_user") {
      throw new Error("The legacy Office User role cannot be assigned from this page.");
    }

    if (!membership.user.credential && nextStatus === "active") {
      throw new Error("Invited users become active after they set a password.");
    }

    if (membership.user.credential && nextStatus === "invited") {
      throw new Error("Issue a password setup link instead of moving a password account back to invited.");
    }

    if (nextRole === "agent" && membership.role !== "agent" && hasActiveLeaderAssignments(membership.teamMemberships)) {
      throw new Error(
        "Remove or transfer this user's active Team / Junior Team leadership assignments in Settings > Teams before changing the account role to Agent."
      );
    }

    if (
      nextRole !== membership.role &&
      !isTeamHierarchyAssignableUserRole(nextRole) &&
      hasActiveTeamAssignments(membership.teamMemberships)
    ) {
      throw new Error(
        "Remove this user's active Team / Junior Team assignments in Settings > Teams before changing the account role to a non-agent role."
      );
    }

    const organizationOffices = await tx.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true
      }
    });
    const previousOfficeScope = buildMembershipOfficeScope({
      allOffices: organizationOffices,
      role: membership.role,
      defaultOfficeId: membership.officeId,
      officeAccesses: membership.officeAccesses
    });

    if (
      input.viewerOfficeId &&
      !membershipHasAccessToOffice({
        role: membership.role,
        allOffices: organizationOffices,
        defaultOfficeId: membership.officeId,
        officeAccesses: membership.officeAccesses,
        officeId: input.viewerOfficeId,
      })
    ) {
      throw new Error("This user is outside the current company scope.");
    }

    const selectedOfficeIds =
      input.accessibleOfficeIds ??
      previousOfficeScope.accessibleOfficeIds;
    const normalizedOfficeAssignment = resolveMembershipOfficeAssignment({
      role: nextRole,
      allOffices: organizationOffices,
      defaultOfficeId: input.defaultOfficeId ?? input.officeId ?? membership.officeId,
      selectedOfficeIds
    });
    const nextOfficeScope = buildMembershipOfficeScope({
      allOffices: organizationOffices,
      role: nextRole,
      defaultOfficeId: normalizedOfficeAssignment.defaultOfficeId,
      officeAccesses: normalizedOfficeAssignment.explicitOfficeIds.map((officeId) => {
        const office = organizationOffices.find((entry) => entry.id === officeId);

        if (!office) {
          throw new Error("Selected company was not found.");
        }

        return {
          officeId,
          office
        };
      })
    });
    const nextOfficeId = normalizedOfficeAssignment.defaultOfficeId;

    const previousRoleLabel = userRoleLabelMap[membership.role];
    const nextRoleLabel = userRoleLabelMap[nextRole];
    const previousStatusLabel = formatMembershipStatusLabel(membership.status);
    const nextStatusLabel = formatMembershipStatusLabel(nextStatus);
    const previousOfficeLabel = previousOfficeScope.officeAccessLabel;
    const identityChanges = [
      buildChange("First name", membership.user.firstName, nextFirstName),
      buildChange("Last name", membership.user.lastName, nextLastName),
      buildChange("Email", membership.user.email, nextEmail),
    ].filter(Boolean) as ActivityLogChange[];

    if (identityChanges.length > 0) {
      try {
        await tx.user.update({
          where: {
            id: membership.userId,
          },
          data: {
            firstName: nextFirstName,
            lastName: nextLastName,
            email: nextEmail,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new Error("Another user already uses that email address.");
        }

        throw error;
      }
    }

    const updatedMembership = await tx.membership.update({
      where: {
        id: membership.id
      },
      data: {
        role: nextRole,
        status: nextStatus,
        officeId: nextOfficeId,
        officeAccesses: {
          deleteMany: {},
          ...(normalizedOfficeAssignment.explicitOfficeIds.length > 0
            ? {
                createMany: {
                  data: normalizedOfficeAssignment.explicitOfficeIds.map((officeId) => ({
                    organizationId: input.organizationId,
                    officeId,
                    createdByMembershipId: input.actorMembershipId
                  }))
                }
              }
            : {})
        }
      },
      include: {
        office: true,
        officeAccesses: {
          include: {
            office: true
          }
        }
      }
    });

    const contextHref = "/office/settings/users";

    if (identityChanges.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsUserIdentityChanged,
        payload: {
          objectLabel: nextUserLabel,
          contextHref,
          details: [],
          changes: identityChanges,
        },
      });
    }

    if (membership.role !== nextRole) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsUserRoleChanged,
        payload: {
          objectLabel: nextUserLabel,
          contextHref,
          details: [],
          changes: [buildChange("Role", previousRoleLabel, nextRoleLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    if (membership.status !== nextStatus) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: nextStatus === "active" ? activityLogActions.settingsUserActivated : activityLogActions.settingsUserDeactivated,
        payload: {
          objectLabel: nextUserLabel,
          contextHref,
          details: [],
          changes: [buildChange("Status", previousStatusLabel, nextStatusLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    const previousOfficeAccessSignature = JSON.stringify({
      defaultOfficeId: previousOfficeScope.defaultOfficeId,
      accessibleOfficeIds: normalizeSelectedOfficeIds(previousOfficeScope.accessibleOfficeIds)
    });
    const nextOfficeAccessSignature = JSON.stringify({
      defaultOfficeId: nextOfficeScope.defaultOfficeId,
      accessibleOfficeIds: normalizeSelectedOfficeIds(nextOfficeScope.accessibleOfficeIds)
    });

    if (previousOfficeAccessSignature !== nextOfficeAccessSignature) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsOfficeAccessChanged,
        payload: {
          objectLabel: nextUserLabel,
          contextHref,
          details: [],
          changes: [buildChange("Company access", previousOfficeLabel, nextOfficeScope.officeAccessLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    return updatedMembership;
  });
}

export async function getOfficeFieldSettingsSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeFieldSettingsSnapshot> {
  const [requiredRoleSettings, transactionIntakeSchema] = await Promise.all([
    prisma.requiredContactRoleSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    }),
    getOfficeTransactionIntakeSchema(input)
  ]);

  const requiredRoleMap = new Map(requiredRoleSettings.map((entry) => [entry.role, entry.isRequired]));

  const contactRoleRows = contactRoleCatalog.map((entry) => ({
    role: entry.role,
    label: entry.label,
    isRequired: requiredRoleMap.get(entry.role) ?? false
  }));

  return {
    summary: {
      requiredRoleCount: contactRoleRows.filter((entry) => entry.isRequired).length,
      requiredFieldCount:
        transactionIntakeSchema.builtInFields.filter((entry) => entry.isRequired).length +
        transactionIntakeSchema.customFields.filter((entry) => entry.isRequired).length,
      visibleFieldCount:
        transactionIntakeSchema.builtInFields.filter((entry) => entry.isVisible).length +
        transactionIntakeSchema.customFields.filter((entry) => entry.isVisible).length
    },
    contactRoleSettings: contactRoleRows,
    transactionFieldSettings: transactionIntakeSchema.builtInFields,
    transactionCustomFieldDefinitions: transactionIntakeSchema.customFields,
    transactionIntakeSchema
  };
}

export async function getOfficeTransactionIntakeSchema(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeTransactionIntakeSchema> {
  const [transactionFieldSettings, transactionCustomFieldDefinitions] = await Promise.all([
    prisma.transactionFieldSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    }),
    prisma.transactionCustomFieldDefinition.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const fieldSettingsMap = new Map(
    transactionFieldSettings.map((entry) => [
      entry.fieldKey,
      {
        isRequired: entry.isRequired,
        isVisible: entry.isVisible,
        options: entry.options
      }
    ])
  );

  const builtInFields = applyTransactionIdentityFallback(
    transactionIntakeBuiltInFieldCatalog.map((entry) =>
      buildOfficeTransactionBuiltInFieldRecord({
        fieldKey: entry.key,
        isRequired: fieldSettingsMap.get(entry.key)?.isRequired ?? false,
        isVisible: fieldSettingsMap.get(entry.key)?.isVisible ?? true,
        options: fieldSettingsMap.get(entry.key)?.options
      })
    )
  );

  const persistedCustomFieldMap = new Map(transactionCustomFieldDefinitions.map((entry) => [entry.fieldKey, entry]));
  const customFields = activeDefaultTransactionCustomFieldCatalog
    .map((entry) => {
      const persisted = persistedCustomFieldMap.get(entry.fieldKey) ?? null;
      const legacyFallback = buildLegacyCustomFieldFallbackState(entry.fieldKey, fieldSettingsMap);

      return buildOfficeTransactionCustomFieldRecord({
        id: persisted?.id ?? null,
        fieldKey: entry.fieldKey,
        label: persisted?.label ?? entry.label,
        type: persisted?.type ?? entry.type,
        isRequired: persisted?.isRequired ?? legacyFallback?.isRequired ?? false,
        isVisible: persisted?.isVisible ?? legacyFallback?.isVisible ?? true,
        sortOrder: persisted?.sortOrder ?? entry.sortOrder,
        options: persisted ? readTransactionCustomFieldOptions(persisted.options) : entry.options,
        isDefault: true
      });
    })
    .concat(
      transactionCustomFieldDefinitions
        .filter((entry) => !activeDefaultTransactionCustomFieldCatalog.some((defaultEntry) => defaultEntry.fieldKey === entry.fieldKey))
        .map((entry) =>
          buildOfficeTransactionCustomFieldRecord({
            id: entry.id,
            fieldKey: entry.fieldKey,
            label: entry.label,
            type: entry.type,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            sortOrder: entry.sortOrder,
            options: readTransactionCustomFieldOptions(entry.options),
            isDefault: false
          })
        )
    )
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label);
    });

  return {
    summary: {
      builtInFieldCount: builtInFields.length,
      visibleBuiltInFieldCount: builtInFields.filter((entry) => entry.isVisible).length,
      requiredBuiltInFieldCount: builtInFields.filter((entry) => entry.isRequired).length,
      customFieldCount: customFields.length,
      visibleCustomFieldCount: customFields.filter((entry) => entry.isVisible).length,
      requiredCustomFieldCount: customFields.filter((entry) => entry.isRequired).length
    },
    builtInFields,
    customFields
  };
}

export async function saveOfficeFieldSettings(input: SaveOfficeFieldSettingsInput) {
  return prisma.$transaction(async (tx) => {
    const existingRoleSettings = await tx.requiredContactRoleSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const existingFieldSettings = await tx.transactionFieldSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });
    const existingCustomFieldDefinitions = await tx.transactionCustomFieldDefinition.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const roleChanges: ActivityLogChange[] = [];
    for (const entry of input.contactRoleSettings) {
      const role = normalizeContactRole(entry.role);
      const existing = existingRoleSettings.find((setting) => setting.role === role) ?? null;
      const previousValue = existing?.isRequired ? "Required" : "Optional";
      const nextValue = entry.isRequired ? "Required" : "Optional";

      if (existing) {
        await tx.requiredContactRoleSetting.update({
          where: {
            id: existing.id
          },
          data: {
            isRequired: entry.isRequired
          }
        });
      } else {
        await tx.requiredContactRoleSetting.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            role,
            isRequired: entry.isRequired
          }
        });
      }

      const change = buildChange(contactRoleLabelMap[role], previousValue, nextValue);
      if (change) {
        roleChanges.push(change);
      }
    }

    const fieldChanges: ActivityLogChange[] = [];
    for (const entry of input.transactionFieldSettings) {
      const fieldKey = normalizeTransactionFieldKey(entry.fieldKey);
      const catalogEntry = getTransactionBuiltInFieldCatalogEntry(fieldKey);
      const existing = existingFieldSettings.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const previousRequired = existing?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? true;
      const previousSelectOptions = existing ? readTransactionBuiltInSelectOptions(fieldKey, existing.options) : readTransactionBuiltInSelectOptions(fieldKey, null);
      const normalizedSelectOptions = normalizeTransactionBuiltInSelectOptions(fieldKey, entry.selectOptions, previousSelectOptions);

      if (catalogEntry?.control === "select" && entry.isVisible && normalizedSelectOptions.length === 0) {
        throw new Error(`${catalogEntry.label} must keep at least one enabled option while the field is visible.`);
      }

      if (existing) {
        await tx.transactionFieldSetting.update({
          where: {
            id: existing.id
          },
          data: {
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            options: catalogEntry?.control === "select" ? normalizedSelectOptions : Prisma.JsonNull
          }
        });
      } else {
        await tx.transactionFieldSetting.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            fieldKey,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            options: catalogEntry?.control === "select" ? normalizedSelectOptions : Prisma.JsonNull
          }
        });
      }

      const fieldLabel = catalogEntry?.label ?? fieldKey;
      const requiredChange = buildChange(`${fieldLabel} required`, previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No");
      const visibilityChange = buildChange(`${fieldLabel} visible`, previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No");
      const optionsChange =
        catalogEntry?.control === "select"
          ? buildChange(
              `${fieldLabel} options`,
              formatTransactionBuiltInSelectOptions(
                previousSelectOptions.filter((option) => option.isEnabled).map((option) => ({ value: option.value, label: option.label }))
              ),
              formatTransactionBuiltInSelectOptions(normalizedSelectOptions)
            )
          : null;

      if (requiredChange) {
        fieldChanges.push(requiredChange);
      }

      if (visibilityChange) {
        fieldChanges.push(visibilityChange);
      }

      if (optionsChange) {
        fieldChanges.push(optionsChange);
      }
    }

    for (const entry of input.transactionCustomFieldDefinitions ?? []) {
      const fieldKey = normalizeTransactionCustomFieldKey(entry.fieldKey);
      const existing = existingCustomFieldDefinitions.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const defaultEntry = activeDefaultTransactionCustomFieldCatalog.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const label = parseOptionalText(entry.label) ?? existing?.label ?? defaultEntry?.label ?? fieldKey;
      const type = normalizeTransactionCustomFieldType(entry.type ?? existing?.type ?? defaultEntry?.type ?? "text");
      const options = normalizeTransactionCustomFieldOptions(
        type,
        entry.options ?? (existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options)
      );
      const sortOrder = typeof entry.sortOrder === "number" ? entry.sortOrder : existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;
      const previousLabel = existing?.label ?? defaultEntry?.label ?? fieldKey;
      const previousType = existing?.type ?? defaultEntry?.type ?? "text";
      const previousRequired = existing?.isRequired ?? buildLegacyCustomFieldFallbackState(fieldKey, new Map(existingFieldSettings.map((setting) => [setting.fieldKey, { isRequired: setting.isRequired, isVisible: setting.isVisible }])))?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? buildLegacyCustomFieldFallbackState(fieldKey, new Map(existingFieldSettings.map((setting) => [setting.fieldKey, { isRequired: setting.isRequired, isVisible: setting.isVisible }])))?.isVisible ?? true;
      const previousOptions = existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [];

      if (existing) {
        await tx.transactionCustomFieldDefinition.update({
          where: {
            id: existing.id
          },
          data: {
            label,
            type,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            sortOrder,
            options
          }
        });
      } else {
        await tx.transactionCustomFieldDefinition.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            fieldKey,
            label,
            type,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            sortOrder,
            options
          }
        });
      }

      const labelChange = buildChange(`${fieldKey} label`, previousLabel, label);
      const typeChange = buildChange(`${label} type`, previousType, type);
      const requiredChange = buildChange(`${label} required`, previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No");
      const visibilityChange = buildChange(`${label} visible`, previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No");
      const optionsChange = buildChange(`${label} options`, previousOptions.join(", ") || "—", options.join(", ") || "—");

      for (const change of [labelChange, typeChange, requiredChange, visibilityChange, optionsChange]) {
        if (change) {
          fieldChanges.push(change);
        }
      }
    }

    const contextHref = "/office/settings/fields";

    if (roleChanges.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "required_contact_role_setting",
        entityId: `required-roles:${input.officeId ?? "organization"}`,
        action: activityLogActions.settingsRequiredContactRolesChanged,
        payload: {
          objectLabel: "Required contact roles",
          contextHref,
          details: roleChanges.map((change) => `${change.label}: ${change.nextValue}`),
          changes: roleChanges
        }
      });
    }

    if (fieldChanges.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "transaction_field_setting",
        entityId: `transaction-fields:${input.officeId ?? "organization"}`,
        action: activityLogActions.settingsTransactionFieldSettingsChanged,
        payload: {
          objectLabel: "Transaction field settings",
          contextHref,
          details: fieldChanges.map((change) => `${change.label}: ${change.nextValue}`),
          changes: fieldChanges
        }
      });
    }

    return getOfficeFieldSettingsSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId
    });
  });
}

async function hasSavedTransactionCustomFieldValues(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    fieldKey: string;
  }
) {
  const officeFilter = input.officeId
    ? Prisma.sql`AND "officeId" = ${input.officeId}`
    : Prisma.sql`AND "officeId" IS NULL`;

  const rows = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "Transaction"
    WHERE "organizationId" = ${input.organizationId}
    ${officeFilter}
    AND "additionalFields" ? ${input.fieldKey}
  `);

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function createOfficeTransactionCustomFieldDefinition(input: CreateOfficeTransactionCustomFieldDefinitionInput) {
  return prisma.$transaction(async (tx) => {
    const existingDefinitions = await tx.transactionCustomFieldDefinition.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      },
      select: {
        fieldKey: true,
        sortOrder: true
      }
    });

    const existingFieldKeys = new Set(
      activeDefaultTransactionCustomFieldCatalog.map((entry) => entry.fieldKey).concat(existingDefinitions.map((entry) => entry.fieldKey))
    );
    const baseFieldKey = slugifyTransactionCustomFieldLabel(input.label);
    let fieldKey = baseFieldKey;
    let suffix = 2;

    while (existingFieldKeys.has(fieldKey)) {
      fieldKey = `${baseFieldKey}_${suffix}`;
      suffix += 1;
    }

    const type = normalizeTransactionCustomFieldType(input.type);
    const options = normalizeTransactionCustomFieldOptions(type, input.options);
    const label = parseOptionalText(input.label);

    if (!label) {
      throw new Error("Field label is required.");
    }

    const sortOrder = Math.max(-1, ...activeDefaultTransactionCustomFieldCatalog.map((entry) => entry.sortOrder), ...existingDefinitions.map((entry) => entry.sortOrder)) + 1;

    await tx.transactionCustomFieldDefinition.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        fieldKey,
        label,
        type,
        isRequired: Boolean(input.isRequired),
        isVisible: typeof input.isVisible === "boolean" ? input.isVisible : true,
        sortOrder,
        options
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `transaction-custom-field:${fieldKey}`,
      action: activityLogActions.settingsTransactionFieldSettingsChanged,
      payload: {
        objectLabel: "Transaction field settings",
        contextHref: "/office/settings/fields",
        details: [`Created custom field: ${label}`],
        changes: [
          { label: `${label} type`, previousValue: "—", nextValue: type },
          { label: `${label} required`, previousValue: "No", nextValue: input.isRequired ? "Yes" : "No" },
          { label: `${label} visible`, previousValue: "No", nextValue: typeof input.isVisible === "boolean" ? (input.isVisible ? "Yes" : "No") : "Yes" }
        ]
      }
    });

    return getOfficeTransactionIntakeSchema({
      organizationId: input.organizationId,
      officeId: input.officeId
    });
  });
}

export async function updateOfficeTransactionCustomFieldDefinition(input: UpdateOfficeTransactionCustomFieldDefinitionInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transactionCustomFieldDefinition.findFirst({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        fieldKey: input.fieldKey
      }
    });
    const defaultEntry = activeDefaultTransactionCustomFieldCatalog.find((entry) => entry.fieldKey === input.fieldKey) ?? null;

    if (!existing && !defaultEntry) {
      throw new Error("Custom field was not found.");
    }

    const nextLabel = parseOptionalText(input.label) ?? existing?.label ?? defaultEntry?.label ?? input.fieldKey;
    const nextType = normalizeTransactionCustomFieldType(input.type ?? existing?.type ?? defaultEntry?.type ?? "text");
    const previousType = existing?.type ?? defaultEntry?.type ?? "text";

    if (nextType !== previousType) {
      const hasStoredValues = await hasSavedTransactionCustomFieldValues(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey: input.fieldKey
      });

      if (hasStoredValues) {
        throw new Error("Field type cannot change after transactions have stored values.");
      }
    }

    const nextOptions = normalizeTransactionCustomFieldOptions(
      nextType,
      input.options ?? (existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options)
    );
    const nextRequired = typeof input.isRequired === "boolean" ? input.isRequired : existing?.isRequired ?? false;
    const nextVisible = typeof input.isVisible === "boolean" ? input.isVisible : existing?.isVisible ?? true;
    const nextSortOrder = typeof input.sortOrder === "number" ? input.sortOrder : existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;

    if (existing) {
      await tx.transactionCustomFieldDefinition.update({
        where: {
          id: existing.id
        },
        data: {
          label: nextLabel,
          type: nextType,
          isRequired: nextRequired,
          isVisible: nextVisible,
          sortOrder: nextSortOrder,
          options: nextOptions
        }
      });
    } else {
      await tx.transactionCustomFieldDefinition.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          fieldKey: normalizeTransactionCustomFieldKey(input.fieldKey),
          label: nextLabel,
          type: nextType,
          isRequired: nextRequired,
          isVisible: nextVisible,
          sortOrder: nextSortOrder,
          options: nextOptions
        }
      });
    }

    const previousLabel = existing?.label ?? defaultEntry?.label ?? input.fieldKey;
    const previousOptions = existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [];

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `transaction-custom-field:${input.fieldKey}`,
      action: activityLogActions.settingsTransactionFieldSettingsChanged,
      payload: {
        objectLabel: "Transaction field settings",
        contextHref: "/office/settings/fields",
        details: [`Updated custom field: ${nextLabel}`],
        changes: [
          buildChange(`${input.fieldKey} label`, previousLabel, nextLabel),
          buildChange(`${nextLabel} type`, previousType, nextType),
          buildChange(`${nextLabel} required`, (existing?.isRequired ?? false) ? "Yes" : "No", nextRequired ? "Yes" : "No"),
          buildChange(`${nextLabel} visible`, (existing?.isVisible ?? true) ? "Yes" : "No", nextVisible ? "Yes" : "No"),
          buildChange(`${nextLabel} options`, previousOptions.join(", ") || "—", nextOptions.join(", ") || "—")
        ].filter(Boolean) as ActivityLogChange[]
      }
    });

    return getOfficeTransactionIntakeSchema({
      organizationId: input.organizationId,
      officeId: input.officeId
    });
  });
}

export async function getOfficeChecklistTemplatesSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeChecklistTemplatesSnapshot> {
  const templates = await prisma.checklistTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null
    },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      createdByMembership: {
        include: {
          user: true
        }
      },
      updatedByMembership: {
        include: {
          user: true
        }
      }
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return {
    summary: {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((template) => template.isActive).length,
      totalItems: templates.reduce((sum, template) => sum + template.items.length, 0)
    },
    transactionTypeOptions: [{ value: "", label: "Office default" }].concat(
      Object.entries(transactionTypeLabelMap).map(([value, label]) => ({
        value,
        label
      }))
    ),
    templates: templates.map(mapChecklistTemplateRecord)
  };
}

export async function createChecklistTemplate(input: CreateChecklistTemplateInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Checklist template name is required.");
  }

  const items = buildChecklistTemplateItems(input.items);

  return prisma.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        name,
        description: parseOptionalText(input.description),
        transactionType: normalizeTransactionType(input.transactionType),
        isActive: input.isActive ?? true,
        createdByMembershipId: input.actorMembershipId,
        updatedByMembershipId: input.actorMembershipId,
        items: {
          createMany: {
            data: items.map((item) => ({
              organizationId: input.organizationId,
              officeId: input.officeId ?? null,
              checklistGroup: item.checklistGroup,
              title: item.title,
              description: item.description,
              dueDaysOffset: item.dueDaysOffset,
              sortOrder: item.sortOrder,
              requiresDocument: item.requiresDocument,
              requiresDocumentApproval: item.requiresDocumentApproval,
              requiresSecondaryApproval: item.requiresSecondaryApproval
            }))
          }
        }
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "checklist_template",
      entityId: template.id,
      action: activityLogActions.settingsChecklistTemplateCreated,
      payload: {
        objectLabel: name,
        contextHref: "/office/settings/checklists",
        details: [`${items.length} template task${items.length === 1 ? "" : "s"}`],
        changes: []
      }
    });

    return template;
  });
}

export async function updateChecklistTemplate(input: UpdateChecklistTemplateInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Checklist template name is required.");
  }

  const items = buildChecklistTemplateItems(input.items);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.checklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      },
      include: {
        items: true
      }
    });

    if (!existing) {
      throw new Error("Checklist template was not found.");
    }

    const changes: ActivityLogChange[] = [];
    const nameChange = buildChange("Name", existing.name, name);
    const descriptionChange = buildChange("Description", existing.description ?? "—", parseOptionalText(input.description) ?? "—");
    const transactionTypeChange = buildChange(
      "Context",
      existing.transactionType ? transactionTypeLabelMap[existing.transactionType] : "Office default",
      input.transactionType ? transactionTypeLabelMap[normalizeTransactionType(input.transactionType) as TransactionType] : "Office default"
    );

    if (nameChange) {
      changes.push(nameChange);
    }

    if (descriptionChange) {
      changes.push(descriptionChange);
    }

    if (transactionTypeChange) {
      changes.push(transactionTypeChange);
    }

    if (existing.items.length !== items.length) {
      changes.push({
        label: "Task rows",
        previousValue: String(existing.items.length),
        nextValue: String(items.length)
      });
    }

    const updated = await tx.checklistTemplate.update({
      where: {
        id: existing.id
      },
      data: {
        name,
        description: parseOptionalText(input.description),
        transactionType: normalizeTransactionType(input.transactionType),
        isActive: input.isActive ?? existing.isActive,
        updatedByMembershipId: input.actorMembershipId
      }
    });

    await tx.checklistTemplateItem.deleteMany({
      where: {
        checklistTemplateId: existing.id
      }
    });

    await tx.checklistTemplateItem.createMany({
      data: items.map((item) => ({
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        checklistTemplateId: existing.id,
        checklistGroup: item.checklistGroup,
        title: item.title,
        description: item.description,
        dueDaysOffset: item.dueDaysOffset,
        sortOrder: item.sortOrder,
        requiresDocument: item.requiresDocument,
        requiresDocumentApproval: item.requiresDocumentApproval,
        requiresSecondaryApproval: item.requiresSecondaryApproval
      }))
    });

    let action: typeof activityLogActions[keyof typeof activityLogActions] = activityLogActions.settingsChecklistTemplateUpdated;
    if (existing.isActive && updated.isActive === false) {
      action = activityLogActions.settingsChecklistTemplateDeactivated;
    } else if (!existing.isActive && updated.isActive === true) {
      action = activityLogActions.settingsChecklistTemplateActivated;
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "checklist_template",
      entityId: existing.id,
      action,
      payload: {
        objectLabel: updated.name,
        contextHref: "/office/settings/checklists",
        details: changes.map((change) => `${change.label}: ${change.nextValue}`),
        changes
      }
    });

    return updated;
  });
}
