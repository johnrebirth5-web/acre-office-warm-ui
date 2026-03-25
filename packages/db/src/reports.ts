import {
  MembershipStatus,
  Prisma,
  TransactionFinanceFeeType,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { buildTransactionVisibilityWhere, resolveOfficeDataScope } from "./access";
import { prisma } from "./client";
import { buildTeamMembershipHierarchyMap, buildTeamPathLabel, formatTeamMembershipRoleLabel, isLeaderTeamMembershipRole } from "./team-hierarchy";

export type OfficeReportStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";
export type OfficeTransactionReportDateOperator = "eq" | "gte" | "lte" | "range";
export type OfficeTransactionReportNumericOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "range";
export type OfficeTransactionReportSortBy =
  | "created_at"
  | "asking_price"
  | "purchased_price"
  | "gross_commission"
  | "status";
export type OfficeTransactionReportSortDirection = "asc" | "desc";

export type OfficeTransactionReportOption = {
  id: string;
  label: string;
};

export type OfficeTransactionReportSearchFieldKey =
  | "owner"
  | "created_at"
  | "buyer_tenant"
  | "closing_move_in"
  | "commission"
  | "asking_price"
  | "purchased_price"
  | "transaction_status"
  | "invoice_number"
  | "department"
  | "team_leader"
  | "transaction_type"
  | "representing_side"
  | "layout"
  | "company_referral";

export type OfficeTransactionReportSearchFieldDescriptor = {
  key: OfficeTransactionReportSearchFieldKey;
  label: string;
  groupLabel: "Operational" | "Financial" | "Organizational";
  sortOrder: number;
  description: string;
};

export type OfficeTransactionReportSearchLayoutSnapshot = {
  availableFields: OfficeTransactionReportSearchFieldDescriptor[];
  selectedFields: OfficeTransactionReportSearchFieldDescriptor[];
  savedLayout: OfficeTransactionReportSearchFieldKey[];
};

export type SaveOfficeTransactionReportSearchLayoutInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  fields: OfficeTransactionReportSearchFieldKey[];
};

export type OfficeTransactionReportColumn = {
  key: keyof OfficeTransactionReportRow;
  label: string;
};

export type OfficeTransactionReportRow = {
  transactionNumber: string;
  invoiceNumber: string;
  creationDate: string;
  owner: string;
  department: string;
  teamLeader: string;
  licensedAgentName: string;
  buyerTenant: string;
  transactionType: string;
  status: OfficeReportStatus;
  representing: string;
  buildingName: string;
  address: string;
  aptSuiteFloor: string;
  city: string;
  state: string;
  zipCode: string;
  layout: string;
  askingPrice: string;
  purchasedPrice: string;
  offerAcceptanceDate: string;
  closingMoveInDate: string;
  invoiceBillTo: string;
  leasingContact: string;
  grossCommission: string;
  rebate: string;
  referral: string;
  reimbursement: string;
  coAgentLegalName: string;
  notes: string;
  externalPartners: string;
  companyReferral: string;
  companyReferralEmployeeName: string;
  href: string;
};

export const officeTransactionReportColumns: OfficeTransactionReportColumn[] = [
  { key: "transactionNumber", label: "Transaction Number" },
  { key: "invoiceNumber", label: "Invoice Number" },
  { key: "creationDate", label: "Creation Date" },
  { key: "owner", label: "Owner" },
  { key: "department", label: "Department" },
  { key: "teamLeader", label: "Team Leader" },
  { key: "licensedAgentName", label: "Licensed Agent Name" },
  { key: "buyerTenant", label: "Buyer / Tenant" },
  { key: "transactionType", label: "Transaction Type" },
  { key: "status", label: "Status" },
  { key: "representing", label: "Representing" },
  { key: "buildingName", label: "Building Name" },
  { key: "address", label: "Address" },
  { key: "aptSuiteFloor", label: "Apt / Suite / Floor" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zipCode", label: "Zip Code" },
  { key: "layout", label: "Layout" },
  { key: "askingPrice", label: "Asking Price" },
  { key: "purchasedPrice", label: "Purchased Price" },
  { key: "offerAcceptanceDate", label: "Offer Acceptance Date" },
  { key: "closingMoveInDate", label: "Closing / Move-In Date" },
  { key: "invoiceBillTo", label: "Invoice Bill To" },
  { key: "leasingContact", label: "Leasing Contact" },
  { key: "grossCommission", label: "Gross Commission" },
  { key: "rebate", label: "Rebate" },
  { key: "referral", label: "Referral" },
  { key: "reimbursement", label: "Reimbursement" },
  { key: "coAgentLegalName", label: "Co-Agent Legal Name" },
  { key: "notes", label: "Notes" },
  { key: "externalPartners", label: "External Partners" },
  { key: "companyReferral", label: "Company Referral" },
  { key: "companyReferralEmployeeName", label: "Company Referral Employee Name" }
];

const reportSearchFieldDescriptorsBase = [
  {
    key: "owner",
    label: "Owner",
    groupLabel: "Organizational",
    sortOrder: 100,
    description: "Filter by transaction owner."
  },
  {
    key: "created_at",
    label: "Creation Date",
    groupLabel: "Operational",
    sortOrder: 110,
    description: "Match transaction creation date with equals, boundary, or range rules."
  },
  {
    key: "closing_move_in",
    label: "Closing / Move-In",
    groupLabel: "Operational",
    sortOrder: 120,
    description: "Match closing or move-in date with equals, boundary, or range rules."
  },
  {
    key: "transaction_status",
    label: "Transaction Status",
    groupLabel: "Operational",
    sortOrder: 130,
    description: "Filter by one or more workflow statuses."
  },
  {
    key: "department",
    label: "Department",
    groupLabel: "Organizational",
    sortOrder: 140,
    description: "Filter by office or department."
  },
  {
    key: "team_leader",
    label: "Team Leader",
    groupLabel: "Organizational",
    sortOrder: 150,
    description: "Filter by the current hierarchy-derived lead."
  },
  {
    key: "transaction_type",
    label: "Transaction Type",
    groupLabel: "Operational",
    sortOrder: 160,
    description: "Filter by one or more transaction types."
  },
  {
    key: "buyer_tenant",
    label: "Buyer / Tenant",
    groupLabel: "Operational",
    sortOrder: 170,
    description: "Partial match against the buyer or tenant field."
  },
  {
    key: "commission",
    label: "Commission",
    groupLabel: "Financial",
    sortOrder: 180,
    description: "Filter gross commission with equals, comparison, or range rules."
  },
  {
    key: "asking_price",
    label: "Asking Price",
    groupLabel: "Financial",
    sortOrder: 190,
    description: "Filter asking price with equals, comparison, or range rules."
  },
  {
    key: "purchased_price",
    label: "Purchased Price",
    groupLabel: "Financial",
    sortOrder: 200,
    description: "Filter purchased price with equals, comparison, or range rules."
  },
  {
    key: "invoice_number",
    label: "Invoice Number",
    groupLabel: "Operational",
    sortOrder: 210,
    description: "Exact match against the invoice number field."
  },
  {
    key: "representing_side",
    label: "Representing Side",
    groupLabel: "Operational",
    sortOrder: 220,
    description: "Filter by representing side."
  },
  {
    key: "layout",
    label: "Layout",
    groupLabel: "Operational",
    sortOrder: 230,
    description: "Filter by the normalized layout bucket."
  },
  {
    key: "company_referral",
    label: "Company Referral",
    groupLabel: "Operational",
    sortOrder: 240,
    description: "Limit the result set to company referral Yes or No."
  }
] satisfies OfficeTransactionReportSearchFieldDescriptor[];

const reportSearchFieldDescriptors: OfficeTransactionReportSearchFieldDescriptor[] = [
  ...reportSearchFieldDescriptorsBase
].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));

const reportSearchFieldKeySet = new Set<OfficeTransactionReportSearchFieldKey>(
  reportSearchFieldDescriptors.map((field) => field.key)
);

const defaultTransactionReportSearchLayout: OfficeTransactionReportSearchFieldKey[] = [
  "owner",
  "created_at",
  "closing_move_in",
  "transaction_status",
  "department",
  "team_leader",
  "transaction_type"
];

export type OfficeTransactionReportsFilters = {
  ownerMembershipId: string;
  createdAtOperator: OfficeTransactionReportDateOperator | "";
  createdAtValue: string;
  createdAtFrom: string;
  createdAtTo: string;
  buyerTenant: string;
  closingMoveInOperator: OfficeTransactionReportDateOperator | "";
  closingMoveInValue: string;
  closingMoveInFrom: string;
  closingMoveInTo: string;
  commissionOperator: OfficeTransactionReportNumericOperator | "";
  commissionValue: string;
  commissionMin: string;
  commissionMax: string;
  askingPriceOperator: OfficeTransactionReportNumericOperator | "";
  askingPriceValue: string;
  askingPriceMin: string;
  askingPriceMax: string;
  purchasedPriceOperator: OfficeTransactionReportNumericOperator | "";
  purchasedPriceValue: string;
  purchasedPriceMin: string;
  purchasedPriceMax: string;
  transactionStatuses: string[];
  invoiceNumber: string;
  departmentIds: string[];
  teamLeaderMembershipIds: string[];
  transactionTypes: string[];
  representingSides: string[];
  layouts: string[];
  companyReferral: "" | "yes" | "no";
  sortBy: OfficeTransactionReportSortBy;
  sortDirection: OfficeTransactionReportSortDirection;
  ownerOptions: OfficeTransactionReportOption[];
  departmentOptions: OfficeTransactionReportOption[];
  teamLeaderOptions: OfficeTransactionReportOption[];
  statusOptions: OfficeTransactionReportOption[];
  transactionTypeOptions: OfficeTransactionReportOption[];
  representingOptions: OfficeTransactionReportOption[];
  layoutOptions: OfficeTransactionReportOption[];
  companyReferralOptions: OfficeTransactionReportOption[];
};

export type OfficeTransactionReportsSummary = {
  totalTransactions: number;
  totalAskingPrice: string;
  totalPurchasedPrice: string;
  totalGrossCommission: string;
  totalRebate: string;
  totalReferral: string;
  totalReimbursement: string;
};

export type OfficeTransactionReportsWorkspace = {
  filters: OfficeTransactionReportsFilters;
  searchLayout: OfficeTransactionReportSearchLayoutSnapshot;
  summary: OfficeTransactionReportsSummary;
  columns: OfficeTransactionReportColumn[];
  rows: OfficeTransactionReportRow[];
  totalCount: number;
};

export type GetOfficeTransactionReportsWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  searchParams?: Record<string, string | string[] | undefined>;
  ownerMembershipId?: string;
  createdAtOperator?: string;
  createdAtValue?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  buyerTenant?: string;
  closingMoveInOperator?: string;
  closingMoveInValue?: string;
  closingMoveInFrom?: string;
  closingMoveInTo?: string;
  commissionOperator?: string;
  commissionValue?: string;
  commissionMin?: string;
  commissionMax?: string;
  askingPriceOperator?: string;
  askingPriceValue?: string;
  askingPriceMin?: string;
  askingPriceMax?: string;
  purchasedPriceOperator?: string;
  purchasedPriceValue?: string;
  purchasedPriceMin?: string;
  purchasedPriceMax?: string;
  transactionStatuses?: string[];
  invoiceNumber?: string;
  departmentIds?: string[];
  teamLeaderMembershipIds?: string[];
  transactionTypes?: string[];
  representingSides?: string[];
  layouts?: string[];
  companyReferral?: string;
  sortBy?: string;
  sortDirection?: string;
};

type LoadedTeamLeaderInfo = {
  options: OfficeTransactionReportOption[];
  leaderIdsByMembershipId: Map<string, string[]>;
  leaderLabelByMembershipId: Map<string, string>;
};

type LoadedReportSearchData = {
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>>;
  visibilityWhere: Prisma.TransactionWhereInput;
  teamLeaderInfo: LoadedTeamLeaderInfo;
  ownerOptions: OfficeTransactionReportOption[];
  departmentOptions: OfficeTransactionReportOption[];
  availableFields: OfficeTransactionReportSearchFieldDescriptor[];
  selectedFields: OfficeTransactionReportSearchFieldDescriptor[];
  savedLayout: OfficeTransactionReportSearchFieldKey[];
  filters: OfficeTransactionReportsFilters;
  searchLayout: OfficeTransactionReportSearchLayoutSnapshot;
};

type TransactionReportRecord = {
  id: string;
  createdAt: Date;
  ownerMembershipId: string | null;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  askingPrice: Prisma.Decimal | null;
  purchasedPrice: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  acceptanceDate: Date | null;
  closingDate: Date | null;
  moveInDate: Date | null;
  grossCommission: Prisma.Decimal | null;
  financeNotes: string | null;
  status: TransactionStatus;
  type: TransactionType;
  representing: TransactionRepresenting;
  companyReferral: boolean;
  companyReferralEmployeeName: string | null;
  additionalFields: Prisma.JsonValue | null;
  office: {
    id: string;
    name: string;
  } | null;
  ownerMembership: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  } | null;
  financeFees: Array<{
    feeType: TransactionFinanceFeeType;
    amount: Prisma.Decimal | null;
  }>;
};

const reportStatusLabelMap: Record<TransactionStatus, OfficeReportStatus> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const reportStatusSortOrder: Record<TransactionStatus, number> = {
  opportunity: 0,
  active: 1,
  pending: 2,
  closed: 3,
  cancelled: 4
};

const reportStatusFilterMap: Record<string, TransactionStatus> = {
  pending: "pending",
  closed: "closed",
  cancelled: "cancelled"
};

const reportTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales Listing",
  rental_leasing: "Rental",
  rental_listing: "Rental Listing",
  commercial_lease: "Commercial Lease",
  commercial_sales: "Commercial Sales",
  other: "Others"
};

const reportTypeFilterMap: Record<string, TransactionType> = {
  sales: "sales",
  sales_listing: "sales_listing",
  rental_leasing: "rental_leasing",
  rental_listing: "rental_listing",
  commercial_lease: "commercial_lease",
  commercial_sales: "commercial_sales",
  other: "other"
};

const representingSideFilterMap: Record<string, TransactionRepresenting[]> = {
  buyer_side: ["buyer"],
  seller_side: ["seller", "landlord"],
  both: ["both"],
  tenant: ["tenant"]
};

const representingSideLabelMap: Record<TransactionRepresenting, string> = {
  buyer: "Buyer Side",
  seller: "Seller Side",
  both: "Both",
  tenant: "Tenant",
  landlord: "Seller Side"
};

const layoutOptions: OfficeTransactionReportOption[] = [
  { id: "1B", label: "1B" },
  { id: "2B", label: "2B" },
  { id: "3B", label: "3B" },
  { id: "4B+", label: "4B+" },
  { id: "Others", label: "Others" }
];

const statusOptions: OfficeTransactionReportOption[] = [
  { id: "pending", label: "Pending" },
  { id: "closed", label: "Closed" },
  { id: "cancelled", label: "Cancelled" }
];

const transactionTypeOptions: OfficeTransactionReportOption[] = [
  { id: "sales", label: "Sales" },
  { id: "sales_listing", label: "Sales Listing" },
  { id: "rental_leasing", label: "Rental" },
  { id: "rental_listing", label: "Rental Listing" },
  { id: "commercial_lease", label: "Commercial Lease" },
  { id: "commercial_sales", label: "Commercial Sales" },
  { id: "other", label: "Others" }
];

const representingOptions: OfficeTransactionReportOption[] = [
  { id: "buyer_side", label: "Buyer Side" },
  { id: "seller_side", label: "Seller Side" },
  { id: "both", label: "Both" },
  { id: "tenant", label: "Tenant" }
];

const companyReferralOptions: OfficeTransactionReportOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" }
];

const selectableOwnerRoles = ["agent", "team_lead"] satisfies UserRole[];
const selectableMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];
const truthyReportFieldValues = new Set(["yes", "true", "1", "y"]);

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function readSearchParamArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      entry
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function isTransactionReportSearchFieldKey(value: string): value is OfficeTransactionReportSearchFieldKey {
  return reportSearchFieldKeySet.has(value as OfficeTransactionReportSearchFieldKey);
}

function normalizeTransactionReportSearchFieldKeys(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.flatMap((entry) => {
        if (typeof entry !== "string") {
          return [];
        }

        return isTransactionReportSearchFieldKey(entry) ? [entry] : [];
      })
    )
  );
}

function sanitizeTransactionReportSearchFieldKeys(fields: OfficeTransactionReportSearchFieldKey[]) {
  return Array.from(
    new Set(
      fields.filter((field): field is OfficeTransactionReportSearchFieldKey => isTransactionReportSearchFieldKey(field))
    )
  );
}

function buildTransactionReportSearchLayoutSnapshot(input: {
  availableFields: OfficeTransactionReportSearchFieldDescriptor[];
  savedLayout: OfficeTransactionReportSearchFieldKey[];
}) {
  const availableFieldMap = new Map(input.availableFields.map((field) => [field.key, field] satisfies [OfficeTransactionReportSearchFieldKey, OfficeTransactionReportSearchFieldDescriptor]));
  const selectedFields = input.savedLayout.flatMap((field) => {
    const descriptor = availableFieldMap.get(field);
    return descriptor ? [descriptor] : [];
  });

  return {
    availableFields: input.availableFields,
    selectedFields,
    savedLayout: input.savedLayout
  } satisfies OfficeTransactionReportSearchLayoutSnapshot;
}

function getRawReportValue(input: GetOfficeTransactionReportsWorkspaceInput, key: keyof NonNullable<GetOfficeTransactionReportsWorkspaceInput["searchParams"]>) {
  if (input.searchParams) {
    return readSearchParamValue(input.searchParams[key]);
  }

  return undefined;
}

function getRawReportArray(input: GetOfficeTransactionReportsWorkspaceInput, key: keyof NonNullable<GetOfficeTransactionReportsWorkspaceInput["searchParams"]>) {
  if (input.searchParams) {
    return readSearchParamArray(input.searchParams[key]);
  }

  return [];
}

function buildScopedOfficeOrNullFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

function formatCurrencyTotal(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatCurrencyCell(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return formatCurrencyTotal(value);
}

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();

  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function normalizeDateOperator(value: string | undefined): OfficeTransactionReportDateOperator | "" {
  return value === "eq" || value === "gte" || value === "lte" || value === "range" ? value : "";
}

function normalizeNumericOperator(value: string | undefined): OfficeTransactionReportNumericOperator | "" {
  return value === "eq" || value === "gt" || value === "gte" || value === "lt" || value === "lte" || value === "range" ? value : "";
}

function normalizeSortBy(value: string | undefined): OfficeTransactionReportSortBy {
  return value === "asking_price" ||
    value === "purchased_price" ||
    value === "gross_commission" ||
    value === "status"
    ? value
    : "created_at";
}

function normalizeSortDirection(value: string | undefined): OfficeTransactionReportSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function normalizeStringList(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function getOwnerLabel(ownerMembership: TransactionReportRecord["ownerMembership"]) {
  if (!ownerMembership) {
    return "Unassigned";
  }

  const fullName = `${ownerMembership.user.firstName} ${ownerMembership.user.lastName}`.trim();
  return fullName || ownerMembership.user.email;
}

function normalizeAdditionalFields(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Prisma.JsonValue>).map(([key, entry]) => [key, String(entry ?? "")])
  );
}

function getPurchasedPriceValue(record: Pick<TransactionReportRecord, "purchasedPrice" | "price">) {
  return record.purchasedPrice ?? record.price;
}

function getNumericValue(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function compareNullableNumbers(left: number | null, right: number | null, direction: OfficeTransactionReportSortDirection) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

function compareDates(left: Date | null | undefined, right: Date | null | undefined, direction: OfficeTransactionReportSortDirection) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return direction === "asc" ? left.getTime() - right.getTime() : right.getTime() - left.getTime();
}

function compareStatuses(
  left: TransactionStatus,
  right: TransactionStatus,
  direction: OfficeTransactionReportSortDirection
) {
  const difference = reportStatusSortOrder[left] - reportStatusSortOrder[right];
  return direction === "asc" ? difference : -difference;
}

function normalizeLayoutValue(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9+]/g, "");
}

function classifyLayout(value: string) {
  const normalized = normalizeLayoutValue(value);

  if (!normalized) {
    return "";
  }

  const bedroomMatch = normalized.match(/^(\d+)\+?(B|BR|BED|BEDS|BEDROOM|BEDROOMS)?\+?$/);

  if (bedroomMatch) {
    const bedroomCount = Number(bedroomMatch[1]);

    if (bedroomCount === 1) {
      return "1B";
    }

    if (bedroomCount === 2) {
      return "2B";
    }

    if (bedroomCount === 3) {
      return "3B";
    }

    if (bedroomCount >= 4) {
      return "4B+";
    }
  }

  return "Others";
}

function matchesLayoutFilter(value: string, selectedLayouts: string[]) {
  if (selectedLayouts.length === 0) {
    return true;
  }

  const category = classifyLayout(value);
  return category ? selectedLayouts.includes(category) : false;
}

function resolveCompanyReferralFlag(companyReferral: boolean, additionalFields: Record<string, string>) {
  const legacyValue = (additionalFields.companyReferral ?? "").trim().toLowerCase();
  return companyReferral || truthyReportFieldValues.has(legacyValue);
}

function matchesCompanyReferralFilter(
  companyReferral: boolean,
  selectedValue: OfficeTransactionReportsFilters["companyReferral"]
) {
  if (!selectedValue) {
    return true;
  }

  return selectedValue === "yes" ? companyReferral : !companyReferral;
}

function getCompanyReferralEmployeeName(
  companyReferralEmployeeName: string | null
) {
  return companyReferralEmployeeName?.trim() ?? "";
}

function buildDateColumnWhere(
  column: keyof Pick<Prisma.TransactionWhereInput, "createdAt" | "closingDate" | "moveInDate">,
  operator: OfficeTransactionReportDateOperator | "",
  value: string,
  from: string,
  to: string
): Prisma.TransactionWhereInput | null {
  if (!operator) {
    return null;
  }

  if (operator === "eq") {
    const start = startOfDay(value);
    const end = endOfDay(value);

    if (!start || !end) {
      return null;
    }

    return {
      [column]: {
        gte: start,
        lte: end
      }
    };
  }

  if (operator === "gte") {
    const start = startOfDay(value);
    return start ? { [column]: { gte: start } } : null;
  }

  if (operator === "lte") {
    const end = endOfDay(value);
    return end ? { [column]: { lte: end } } : null;
  }

  const start = startOfDay(from);
  const end = endOfDay(to);

  if (!start && !end) {
    return null;
  }

  return {
    [column]: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {})
    }
  };
}

function buildNumericColumnWhere(
  column: keyof Pick<Prisma.TransactionWhereInput, "grossCommission" | "askingPrice" | "purchasedPrice" | "price">,
  operator: OfficeTransactionReportNumericOperator | "",
  value: string,
  min: string,
  max: string
): Prisma.TransactionWhereInput | null {
  if (!operator) {
    return null;
  }

  if (operator === "range") {
    const minimum = parseOptionalDecimal(min);
    const maximum = parseOptionalDecimal(max);

    if (!minimum && !maximum) {
      return null;
    }

    return {
      [column]: {
        ...(minimum ? { gte: minimum } : {}),
        ...(maximum ? { lte: maximum } : {})
      }
    };
  }

  const parsed = parseOptionalDecimal(value);

  if (!parsed) {
    return null;
  }

  if (operator === "eq") {
    return { [column]: parsed };
  }

  return {
    [column]: {
      [operator]: parsed
    }
  };
}

function buildPurchasedPriceWhere(
  operator: OfficeTransactionReportNumericOperator | "",
  value: string,
  min: string,
  max: string
): Prisma.TransactionWhereInput | null {
  const purchasedPriceWhere = buildNumericColumnWhere("purchasedPrice", operator, value, min, max);
  const legacyPriceWhere = buildNumericColumnWhere("price", operator, value, min, max);

  if (!purchasedPriceWhere && !legacyPriceWhere) {
    return null;
  }

  if (!legacyPriceWhere) {
    return purchasedPriceWhere;
  }

  if (!purchasedPriceWhere) {
    return legacyPriceWhere;
  }

  return {
    OR: [
      purchasedPriceWhere,
      {
        AND: [
          { purchasedPrice: null },
          legacyPriceWhere
        ]
      }
    ]
  };
}

function buildClosingMoveInWhere(
  operator: OfficeTransactionReportDateOperator | "",
  value: string,
  from: string,
  to: string
): Prisma.TransactionWhereInput | null {
  const moveInWhere = buildDateColumnWhere("moveInDate", operator, value, from, to);
  const closingWhere = buildDateColumnWhere("closingDate", operator, value, from, to);

  if (!moveInWhere && !closingWhere) {
    return null;
  }

  if (!closingWhere) {
    return moveInWhere;
  }

  if (!moveInWhere) {
    return closingWhere;
  }

  return {
    OR: [
      moveInWhere,
      {
        AND: [
          { moveInDate: null },
          closingWhere
        ]
      }
    ]
  };
}

async function loadReportTeamLeaderInfo(input: {
  organizationId: string;
  visibleMembershipIds: string[] | null;
  visibleTeamIds: string[] | null;
  officeId?: string | null;
}) {
  const [teams, teamMemberships] = await Promise.all([
    prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...(buildScopedOfficeOrNullFilter(input.officeId) ?? {})
      },
      select: {
        id: true,
        name: true,
        parentTeamId: true,
        isActive: true
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        team: {
          isActive: true,
          ...(buildScopedOfficeOrNullFilter(input.officeId) ?? {})
        }
      },
      select: {
        id: true,
        membershipId: true,
        teamId: true,
        role: true,
        reportsToTeamMembershipId: true,
        membership: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    })
  ]);

  const hierarchy = buildTeamMembershipHierarchyMap({
    teams,
    teamMemberships: teamMemberships.map((teamMembership) => ({
      id: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      role: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      label:
        `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() ||
        teamMembership.membership.user.email
    }))
  });

  const leaderIdsByMembershipId = new Map<string, string[]>();
  const leaderLabelSetByMembershipId = new Map<string, Set<string>>();
  const optionMap = new Map<string, string>();
  const visibleMembershipIdSet = input.visibleMembershipIds === null ? null : new Set(input.visibleMembershipIds);
  const visibleTeamIdSet = input.visibleTeamIds === null ? null : new Set(input.visibleTeamIds);
  const teamMembershipById = new Map(
    teamMemberships.map((teamMembership) => [
      teamMembership.id,
      {
        ...teamMembership,
        label:
          `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() ||
          teamMembership.membership.user.email
      }
    ])
  );
  const baseTeamMemberships = teamMemberships
    .filter((teamMembership) => (visibleMembershipIdSet ? visibleMembershipIdSet.has(teamMembership.membershipId) : true))
    .filter((teamMembership) => (visibleTeamIdSet ? visibleTeamIdSet.has(teamMembership.teamId) : true))
    .sort((left, right) => {
      const leftLabel = `${left.membership.user.firstName} ${left.membership.user.lastName}`.trim() || left.membership.user.email;
      const rightLabel = `${right.membership.user.firstName} ${right.membership.user.lastName}`.trim() || right.membership.user.email;
      return leftLabel.localeCompare(rightLabel) || left.id.localeCompare(right.id);
    });

  for (const teamMembership of baseTeamMemberships) {
    const hierarchyRecord = hierarchy.hierarchyMap.get(teamMembership.id);
    const selfLabel =
      `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() ||
      teamMembership.membership.user.email;
    const directManager =
      hierarchyRecord?.directManagerTeamMembershipId
        ? teamMembershipById.get(hierarchyRecord.directManagerTeamMembershipId) ?? null
        : null;
    const rootLeader = hierarchyRecord?.rootLeader ?? null;
    const resolvedLeader = isLeaderTeamMembershipRole(teamMembership.role)
      ? {
          membershipId: teamMembership.membershipId,
          label: selfLabel,
          roleLabel: formatTeamMembershipRoleLabel(teamMembership.role),
          teamPathLabel: hierarchyRecord?.teamPathLabel ?? buildTeamPathLabel(hierarchy.index, teamMembership.teamId)
        }
      : directManager
        ? {
            membershipId: directManager.membershipId,
            label: directManager.label,
            roleLabel: formatTeamMembershipRoleLabel(directManager.role),
            teamPathLabel: buildTeamPathLabel(hierarchy.index, directManager.teamId)
          }
        : rootLeader
          ? {
              membershipId: rootLeader.membershipId,
              label: rootLeader.label,
              roleLabel: rootLeader.roleLabel,
              teamPathLabel: rootLeader.teamPathLabel
            }
          : null;

    if (!resolvedLeader) {
      continue;
    }

    const currentLeaderIds = leaderIdsByMembershipId.get(teamMembership.membershipId) ?? [];
    if (!currentLeaderIds.includes(resolvedLeader.membershipId)) {
      currentLeaderIds.push(resolvedLeader.membershipId);
      leaderIdsByMembershipId.set(teamMembership.membershipId, currentLeaderIds);
    }

    const currentLeaderLabels = leaderLabelSetByMembershipId.get(teamMembership.membershipId) ?? new Set<string>();
    currentLeaderLabels.add(resolvedLeader.label);
    leaderLabelSetByMembershipId.set(teamMembership.membershipId, currentLeaderLabels);

    if (!optionMap.has(resolvedLeader.membershipId)) {
      optionMap.set(
        resolvedLeader.membershipId,
        resolvedLeader.teamPathLabel
          ? `${resolvedLeader.label} · ${resolvedLeader.roleLabel} · ${resolvedLeader.teamPathLabel}`
          : `${resolvedLeader.label} · ${resolvedLeader.roleLabel}`
      );
    }
  }

  return {
    options: [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, label]) => ({ id, label })),
    leaderIdsByMembershipId,
    leaderLabelByMembershipId: new Map(
      [...leaderLabelSetByMembershipId.entries()].map(([membershipId, labels]) => [
        membershipId,
        [...labels].sort((left, right) => left.localeCompare(right)).join(", ")
      ])
    )
  } satisfies LoadedTeamLeaderInfo;
}

function sortTransactions(
  transactions: TransactionReportRecord[],
  sortBy: OfficeTransactionReportSortBy,
  sortDirection: OfficeTransactionReportSortDirection
) {
  return [...transactions].sort((left, right) => {
    const primaryComparison =
      sortBy === "created_at"
        ? compareDates(left.createdAt, right.createdAt, sortDirection)
        : sortBy === "asking_price"
          ? compareNullableNumbers(getNumericValue(left.askingPrice), getNumericValue(right.askingPrice), sortDirection)
          : sortBy === "purchased_price"
            ? compareNullableNumbers(getNumericValue(getPurchasedPriceValue(left)), getNumericValue(getPurchasedPriceValue(right)), sortDirection)
            : sortBy === "gross_commission"
              ? compareNullableNumbers(getNumericValue(left.grossCommission), getNumericValue(right.grossCommission), sortDirection)
              : compareStatuses(left.status, right.status, sortDirection);

    if (primaryComparison !== 0) {
      return primaryComparison;
    }

    const createdAtComparison = compareDates(left.createdAt, right.createdAt, "desc");

    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }

    return left.id.localeCompare(right.id);
  });
}

function getFeeTotals(financeFees: TransactionReportRecord["financeFees"]) {
  const rebateFees = financeFees.filter((fee) => fee.feeType === "rebate");
  const referralFees = financeFees.filter(
    (fee) => fee.feeType === "client_referral" || fee.feeType === "external_referral" || fee.feeType === "company_referral"
  );
  const reimbursementFees = financeFees.filter((fee) => fee.feeType === "reimbursement");
  const rebateAmount = rebateFees.reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const referralAmount = referralFees.reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const reimbursementAmount = reimbursementFees.reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);

  return {
    rebateAmount,
    referralAmount,
    reimbursementAmount,
    hasRebate: rebateFees.some((fee) => fee.amount !== null),
    hasReferral: referralFees.some((fee) => fee.amount !== null),
    hasReimbursement: reimbursementFees.some((fee) => fee.amount !== null)
  };
}

function buildReportRow(
  transaction: TransactionReportRecord,
  teamLeaderInfo: LoadedTeamLeaderInfo
): OfficeTransactionReportRow {
  const additionalFields = normalizeAdditionalFields(transaction.additionalFields);
  const { rebateAmount, referralAmount, reimbursementAmount, hasRebate, hasReferral, hasReimbursement } = getFeeTotals(
    transaction.financeFees
  );
  const companyReferral = resolveCompanyReferralFlag(transaction.companyReferral, additionalFields);

  return {
    transactionNumber: transaction.id,
    invoiceNumber: additionalFields.invoiceNumber ?? "",
    creationDate: formatDateValue(transaction.createdAt),
    owner: getOwnerLabel(transaction.ownerMembership),
    department: transaction.office?.name ?? "",
    teamLeader: transaction.ownerMembershipId ? teamLeaderInfo.leaderLabelByMembershipId.get(transaction.ownerMembershipId) ?? "" : "",
    licensedAgentName: additionalFields.licensedAgentName ?? "",
    buyerTenant: additionalFields.buyerTenant ?? "",
    transactionType: reportTypeLabelMap[transaction.type],
    status: reportStatusLabelMap[transaction.status],
    representing: representingSideLabelMap[transaction.representing],
    buildingName: additionalFields.buildingName ?? "",
    address: transaction.address,
    aptSuiteFloor: additionalFields.unitNumber ?? "",
    city: transaction.city,
    state: transaction.state,
    zipCode: transaction.zipCode,
    layout: additionalFields.layout ?? "",
    askingPrice: formatCurrencyCell(transaction.askingPrice),
    purchasedPrice: formatCurrencyCell(getPurchasedPriceValue(transaction)),
    offerAcceptanceDate: formatDateValue(transaction.acceptanceDate),
    closingMoveInDate: formatDateValue(transaction.moveInDate ?? transaction.closingDate),
    invoiceBillTo: additionalFields.invoiceBillTo ?? "",
    leasingContact: additionalFields.leasingContact ?? "",
    grossCommission: formatCurrencyCell(transaction.grossCommission),
    rebate: formatCurrencyCell(hasRebate ? rebateAmount : null),
    referral: formatCurrencyCell(hasReferral ? referralAmount : null),
    reimbursement: formatCurrencyCell(hasReimbursement ? reimbursementAmount : null),
    coAgentLegalName: additionalFields.coAgentLegalName ?? "",
    notes: transaction.financeNotes ?? "",
    externalPartners: additionalFields.externalPartners ?? "",
    companyReferral: companyReferral ? "Yes" : "No",
    companyReferralEmployeeName: getCompanyReferralEmployeeName(transaction.companyReferralEmployeeName),
    href: `/office/transactions/${transaction.id}`
  };
}

function areTransactionReportSearchFieldKeysEqual(
  left: OfficeTransactionReportSearchFieldKey[],
  right: OfficeTransactionReportSearchFieldKey[]
) {
  return left.length === right.length && left.every((field, index) => field === right[index]);
}

function buildTransactionReportFilters(
  input: GetOfficeTransactionReportsWorkspaceInput,
  options: {
    ownerOptions: OfficeTransactionReportOption[];
    departmentOptions: OfficeTransactionReportOption[];
    teamLeaderInfo: LoadedTeamLeaderInfo;
  }
) {
  const rawOwnerMembershipId = getRawReportValue(input, "ownerMembershipId") ?? input.ownerMembershipId;
  const rawCreatedAtOperator = getRawReportValue(input, "createdAtOperator") ?? input.createdAtOperator;
  const rawCreatedAtValue = getRawReportValue(input, "createdAtValue") ?? input.createdAtValue;
  const rawCreatedAtFrom = getRawReportValue(input, "createdAtFrom") ?? input.createdAtFrom;
  const rawCreatedAtTo = getRawReportValue(input, "createdAtTo") ?? input.createdAtTo;
  const rawBuyerTenant = getRawReportValue(input, "buyerTenant") ?? input.buyerTenant;
  const rawClosingMoveInOperator =
    getRawReportValue(input, "closingMoveInOperator") ?? input.closingMoveInOperator;
  const rawClosingMoveInValue = getRawReportValue(input, "closingMoveInValue") ?? input.closingMoveInValue;
  const rawClosingMoveInFrom = getRawReportValue(input, "closingMoveInFrom") ?? input.closingMoveInFrom;
  const rawClosingMoveInTo = getRawReportValue(input, "closingMoveInTo") ?? input.closingMoveInTo;
  const rawCommissionOperator = getRawReportValue(input, "commissionOperator") ?? input.commissionOperator;
  const rawCommissionValue = getRawReportValue(input, "commissionValue") ?? input.commissionValue;
  const rawCommissionMin = getRawReportValue(input, "commissionMin") ?? input.commissionMin;
  const rawCommissionMax = getRawReportValue(input, "commissionMax") ?? input.commissionMax;
  const rawAskingPriceOperator = getRawReportValue(input, "askingPriceOperator") ?? input.askingPriceOperator;
  const rawAskingPriceValue = getRawReportValue(input, "askingPriceValue") ?? input.askingPriceValue;
  const rawAskingPriceMin = getRawReportValue(input, "askingPriceMin") ?? input.askingPriceMin;
  const rawAskingPriceMax = getRawReportValue(input, "askingPriceMax") ?? input.askingPriceMax;
  const rawPurchasedPriceOperator =
    getRawReportValue(input, "purchasedPriceOperator") ?? input.purchasedPriceOperator;
  const rawPurchasedPriceValue = getRawReportValue(input, "purchasedPriceValue") ?? input.purchasedPriceValue;
  const rawPurchasedPriceMin = getRawReportValue(input, "purchasedPriceMin") ?? input.purchasedPriceMin;
  const rawPurchasedPriceMax = getRawReportValue(input, "purchasedPriceMax") ?? input.purchasedPriceMax;
  const rawTransactionStatuses = input.searchParams
    ? getRawReportArray(input, "transactionStatuses")
    : input.transactionStatuses ?? [];
  const rawInvoiceNumber = getRawReportValue(input, "invoiceNumber") ?? input.invoiceNumber;
  const rawDepartmentIds = input.searchParams ? getRawReportArray(input, "departmentIds") : input.departmentIds ?? [];
  const rawTeamLeaderMembershipIds = input.searchParams
    ? getRawReportArray(input, "teamLeaderMembershipIds")
    : input.teamLeaderMembershipIds ?? [];
  const rawTransactionTypes = input.searchParams
    ? getRawReportArray(input, "transactionTypes")
    : input.transactionTypes ?? [];
  const rawRepresentingSides = input.searchParams
    ? getRawReportArray(input, "representingSides")
    : input.representingSides ?? [];
  const rawLayouts = input.searchParams ? getRawReportArray(input, "layouts") : input.layouts ?? [];
  const rawCompanyReferral = getRawReportValue(input, "companyReferral") ?? input.companyReferral;
  const rawSortBy = getRawReportValue(input, "sortBy") ?? input.sortBy;
  const rawSortDirection = getRawReportValue(input, "sortDirection") ?? input.sortDirection;

  const normalizedStatuses = normalizeStringList(rawTransactionStatuses).filter(
    (status) => Boolean(reportStatusFilterMap[status])
  );
  const normalizedTypes = normalizeStringList(rawTransactionTypes).filter((type) =>
    Boolean(reportTypeFilterMap[type])
  );
  const normalizedRepresentingSides = normalizeStringList(rawRepresentingSides).filter(
    (side) => representingSideFilterMap[side] !== undefined
  );
  const normalizedLayouts = normalizeStringList(rawLayouts).filter((layout) =>
    layoutOptions.some((option) => option.id === layout)
  );
  const normalizedDepartmentIds = normalizeStringList(rawDepartmentIds).filter((id) =>
    options.departmentOptions.some((option) => option.id === id)
  );
  const normalizedTeamLeaderMembershipIds = normalizeStringList(rawTeamLeaderMembershipIds).filter((id) =>
    options.teamLeaderInfo.options.some((option) => option.id === id)
  );
  const createdAtOperator = normalizeDateOperator(rawCreatedAtOperator);
  const closingMoveInOperator = normalizeDateOperator(rawClosingMoveInOperator);
  const commissionOperator = normalizeNumericOperator(rawCommissionOperator);
  const askingPriceOperator = normalizeNumericOperator(rawAskingPriceOperator);
  const purchasedPriceOperator = normalizeNumericOperator(rawPurchasedPriceOperator);
  const sortBy = normalizeSortBy(rawSortBy);
  const sortDirection = normalizeSortDirection(rawSortDirection);

  return {
    ownerMembershipId: rawOwnerMembershipId?.trim() ?? "",
    createdAtOperator,
    createdAtValue: rawCreatedAtValue?.trim() ?? "",
    createdAtFrom: rawCreatedAtFrom?.trim() ?? "",
    createdAtTo: rawCreatedAtTo?.trim() ?? "",
    buyerTenant: rawBuyerTenant?.trim() ?? "",
    closingMoveInOperator,
    closingMoveInValue: rawClosingMoveInValue?.trim() ?? "",
    closingMoveInFrom: rawClosingMoveInFrom?.trim() ?? "",
    closingMoveInTo: rawClosingMoveInTo?.trim() ?? "",
    commissionOperator,
    commissionValue: rawCommissionValue?.trim() ?? "",
    commissionMin: rawCommissionMin?.trim() ?? "",
    commissionMax: rawCommissionMax?.trim() ?? "",
    askingPriceOperator,
    askingPriceValue: rawAskingPriceValue?.trim() ?? "",
    askingPriceMin: rawAskingPriceMin?.trim() ?? "",
    askingPriceMax: rawAskingPriceMax?.trim() ?? "",
    purchasedPriceOperator,
    purchasedPriceValue: rawPurchasedPriceValue?.trim() ?? "",
    purchasedPriceMin: rawPurchasedPriceMin?.trim() ?? "",
    purchasedPriceMax: rawPurchasedPriceMax?.trim() ?? "",
    transactionStatuses: normalizedStatuses,
    invoiceNumber: rawInvoiceNumber?.trim() ?? "",
    departmentIds: normalizedDepartmentIds,
    teamLeaderMembershipIds: normalizedTeamLeaderMembershipIds,
    transactionTypes: normalizedTypes,
    representingSides: normalizedRepresentingSides,
    layouts: normalizedLayouts,
    companyReferral: rawCompanyReferral === "yes" || rawCompanyReferral === "no" ? rawCompanyReferral : "",
    sortBy,
    sortDirection,
    ownerOptions: options.ownerOptions,
    departmentOptions: options.departmentOptions,
    teamLeaderOptions: options.teamLeaderInfo.options,
    statusOptions,
    transactionTypeOptions,
    representingOptions,
    layoutOptions,
    companyReferralOptions
  } satisfies OfficeTransactionReportsFilters;
}

async function loadReportSearchData(
  input: GetOfficeTransactionReportsWorkspaceInput
): Promise<LoadedReportSearchData> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "reports"
  });
  const visibilityWhere = buildTransactionVisibilityWhere(scope);
  const visibleMembershipIds = scope.visibleMembershipIds;
  const membershipVisibilityFilter =
    visibleMembershipIds === null
      ? undefined
      : {
          in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"]
        };
  const teamLeaderInfo = await loadReportTeamLeaderInfo({
    organizationId: input.organizationId,
    visibleMembershipIds,
    visibleTeamIds: scope.visibleTeamIds,
    officeId: input.officeId ?? null
  });
  const visibleOfficeIds =
    input.officeId
      ? [input.officeId]
      : visibleMembershipIds === null
        ? null
        : Array.from(
            new Set(
              (
                await prisma.transaction.findMany({
                  where: {
                    organizationId: input.organizationId,
                    officeId: {
                      not: null
                    },
                    ...visibilityWhere
                  },
                  select: {
                    officeId: true
                  },
                  distinct: ["officeId"]
                })
              )
                .map((transaction) => transaction.officeId)
                .filter((officeId): officeId is string => Boolean(officeId))
            )
          );

  const [ownerMemberships, departmentRecords, savedLayoutRecord] = await Promise.all([
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildScopedOfficeOrNullFilter(input.officeId) ?? {}),
        status: {
          in: selectableMembershipStatuses
        },
        role: {
          in: selectableOwnerRoles
        },
        ...(membershipVisibilityFilter ? { id: membershipVisibilityFilter } : {})
      },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId,
        ...(visibleOfficeIds === null
          ? {}
          : {
              id: {
                in: visibleOfficeIds.length > 0 ? visibleOfficeIds : ["__no_office__"]
              }
            })
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.transactionReportSearchLayout.findFirst({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    })
  ]);

  const ownerOptions = ownerMemberships.map((membership) => ({
    id: membership.id,
    label: `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email
  }));
  const departmentOptions = departmentRecords.map((office) => ({
    id: office.id,
    label: office.name
  }));
  const availableFields = reportSearchFieldDescriptors;
  const normalizedSavedLayout = normalizeTransactionReportSearchFieldKeys(savedLayoutRecord?.fieldLayout ?? null);
  const sanitizedSavedLayout = sanitizeTransactionReportSearchFieldKeys(normalizedSavedLayout);

  if (
    savedLayoutRecord &&
    JSON.stringify(savedLayoutRecord.fieldLayout) !== JSON.stringify(sanitizedSavedLayout)
  ) {
    await prisma.transactionReportSearchLayout.update({
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
      : sanitizeTransactionReportSearchFieldKeys(defaultTransactionReportSearchLayout);
  const searchLayout = buildTransactionReportSearchLayoutSnapshot({
    availableFields,
    savedLayout
  });
  const filters = buildTransactionReportFilters(input, {
    ownerOptions,
    departmentOptions,
    teamLeaderInfo
  });

  return {
    scope,
    visibilityWhere,
    teamLeaderInfo,
    ownerOptions,
    departmentOptions,
    availableFields,
    selectedFields: searchLayout.selectedFields,
    savedLayout: searchLayout.savedLayout,
    filters,
    searchLayout
  };
}

export async function getOfficeTransactionReportSearchLayoutSnapshot(
  input: GetOfficeTransactionReportsWorkspaceInput
): Promise<OfficeTransactionReportSearchLayoutSnapshot> {
  const searchData = await loadReportSearchData(input);
  return searchData.searchLayout;
}

export async function saveOfficeTransactionReportSearchLayout(
  input: SaveOfficeTransactionReportSearchLayoutInput
): Promise<OfficeTransactionReportSearchFieldKey[]> {
  const sanitizedFields = sanitizeTransactionReportSearchFieldKeys(input.fields);
  const availableFieldMap = new Map(
    reportSearchFieldDescriptors.map((field) => [field.key, field] satisfies [OfficeTransactionReportSearchFieldKey, OfficeTransactionReportSearchFieldDescriptor])
  );
  const previousFieldLabels = (storedValue: Prisma.JsonValue | null | undefined) =>
    normalizeTransactionReportSearchFieldKeys(storedValue)
      .flatMap((field) => {
        const descriptor = availableFieldMap.get(field);
        return descriptor ? [descriptor.label] : [];
      })
      .join(", ");
  const nextFieldLabels = sanitizedFields
    .flatMap((field) => {
      const descriptor = availableFieldMap.get(field);
      return descriptor ? [descriptor.label] : [];
    })
    .join(", ");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transactionReportSearchLayout.findFirst({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const saved = existing
      ? await tx.transactionReportSearchLayout.update({
          where: {
            id: existing.id
          },
          data: {
            updatedByMembershipId: input.actorMembershipId,
            fieldLayout: sanitizedFields as Prisma.InputJsonValue
          }
        })
      : await tx.transactionReportSearchLayout.create({
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
      entityType: "transaction_report_search_layout",
      entityId: saved.id,
      action: activityLogActions.settingsTransactionReportSearchLayoutUpdated,
      payload: {
        objectLabel: "Reports search layout",
        contextHref: "/office/reports",
        details: [`Visible search fields: ${nextFieldLabels || "None"}`],
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

export async function getOfficeTransactionReportsWorkspace(
  input: GetOfficeTransactionReportsWorkspaceInput
): Promise<OfficeTransactionReportsWorkspace> {
  const searchData = await loadReportSearchData(input);
  const { filters, teamLeaderInfo, visibilityWhere } = searchData;

  const matchingOwnerMembershipIds =
    filters.teamLeaderMembershipIds.length > 0
      ? searchData.ownerOptions
          .filter((membership) => {
            const leaderIds = teamLeaderInfo.leaderIdsByMembershipId.get(membership.id) ?? [];
            return leaderIds.some((leaderId) => filters.teamLeaderMembershipIds.includes(leaderId));
          })
          .map((membership) => membership.id)
      : [];
  const whereConditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    visibilityWhere
  ];

  if (filters.ownerMembershipId) {
    whereConditions.push({
      ownerMembershipId: filters.ownerMembershipId
    });
  }

  if (input.officeId) {
    whereConditions.push({
      officeId: input.officeId
    });
  }

  if (filters.departmentIds.length > 0) {
    whereConditions.push({
      officeId: {
        in: filters.departmentIds
      }
    });
  }

  if (filters.teamLeaderMembershipIds.length > 0) {
    whereConditions.push({
      ownerMembershipId: {
        in: matchingOwnerMembershipIds.length > 0 ? matchingOwnerMembershipIds : ["__no_matching_owner__"]
      }
    });
  }

  if (filters.transactionStatuses.length > 0) {
    whereConditions.push({
      status: {
        in: filters.transactionStatuses.map((status) => reportStatusFilterMap[status])
      }
    });
  }

  if (filters.transactionTypes.length > 0) {
    whereConditions.push({
      type: {
        in: filters.transactionTypes.map((type) => reportTypeFilterMap[type])
      }
    });
  }

  if (filters.representingSides.length > 0) {
    whereConditions.push({
      representing: {
        in: Array.from(
          new Set(filters.representingSides.flatMap((side) => representingSideFilterMap[side] ?? []))
        )
      }
    });
  }

  if (filters.buyerTenant) {
    whereConditions.push({
      additionalFields: {
        path: ["buyerTenant"],
        string_contains: filters.buyerTenant,
        mode: "insensitive"
      }
    });
  }

  if (filters.invoiceNumber) {
    whereConditions.push({
      additionalFields: {
        path: ["invoiceNumber"],
        equals: filters.invoiceNumber
      }
    });
  }

  const createdAtWhere = buildDateColumnWhere(
    "createdAt",
    filters.createdAtOperator,
    filters.createdAtValue,
    filters.createdAtFrom,
    filters.createdAtTo
  );
  if (createdAtWhere) {
    whereConditions.push(createdAtWhere);
  }

  const closingMoveInWhere = buildClosingMoveInWhere(
    filters.closingMoveInOperator,
    filters.closingMoveInValue,
    filters.closingMoveInFrom,
    filters.closingMoveInTo
  );
  if (closingMoveInWhere) {
    whereConditions.push(closingMoveInWhere);
  }

  const grossCommissionWhere = buildNumericColumnWhere(
    "grossCommission",
    filters.commissionOperator,
    filters.commissionValue,
    filters.commissionMin,
    filters.commissionMax
  );
  if (grossCommissionWhere) {
    whereConditions.push(grossCommissionWhere);
  }

  const askingPriceWhere = buildNumericColumnWhere(
    "askingPrice",
    filters.askingPriceOperator,
    filters.askingPriceValue,
    filters.askingPriceMin,
    filters.askingPriceMax
  );
  if (askingPriceWhere) {
    whereConditions.push(askingPriceWhere);
  }

  const purchasedPriceWhere = buildPurchasedPriceWhere(
    filters.purchasedPriceOperator,
    filters.purchasedPriceValue,
    filters.purchasedPriceMin,
    filters.purchasedPriceMax
  );
  if (purchasedPriceWhere) {
    whereConditions.push(purchasedPriceWhere);
  }

  const where = whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };
  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      ownerMembershipId: true,
      title: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      askingPrice: true,
      purchasedPrice: true,
      price: true,
      acceptanceDate: true,
      closingDate: true,
      moveInDate: true,
      grossCommission: true,
      financeNotes: true,
      status: true,
      type: true,
      representing: true,
      companyReferral: true,
      companyReferralEmployeeName: true,
      additionalFields: true,
      office: {
        select: {
          id: true,
          name: true
        }
      },
      ownerMembership: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      financeFees: {
        select: {
          feeType: true,
          amount: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });
  const filteredTransactions = transactions.filter((transaction) => {
    const additionalFields = normalizeAdditionalFields(transaction.additionalFields);
    const companyReferral = resolveCompanyReferralFlag(transaction.companyReferral, additionalFields);

    return (
      matchesLayoutFilter(additionalFields.layout ?? "", filters.layouts) &&
      matchesCompanyReferralFilter(companyReferral, filters.companyReferral)
    );
  });
  const sortedTransactions = sortTransactions(
    filteredTransactions,
    filters.sortBy,
    filters.sortDirection
  );
  const rows = sortedTransactions.map((transaction) => buildReportRow(transaction, teamLeaderInfo));
  const summary = sortedTransactions.reduce(
    (accumulator, transaction) => {
      const { rebateAmount, referralAmount, reimbursementAmount } = getFeeTotals(transaction.financeFees);

      return {
        totalTransactions: accumulator.totalTransactions + 1,
        askingPrice: accumulator.askingPrice + Number(transaction.askingPrice ?? 0),
        purchasedPrice: accumulator.purchasedPrice + Number(getPurchasedPriceValue(transaction) ?? 0),
        grossCommission: accumulator.grossCommission + Number(transaction.grossCommission ?? 0),
        rebate: accumulator.rebate + rebateAmount,
        referral: accumulator.referral + referralAmount,
        reimbursement: accumulator.reimbursement + reimbursementAmount
      };
    },
    {
      totalTransactions: 0,
      askingPrice: 0,
      purchasedPrice: 0,
      grossCommission: 0,
      rebate: 0,
      referral: 0,
      reimbursement: 0
    }
  );

  return {
    filters,
    searchLayout: searchData.searchLayout,
    summary: {
      totalTransactions: summary.totalTransactions,
      totalAskingPrice: formatCurrencyTotal(summary.askingPrice),
      totalPurchasedPrice: formatCurrencyTotal(summary.purchasedPrice),
      totalGrossCommission: formatCurrencyTotal(summary.grossCommission),
      totalRebate: formatCurrencyTotal(summary.rebate),
      totalReferral: formatCurrencyTotal(summary.referral),
      totalReimbursement: formatCurrencyTotal(summary.reimbursement)
    },
    columns: officeTransactionReportColumns,
    rows,
    totalCount: rows.length
  };
}

export async function listOfficeTransactionReportExportRows(
  input: GetOfficeTransactionReportsWorkspaceInput
): Promise<OfficeTransactionReportRow[]> {
  const workspace = await getOfficeTransactionReportsWorkspace(input);
  return workspace.rows;
}
