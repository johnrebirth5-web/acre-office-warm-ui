import {
  MembershipStatus,
  Prisma,
  TransactionContactRole,
  TransactionCustomFieldType,
  TransactionFieldKey,
  TransactionType,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";

const userRoleLabelMap: Record<UserRole, string> = {
  agent: "Agent",
  office_manager: "Office Manager",
  office_user: "Office User",
  office_admin: "Office Admin"
};

const officeInternalRoleCatalog: UserRole[] = ["office_admin", "office_user", "office_manager"];

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

const transactionIntakeBuiltInFieldCatalog: Array<{
  key: TransactionFieldKey;
  label: string;
  inputName: string;
  section: "top" | "primary";
  control: "text" | "date" | "select";
  className?: string;
  options?: string[];
}> = [
  { key: "transaction_type", label: "Type", inputName: "transactionType", section: "top", control: "select", options: ["Sales", "Sales (listing)", "Rental/Leasing", "Rental (listing)", "Commercial Sales", "Commercial Lease", "Other"] },
  { key: "transaction_status", label: "Status", inputName: "transactionStatus", section: "top", control: "select", options: ["Opportunity", "Active", "Pending", "Closed", "Cancelled"] },
  { key: "representing", label: "Representing", inputName: "representing", section: "top", control: "select", options: ["Buyer", "Seller", "Both", "Tenant", "Landlord"] },
  { key: "address", label: "Address", inputName: "address", section: "primary", control: "text" },
  { key: "city", label: "City", inputName: "city", section: "primary", control: "text" },
  { key: "state", label: "State", inputName: "state", section: "primary", control: "text", className: "is-compact" },
  { key: "zip_code", label: "Zip", inputName: "zipCode", section: "primary", control: "text", className: "is-compact" },
  { key: "transaction_name", label: "Transaction Name", inputName: "transactionName", section: "primary", control: "text", className: "is-span-4" },
  { key: "price", label: "Price", inputName: "price", section: "primary", control: "text" },
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
  { fieldKey: "currencyType", label: "Currency Type", type: "select", sortOrder: 16, options: ["USD", "CNY"] },
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
  status: string;
  statusValue: MembershipStatus;
  title: string;
  authStatusLabel: string;
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
    roleOptions: Array<{ value: string; label: string }>;
    statusOptions: Array<{ value: string; label: string }>;
    officeOptions: Array<{ id: string; label: string }>;
  };
  rows: OfficeAdminUserRow[];
};

export type OfficeRequiredContactRoleRecord = {
  role: TransactionContactRole;
  label: string;
  isRequired: boolean;
};

export type OfficeTransactionFieldSettingRecord = {
  fieldKey: TransactionFieldKey;
  inputName: string;
  label: string;
  section: "top" | "primary";
  control: "text" | "date" | "select";
  className: string;
  options: string[];
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
  officeId?: string | null;
  q?: string;
  role?: string;
  status?: string;
  officeFilterId?: string;
};

export type UpdateOfficeAdminUserInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
  role?: string;
  status?: string;
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

function formatOfficeAccessLabel(office: { name: string } | null) {
  return office?.name ?? "All offices";
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

function isOfficeInternalRole(role: UserRole) {
  return officeInternalRoleCatalog.includes(role);
}

function mapOfficeAdminUserRow(membership: {
  id: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  title: string | null;
  officeId: string | null;
  office: { name: string } | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    credential: {
      mustChangePassword: boolean;
      lockedUntil: Date | null;
    } | null;
  };
  invitations: Array<{
    expiresAt: Date;
  }>;
}): OfficeAdminUserRow {
  const pendingInvitation = membership.invitations[0] ?? null;
  const isLocked = Boolean(membership.user.credential?.lockedUntil && membership.user.credential.lockedUntil > new Date());
  const hasCredential = Boolean(membership.user.credential);
  const name = `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
  const mustChangePassword = membership.user.credential?.mustChangePassword ?? false;

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
    role: membership.role === "office_manager" ? "Office Manager (Legacy)" : userRoleLabelMap[membership.role],
    roleValue: membership.role,
    roleEditorValue: membership.role,
    officeAccessLabel: formatOfficeAccessLabel(membership.office),
    officeAccessValue: membership.officeId ?? "__all__",
    status: formatMembershipStatusLabel(membership.status),
    statusValue: membership.status,
    title: membership.title ?? "",
    authStatusLabel,
    lockStatusLabel: isLocked ? "Locked" : "Not locked",
    lockedUntilLabel: formatDateTimeLabel(membership.user.credential?.lockedUntil),
    invitationStatusLabel,
    invitationExpiresAtLabel: formatDateTimeLabel(pendingInvitation?.expiresAt),
    hasCredential,
    hasActiveInvitation: Boolean(pendingInvitation),
    isLocked,
    mustChangePassword,
    href: null
  };
}

function normalizeUserRole(value: string | undefined): UserRole | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "agent" || value === "office_manager" || value === "office_user" || value === "office_admin") {
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
    value === "price" ||
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
  isLockedRequired?: boolean;
  isLockedVisible?: boolean;
}): OfficeTransactionFieldSettingRecord {
  const catalogEntry = transactionIntakeBuiltInFieldCatalog.find((entry) => entry.key === input.fieldKey);

  if (!catalogEntry) {
    throw new Error("Unsupported transaction built-in field.");
  }

  return {
    fieldKey: catalogEntry.key,
    inputName: catalogEntry.inputName,
    label: catalogEntry.label,
    section: catalogEntry.section,
    control: catalogEntry.control,
    className: catalogEntry.className ?? "",
    options: catalogEntry.options ?? [],
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
  const roleFilter = normalizeUserRole(input.role);
  const q = input.q?.trim() ?? "";
  const statusFilter = input.status?.trim() ?? "";
  const now = new Date();

  const where: Prisma.MembershipWhereInput = {
    organizationId: input.organizationId,
    role: {
      in: officeInternalRoleCatalog
    }
  };

  if (officeFilterId === "__all__") {
    where.officeId = null;
  } else if (officeFilterId) {
    where.officeId = officeFilterId;
  }

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

  const [memberships, offices, summary] = await Promise.all([
    prisma.membership.findMany({
      where,
      include: {
        user: {
          include: {
            credential: true
          }
        },
        office: true,
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
        name: true
      }
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: officeInternalRoleCatalog
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
    })
  ]);

  const summaryRows = summary.map((membership) =>
    mapOfficeAdminUserRow({
      ...membership,
      title: membership.title ?? null
    })
  );
  const totalUsers = summaryRows.length;
  const activeUsers = summaryRows.filter((entry) => entry.statusValue === "active").length;
  const invitedUsers = summaryRows.filter((entry) => entry.statusValue === "invited").length;
  const disabledUsers = summaryRows.filter((entry) => entry.statusValue === "disabled").length;
  const lockedUsers = summaryRows.filter((entry) => entry.isLocked).length;
  const pendingInvitationCount = summaryRows.filter((entry) => entry.hasActiveInvitation).length;
  const allOfficeAccessCount = summaryRows.filter((entry) => entry.officeAccessValue === "__all__").length;

  const roleOptions = [
    { value: "office_admin", label: "Admin" },
    { value: "office_user", label: "User" }
  ];

  if (summaryRows.some((entry) => entry.roleValue === "office_manager")) {
    roleOptions.push({ value: "office_manager", label: "Office Manager (Legacy)" });
  }

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
      officeId: officeFilterId,
      roleOptions,
      statusOptions: [
        { value: "active", label: "Active" },
        { value: "invited", label: "Invited" },
        { value: "disabled", label: "Disabled" },
        { value: "locked", label: "Locked" }
      ],
      officeOptions: [{ id: "__all__", label: "All offices" }, ...offices.map((office) => ({ id: office.id, label: office.name }))]
    },
    rows: memberships.map((membership) =>
      mapOfficeAdminUserRow({
        ...membership,
        title: membership.title ?? null
      })
    )
  };
}

export async function updateOfficeAdminUser(input: UpdateOfficeAdminUserInput) {
  return prisma.$transaction(async (tx) => {
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
        office: true
      }
    });

    if (!membership) {
      throw new Error("User membership was not found.");
    }

    if (!isOfficeInternalRole(membership.role)) {
      throw new Error("Agent memberships are managed outside the internal users page.");
    }

    const nextRole = normalizeUserRole(input.role) ?? membership.role;
    const nextStatus = normalizeMembershipStatus(input.status) ?? membership.status;
    let nextOfficeId = typeof input.officeId === "string" ? input.officeId : input.officeId === null ? null : membership.officeId;

    if (nextRole === "agent") {
      throw new Error("Users page only supports internal Admin and User roles.");
    }

    if (nextRole === "office_manager" && membership.role !== "office_manager") {
      throw new Error("The legacy Office Manager role cannot be assigned from this page.");
    }

    if (!membership.user.credential && nextStatus === "active") {
      throw new Error("Invited users become active after they set a password.");
    }

    if (membership.user.credential && nextStatus === "invited") {
      throw new Error("Issue a password setup link instead of moving a password account back to invited.");
    }

    if (nextOfficeId === "__all__") {
      nextOfficeId = null;
    }

    let nextOfficeName = "All offices";
    if (nextOfficeId) {
      const office = await tx.office.findFirst({
        where: {
          id: nextOfficeId,
          organizationId: input.organizationId
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!office) {
        throw new Error("Selected office was not found.");
      }

      nextOfficeName = office.name;
    }

    const previousRoleLabel = userRoleLabelMap[membership.role];
    const nextRoleLabel = userRoleLabelMap[nextRole];
    const previousStatusLabel = formatMembershipStatusLabel(membership.status);
    const nextStatusLabel = formatMembershipStatusLabel(nextStatus);
    const previousOfficeLabel = formatOfficeAccessLabel(membership.office);

    const updatedMembership = await tx.membership.update({
      where: {
        id: membership.id
      },
      data: {
        role: nextRole,
        status: nextStatus,
        officeId: nextOfficeId
      },
      include: {
        office: true
      }
    });

    const userLabel = `${membership.user.firstName} ${membership.user.lastName}`;
    const contextHref = "/office/settings/users";

    if (membership.role !== nextRole) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsUserRoleChanged,
        payload: {
          objectLabel: userLabel,
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
          objectLabel: userLabel,
          contextHref,
          details: [],
          changes: [buildChange("Status", previousStatusLabel, nextStatusLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    if ((membership.officeId ?? null) !== (nextOfficeId ?? null)) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsOfficeAccessChanged,
        payload: {
          objectLabel: userLabel,
          contextHref,
          details: [],
          changes: [buildChange("Office access", previousOfficeLabel, nextOfficeName)].filter(Boolean) as ActivityLogChange[]
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
        isVisible: entry.isVisible
      }
    ])
  );

  const builtInFields = applyTransactionIdentityFallback(
    transactionIntakeBuiltInFieldCatalog.map((entry) =>
      buildOfficeTransactionBuiltInFieldRecord({
        fieldKey: entry.key,
        isRequired: fieldSettingsMap.get(entry.key)?.isRequired ?? false,
        isVisible: fieldSettingsMap.get(entry.key)?.isVisible ?? true
      })
    )
  );

  const persistedCustomFieldMap = new Map(transactionCustomFieldDefinitions.map((entry) => [entry.fieldKey, entry]));
  const customFields = defaultTransactionCustomFieldCatalog
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
        .filter((entry) => !defaultTransactionCustomFieldCatalog.some((defaultEntry) => defaultEntry.fieldKey === entry.fieldKey))
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
      const existing = existingFieldSettings.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const previousRequired = existing?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? true;

      if (existing) {
        await tx.transactionFieldSetting.update({
          where: {
            id: existing.id
          },
          data: {
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        });
      } else {
        await tx.transactionFieldSetting.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            fieldKey,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        });
      }

      const fieldLabel = transactionIntakeBuiltInFieldCatalog.find((catalogEntry) => catalogEntry.key === fieldKey)?.label ?? fieldKey;
      const requiredChange = buildChange(`${fieldLabel} required`, previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No");
      const visibilityChange = buildChange(`${fieldLabel} visible`, previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No");

      if (requiredChange) {
        fieldChanges.push(requiredChange);
      }

      if (visibilityChange) {
        fieldChanges.push(visibilityChange);
      }
    }

    for (const entry of input.transactionCustomFieldDefinitions ?? []) {
      const fieldKey = normalizeTransactionCustomFieldKey(entry.fieldKey);
      const existing = existingCustomFieldDefinitions.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const defaultEntry = defaultTransactionCustomFieldCatalog.find((setting) => setting.fieldKey === fieldKey) ?? null;
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
      defaultTransactionCustomFieldCatalog.map((entry) => entry.fieldKey).concat(existingDefinitions.map((entry) => entry.fieldKey))
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

    const sortOrder = Math.max(-1, ...defaultTransactionCustomFieldCatalog.map((entry) => entry.sortOrder), ...existingDefinitions.map((entry) => entry.sortOrder)) + 1;

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
    const defaultEntry = defaultTransactionCustomFieldCatalog.find((entry) => entry.fieldKey === input.fieldKey) ?? null;

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
