import {
  MembershipStatus,
  Prisma,
  TransactionFinanceApprovalStatus,
  TransactionFinanceCalculationType,
  TransactionFinanceFeeType,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import {
  buildTransactionPortfolioVisibilityWhere,
  buildTransactionVisibilityWhere,
  canViewCrossMemberFinancials,
  canViewFinancialsForMembership,
  getMyScopedMembershipIds,
  redactCurrency,
  resolveOfficeDataScope,
  type OfficeDataScope
} from "./access";
import { prisma } from "./client";
import {
  getOfficeTransactionIntakeSchema,
  type OfficeTransactionIntakeSchema,
  type OfficeTransactionCustomFieldDefinitionRecord,
  type OfficeTransactionFieldSettingRecord
} from "./field-settings";
import { buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds } from "./team-hierarchy";
import { retiredTransactionAdditionalFieldKeys } from "./transaction-retired-custom-fields";
import {
  buildTransactionFinancePrerequisiteSnapshot,
  ensureTransactionFinanceFees,
  mapTransactionFinanceFeeRecord,
  normalizeTransactionFinanceFeeForPersistence,
  type OfficeTransactionFinanceFeeRecord,
  type OfficeTransactionFinancePrerequisiteSnapshot
} from "./commissions";
import { listAvailableContactsForTransaction, type OfficeTransactionContact, type OfficeTransactionContactOption } from "./transaction-contacts";
import {
  listTransactionDocumentsSnapshot,
  type OfficeFormTemplateOption,
  type OfficeIncomingUpdate,
  type OfficeSignatureRequest,
  type OfficeTransactionDocument,
  type OfficeTransactionForm
} from "./transaction-documents";

export type OfficeTransactionStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";

export type OfficeTransactionRecord = {
  id: string;
  address: string;
  importantDate: string;
  askingPrice: string;
  purchasedPrice: string;
  price: string;
  owner: string;
  representing: string;
  status: OfficeTransactionStatus;
  volume: number;
  isFlagged?: boolean;
};

export type OfficeTransactionSummary = {
  totalCount: number;
  totalNetIncome: string;
  totalNetIncomeLabel: string;
};

export type OfficeTransactionSelectOption = {
  id: string;
  label: string;
};

export type OfficeTransactionFilterOptions = {
  ownerOptions: OfficeTransactionSelectOption[];
  teamOptions: OfficeTransactionSelectOption[];
};

export type OfficeTransactionOwnerOption = {
  id: string;
  label: string;
  roleLabel: string;
  roleValue: UserRole;
};

export type OfficeTransactionOwnerAssignment = {
  currentOwnerMembershipId: string;
  currentOwnerLabel: string;
  canSelectDifferentOwner: boolean;
  options: OfficeTransactionOwnerOption[];
};

export type OfficeTransactionListResult = {
  transactions: OfficeTransactionRecord[];
  summary: OfficeTransactionSummary;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filterOptions: OfficeTransactionFilterOptions;
};

export type OfficeTransactionsPageSnapshot = {
  searchLayout: OfficeTransactionSearchLayoutSnapshot;
  listResult: OfficeTransactionListResult;
};

export type OfficeTransactionSearchFieldKind = "system" | "builtin" | "custom";
export type OfficeTransactionSearchFieldControl = "text" | "select" | "date";

export type OfficeTransactionSearchFieldReference = {
  kind: OfficeTransactionSearchFieldKind;
  key: string;
};

export type OfficeTransactionSearchFieldOption = {
  value: string;
  label: string;
};

export type OfficeTransactionSearchFieldDescriptor = OfficeTransactionSearchFieldReference & {
  label: string;
  control: OfficeTransactionSearchFieldControl;
  supportsRange: boolean;
  groupLabel: "Operational" | "Built-in" | "Custom";
  sortOrder: number;
  options: OfficeTransactionSearchFieldOption[];
  placeholder?: string;
  emptyOptionLabel?: string;
};

export type OfficeTransactionFieldFilterValue = {
  value: string;
  from: string;
  to: string;
};

export type OfficeTransactionFieldFilterInput = {
  kind: "builtin" | "custom";
  key: string;
  control: OfficeTransactionSearchFieldControl;
  value?: string;
  from?: string;
  to?: string;
};

export type OfficeTransactionSearchLayoutFilters = {
  system: {
    q: string;
    ownerMembershipId: string;
    teamId: string;
    createdAt: {
      from: string;
      to: string;
    };
  };
  builtin: Record<string, OfficeTransactionFieldFilterValue>;
  custom: Record<string, OfficeTransactionFieldFilterValue>;
};

export type OfficeTransactionSearchLayoutSnapshot = {
  schema: OfficeTransactionIntakeSchema;
  filterOptions: OfficeTransactionFilterOptions;
  availableFields: OfficeTransactionSearchFieldDescriptor[];
  selectedFields: OfficeTransactionSearchFieldDescriptor[];
  savedLayout: OfficeTransactionSearchFieldReference[];
  filters: OfficeTransactionSearchLayoutFilters;
  listFilters: {
    q: string;
    status: OfficeTransactionStatus | "All";
    ownerMembershipId: string;
    teamId: string;
    type: string;
    startDate: string;
    endDate: string;
    fieldFilters: OfficeTransactionFieldFilterInput[];
  };
};

export type SaveOfficeTransactionSearchLayoutInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  fields: OfficeTransactionSearchFieldReference[];
};

export type GetOfficeTransactionSearchLayoutSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  searchParams?: Record<string, string | string[] | undefined>;
};

export type OfficeTransactionDetail = {
  id: string;
  organizationId: string;
  officeId: string | null;
  ownerMembershipId: string | null;
  canViewFinancials: boolean;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  typeValue: string;
  askingPrice: string;
  purchasedPrice: string;
  price: string;
  type: string;
  statusValue: string;
  status: OfficeTransactionStatus;
  representingValue: string;
  representing: string;
  importantDate: string;
  buyerAgreementDate: string;
  buyerExpirationDate: string;
  acceptanceDate: string;
  listingDate: string;
  listingExpirationDate: string;
  closingDate: string;
  moveInDate: string;
  companyReferral: "Yes" | "No";
  companyReferralEmployeeName: string;
  ownerName: string;
  ownerEmail: string;
  officeName: string;
  grossCommission: string;
  referralFee: string;
  officeNet: string;
  agentNet: string;
  financeNotes: string;
  financeFees: OfficeTransactionFinanceFeeRecord[];
  financePrerequisites: OfficeTransactionFinancePrerequisiteSnapshot;
  additionalFields: Record<string, string>;
  contacts: OfficeTransactionContact[];
  availableContacts: OfficeTransactionContactOption[];
  documents: OfficeTransactionDocument[];
  forms: OfficeTransactionForm[];
  signatureRequests: OfficeSignatureRequest[];
  incomingUpdates: OfficeIncomingUpdate[];
  formTemplates: OfficeFormTemplateOption[];
  createdAt: string;
  updatedAt: string;
};

export type ListTransactionsInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  search?: string;
  status?: OfficeTransactionStatus | "All";
  ownerMembershipId?: string;
  teamId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  fieldFilters?: OfficeTransactionFieldFilterInput[];
  page?: number;
  pageSize?: number;
};

export type GetTransactionByIdInput = {
  organizationId: string;
  viewerMembershipId: string;
  transactionId: string;
  officeId?: string | null;
};

export type CreateTransactionInput = {
  organizationId: string;
  officeId?: string | null;
  ownerMembershipId: string;
  actorMembershipId?: string;
  transactionType: string;
  transactionStatus: string;
  representing: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  transactionName: string;
  askingPrice?: string;
  purchasedPrice?: string;
  price?: string;
  buyerAgreementDate?: string;
  buyerExpirationDate?: string;
  acceptanceDate?: string;
  listingDate?: string;
  listingExpirationDate?: string;
  closingDate?: string;
  moveInDate?: string;
  companyReferral?: string;
  companyReferralEmployeeName?: string;
  grossCommission?: string;
  referralFee?: string;
  officeNet?: string;
  agentNet?: string;
  financeNotes?: string;
  fees?: Array<{
    feeType: string;
    rate?: string;
    amount?: string;
    selectedCalculationType?: string;
    approvalStatus?: string;
    notes?: string;
  }>;
  additionalFields?: Record<string, string>;
};

export type UpdateTransactionStatusInput = {
  organizationId: string;
  transactionId: string;
  status: OfficeTransactionStatus;
  actorMembershipId?: string;
};

export type UpdateTransactionFinanceInput = {
  organizationId: string;
  transactionId: string;
  grossCommission?: string;
  referralFee?: string;
  officeNet?: string;
  agentNet?: string;
  financeNotes?: string;
  clientReferralFormApproved?: boolean;
  rebateAgreementSigned?: boolean;
  rebateGoogleFormSubmitted?: boolean;
  fees?: Array<{
    feeType: string;
    rate?: string;
    amount?: string;
    selectedCalculationType?: string;
    approvalStatus?: string;
    notes?: string;
  }>;
  actorMembershipId?: string;
};

export type UpdateTransactionIntakeInput = {
  organizationId: string;
  transactionId: string;
  transactionType: string;
  transactionStatus: string;
  representing: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  transactionName: string;
  askingPrice?: string;
  purchasedPrice?: string;
  price?: string;
  buyerAgreementDate?: string;
  buyerExpirationDate?: string;
  acceptanceDate?: string;
  listingDate?: string;
  listingExpirationDate?: string;
  closingDate?: string;
  moveInDate?: string;
  additionalFields?: Record<string, string>;
  actorMembershipId?: string;
};

export type PreparedTransactionIntakeSubmission = {
  transactionType: string;
  transactionStatus: string;
  representing: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  transactionName: string;
  askingPrice: string;
  purchasedPrice: string;
  price: string;
  buyerAgreementDate: string;
  buyerExpirationDate: string;
  acceptanceDate: string;
  listingDate: string;
  listingExpirationDate: string;
  closingDate: string;
  moveInDate: string;
  additionalFields: Record<string, string>;
};

const restrictedIntakeFinanceFieldKeys = new Set(["officeNet", "agentNet"]);

function stripRetiredTransactionAdditionalFields(additionalFields: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(additionalFields).filter(([fieldKey]) => !retiredTransactionAdditionalFieldKeys.has(fieldKey))
  );
}

function sanitizeEditableIntakeAdditionalFields(
  additionalFields: Record<string, string> | undefined,
  canManageTransactionFinance: boolean
) {
  if (!additionalFields) {
    return {};
  }

  const activeAdditionalFields = stripRetiredTransactionAdditionalFields(additionalFields);

  if (canManageTransactionFinance) {
    return activeAdditionalFields;
  }

  return Object.fromEntries(
    Object.entries(activeAdditionalFields).filter(([fieldKey]) => !restrictedIntakeFinanceFieldKeys.has(fieldKey))
  );
}

const transactionStatusLabelMap: Record<TransactionStatus, OfficeTransactionStatus> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const transactionStatusDisplayDbMap: Record<OfficeTransactionStatus, TransactionStatus> = {
  Opportunity: "opportunity",
  Active: "active",
  Pending: "pending",
  Closed: "closed",
  Cancelled: "cancelled"
};

const transactionStatusInputDbMap: Record<string, TransactionStatus> = {
  opportunity: "opportunity",
  active: "active",
  pending: "pending",
  closed: "closed",
  cancelled: "cancelled",
  Opportunity: "opportunity",
  Active: "active",
  Pending: "pending",
  Closed: "closed",
  Cancelled: "cancelled"
};

const transactionTypeInputDbMap: Record<string, TransactionType> = {
  sales: "sales",
  sales_listing: "sales_listing",
  rental_leasing: "rental_leasing",
  rental_listing: "rental_listing",
  commercial_sales: "commercial_sales",
  commercial_lease: "commercial_lease",
  other: "other",
  Sales: "sales",
  "Sales (listing)": "sales_listing",
  "Rental/Leasing": "rental_leasing",
  "Rental (listing)": "rental_listing",
  "Commercial Sales": "commercial_sales",
  "Commercial Lease": "commercial_lease",
  Other: "other"
};

const transactionTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales (listing)",
  rental_leasing: "Rental/Leasing",
  rental_listing: "Rental (listing)",
  commercial_sales: "Commercial Sales",
  commercial_lease: "Commercial Lease",
  other: "Other"
};

const representingInputDbMap: Record<string, TransactionRepresenting> = {
  buyer: "buyer",
  seller: "seller",
  both: "both",
  tenant: "tenant",
  landlord: "landlord",
  Buyer: "buyer",
  Seller: "seller",
  Both: "both",
  Tenant: "tenant",
  Landlord: "landlord"
};

const representingLabelMap: Record<TransactionRepresenting, string> = {
  buyer: "buyer",
  seller: "seller",
  both: "both",
  tenant: "tenant",
  landlord: "landlord"
};

const defaultTransactionsPage = 1;
const defaultTransactionsPageSize = 20;
const maxTransactionsPageSize = 100;
const transactionOwnerRoleValues = ["agent", "team_lead"] satisfies UserRole[];
const selectableTransactionOwnerStatuses = ["active", "invited"] satisfies MembershipStatus[];
const hiddenSearchCustomFieldKeys = new Set(["agentName"]);
const defaultTransactionSearchLayout: OfficeTransactionSearchFieldReference[] = [
  { kind: "system", key: "search" },
  { kind: "system", key: "owner" },
  { kind: "system", key: "team" },
  { kind: "system", key: "created_at" },
  { kind: "builtin", key: "transaction_type" },
  { kind: "builtin", key: "transaction_status" },
  { kind: "custom", key: "invoiceNumber" },
  { kind: "custom", key: "buyerTenant" },
  { kind: "custom", key: "buildingName" },
  { kind: "builtin", key: "address" },
  { kind: "custom", key: "unitNumber" },
  { kind: "builtin", key: "city" },
  { kind: "builtin", key: "state" },
  { kind: "builtin", key: "zip_code" },
  { kind: "custom", key: "layout" }
];

type TransactionFilterContext = {
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>>;
  scopedTeams: Array<{
    id: string;
    name: string;
    isActive: boolean;
    parentTeamId: string | null;
  }>;
  teamHierarchyIndex: ReturnType<typeof createTeamHierarchyIndex>;
  ownerMemberships: Array<{
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }>;
};

type LoadedTransactionSearchLayoutWorkspace = {
  schema: OfficeTransactionIntakeSchema;
  filterContext: TransactionFilterContext;
  searchLayout: OfficeTransactionSearchLayoutSnapshot;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

function buildSearchFieldDescriptorId(field: OfficeTransactionSearchFieldReference) {
  return `${field.kind}:${field.key}`;
}

function buildEmptyTransactionSearchFieldFilterValue(): OfficeTransactionFieldFilterValue {
  return {
    value: "",
    from: "",
    to: ""
  };
}

function normalizeTransactionSearchFieldReferences(
  value: Prisma.JsonValue | null | undefined
): OfficeTransactionSearchFieldReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as Partial<OfficeTransactionSearchFieldReference>;
    const kind =
      candidate.kind === "system" || candidate.kind === "builtin" || candidate.kind === "custom"
        ? candidate.kind
        : null;
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";

    if (!kind || !key) {
      return [];
    }

    return [
      {
        kind,
        key
      }
    ];
  });
}

function sanitizeTransactionSearchFieldReferences(
  fields: OfficeTransactionSearchFieldReference[],
  availableFields: OfficeTransactionSearchFieldDescriptor[]
) {
  const availableFieldMap = new Map(
    availableFields.map((field) => [buildSearchFieldDescriptorId(field), field] satisfies [string, OfficeTransactionSearchFieldDescriptor])
  );
  const seen = new Set<string>();

  return fields.flatMap((field) => {
    const id = buildSearchFieldDescriptorId(field);

    if (seen.has(id) || !availableFieldMap.has(id)) {
      return [];
    }

    seen.add(id);
    return [field];
  });
}

function areTransactionSearchFieldReferencesEqual(
  left: OfficeTransactionSearchFieldReference[],
  right: OfficeTransactionSearchFieldReference[]
) {
  return (
    left.length === right.length &&
    left.every((field, index) => field.kind === right[index]?.kind && field.key === right[index]?.key)
  );
}

function normalizeSearchFilterDateValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return parseOptionalDate(trimmed) ? trimmed : "";
}

function normalizeSearchSelectValue(
  descriptor: Pick<OfficeTransactionSearchFieldDescriptor, "options">,
  value: string | undefined
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return descriptor.options.some((option) => option.value === trimmed) ? trimmed : "";
}

function normalizeTransactionStatusQueryValue(value: string | undefined): TransactionStatus | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? transactionStatusInputDbMap[trimmed] ?? null : null;
}

function normalizeTransactionTypeQueryValue(value: string | undefined): TransactionType | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? transactionTypeInputDbMap[trimmed] ?? null : null;
}

function buildSystemTransactionSearchFields(filterOptions: OfficeTransactionFilterOptions): OfficeTransactionSearchFieldDescriptor[] {
  return [
    {
      kind: "system",
      key: "search",
      label: "Search",
      control: "text",
      supportsRange: false,
      groupLabel: "Operational",
      sortOrder: 0,
      options: [],
      placeholder: "Search address, contact, mls # ..."
    },
    {
      kind: "system",
      key: "owner",
      label: "Owner / agent",
      control: "select",
      supportsRange: false,
      groupLabel: "Operational",
      sortOrder: 20,
      options: filterOptions.ownerOptions.map((option) => ({
        value: option.id,
        label: option.label
      })),
      emptyOptionLabel: "All owners"
    },
    {
      kind: "system",
      key: "team",
      label: "Team",
      control: "select",
      supportsRange: false,
      groupLabel: "Operational",
      sortOrder: 30,
      options: filterOptions.teamOptions.map((option) => ({
        value: option.id,
        label: option.label
      })),
      emptyOptionLabel: "All teams"
    },
    {
      kind: "system",
      key: "created_at",
      label: "Created at",
      control: "date",
      supportsRange: true,
      groupLabel: "Operational",
      sortOrder: 40,
      options: []
    }
  ];
}

function buildAvailableTransactionSearchFields(
  schema: OfficeTransactionIntakeSchema,
  filterOptions: OfficeTransactionFilterOptions
) {
  const builtInFields = schema.builtInFields
    .filter((field) => field.isVisible)
    .map(
      (field) =>
        ({
          kind: "builtin",
          key: field.fieldKey,
          label: field.label,
          control: field.control === "textarea" ? "text" : field.control,
          supportsRange: field.control === "date",
          groupLabel: "Built-in",
          sortOrder: 100 + field.sortOrder,
          options:
            field.control === "select"
              ? field.selectOptions
                  .filter((option) => option.isEnabled)
                  .map((option) => ({
                    value: option.value,
                    label: option.label
                  }))
              : [],
          placeholder:
            field.control === "text" || field.control === "textarea"
              ? `Filter by ${field.label.toLowerCase()}`
              : undefined,
          emptyOptionLabel:
            field.control === "select"
              ? field.fieldKey === "transaction_status"
                ? "All statuses"
                : field.fieldKey === "transaction_type"
                  ? "All types"
                  : `Any ${field.label.toLowerCase()}`
              : undefined
        }) satisfies OfficeTransactionSearchFieldDescriptor
    );
  const customFields = schema.customFields
    .filter((field) => field.isVisible)
    .filter((field) => !hiddenSearchCustomFieldKeys.has(field.fieldKey))
    .map(
      (field) =>
        ({
          kind: "custom",
          key: field.fieldKey,
          label: field.label,
          control: field.type === "date" ? "date" : field.type === "select" ? "select" : "text",
          supportsRange: field.type === "date",
          groupLabel: "Custom",
          sortOrder: 1000 + field.sortOrder,
          options:
            field.type === "select"
              ? field.options.map((option) => ({
                  value: option,
                  label: option
                }))
              : [],
          placeholder: field.type === "text" ? `Filter by ${field.label.toLowerCase()}` : undefined,
          emptyOptionLabel: field.type === "select" ? `Any ${field.label.toLowerCase()}` : undefined
        }) satisfies OfficeTransactionSearchFieldDescriptor
    );

  return [
    ...buildSystemTransactionSearchFields(filterOptions),
    ...builtInFields,
    ...customFields
  ].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

function buildDefaultTransactionSearchFieldReferences(availableFields: OfficeTransactionSearchFieldDescriptor[]) {
  return sanitizeTransactionSearchFieldReferences(defaultTransactionSearchLayout, availableFields);
}

function buildTransactionSearchLayoutFilters(input: {
  selectedFields: OfficeTransactionSearchFieldDescriptor[];
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const searchParams = input.searchParams ?? {};
  const selectedSystemFields = input.selectedFields.filter(
    (field): field is OfficeTransactionSearchFieldDescriptor & { kind: "system" } => field.kind === "system"
  );
  const selectedSystemKeys = new Set(selectedSystemFields.map((field) => field.key));
  const selectedSystemFieldMap = new Map(selectedSystemFields.map((field) => [field.key, field]));
  const selectedBuiltInFields = input.selectedFields.filter(
    (field): field is OfficeTransactionSearchFieldDescriptor & { kind: "builtin" } => field.kind === "builtin"
  );
  const selectedCustomFields = input.selectedFields.filter(
    (field): field is OfficeTransactionSearchFieldDescriptor & { kind: "custom" } => field.kind === "custom"
  );
  const builtInFilters = Object.fromEntries(
    selectedBuiltInFields.map((field) => [field.key, buildEmptyTransactionSearchFieldFilterValue()])
  ) as Record<string, OfficeTransactionFieldFilterValue>;
  const customFilters = Object.fromEntries(
    selectedCustomFields.map((field) => [field.key, buildEmptyTransactionSearchFieldFilterValue()])
  ) as Record<string, OfficeTransactionFieldFilterValue>;

  const q = selectedSystemKeys.has("search") ? readSearchParamValue(searchParams.q).trim() : "";
  const ownerMembershipId =
    selectedSystemFieldMap.get("owner")?.control === "select"
      ? normalizeSearchSelectValue(
          selectedSystemFieldMap.get("owner")!,
          readSearchParamValue(searchParams.ownerMembershipId)
        )
      : "";
  const teamId =
    selectedSystemFieldMap.get("team")?.control === "select"
      ? normalizeSearchSelectValue(
          selectedSystemFieldMap.get("team")!,
          readSearchParamValue(searchParams.teamId)
        )
      : "";
  const createdAtFrom = selectedSystemKeys.has("created_at")
    ? normalizeSearchFilterDateValue(readSearchParamValue(searchParams.startDate))
    : "";
  const createdAtTo = selectedSystemKeys.has("created_at")
    ? normalizeSearchFilterDateValue(readSearchParamValue(searchParams.endDate))
    : "";
  const fieldFilters: OfficeTransactionFieldFilterInput[] = [];
  let status: OfficeTransactionStatus | "All" = "All";
  let type = "";

  for (const field of selectedBuiltInFields) {
    const paramValue = readSearchParamValue(searchParams[`field_${field.key}`]);

    if (field.key === "transaction_status") {
      const normalizedStatus = normalizeTransactionStatusQueryValue(
        paramValue || readSearchParamValue(searchParams.status)
      );
      const nextValue = normalizedStatus ?? "";
      builtInFilters[field.key] = {
        value: nextValue,
        from: "",
        to: ""
      };
      status = normalizedStatus ? transactionStatusLabelMap[normalizedStatus] : "All";
      continue;
    }

    if (field.key === "transaction_type") {
      const normalizedType = normalizeTransactionTypeQueryValue(
        paramValue || readSearchParamValue(searchParams.type)
      );
      const nextValue = normalizedType ?? "";
      builtInFilters[field.key] = {
        value: nextValue,
        from: "",
        to: ""
      };
      type = nextValue;
      continue;
    }

    if (field.control === "date") {
      const from = normalizeSearchFilterDateValue(readSearchParamValue(searchParams[`field_${field.key}_from`]));
      const to = normalizeSearchFilterDateValue(readSearchParamValue(searchParams[`field_${field.key}_to`]));
      builtInFilters[field.key] = {
        value: "",
        from,
        to
      };

      if (from || to) {
        fieldFilters.push({
          kind: "builtin",
          key: field.key,
          control: field.control,
          from,
          to
        });
      }

      continue;
    }

    const value =
      field.control === "select"
        ? normalizeSearchSelectValue(field, paramValue)
        : paramValue.trim();
    builtInFilters[field.key] = {
      value,
      from: "",
      to: ""
    };

    if (value) {
      fieldFilters.push({
        kind: "builtin",
        key: field.key,
        control: field.control,
        value
      });
    }
  }

  for (const field of selectedCustomFields) {
    if (field.control === "date") {
      const from = normalizeSearchFilterDateValue(readSearchParamValue(searchParams[`custom_${field.key}_from`]));
      const to = normalizeSearchFilterDateValue(readSearchParamValue(searchParams[`custom_${field.key}_to`]));
      customFilters[field.key] = {
        value: "",
        from,
        to
      };

      if (from || to) {
        fieldFilters.push({
          kind: "custom",
          key: field.key,
          control: field.control,
          from,
          to
        });
      }

      continue;
    }

    const rawValue = readSearchParamValue(searchParams[`custom_${field.key}`]).trim();
    const value =
      field.control === "select"
        ? normalizeSearchSelectValue(field, rawValue)
        : rawValue;
    customFilters[field.key] = {
      value,
      from: "",
      to: ""
    };

    if (value) {
      fieldFilters.push({
        kind: "custom",
        key: field.key,
        control: field.control,
        value
      });
    }
  }

  return {
    filters: {
      system: {
        q,
        ownerMembershipId,
        teamId,
        createdAt: {
          from: createdAtFrom,
          to: createdAtTo
        }
      },
      builtin: builtInFilters,
      custom: customFilters
    } satisfies OfficeTransactionSearchLayoutFilters,
    listFilters: {
      q,
      status,
      ownerMembershipId,
      teamId,
      type,
      startDate: createdAtFrom,
      endDate: createdAtTo,
      fieldFilters
    }
  };
}

async function getTransactionFilterContext(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
}): Promise<TransactionFilterContext> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
      ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      parentTeamId: true
    },
    orderBy: [{ name: "asc" }]
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const ownerMemberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: {
        in: selectableTransactionOwnerStatuses
      },
      ...(scope.visibleMembershipIds ? { id: { in: scope.visibleMembershipIds } } : {}),
      ...(input.officeId ? { officeId: input.officeId } : {}),
      role: {
        in: [
          "owner",
          "office_admin",
          "accountant",
          "human_resources",
          "team_lead",
          "agent",
          "office_manager",
          "office_user"
        ] satisfies UserRole[]
      }
    },
    select: {
      id: true,
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
  });

  return {
    scope,
    scopedTeams,
    teamHierarchyIndex,
    ownerMemberships
  };
}

function buildTransactionFilterOptions(context: TransactionFilterContext): OfficeTransactionFilterOptions {
  return {
    ownerOptions: context.ownerMemberships.map((membership) => ({
      id: membership.id,
      label: `${membership.user.firstName} ${membership.user.lastName}`.trim()
    })),
    teamOptions: context.scopedTeams.map((team) => ({
      id: team.id,
      label: buildTeamPathLabel(context.teamHierarchyIndex, team.id) || team.name
    }))
  };
}

function buildTransactionOwnerOfficeWhere(officeId: string | null | undefined): Prisma.MembershipWhereInput | undefined {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

function formatTransactionOwnerRoleLabel(role: UserRole) {
  if (role === "team_lead") {
    return "Team Lead";
  }

  return "Agent";
}

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function getTotalNetIncomeLabel(scope: OfficeDataScope) {
  if (canViewCrossMemberFinancials(scope)) {
    return "Office net income";
  }

  if (scope.kind === "team") {
    return "Team net income";
  }

  return "My net income";
}

function formatOptionalCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return formatCurrency(value);
}

function getPurchasedPriceValue<T extends { purchasedPrice: Prisma.Decimal | null; price: Prisma.Decimal | null }>(transaction: T) {
  return transaction.purchasedPrice ?? transaction.price;
}

function getAskingPriceValue<T extends { askingPrice: Prisma.Decimal | null }>(transaction: T) {
  return transaction.askingPrice;
}

function formatImportantDate(date: Date | null) {
  if (!date) {
    return "";
  }

  return `expires: ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

function formatDateValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const parsed = trimmed ? new Date(trimmed) : null;

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function startOfDay(value: string | undefined) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function endOfDay(value: string | undefined) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

function parseOptionalDecimal(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();

  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseTransactionFinanceFeeType(value: string | undefined): TransactionFinanceFeeType | null {
  if (
    value === "rebate" ||
    value === "client_referral" ||
    value === "external_referral" ||
    value === "company_referral" ||
    value === "channel_development_fee" ||
    value === "reimbursement"
  ) {
    return value;
  }

  return null;
}

function parseTransactionFinanceCalculationType(value: string | undefined): TransactionFinanceCalculationType | null {
  if (value === "pre_split" || value === "post_split" || value === "reimbursement") {
    return value;
  }

  return null;
}

function parseTransactionFinanceApprovalStatus(value: string | undefined): TransactionFinanceApprovalStatus | null {
  if (value === "not_required" || value === "pending" || value === "approved") {
    return value;
  }

  return null;
}

function transactionFinanceLabel(value: TransactionFinanceFeeType) {
  switch (value) {
    case "rebate":
      return "Rebate";
    case "client_referral":
      return "Internal Referral";
    case "external_referral":
      return "External Referral";
    case "company_referral":
      return "Company Referral";
    case "channel_development_fee":
      return "Channel Development Fee";
    case "reimbursement":
      return "Reimbursement";
    default:
      return value;
  }
}

function parseCreateFinanceDecimal(explicitValue: string | undefined, fallbackValue: string | undefined) {
  return parseOptionalDecimal(explicitValue) ?? parseOptionalDecimal(fallbackValue);
}

function hasStructuredFinanceFeeSubmission(input: {
  rate?: string;
  amount?: string;
  notes?: string;
}) {
  return [input.rate, input.amount, input.notes].some((value) => value?.trim().length);
}

function parseStructuredFinanceFeeNotes(value: string | undefined, fallbackValue: string | null) {
  return value === undefined ? fallbackValue : parseOptionalText(value);
}

function normalizePayloadString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTransactionIntakeDateValue(value: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("A valid date is required.");
  }

  return value;
}

function validateTransactionIntakeSelectValue(
  field: Pick<OfficeTransactionFieldSettingRecord | OfficeTransactionCustomFieldDefinitionRecord, "label" | "options">,
  value: string
) {
  if (!value) {
    return;
  }

  if (!field.options.includes(value)) {
    throw new Error(`${field.label} must use one of the configured options.`);
  }
}

function buildTransactionIntakeBuiltInDefaults() {
  return {
    transactionType: "",
    transactionStatus: "",
    representing: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    transactionName: "",
    askingPrice: "",
    purchasedPrice: "",
    price: "",
    buyerAgreementDate: "",
    buyerExpirationDate: "",
    acceptanceDate: "",
    listingDate: "",
    listingExpirationDate: "",
    closingDate: "",
    moveInDate: ""
  };
}

export function prepareTransactionIntakeSubmission(input: {
  schema: Awaited<ReturnType<typeof getOfficeTransactionIntakeSchema>>;
  payload: Record<string, unknown>;
  existingTransaction?: OfficeTransactionDetail | null;
}): PreparedTransactionIntakeSubmission {
  const builtInValues = buildTransactionIntakeBuiltInDefaults();
  const existingCustomFieldValues = { ...(input.existingTransaction?.additionalFields ?? {}) };
  const visibleBuiltInFields = input.schema.builtInFields.filter((field) => field.isVisible);
  const visibleCustomFields = input.schema.customFields.filter((field) => field.isVisible);
  const topFieldDefaults: Partial<Record<OfficeTransactionFieldSettingRecord["fieldKey"], string>> = {
    transaction_type: "other",
    transaction_status: "opportunity",
    representing: "buyer"
  };
  const getExistingBuiltInValue = (fieldKey: OfficeTransactionFieldSettingRecord["fieldKey"]) => {
    switch (fieldKey) {
      case "transaction_type":
        return input.existingTransaction?.typeValue ?? "";
      case "transaction_status":
        return input.existingTransaction?.statusValue ?? "";
      case "representing":
        return input.existingTransaction?.representingValue ?? "";
      case "address":
        return input.existingTransaction?.address ?? "";
      case "city":
        return input.existingTransaction?.city ?? "";
      case "state":
        return input.existingTransaction?.state ?? "";
      case "zip_code":
        return input.existingTransaction?.zipCode ?? "";
      case "transaction_name":
        return input.existingTransaction?.title ?? "";
      case "asking_price":
        return input.existingTransaction?.askingPrice ?? "";
      case "purchased_price":
        return input.existingTransaction?.purchasedPrice ?? input.existingTransaction?.price ?? "";
      case "price":
        return input.existingTransaction?.purchasedPrice ?? input.existingTransaction?.price ?? "";
      case "buyer_agreement_date":
        return input.existingTransaction?.buyerAgreementDate ?? "";
      case "buyer_expiration_date":
        return input.existingTransaction?.buyerExpirationDate ?? "";
      case "acceptance_date":
        return input.existingTransaction?.acceptanceDate ?? "";
      case "listing_date":
        return input.existingTransaction?.listingDate ?? "";
      case "listing_expiration_date":
        return input.existingTransaction?.listingExpirationDate ?? "";
      case "closing_date":
        return input.existingTransaction?.closingDate ?? "";
      case "move_in_date":
        return input.existingTransaction?.moveInDate ?? "";
      default:
        return "";
    }
  };
  const getTopFieldFallbackValue = (fieldKey: OfficeTransactionFieldSettingRecord["fieldKey"], preferConfiguredOption: boolean) => {
    const schemaField = input.schema.builtInFields.find((field) => field.fieldKey === fieldKey);

    if (preferConfiguredOption && schemaField?.options.length) {
      return schemaField.options[0] ?? topFieldDefaults[fieldKey] ?? "";
    }

    return topFieldDefaults[fieldKey] ?? schemaField?.options[0] ?? "";
  };

  for (const field of visibleBuiltInFields) {
    const rawValue = normalizePayloadString(input.payload[field.inputName]);
    const existingValue = field.control === "select" ? getExistingBuiltInValue(field.fieldKey) : "";
    const submittedValue = rawValue || existingValue;

    if (field.isRequired && !submittedValue) {
      throw new Error(`${field.label} is required.`);
    }

    if (field.control === "select") {
      validateTransactionIntakeSelectValue(field, submittedValue);
    }

    const nextValue = field.control === "date" ? parseTransactionIntakeDateValue(rawValue) : submittedValue;

    switch (field.fieldKey) {
      case "transaction_type":
        builtInValues.transactionType = nextValue;
        break;
      case "transaction_status":
        builtInValues.transactionStatus = nextValue;
        break;
      case "representing":
        builtInValues.representing = nextValue;
        break;
      case "address":
        builtInValues.address = nextValue;
        break;
      case "city":
        builtInValues.city = nextValue;
        break;
      case "state":
        builtInValues.state = nextValue;
        break;
      case "zip_code":
        builtInValues.zipCode = nextValue;
        break;
      case "transaction_name":
        builtInValues.transactionName = nextValue;
        break;
      case "asking_price":
        builtInValues.askingPrice = nextValue;
        break;
      case "purchased_price":
        builtInValues.purchasedPrice = nextValue;
        break;
      case "price":
        builtInValues.purchasedPrice = nextValue;
        builtInValues.price = nextValue;
        break;
      case "buyer_agreement_date":
        builtInValues.buyerAgreementDate = nextValue;
        break;
      case "buyer_expiration_date":
        builtInValues.buyerExpirationDate = nextValue;
        break;
      case "acceptance_date":
        builtInValues.acceptanceDate = nextValue;
        break;
      case "listing_date":
        builtInValues.listingDate = nextValue;
        break;
      case "listing_expiration_date":
        builtInValues.listingExpirationDate = nextValue;
        break;
      case "closing_date":
        builtInValues.closingDate = nextValue;
        break;
      case "move_in_date":
        builtInValues.moveInDate = nextValue;
        break;
      default:
        break;
    }
  }

  for (const field of input.schema.builtInFields.filter((entry) => !entry.isVisible)) {
    const currentValue = getExistingBuiltInValue(field.fieldKey);

    switch (field.fieldKey) {
      case "transaction_type":
        builtInValues.transactionType = currentValue || getTopFieldFallbackValue("transaction_type", false);
        break;
      case "transaction_status":
        builtInValues.transactionStatus = currentValue || getTopFieldFallbackValue("transaction_status", false);
        break;
      case "representing":
        builtInValues.representing = currentValue || getTopFieldFallbackValue("representing", false);
        break;
      case "address":
        builtInValues.address = currentValue;
        break;
      case "city":
        builtInValues.city = currentValue;
        break;
      case "state":
        builtInValues.state = currentValue;
        break;
      case "zip_code":
        builtInValues.zipCode = currentValue;
        break;
      case "transaction_name":
        builtInValues.transactionName = currentValue;
        break;
      case "asking_price":
        builtInValues.askingPrice = currentValue;
        break;
      case "purchased_price":
        builtInValues.purchasedPrice = currentValue;
        builtInValues.price = currentValue;
        break;
      case "price":
        builtInValues.purchasedPrice = currentValue;
        builtInValues.price = currentValue;
        break;
      case "buyer_agreement_date":
        builtInValues.buyerAgreementDate = currentValue;
        break;
      case "buyer_expiration_date":
        builtInValues.buyerExpirationDate = currentValue;
        break;
      case "acceptance_date":
        builtInValues.acceptanceDate = currentValue;
        break;
      case "listing_date":
        builtInValues.listingDate = currentValue;
        break;
      case "listing_expiration_date":
        builtInValues.listingExpirationDate = currentValue;
        break;
      case "closing_date":
        builtInValues.closingDate = currentValue;
        break;
      case "move_in_date":
        builtInValues.moveInDate = currentValue;
        break;
      default:
        break;
    }
  }

  const additionalFields = { ...existingCustomFieldValues };

  for (const field of visibleCustomFields) {
    const rawValue = normalizePayloadString(input.payload[field.inputName]);

    if (field.isRequired && !rawValue) {
      throw new Error(`${field.label} is required.`);
    }

    if (field.type === "select") {
      validateTransactionIntakeSelectValue(field, rawValue);
    }

    if (field.type === "text" && rawValue.length > 50) {
      throw new Error(`${field.label} must be 50 characters or fewer.`);
    }

    additionalFields[field.fieldKey] = field.type === "date" ? parseTransactionIntakeDateValue(rawValue) : rawValue;
  }

  if (!builtInValues.transactionType) {
    builtInValues.transactionType = getTopFieldFallbackValue("transaction_type", true);
  }

  if (!builtInValues.transactionStatus) {
    builtInValues.transactionStatus = getTopFieldFallbackValue("transaction_status", true);
  }

  if (!builtInValues.representing) {
    builtInValues.representing = getTopFieldFallbackValue("representing", true);
  }

  if (!builtInValues.transactionName && !(builtInValues.address || input.existingTransaction?.address)) {
    throw new Error("Transaction Name is required.");
  }

  return {
    transactionType: builtInValues.transactionType,
    transactionStatus: builtInValues.transactionStatus,
    representing: builtInValues.representing,
    address: builtInValues.address,
    city: builtInValues.city,
    state: builtInValues.state,
    zipCode: builtInValues.zipCode,
    transactionName: builtInValues.transactionName,
    askingPrice: builtInValues.askingPrice,
    purchasedPrice: builtInValues.purchasedPrice || builtInValues.price,
    price: builtInValues.price,
    buyerAgreementDate: builtInValues.buyerAgreementDate,
    buyerExpirationDate: builtInValues.buyerExpirationDate,
    acceptanceDate: builtInValues.acceptanceDate,
    listingDate: builtInValues.listingDate,
    listingExpirationDate: builtInValues.listingExpirationDate,
    closingDate: builtInValues.closingDate,
    moveInDate: builtInValues.moveInDate,
    additionalFields
  };
}

function formatAuditCurrencyValue(value: Prisma.Decimal | null) {
  return value ? formatCurrency(value) : "—";
}

function formatAuditTextValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function buildAuditDetail(label: string, previousValue: string, nextValue: string) {
  if (previousValue === nextValue) {
    return null;
  }

  return `${label}: ${previousValue} -> ${nextValue}`;
}

function buildAuditChange(label: string, previousValue: string, nextValue: string) {
  if (previousValue === nextValue) {
    return null;
  }

  return {
    label,
    previousValue,
    nextValue
  };
}

function buildTransactionObjectLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function getSearchMatchingTransactionStatuses(query: string) {
  const normalizedQuery = query.toLowerCase();

  return Object.entries(transactionStatusLabelMap)
    .filter(([, label]) => label.toLowerCase().includes(normalizedQuery))
    .map(([status]) => status as TransactionStatus);
}

function getSearchMatchingRepresentingValues(query: string) {
  const normalizedQuery = query.toLowerCase();

  return Object.entries(representingLabelMap)
    .filter(([, label]) => label.toLowerCase().includes(normalizedQuery))
    .map(([representing]) => representing as TransactionRepresenting);
}

function parseTransactionTypeFilter(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return Object.keys(transactionTypeLabelMap).includes(value.trim()) ? (value.trim() as TransactionType) : null;
}

function mapTransactionRecord(
  transaction: {
    id: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    askingPrice: Prisma.Decimal | null;
    purchasedPrice: Prisma.Decimal | null;
    price: Prisma.Decimal | null;
    importantDate: Date | null;
    status: TransactionStatus;
    representing: TransactionRepresenting;
    ownerMembership: {
      user: {
        firstName: string;
        lastName: string;
      };
    } | null;
  }
): OfficeTransactionRecord {
  const askingPrice = getAskingPriceValue(transaction);
  const purchasedPrice = getPurchasedPriceValue(transaction);

  return {
    id: transaction.id,
    address: `${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`.replace(/,\s+,/g, ", "),
    importantDate: formatImportantDate(transaction.importantDate),
    askingPrice: formatOptionalCurrency(askingPrice),
    purchasedPrice: formatOptionalCurrency(purchasedPrice),
    price: formatOptionalCurrency(purchasedPrice),
    owner: transaction.ownerMembership
      ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
      : "Unassigned",
    representing: representingLabelMap[transaction.representing],
    status: transactionStatusLabelMap[transaction.status],
    volume: Number(purchasedPrice ?? 0),
    isFlagged: Boolean(transaction.importantDate)
  };
}

function mapTransactionDetail(
  transaction: {
    id: string;
    organizationId: string;
    officeId: string | null;
    ownerMembershipId: string | null;
    title: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    askingPrice: Prisma.Decimal | null;
    purchasedPrice: Prisma.Decimal | null;
    price: Prisma.Decimal | null;
    type: TransactionType;
    status: TransactionStatus;
    representing: TransactionRepresenting;
    importantDate: Date | null;
    buyerAgreementDate: Date | null;
    buyerExpirationDate: Date | null;
    acceptanceDate: Date | null;
    listingDate: Date | null;
    listingExpirationDate: Date | null;
    closingDate: Date | null;
    moveInDate: Date | null;
    companyReferral: boolean;
    companyReferralEmployeeName: string | null;
    clientReferralFormApproved: boolean;
    rebateAgreementSigned: boolean;
    rebateGoogleFormSubmitted: boolean;
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    officeNet: Prisma.Decimal | null;
    agentNet: Prisma.Decimal | null;
    financeNotes: string | null;
    additionalFields: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    office: {
      name: string;
    } | null;
    ownerMembership: {
      user: {
        email: string;
        firstName: string;
        lastName: string;
      };
    } | null;
    transactionContacts?: OfficeTransactionContact[];
    availableContacts?: OfficeTransactionContactOption[];
    documents?: OfficeTransactionDocument[];
    forms?: OfficeTransactionForm[];
    signatureRequests?: OfficeSignatureRequest[];
    incomingUpdates?: OfficeIncomingUpdate[];
    formTemplates?: OfficeFormTemplateOption[];
    financeFees?: OfficeTransactionFinanceFeeRecord[];
  },
  canViewFinancials: boolean
): OfficeTransactionDetail {
  const ownerName = transaction.ownerMembership
    ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
    : "Unassigned";
  const askingPrice = getAskingPriceValue(transaction);
  const purchasedPrice = getPurchasedPriceValue(transaction);

  return {
    id: transaction.id,
    organizationId: transaction.organizationId,
    officeId: transaction.officeId,
    ownerMembershipId: transaction.ownerMembershipId,
    canViewFinancials,
    title: transaction.title,
    address: transaction.address,
    city: transaction.city,
    state: transaction.state,
    zipCode: transaction.zipCode,
    typeValue: transaction.type,
    askingPrice: askingPrice ? String(askingPrice) : "",
    purchasedPrice: purchasedPrice ? String(purchasedPrice) : "",
    price: purchasedPrice ? String(purchasedPrice) : "",
    type: transactionTypeLabelMap[transaction.type],
    statusValue: transaction.status,
    status: transactionStatusLabelMap[transaction.status],
    representingValue: transaction.representing,
    representing: representingLabelMap[transaction.representing],
    importantDate: formatDateValue(transaction.importantDate),
    buyerAgreementDate: formatDateValue(transaction.buyerAgreementDate),
    buyerExpirationDate: formatDateValue(transaction.buyerExpirationDate),
    acceptanceDate: formatDateValue(transaction.acceptanceDate),
    listingDate: formatDateValue(transaction.listingDate),
    listingExpirationDate: formatDateValue(transaction.listingExpirationDate),
    closingDate: formatDateValue(transaction.closingDate),
    moveInDate: formatDateValue(transaction.moveInDate),
    companyReferral: transaction.companyReferral ? "Yes" : "No",
    companyReferralEmployeeName: transaction.companyReferralEmployeeName ?? "",
    ownerName,
    ownerEmail: transaction.ownerMembership?.user.email ?? "",
    officeName: transaction.office?.name ?? "",
    grossCommission: redactCurrency(transaction.grossCommission ? String(transaction.grossCommission) : "", canViewFinancials),
    referralFee: redactCurrency(transaction.referralFee ? String(transaction.referralFee) : "", canViewFinancials),
    officeNet: redactCurrency(transaction.officeNet ? String(transaction.officeNet) : "", canViewFinancials),
    agentNet: redactCurrency(transaction.agentNet ? String(transaction.agentNet) : "", canViewFinancials),
    financeNotes: canViewFinancials ? transaction.financeNotes ?? "" : "Restricted",
    financeFees: transaction.financeFees ?? [],
    financePrerequisites: buildTransactionFinancePrerequisiteSnapshot({
      clientReferralFormApproved: transaction.clientReferralFormApproved,
      rebateAgreementSigned: transaction.rebateAgreementSigned,
      rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
    }),
    additionalFields:
      transaction.additionalFields && typeof transaction.additionalFields === "object" && !Array.isArray(transaction.additionalFields)
        ? stripRetiredTransactionAdditionalFields(
            Object.fromEntries(
              Object.entries(transaction.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [key, String(value ?? "")])
            )
          )
        : {},
    contacts: transaction.transactionContacts ?? [],
    availableContacts: transaction.availableContacts ?? [],
    documents: transaction.documents ?? [],
    forms: transaction.forms ?? [],
    signatureRequests: transaction.signatureRequests ?? [],
    incomingUpdates: transaction.incomingUpdates ?? [],
    formTemplates: transaction.formTemplates ?? [],
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

function buildTransactionDateFieldWhere(
  column: keyof Pick<
    Prisma.TransactionWhereInput,
    | "createdAt"
    | "buyerAgreementDate"
    | "buyerExpirationDate"
    | "acceptanceDate"
    | "listingDate"
    | "listingExpirationDate"
    | "closingDate"
    | "moveInDate"
  >,
  from: string | undefined,
  to: string | undefined
): Prisma.TransactionWhereInput | null {
  const startDate = startOfDay(from);
  const endDate = endOfDay(to);

  if (!startDate && !endDate) {
    return null;
  }

  return {
    [column]: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    }
  };
}

function buildTransactionCustomDateFieldWhere(
  fieldKey: string,
  from: string | undefined,
  to: string | undefined
): Prisma.TransactionWhereInput | null {
  const normalizedFrom = normalizeSearchFilterDateValue(from);
  const normalizedTo = normalizeSearchFilterDateValue(to);

  if (!normalizedFrom && !normalizedTo) {
    return null;
  }

  return {
    additionalFields: {
      path: [fieldKey],
      ...(normalizedFrom ? { gte: normalizedFrom } : {}),
      ...(normalizedTo ? { lte: normalizedTo } : {})
    }
  };
}

function buildTransactionFieldFilterWhere(
  filter: OfficeTransactionFieldFilterInput
): Prisma.TransactionWhereInput | null {
  if (filter.kind === "builtin") {
    switch (filter.key) {
      case "transaction_status": {
        const normalizedStatus = normalizeTransactionStatusQueryValue(filter.value);
        return normalizedStatus ? { status: normalizedStatus } : null;
      }
      case "transaction_type": {
        const normalizedType = normalizeTransactionTypeQueryValue(filter.value);
        return normalizedType ? { type: normalizedType } : null;
      }
      case "representing": {
        const normalizedRepresenting = filter.value?.trim()
          ? representingInputDbMap[filter.value.trim()] ?? null
          : null;
        return normalizedRepresenting ? { representing: normalizedRepresenting } : null;
      }
      case "address":
        return filter.value?.trim()
          ? {
              address: {
                contains: filter.value.trim(),
                mode: "insensitive"
              }
            }
          : null;
      case "city":
        return filter.value?.trim()
          ? {
              city: {
                contains: filter.value.trim(),
                mode: "insensitive"
              }
            }
          : null;
      case "state":
        return filter.value?.trim()
          ? {
              state: {
                contains: filter.value.trim(),
                mode: "insensitive"
              }
            }
          : null;
      case "zip_code":
        return filter.value?.trim()
          ? {
              zipCode: {
                contains: filter.value.trim(),
                mode: "insensitive"
              }
            }
          : null;
      case "transaction_name":
        return filter.value?.trim()
          ? {
              title: {
                contains: filter.value.trim(),
                mode: "insensitive"
              }
            }
          : null;
      case "asking_price": {
        const parsedPrice = parseOptionalDecimal(filter.value);
        return parsedPrice ? { askingPrice: parsedPrice } : null;
      }
      case "purchased_price": {
        const parsedPrice = parseOptionalDecimal(filter.value);
        return parsedPrice ? { purchasedPrice: parsedPrice } : null;
      }
      case "price": {
        const parsedPrice = parseOptionalDecimal(filter.value);
        return parsedPrice ? { purchasedPrice: parsedPrice } : null;
      }
      case "buyer_agreement_date":
        return buildTransactionDateFieldWhere("buyerAgreementDate", filter.from, filter.to);
      case "buyer_expiration_date":
        return buildTransactionDateFieldWhere("buyerExpirationDate", filter.from, filter.to);
      case "acceptance_date":
        return buildTransactionDateFieldWhere("acceptanceDate", filter.from, filter.to);
      case "listing_date":
        return buildTransactionDateFieldWhere("listingDate", filter.from, filter.to);
      case "listing_expiration_date":
        return buildTransactionDateFieldWhere("listingExpirationDate", filter.from, filter.to);
      case "closing_date":
        return buildTransactionDateFieldWhere("closingDate", filter.from, filter.to);
      case "move_in_date":
        return buildTransactionDateFieldWhere("moveInDate", filter.from, filter.to);
      default:
        return null;
    }
  }

  if (filter.control === "date") {
    return buildTransactionCustomDateFieldWhere(filter.key, filter.from, filter.to);
  }

  if (!filter.value?.trim()) {
    return null;
  }

  if (filter.control === "select") {
    return {
      additionalFields: {
        path: [filter.key],
        equals: filter.value.trim()
      }
    };
  }

  return {
    additionalFields: {
      path: [filter.key],
      string_contains: filter.value.trim(),
      mode: "insensitive"
    }
  };
}

async function loadOfficeTransactionSearchLayoutWorkspace(
  input: GetOfficeTransactionSearchLayoutSnapshotInput
): Promise<LoadedTransactionSearchLayoutWorkspace> {
  const [schema, filterContext, savedLayoutRecord] = await Promise.all([
    getOfficeTransactionIntakeSchema({
      organizationId: input.organizationId,
      officeId: input.officeId ?? null
    }),
    getTransactionFilterContext({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null
    }),
    prisma.transactionSearchLayout.findFirst({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    })
  ]);
  const filterOptions = buildTransactionFilterOptions(filterContext);
  const availableFields = buildAvailableTransactionSearchFields(schema, filterOptions);
  const normalizedSavedLayout = normalizeTransactionSearchFieldReferences(savedLayoutRecord?.fieldLayout ?? null);
  const sanitizedSavedLayout = sanitizeTransactionSearchFieldReferences(
    normalizedSavedLayout,
    availableFields
  );

  if (
    savedLayoutRecord &&
    !areTransactionSearchFieldReferencesEqual(normalizedSavedLayout, sanitizedSavedLayout)
  ) {
    await prisma.transactionSearchLayout.update({
      where: {
        id: savedLayoutRecord.id
      },
      data: {
        fieldLayout: sanitizedSavedLayout as Prisma.InputJsonValue
      }
    });
  }

  const savedLayout =
    savedLayoutRecord?.id !== undefined
      ? sanitizedSavedLayout
      : buildDefaultTransactionSearchFieldReferences(availableFields);
  const availableFieldMap = new Map(
    availableFields.map((field) => [buildSearchFieldDescriptorId(field), field] satisfies [string, OfficeTransactionSearchFieldDescriptor])
  );
  const selectedFields = savedLayout.flatMap((field) => {
    const descriptor = availableFieldMap.get(buildSearchFieldDescriptorId(field));
    return descriptor ? [descriptor] : [];
  });
  const resolvedFilters = buildTransactionSearchLayoutFilters({
    selectedFields,
    searchParams: input.searchParams
  });

  return {
    schema,
    filterContext,
    searchLayout: {
      schema,
      filterOptions,
      availableFields,
      selectedFields,
      savedLayout,
      filters: resolvedFilters.filters,
      listFilters: resolvedFilters.listFilters
    }
  };
}

export async function getOfficeTransactionSearchLayoutSnapshot(
  input: GetOfficeTransactionSearchLayoutSnapshotInput
): Promise<OfficeTransactionSearchLayoutSnapshot> {
  const workspace = await loadOfficeTransactionSearchLayoutWorkspace(input);

  return workspace.searchLayout;
}

function buildTransactionListWhere(input: Pick<
  ListTransactionsInput,
  | "organizationId"
  | "officeId"
  | "search"
  | "status"
  | "ownerMembershipId"
  | "teamId"
  | "type"
  | "startDate"
  | "endDate"
  | "fieldFilters"
>, filterContext: TransactionFilterContext) {
  const { scope, teamHierarchyIndex } = filterContext;
  const selectedTeamIds = input.teamId?.trim() ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const whereConditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    buildTransactionPortfolioVisibilityWhere(scope)
  ];
  const transactionType = parseTransactionTypeFilter(input.type);
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);

  if (input.officeId) {
    whereConditions.push({
      officeId: input.officeId
    });
  }

  if (input.status && input.status !== "All") {
    whereConditions.push({
      status: transactionStatusDisplayDbMap[input.status]
    });
  }

  if (input.ownerMembershipId?.trim()) {
    whereConditions.push({
      ownerMembershipId: input.ownerMembershipId.trim()
    });
  }

  if (input.teamId?.trim()) {
    whereConditions.push({
      ownerMembership: {
        is: {
          teamMemberships: {
            some: {
              organizationId: input.organizationId,
              teamId: {
                in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
              },
              ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
              team: {
                isActive: true
              }
            }
          }
        }
      }
    });
  }

  if (transactionType) {
    whereConditions.push({
      type: transactionType
    });
  }

  if (startDate || endDate) {
    whereConditions.push({
      createdAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    });
  }

  for (const fieldFilter of input.fieldFilters ?? []) {
    const nextWhere = buildTransactionFieldFilterWhere(fieldFilter);

    if (nextWhere) {
      whereConditions.push(nextWhere);
    }
  }

  if (input.search?.trim()) {
    const query = input.search.trim();
    const matchingStatuses = getSearchMatchingTransactionStatuses(query);
    const matchingRepresentingValues = getSearchMatchingRepresentingValues(query);

    whereConditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { zipCode: { contains: query, mode: "insensitive" } },
        {
          ownerMembership: {
            user: {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } }
              ]
            }
          }
        },
        {
          transactionContacts: {
            some: {
              client: {
                OR: [
                  { fullName: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query, mode: "insensitive" } }
                ]
              }
            }
          }
        },
        ...(matchingStatuses.length > 0 ? [{ status: { in: matchingStatuses } }] : []),
        ...(matchingRepresentingValues.length > 0 ? [{ representing: { in: matchingRepresentingValues } }] : [])
      ]
    });
  }

  return {
    scope,
    where: whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions }
  };
}

async function listTransactionsWithContext(
  input: ListTransactionsInput,
  filterContext: TransactionFilterContext
): Promise<OfficeTransactionListResult> {
  const { scope, where } = buildTransactionListWhere(input, filterContext);
  const requestedPage = Number.isFinite(input.page) ? Number(input.page) : defaultTransactionsPage;
  const requestedPageSize = Number.isFinite(input.pageSize) ? Number(input.pageSize) : defaultTransactionsPageSize;
  const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || defaultTransactionsPageSize, 1), maxTransactionsPageSize);
  const scopedMembershipIds = getMyScopedMembershipIds(scope);
  const totalCount = await prisma.transaction.count({
    where
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(Math.trunc(requestedPage) || defaultTransactionsPage, 1), totalPages);
  const [transactions, financeAggregate, scopedCommissionIncomeAggregate, scopedFallbackIncomeAggregate] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        askingPrice: true,
        purchasedPrice: true,
        price: true,
        importantDate: true,
        status: true,
        representing: true,
        ownerMembership: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.transaction.aggregate({
      where,
      _sum: {
        officeNet: true
      }
    }),
    prisma.commissionCalculation.aggregate({
      where: {
        organizationId: input.organizationId,
        membershipId: {
          in: scopedMembershipIds
        },
        transaction: {
          is: where
        }
      },
      _sum: {
        statementAmount: true
      }
    }),
    prisma.transaction.aggregate({
      where: {
        ...where,
        ownerMembershipId: {
          in: scopedMembershipIds
        },
        commissionCalculations: {
          none: {
            membershipId: {
              in: scopedMembershipIds
            }
          }
        }
      },
      _sum: {
        agentNet: true
      }
    })
  ]);

  return {
    transactions: transactions.map(mapTransactionRecord),
    summary: {
      totalCount,
      totalNetIncomeLabel: getTotalNetIncomeLabel(scope),
      totalNetIncome: canViewCrossMemberFinancials(scope)
        ? formatCurrency(financeAggregate._sum.officeNet)
        : formatCurrency(
            Number(scopedCommissionIncomeAggregate._sum.statementAmount ?? 0) + Number(scopedFallbackIncomeAggregate._sum.agentNet ?? 0)
          )
    },
    totalCount,
    totalPages,
    page,
    pageSize,
    filterOptions: buildTransactionFilterOptions(filterContext)
  };
}

export async function getOfficeTransactionsPageSnapshot(
  input: GetOfficeTransactionSearchLayoutSnapshotInput & {
    page?: number;
    pageSize?: number;
  }
): Promise<OfficeTransactionsPageSnapshot> {
  const workspace = await loadOfficeTransactionSearchLayoutWorkspace(input);
  const listResult = await listTransactionsWithContext(
    {
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      search: workspace.searchLayout.listFilters.q,
      status: workspace.searchLayout.listFilters.status,
      ownerMembershipId: workspace.searchLayout.listFilters.ownerMembershipId,
      teamId: workspace.searchLayout.listFilters.teamId,
      type: workspace.searchLayout.listFilters.type,
      startDate: workspace.searchLayout.listFilters.startDate,
      endDate: workspace.searchLayout.listFilters.endDate,
      fieldFilters: workspace.searchLayout.listFilters.fieldFilters,
      page: input.page,
      pageSize: input.pageSize
    },
    workspace.filterContext
  );

  return {
    searchLayout: workspace.searchLayout,
    listResult
  };
}

export async function listTransactions(input: ListTransactionsInput): Promise<OfficeTransactionListResult> {
  const filterContext = await getTransactionFilterContext({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });

  return listTransactionsWithContext(input, filterContext);
}

export async function saveOfficeTransactionSearchLayout(
  input: SaveOfficeTransactionSearchLayoutInput
): Promise<OfficeTransactionSearchFieldReference[]> {
  const schema = await getOfficeTransactionIntakeSchema({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null
  });
  const availableFields = buildAvailableTransactionSearchFields(schema, {
    ownerOptions: [],
    teamOptions: []
  });
  const sanitizedFields = sanitizeTransactionSearchFieldReferences(input.fields, availableFields);
  const availableFieldMap = new Map(
    availableFields.map((field) => [buildSearchFieldDescriptorId(field), field] satisfies [string, OfficeTransactionSearchFieldDescriptor])
  );
  const previousFieldLabels = (storedValue: Prisma.JsonValue | null | undefined) =>
    normalizeTransactionSearchFieldReferences(storedValue)
      .flatMap((field) => {
        const descriptor = availableFieldMap.get(buildSearchFieldDescriptorId(field));
        return descriptor ? [descriptor.label] : [];
      })
      .join(", ");
  const nextFieldLabels = sanitizedFields
    .flatMap((field) => {
      const descriptor = availableFieldMap.get(buildSearchFieldDescriptorId(field));
      return descriptor ? [descriptor.label] : [];
    })
    .join(", ");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transactionSearchLayout.findFirst({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const saved = existing
      ? await tx.transactionSearchLayout.update({
          where: {
            id: existing.id
          },
          data: {
            updatedByMembershipId: input.actorMembershipId,
            fieldLayout: sanitizedFields as Prisma.InputJsonValue
          }
        })
      : await tx.transactionSearchLayout.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            updatedByMembershipId: input.actorMembershipId,
            fieldLayout: sanitizedFields as Prisma.InputJsonValue
          }
        });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_search_layout",
      entityId: saved.id,
      action: activityLogActions.settingsTransactionSearchLayoutUpdated,
      payload: {
        objectLabel: "Transaction search layout",
        contextHref: "/office/transactions",
        details: [
          `Visible search fields: ${nextFieldLabels || "None"}`
        ],
        changes: [
          {
            label: "Visible fields",
            previousValue: previousFieldLabels(existing?.fieldLayout) || null,
            nextValue: nextFieldLabels || "None"
          }
        ]
      }
    });

    return sanitizedFields;
  });
}

export async function getOfficeTransactionOwnerAssignment(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
}): Promise<OfficeTransactionOwnerAssignment> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });
  const canSelectDifferentOwner =
    scope.viewerPermissions.includes("transactions:create") && scope.viewerPermissions.includes("transactions:view:company");

  const [viewerMembership, ownerMemberships] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        id: input.viewerMembershipId,
        organizationId: input.organizationId,
        ...(buildTransactionOwnerOfficeWhere(input.officeId) ?? {})
      },
      include: {
        user: true
      }
    }),
    canSelectDifferentOwner
      ? prisma.membership.findMany({
          where: {
            organizationId: input.organizationId,
            status: {
              in: selectableTransactionOwnerStatuses
            },
            ...(buildTransactionOwnerOfficeWhere(input.officeId) ?? {}),
            role: {
              in: transactionOwnerRoleValues
            }
          },
          include: {
            user: true
          },
          orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
        })
      : Promise.resolve([])
  ]);

  if (!viewerMembership) {
    throw new Error("Viewer membership was not found.");
  }

  return {
    currentOwnerMembershipId: viewerMembership.id,
    currentOwnerLabel: `${viewerMembership.user.firstName} ${viewerMembership.user.lastName}`.trim() || viewerMembership.user.email,
    canSelectDifferentOwner,
    options: ownerMemberships.map((membership) => ({
      id: membership.id,
      label: `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email,
      roleLabel: formatTransactionOwnerRoleLabel(membership.role),
      roleValue: membership.role
    }))
  };
}

export const officeTransactionsPageDefaults = {
  page: defaultTransactionsPage,
  pageSize: defaultTransactionsPageSize
} as const;

export const officeTransactionsPageLimits = {
  maxPageSize: maxTransactionsPageSize
} as const;

export async function getTransactionById(input: GetTransactionByIdInput): Promise<OfficeTransactionDetail | null> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId,
      ...(input.officeId ? { officeId: input.officeId } : {}),
      ...buildTransactionVisibilityWhere(scope)
    },
    include: {
      office: true,
      ownerMembership: {
        include: {
          user: true
        }
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId
        },
        include: {
          client: {
            select: {
              fullName: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!transaction) {
    return null;
  }

  const canViewFinancials = canViewFinancialsForMembership(scope, transaction.ownerMembershipId);
  const financeFees = await prisma.$transaction((tx) =>
    ensureTransactionFinanceFees(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId,
      transactionId: transaction.id,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    })
  );

  const [availableContacts, documentsSnapshot] = await Promise.all([
    listAvailableContactsForTransaction(input.organizationId, input.transactionId),
    listTransactionDocumentsSnapshot(input.organizationId, input.transactionId)
  ]);

  return mapTransactionDetail(
    {
      ...transaction,
      transactionContacts: transaction.transactionContacts.map((transactionContact) => ({
        id: transactionContact.id,
        transactionId: transactionContact.transactionId,
        clientId: transactionContact.clientId,
        fullName: transactionContact.client.fullName,
        email: transactionContact.client.email ?? "",
        phone: transactionContact.client.phone ?? "",
        role: transactionContact.role
          .split("_")
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join("-"),
        isPrimary: transactionContact.isPrimary,
        notes: transactionContact.notes ?? ""
      })),
      availableContacts,
      financeFees: financeFees.map((fee) =>
        mapTransactionFinanceFeeRecord(fee, {
          restrictAmounts: !canViewFinancials
        })
      ),
      documents: documentsSnapshot.documents,
      forms: documentsSnapshot.forms,
      signatureRequests: documentsSnapshot.signatureRequests,
      incomingUpdates: documentsSnapshot.incomingUpdates,
      formTemplates: documentsSnapshot.formTemplates
    },
    canViewFinancials
  );
}

export async function createTransaction(input: CreateTransactionInput): Promise<OfficeTransactionDetail> {
  const transaction = await prisma.$transaction(async (tx) => {
    const ownerMembership = await tx.membership.findFirst({
      where: {
        id: input.ownerMembershipId,
        organizationId: input.organizationId,
        status: {
          in: selectableTransactionOwnerStatuses
        },
        ...(buildTransactionOwnerOfficeWhere(input.officeId) ?? {}),
        role: {
          in: transactionOwnerRoleValues
        }
      },
      include: {
        user: true
      }
    });

    if (!ownerMembership) {
      throw new Error("Transaction owner was not found.");
    }

    const ownerLabel = `${ownerMembership.user.firstName} ${ownerMembership.user.lastName}`.trim() || ownerMembership.user.email;
    const additionalFields = stripRetiredTransactionAdditionalFields({
      ...(input.additionalFields ?? {}),
      agentName: ownerLabel
    });
    const companyReferralValue = (input.companyReferral ?? "").toString().trim().toLowerCase();
    const companyReferral = companyReferralValue === "yes";
    const companyReferralEmployeeName = parseOptionalText(input.companyReferralEmployeeName) ?? "";
    const askingPrice = parseOptionalDecimal(input.askingPrice);
    const purchasedPrice = parseOptionalDecimal(input.purchasedPrice ?? input.price);
    const grossCommission = parseCreateFinanceDecimal(input.grossCommission, undefined);
    const referralFee = parseCreateFinanceDecimal(input.referralFee, undefined);
    const officeNet = parseCreateFinanceDecimal(input.officeNet, undefined);
    const agentNet = parseCreateFinanceDecimal(input.agentNet, undefined);
    const financeNotes = parseOptionalText(input.financeNotes);

    const created = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        ownerMembershipId: input.ownerMembershipId,
        type: transactionTypeInputDbMap[input.transactionType] ?? "other",
        status: transactionStatusInputDbMap[input.transactionStatus] ?? "opportunity",
        representing: representingInputDbMap[input.representing] ?? "buyer",
        title: input.transactionName.trim() || input.address.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        zipCode: input.zipCode.trim(),
        askingPrice,
        purchasedPrice,
        price: purchasedPrice,
        importantDate: parseOptionalDate(input.buyerExpirationDate) ?? parseOptionalDate(input.moveInDate) ?? parseOptionalDate(input.closingDate),
        buyerAgreementDate: parseOptionalDate(input.buyerAgreementDate),
        buyerExpirationDate: parseOptionalDate(input.buyerExpirationDate),
        acceptanceDate: parseOptionalDate(input.acceptanceDate),
        listingDate: parseOptionalDate(input.listingDate),
        listingExpirationDate: parseOptionalDate(input.listingExpirationDate),
        closingDate: parseOptionalDate(input.closingDate),
        moveInDate: parseOptionalDate(input.moveInDate),
        companyReferral,
        companyReferralEmployeeName: companyReferralEmployeeName || null,
        grossCommission,
        referralFee,
        officeNet,
        agentNet,
        financeNotes,
        referralContext: companyReferral
          ? {
              companyReferralEmployeeName
            }
          : Prisma.JsonNull,
        commissionContext: Prisma.JsonNull,
        additionalFields
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

    const financeFees = await ensureTransactionFinanceFees(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? created.officeId,
      transactionId: created.id,
      grossCommission: created.grossCommission,
      referralFee: created.referralFee,
      companyReferral: created.companyReferral,
      additionalFields: created.additionalFields
    });

    if (input.fees && input.fees.length > 0) {
      const feeByType = new Map(financeFees.map((fee) => [fee.feeType, fee]));

      for (const feeInput of input.fees) {
        if (!hasStructuredFinanceFeeSubmission(feeInput)) {
          continue;
        }

        const feeType = parseTransactionFinanceFeeType(feeInput.feeType);

        if (!feeType) {
          continue;
        }

        if (feeType === "company_referral" && !created.companyReferral) {
          continue;
        }

        const existingFee = feeByType.get(feeType);

        if (!existingFee) {
          continue;
        }

        const normalized = normalizeTransactionFinanceFeeForPersistence({
          feeType,
          grossCommission: created.grossCommission,
          existingRate: existingFee.rate,
          existingAmount: existingFee.amount,
          existingCalculationType: existingFee.selectedCalculationType,
          existingApprovalStatus: existingFee.approvalStatus,
          rate: parseOptionalDecimal(feeInput.rate),
          amount: parseOptionalDecimal(feeInput.amount),
          selectedCalculationType: parseTransactionFinanceCalculationType(feeInput.selectedCalculationType),
          requestedApprovalStatus: parseTransactionFinanceApprovalStatus(feeInput.approvalStatus),
          notes: parseStructuredFinanceFeeNotes(feeInput.notes, existingFee.notes)
        });

        await tx.transactionFinanceFee.update({
          where: {
            id: existingFee.id
          },
          data: {
            rate: normalized.rate,
            amount: normalized.amount,
            selectedCalculationType: normalized.selectedCalculationType,
            approvalRequired: normalized.approvalRequired,
            approvalStatus: normalized.approvalStatus,
            notes: normalized.notes,
            approvedAt: normalized.approvalStatus === "approved" ? new Date() : null,
            approvedByMembershipId: normalized.approvalStatus === "approved" ? input.actorMembershipId ?? null : null
          }
        });
      }

      const refreshedFees = await tx.transactionFinanceFee.findMany({
        where: {
          organizationId: input.organizationId,
          transactionId: created.id
        }
      });
      const computedPreSplitTotal = refreshedFees
        .filter((fee) => fee.selectedCalculationType === "pre_split")
        .reduce((sum, fee) => sum.plus(fee.amount ?? 0), new Prisma.Decimal(0));

      await tx.transaction.update({
        where: {
          id: created.id
        },
        data: {
          referralFee: computedPreSplitTotal
        }
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "transaction",
      entityId: created.id,
      action: activityLogActions.transactionCreated,
      payload: {
        officeId: created.officeId,
        transactionId: created.id,
        transactionLabel: buildTransactionObjectLabel(created),
        objectLabel: buildTransactionObjectLabel(created),
        details: [
          `Status: ${transactionStatusLabelMap[created.status]}`,
          `Representing: ${representingLabelMap[created.representing]}`,
          `Owner: ${created.ownerMembership ? `${created.ownerMembership.user.firstName} ${created.ownerMembership.user.lastName}` : "Unassigned"}`
        ]
      }
    });

    return created;
  });

  return mapTransactionDetail(
    {
      ...transaction,
      transactionContacts: [],
      availableContacts: []
    },
    true
  );
}

export async function updateTransactionStatus(input: UpdateTransactionStatusInput): Promise<OfficeTransactionDetail | null> {
  if (!input.actorMembershipId) {
    throw new Error("Actor membership is required.");
  }

  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId
  });
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId,
      ...buildTransactionVisibilityWhere(scope)
    },
    select: {
      id: true,
      officeId: true,
      ownerMembershipId: true,
      title: true,
      address: true,
      city: true,
      state: true,
      status: true
    }
  });

  if (!transaction) {
    return null;
  }

  const nextStatus = transactionStatusDisplayDbMap[input.status];
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.transaction.update({
      where: {
        id: input.transactionId
      },
      data: {
        status: nextStatus,
        importantDate: input.status === "Closed" || input.status === "Cancelled" ? null : undefined
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

    if (transaction.status !== nextStatus) {
      const statusChange = buildAuditChange("Status", transactionStatusLabelMap[transaction.status], transactionStatusLabelMap[saved.status]);
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "transaction",
        entityId: saved.id,
        action:
          nextStatus === "closed"
            ? activityLogActions.transactionClosed
            : nextStatus === "cancelled"
              ? activityLogActions.transactionCancelled
              : activityLogActions.transactionStatusChanged,
        payload: {
          officeId: saved.officeId,
          transactionId: saved.id,
          transactionLabel: buildTransactionObjectLabel(saved),
          objectLabel: buildTransactionObjectLabel(saved),
          changes: statusChange ? [statusChange] : [],
          details: [
            ...(nextStatus === "closed" ? ["Closed workflow reached"] : []),
            ...(nextStatus === "cancelled" ? ["Cancelled workflow reached"] : [])
          ]
        }
      });
    }

    return saved;
  });

  return mapTransactionDetail(
    {
      ...updated,
      transactionContacts: [],
      availableContacts: []
    },
    canViewFinancialsForMembership(scope, updated.ownerMembershipId)
  );
}

export async function updateTransactionFinance(input: UpdateTransactionFinanceInput): Promise<OfficeTransactionDetail | null> {
  if (!input.actorMembershipId) {
    throw new Error("Actor membership is required.");
  }

  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId
  });
  const existing = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId,
      ...buildTransactionVisibilityWhere(scope)
    },
    select: {
      id: true,
      officeId: true,
      title: true,
      address: true,
      city: true,
      state: true,
      companyReferral: true,
      additionalFields: true,
      grossCommission: true,
      referralFee: true,
      officeNet: true,
      agentNet: true,
      financeNotes: true,
      clientReferralFormApproved: true,
      rebateAgreementSigned: true,
      rebateGoogleFormSubmitted: true
    }
  });

  if (!existing) {
    return null;
  }

  const nextGrossCommission = parseOptionalDecimal(input.grossCommission) ?? existing.grossCommission;
  const manualReferralFee = parseOptionalDecimal(input.referralFee);
  const nextOfficeNet = parseOptionalDecimal(input.officeNet) ?? existing.officeNet;
  const nextAgentNet = parseOptionalDecimal(input.agentNet) ?? existing.agentNet;
  const nextFinanceNotes = input.financeNotes !== undefined ? parseOptionalText(input.financeNotes) : existing.financeNotes;
  const nextClientReferralFormApproved = input.clientReferralFormApproved ?? existing.clientReferralFormApproved;
  const nextRebateAgreementSigned = input.rebateAgreementSigned ?? existing.rebateAgreementSigned;
  const nextRebateGoogleFormSubmitted = input.rebateGoogleFormSubmitted ?? existing.rebateGoogleFormSubmitted;

  await prisma.$transaction(async (tx) => {
    const financeFees = await ensureTransactionFinanceFees(tx, {
      organizationId: input.organizationId,
      officeId: existing.officeId,
      transactionId: input.transactionId,
      grossCommission: existing.grossCommission,
      referralFee: existing.referralFee,
      companyReferral: existing.companyReferral,
      additionalFields: existing.additionalFields
    });
    const feeByType = new Map(financeFees.map((fee) => [fee.feeType, fee]));
    const feeDetails: string[] = [];

    for (const feeInput of input.fees ?? []) {
      const feeType = parseTransactionFinanceFeeType(feeInput.feeType);

      if (!feeType) {
        continue;
      }

      const existingFee = feeByType.get(feeType);

      if (!existingFee) {
        continue;
      }

      const isBlockedCompanyReferralFee = feeType === "company_referral" && !existing.companyReferral;
      const parsedRate = isBlockedCompanyReferralFee ? null : parseOptionalDecimal(feeInput.rate);
      const parsedAmount = isBlockedCompanyReferralFee ? null : parseOptionalDecimal(feeInput.amount);
      const parsedNotes = isBlockedCompanyReferralFee
        ? null
        : parseStructuredFinanceFeeNotes(feeInput.notes, existingFee.notes);

      const normalized = normalizeTransactionFinanceFeeForPersistence({
        feeType,
        grossCommission: nextGrossCommission,
        existingRate: existingFee.rate,
        existingAmount: existingFee.amount,
        existingCalculationType: existingFee.selectedCalculationType,
        existingApprovalStatus: existingFee.approvalStatus,
        rate: parsedRate,
        amount: parsedAmount,
        selectedCalculationType: parseTransactionFinanceCalculationType(feeInput.selectedCalculationType),
        requestedApprovalStatus: parseTransactionFinanceApprovalStatus(feeInput.approvalStatus),
        notes: parsedNotes
      });

      await tx.transactionFinanceFee.update({
        where: {
          id: existingFee.id
        },
        data: {
          rate: normalized.rate,
          amount: normalized.amount,
          selectedCalculationType: normalized.selectedCalculationType,
          approvalRequired: normalized.approvalRequired,
          approvalStatus: normalized.approvalStatus,
          notes: normalized.notes,
          approvedAt: normalized.approvalStatus === "approved" ? new Date() : null,
          approvedByMembershipId: normalized.approvalStatus === "approved" ? input.actorMembershipId : null
        }
      });

      feeDetails.push(
        `${feeType}: ${transactionFinanceLabel(feeType)} ${formatAuditCurrencyValue(existingFee.amount)} -> ${formatAuditCurrencyValue(normalized.amount)}`
      );
    }

    const refreshedFees = await tx.transactionFinanceFee.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: input.transactionId
      }
    });
    const computedPreSplitTotal = refreshedFees
      .filter((fee) => fee.selectedCalculationType === "pre_split")
      .reduce((sum, fee) => sum.plus(fee.amount ?? 0), new Prisma.Decimal(0));
    const nextReferralFee = input.fees && input.fees.length > 0 ? computedPreSplitTotal : manualReferralFee ?? existing.referralFee;

    await tx.transaction.update({
      where: {
        id: input.transactionId
      },
      data: {
        grossCommission: nextGrossCommission,
        referralFee: nextReferralFee,
        officeNet: nextOfficeNet,
        agentNet: nextAgentNet,
        financeNotes: nextFinanceNotes,
        clientReferralFormApproved: nextClientReferralFormApproved,
        rebateAgreementSigned: nextRebateAgreementSigned,
        rebateGoogleFormSubmitted: nextRebateGoogleFormSubmitted
      }
    });

    const details = [
      buildAuditDetail("Gross commission", formatAuditCurrencyValue(existing.grossCommission), formatAuditCurrencyValue(nextGrossCommission)),
      buildAuditDetail("Referral fee", formatAuditCurrencyValue(existing.referralFee), formatAuditCurrencyValue(nextReferralFee)),
      buildAuditDetail("Office net", formatAuditCurrencyValue(existing.officeNet), formatAuditCurrencyValue(nextOfficeNet)),
      buildAuditDetail("Agent net", formatAuditCurrencyValue(existing.agentNet), formatAuditCurrencyValue(nextAgentNet)),
      buildAuditDetail("Finance notes", formatAuditTextValue(existing.financeNotes), formatAuditTextValue(nextFinanceNotes)),
      buildAuditDetail(
        "Internal referral form approved",
        existing.clientReferralFormApproved ? "Yes" : "No",
        nextClientReferralFormApproved ? "Yes" : "No"
      ),
      buildAuditDetail("Rebate agreement signed", existing.rebateAgreementSigned ? "Yes" : "No", nextRebateAgreementSigned ? "Yes" : "No"),
      buildAuditDetail(
        "Rebate Google Form submitted",
        existing.rebateGoogleFormSubmitted ? "Yes" : "No",
        nextRebateGoogleFormSubmitted ? "Yes" : "No"
      ),
      ...feeDetails
    ].filter((detail): detail is string => Boolean(detail));
    const changes = [
      buildAuditChange("Gross commission", formatAuditCurrencyValue(existing.grossCommission), formatAuditCurrencyValue(nextGrossCommission)),
      buildAuditChange("Referral fee", formatAuditCurrencyValue(existing.referralFee), formatAuditCurrencyValue(nextReferralFee)),
      buildAuditChange("Office net", formatAuditCurrencyValue(existing.officeNet), formatAuditCurrencyValue(nextOfficeNet)),
      buildAuditChange("Agent net", formatAuditCurrencyValue(existing.agentNet), formatAuditCurrencyValue(nextAgentNet)),
      buildAuditChange("Finance notes", formatAuditTextValue(existing.financeNotes), formatAuditTextValue(nextFinanceNotes)),
      buildAuditChange("Internal referral form approved", existing.clientReferralFormApproved ? "Yes" : "No", nextClientReferralFormApproved ? "Yes" : "No"),
      buildAuditChange("Rebate agreement signed", existing.rebateAgreementSigned ? "Yes" : "No", nextRebateAgreementSigned ? "Yes" : "No"),
      buildAuditChange(
        "Rebate Google Form submitted",
        existing.rebateGoogleFormSubmitted ? "Yes" : "No",
        nextRebateGoogleFormSubmitted ? "Yes" : "No"
      )
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (details.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "transaction",
        entityId: input.transactionId,
        action: activityLogActions.transactionFinanceUpdated,
        payload: {
          officeId: existing.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing),
          objectLabel: buildTransactionObjectLabel(existing),
          changes,
          details
        }
      });
    }
  });

  return getTransactionById({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId,
    transactionId: input.transactionId,
    officeId: existing.officeId
  });
}

export async function updateTransactionIntake(input: UpdateTransactionIntakeInput): Promise<OfficeTransactionDetail | null> {
  if (!input.actorMembershipId) {
    throw new Error("Actor membership is required.");
  }

  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId
  });
  const canManageTransactionFinance = scope.viewerPermissions.includes("transactions:finance");
  const existing = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId,
      ...buildTransactionVisibilityWhere(scope)
    },
    select: {
      id: true,
      officeId: true,
      title: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      type: true,
      status: true,
      representing: true,
      price: true,
      buyerAgreementDate: true,
      buyerExpirationDate: true,
      acceptanceDate: true,
      listingDate: true,
      listingExpirationDate: true,
      closingDate: true,
      moveInDate: true,
      companyReferral: true,
      companyReferralEmployeeName: true,
      askingPrice: true,
      purchasedPrice: true,
      grossCommission: true,
      referralFee: true,
      officeNet: true,
      agentNet: true,
      financeNotes: true,
      additionalFields: true,
      ownerMembership: {
        include: {
          user: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  const existingAdditionalFields =
    existing.additionalFields && typeof existing.additionalFields === "object" && !Array.isArray(existing.additionalFields)
      ? stripRetiredTransactionAdditionalFields(
          Object.fromEntries(
            Object.entries(existing.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [key, String(value ?? "")])
          )
        )
      : {};
  const sanitizedAdditionalFieldsInput = sanitizeEditableIntakeAdditionalFields(input.additionalFields, canManageTransactionFinance);
  const mergedAdditionalFields = {
    ...existingAdditionalFields,
    ...sanitizedAdditionalFieldsInput
  };
  const ownerLabel =
    existing.ownerMembership
      ? `${existing.ownerMembership.user.firstName} ${existing.ownerMembership.user.lastName}`.trim() || existing.ownerMembership.user.email
      : existingAdditionalFields.agentName ?? "";

  if (ownerLabel) {
    mergedAdditionalFields.agentName = ownerLabel;
  }
  const nextTitle = input.transactionName.trim() || input.address.trim() || existing.title;
  const nextAddress = input.address.trim();
  const nextCity = input.city.trim();
  const nextState = input.state.trim();
  const nextZipCode = input.zipCode.trim();
  const nextAskingPrice = parseOptionalDecimal(input.askingPrice) ?? existing.askingPrice;
  const nextPurchasedPrice = parseOptionalDecimal(input.purchasedPrice ?? input.price) ?? existing.purchasedPrice ?? existing.price;
  const nextBuyerAgreementDate = parseOptionalDate(input.buyerAgreementDate);
  const nextBuyerExpirationDate = parseOptionalDate(input.buyerExpirationDate);
  const nextAcceptanceDate = parseOptionalDate(input.acceptanceDate);
  const nextListingDate = parseOptionalDate(input.listingDate);
  const nextListingExpirationDate = parseOptionalDate(input.listingExpirationDate);
  const nextClosingDate = parseOptionalDate(input.closingDate);
  const nextMoveInDate = parseOptionalDate(input.moveInDate);
  const nextImportantDate =
    parseOptionalDate(input.buyerExpirationDate) ?? parseOptionalDate(input.moveInDate) ?? parseOptionalDate(input.closingDate);
  const nextTransactionType = transactionTypeInputDbMap[input.transactionType] ?? existing.type;
  const nextTransactionStatus = transactionStatusInputDbMap[input.transactionStatus] ?? existing.status;
  const nextRepresenting = representingInputDbMap[input.representing] ?? existing.representing;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: {
        id: input.transactionId
      },
      data: {
        type: nextTransactionType,
        status: nextTransactionStatus,
        representing: nextRepresenting,
        title: nextTitle,
        address: nextAddress,
        city: nextCity,
        state: nextState,
        zipCode: nextZipCode,
        askingPrice: nextAskingPrice,
        purchasedPrice: nextPurchasedPrice,
        price: nextPurchasedPrice,
        importantDate: nextImportantDate,
        buyerAgreementDate: nextBuyerAgreementDate,
        buyerExpirationDate: nextBuyerExpirationDate,
        acceptanceDate: nextAcceptanceDate,
        listingDate: nextListingDate,
        listingExpirationDate: nextListingExpirationDate,
        closingDate: nextClosingDate,
        moveInDate: nextMoveInDate,
        additionalFields: mergedAdditionalFields
      }
    });

    const details = [
      buildAuditDetail("Transaction name", existing.title, nextTitle),
      buildAuditDetail("Address", existing.address, nextAddress),
      buildAuditDetail("City", existing.city, nextCity),
      buildAuditDetail("State", existing.state, nextState),
      buildAuditDetail("Zip", existing.zipCode, nextZipCode),
      buildAuditDetail("Type", transactionTypeLabelMap[existing.type], transactionTypeLabelMap[nextTransactionType]),
      buildAuditDetail("Status", transactionStatusLabelMap[existing.status], transactionStatusLabelMap[nextTransactionStatus]),
      buildAuditDetail("Representing", representingLabelMap[existing.representing], representingLabelMap[nextRepresenting]),
      buildAuditDetail("Asking price", formatAuditCurrencyValue(existing.askingPrice), formatAuditCurrencyValue(nextAskingPrice)),
      buildAuditDetail(
        "Purchased price",
        formatAuditCurrencyValue(existing.purchasedPrice ?? existing.price),
        formatAuditCurrencyValue(nextPurchasedPrice)
      ),
      buildAuditDetail("Buyer agreement date", formatAuditTextValue(formatDateValue(existing.buyerAgreementDate)), formatAuditTextValue(input.buyerAgreementDate)),
      buildAuditDetail("Buyer expiration date", formatAuditTextValue(formatDateValue(existing.buyerExpirationDate)), formatAuditTextValue(input.buyerExpirationDate)),
      buildAuditDetail("Acceptance date", formatAuditTextValue(formatDateValue(existing.acceptanceDate)), formatAuditTextValue(input.acceptanceDate)),
      buildAuditDetail("Listing date", formatAuditTextValue(formatDateValue(existing.listingDate)), formatAuditTextValue(input.listingDate)),
      buildAuditDetail("Listing expiration date", formatAuditTextValue(formatDateValue(existing.listingExpirationDate)), formatAuditTextValue(input.listingExpirationDate)),
      buildAuditDetail("Closing date", formatAuditTextValue(formatDateValue(existing.closingDate)), formatAuditTextValue(input.closingDate)),
      buildAuditDetail("Move-In date", formatAuditTextValue(formatDateValue(existing.moveInDate)), formatAuditTextValue(input.moveInDate)),
      ...Object.keys(sanitizedAdditionalFieldsInput).map((fieldKey) =>
        buildAuditDetail(fieldKey, formatAuditTextValue(existingAdditionalFields[fieldKey]), formatAuditTextValue(mergedAdditionalFields[fieldKey]))
      )
    ].filter((detail): detail is string => Boolean(detail));

    const changes = [
      buildAuditChange("Transaction name", existing.title, nextTitle),
      buildAuditChange("Address", existing.address, nextAddress),
      buildAuditChange("City", existing.city, nextCity),
      buildAuditChange("State", existing.state, nextState),
      buildAuditChange("Zip", existing.zipCode, nextZipCode),
      buildAuditChange("Type", transactionTypeLabelMap[existing.type], transactionTypeLabelMap[nextTransactionType]),
      buildAuditChange("Status", transactionStatusLabelMap[existing.status], transactionStatusLabelMap[nextTransactionStatus]),
      buildAuditChange("Representing", representingLabelMap[existing.representing], representingLabelMap[nextRepresenting]),
      buildAuditChange("Asking price", formatAuditCurrencyValue(existing.askingPrice), formatAuditCurrencyValue(nextAskingPrice)),
      buildAuditChange(
        "Purchased price",
        formatAuditCurrencyValue(existing.purchasedPrice ?? existing.price),
        formatAuditCurrencyValue(nextPurchasedPrice)
      ),
      buildAuditChange("Buyer agreement date", formatAuditTextValue(formatDateValue(existing.buyerAgreementDate)), formatAuditTextValue(input.buyerAgreementDate)),
      buildAuditChange("Buyer expiration date", formatAuditTextValue(formatDateValue(existing.buyerExpirationDate)), formatAuditTextValue(input.buyerExpirationDate)),
      buildAuditChange("Acceptance date", formatAuditTextValue(formatDateValue(existing.acceptanceDate)), formatAuditTextValue(input.acceptanceDate)),
      buildAuditChange("Listing date", formatAuditTextValue(formatDateValue(existing.listingDate)), formatAuditTextValue(input.listingDate)),
      buildAuditChange("Listing expiration date", formatAuditTextValue(formatDateValue(existing.listingExpirationDate)), formatAuditTextValue(input.listingExpirationDate)),
      buildAuditChange("Closing date", formatAuditTextValue(formatDateValue(existing.closingDate)), formatAuditTextValue(input.closingDate)),
      buildAuditChange("Move-In date", formatAuditTextValue(formatDateValue(existing.moveInDate)), formatAuditTextValue(input.moveInDate)),
      ...Object.keys(sanitizedAdditionalFieldsInput).map((fieldKey) =>
        buildAuditChange(fieldKey, formatAuditTextValue(existingAdditionalFields[fieldKey]), formatAuditTextValue(mergedAdditionalFields[fieldKey]))
      )
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (details.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "transaction",
        entityId: input.transactionId,
        action: activityLogActions.transactionUpdated,
        payload: {
          officeId: existing.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing),
          objectLabel: buildTransactionObjectLabel(existing),
          changes,
          details
        }
      });
    }
  });

  return getTransactionById({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId,
    transactionId: input.transactionId,
    officeId: existing.officeId
  });
}
