import {
  MembershipStatus,
  Prisma,
  TransactionFinanceFeeType,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType,
  UserRole
} from "@prisma/client";
import { buildTransactionVisibilityWhere, resolveOfficeDataScope } from "./access";
import { prisma } from "./client";
import { buildTeamMembershipHierarchyMap, formatTeamMembershipRoleLabel, isLeaderTeamMembershipRole } from "./team-hierarchy";

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
  commissionType: string;
  invoiceBillTo: string;
  leasingContact: string;
  currencyType: string;
  grossCommission: string;
  commissionRate: string;
  rebate: string;
  referral: string;
  reimbursement: string;
  coAgentLegalName: string;
  commissionBreakdown: string;
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
  { key: "commissionType", label: "Commission Type" },
  { key: "invoiceBillTo", label: "Invoice Bill To" },
  { key: "leasingContact", label: "Leasing Contact" },
  { key: "currencyType", label: "Currency Type" },
  { key: "grossCommission", label: "Gross Commission" },
  { key: "commissionRate", label: "Commission Rate" },
  { key: "rebate", label: "Rebate" },
  { key: "referral", label: "Referral" },
  { key: "reimbursement", label: "Reimbursement" },
  { key: "coAgentLegalName", label: "Co-Agent Legal Name" },
  { key: "commissionBreakdown", label: "Commission Breakdown" },
  { key: "notes", label: "Notes" },
  { key: "externalPartners", label: "External Partners" },
  { key: "companyReferral", label: "Company Referral" },
  { key: "companyReferralEmployeeName", label: "Company Referral Employee Name" }
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
  summary: OfficeTransactionReportsSummary;
  columns: OfficeTransactionReportColumn[];
  rows: OfficeTransactionReportRow[];
  totalCount: number;
};

export type GetOfficeTransactionReportsWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
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
const sortableColumns: Record<OfficeTransactionReportSortBy, Prisma.TransactionOrderByWithRelationInput | Prisma.TransactionOrderByWithRelationInput[]> = {
  created_at: [{ createdAt: "desc" }],
  asking_price: [{ askingPrice: "desc" }, { createdAt: "desc" }],
  purchased_price: [{ purchasedPrice: "desc" }, { price: "desc" }, { createdAt: "desc" }],
  gross_commission: [{ grossCommission: "desc" }, { createdAt: "desc" }],
  status: [{ status: "asc" }, { createdAt: "desc" }]
};

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
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
}) {
  const membershipFilter =
    input.visibleMembershipIds === null
      ? undefined
      : {
          in: input.visibleMembershipIds.length > 0 ? input.visibleMembershipIds : ["__no_membership__"]
        };

  const [teams, teamMemberships] = await Promise.all([
    prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true
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
        ...(membershipFilter ? { membershipId: membershipFilter } : {})
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
  const leaderLabelByMembershipId = new Map<string, string>();
  const optionMap = new Map<string, string>();

  for (const teamMembership of teamMemberships) {
    const hierarchyRecord = hierarchy.hierarchyMap.get(teamMembership.id);
    const selfLabel =
      `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() ||
      teamMembership.membership.user.email;
    const resolvedLeaderId = isLeaderTeamMembershipRole(teamMembership.role)
      ? teamMembership.membershipId
      : hierarchyRecord?.directManagerMembershipId ?? hierarchyRecord?.rootLeader?.membershipId ?? null;
    const resolvedLeaderLabel = isLeaderTeamMembershipRole(teamMembership.role)
      ? selfLabel
      : hierarchyRecord?.directManagerLabel && hierarchyRecord.directManagerLabel !== "No direct manager"
        ? hierarchyRecord.directManagerLabel
        : hierarchyRecord?.rootLeader?.label ?? "";

    if (!resolvedLeaderId || !resolvedLeaderLabel) {
      continue;
    }

    const currentLeaderIds = leaderIdsByMembershipId.get(teamMembership.membershipId) ?? [];
    if (!currentLeaderIds.includes(resolvedLeaderId)) {
      currentLeaderIds.push(resolvedLeaderId);
      leaderIdsByMembershipId.set(teamMembership.membershipId, currentLeaderIds);
    }

    if (!leaderLabelByMembershipId.has(teamMembership.membershipId)) {
      leaderLabelByMembershipId.set(teamMembership.membershipId, resolvedLeaderLabel);
    }

    const teamLabel = hierarchyRecord ? hierarchyRecord.teamPathLabel : "";
    const roleLabel = formatTeamMembershipRoleLabel(teamMembership.role);
    optionMap.set(
      resolvedLeaderId,
      teamLabel ? `${resolvedLeaderLabel} · ${roleLabel} · ${teamLabel}` : `${resolvedLeaderLabel} · ${roleLabel}`
    );
  }

  return {
    options: [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, label]) => ({ id, label })),
    leaderIdsByMembershipId,
    leaderLabelByMembershipId
  } satisfies LoadedTeamLeaderInfo;
}

function mapSortOrder(sortBy: OfficeTransactionReportSortBy, sortDirection: OfficeTransactionReportSortDirection) {
  const config = sortableColumns[sortBy];

  if (Array.isArray(config)) {
    return config.map((entry, index) => {
      if (index === 0) {
        const key = Object.keys(entry)[0] as keyof typeof entry;
        return {
          [key]: sortDirection
        };
      }

      return entry;
    });
  }

  const key = Object.keys(config)[0] as keyof typeof config;
  return {
    [key]: sortDirection
  };
}

function buildReportRow(
  transaction: TransactionReportRecord,
  teamLeaderInfo: LoadedTeamLeaderInfo
): OfficeTransactionReportRow {
  const additionalFields = normalizeAdditionalFields(transaction.additionalFields);
  const rebateAmount = transaction.financeFees
    .filter((fee) => fee.feeType === "rebate")
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const referralAmount = transaction.financeFees
    .filter((fee) => fee.feeType === "client_referral" || fee.feeType === "external_referral" || fee.feeType === "company_referral")
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const reimbursementAmount = transaction.financeFees
    .filter((fee) => fee.feeType === "reimbursement")
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);

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
    askingPrice: formatCurrency(transaction.askingPrice),
    purchasedPrice: formatCurrency(getPurchasedPriceValue(transaction)),
    offerAcceptanceDate: formatDateValue(transaction.acceptanceDate),
    closingMoveInDate: formatDateValue(transaction.moveInDate ?? transaction.closingDate),
    commissionType: additionalFields.commissionType ?? "",
    invoiceBillTo: additionalFields.invoiceBillTo ?? "",
    leasingContact: additionalFields.leasingContact ?? "",
    currencyType: additionalFields.currencyType ?? "USD",
    grossCommission: formatCurrency(transaction.grossCommission),
    commissionRate: additionalFields.yourCommissionRate ?? "",
    rebate: formatCurrency(rebateAmount),
    referral: formatCurrency(referralAmount),
    reimbursement: formatCurrency(reimbursementAmount),
    coAgentLegalName: additionalFields.coAgentLegalName ?? "",
    commissionBreakdown: additionalFields.commissionBreakdown ?? "",
    notes: additionalFields.note ?? additionalFields.notes ?? "",
    externalPartners: additionalFields.externalPartners ?? "",
    companyReferral: transaction.companyReferral ? "Yes" : "No",
    companyReferralEmployeeName: transaction.companyReferralEmployeeName ?? additionalFields.companyReferralEmployeeName ?? "",
    href: `/office/transactions/${transaction.id}`
  };
}

export async function getOfficeTransactionReportsWorkspace(
  input: GetOfficeTransactionReportsWorkspaceInput
): Promise<OfficeTransactionReportsWorkspace> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: null,
    resource: "reports"
  });
  const visibleMembershipIds = scope.visibleMembershipIds;
  const teamLeaderInfo = await loadReportTeamLeaderInfo({
    organizationId: input.organizationId,
    visibleMembershipIds
  });
  const membershipVisibilityFilter =
    visibleMembershipIds === null
      ? undefined
      : {
          in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"]
        };
  const [ownerMemberships, departmentOptions] = await Promise.all([
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
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
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ name: "asc" }]
    })
  ]);

  const normalizedStatuses = normalizeStringList(input.transactionStatuses).filter((status) => Boolean(reportStatusFilterMap[status]));
  const normalizedTypes = normalizeStringList(input.transactionTypes).filter((type) => Boolean(reportTypeFilterMap[type]));
  const normalizedRepresentingSides = normalizeStringList(input.representingSides).filter(
    (side) => representingSideFilterMap[side] !== undefined
  );
  const normalizedLayouts = normalizeStringList(input.layouts).filter((layout) => layoutOptions.some((option) => option.id === layout));
  const normalizedDepartmentIds = normalizeStringList(input.departmentIds).filter((id) =>
    departmentOptions.some((option) => option.id === id)
  );
  const normalizedTeamLeaderMembershipIds = normalizeStringList(input.teamLeaderMembershipIds).filter((id) =>
    teamLeaderInfo.options.some((option) => option.id === id)
  );
  const createdAtOperator = normalizeDateOperator(input.createdAtOperator);
  const closingMoveInOperator = normalizeDateOperator(input.closingMoveInOperator);
  const commissionOperator = normalizeNumericOperator(input.commissionOperator);
  const askingPriceOperator = normalizeNumericOperator(input.askingPriceOperator);
  const purchasedPriceOperator = normalizeNumericOperator(input.purchasedPriceOperator);
  const sortBy = normalizeSortBy(input.sortBy);
  const sortDirection = normalizeSortDirection(input.sortDirection);
  const filters: OfficeTransactionReportsFilters = {
    ownerMembershipId: input.ownerMembershipId?.trim() ?? "",
    createdAtOperator,
    createdAtValue: input.createdAtValue?.trim() ?? "",
    createdAtFrom: input.createdAtFrom?.trim() ?? "",
    createdAtTo: input.createdAtTo?.trim() ?? "",
    buyerTenant: input.buyerTenant?.trim() ?? "",
    closingMoveInOperator,
    closingMoveInValue: input.closingMoveInValue?.trim() ?? "",
    closingMoveInFrom: input.closingMoveInFrom?.trim() ?? "",
    closingMoveInTo: input.closingMoveInTo?.trim() ?? "",
    commissionOperator,
    commissionValue: input.commissionValue?.trim() ?? "",
    commissionMin: input.commissionMin?.trim() ?? "",
    commissionMax: input.commissionMax?.trim() ?? "",
    askingPriceOperator,
    askingPriceValue: input.askingPriceValue?.trim() ?? "",
    askingPriceMin: input.askingPriceMin?.trim() ?? "",
    askingPriceMax: input.askingPriceMax?.trim() ?? "",
    purchasedPriceOperator,
    purchasedPriceValue: input.purchasedPriceValue?.trim() ?? "",
    purchasedPriceMin: input.purchasedPriceMin?.trim() ?? "",
    purchasedPriceMax: input.purchasedPriceMax?.trim() ?? "",
    transactionStatuses: normalizedStatuses,
    invoiceNumber: input.invoiceNumber?.trim() ?? "",
    departmentIds: normalizedDepartmentIds,
    teamLeaderMembershipIds: normalizedTeamLeaderMembershipIds,
    transactionTypes: normalizedTypes,
    representingSides: normalizedRepresentingSides,
    layouts: normalizedLayouts,
    companyReferral: input.companyReferral === "yes" || input.companyReferral === "no" ? input.companyReferral : "",
    sortBy,
    sortDirection,
    ownerOptions: ownerMemberships.map((membership) => ({
      id: membership.id,
      label: `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email
    })),
    departmentOptions: departmentOptions.map((office) => ({
      id: office.id,
      label: office.name
    })),
    teamLeaderOptions: teamLeaderInfo.options,
    statusOptions,
    transactionTypeOptions,
    representingOptions,
    layoutOptions,
    companyReferralOptions
  };

  const matchingOwnerMembershipIds =
    filters.teamLeaderMembershipIds.length > 0
      ? ownerMemberships
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
    buildTransactionVisibilityWhere(scope)
  ];

  if (filters.ownerMembershipId) {
    whereConditions.push({
      ownerMembershipId: filters.ownerMembershipId
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

  if (filters.layouts.length > 0) {
    whereConditions.push({
      OR: filters.layouts.map((layout) => ({
        additionalFields: {
          path: ["layout"],
          equals: layout
        }
      }))
    });
  }

  if (filters.companyReferral) {
    whereConditions.push({
      companyReferral: filters.companyReferral === "yes"
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
    orderBy: mapSortOrder(sortBy, sortDirection)
  });
  const rows = transactions.map((transaction) => buildReportRow(transaction, teamLeaderInfo));
  const summary = rows.reduce(
    (accumulator, row) => ({
      totalTransactions: accumulator.totalTransactions + 1,
      askingPrice: accumulator.askingPrice + Number(parseOptionalDecimal(row.askingPrice)?.toString() ?? 0),
      purchasedPrice: accumulator.purchasedPrice + Number(parseOptionalDecimal(row.purchasedPrice)?.toString() ?? 0),
      grossCommission: accumulator.grossCommission + Number(parseOptionalDecimal(row.grossCommission)?.toString() ?? 0),
      rebate: accumulator.rebate + Number(parseOptionalDecimal(row.rebate)?.toString() ?? 0),
      referral: accumulator.referral + Number(parseOptionalDecimal(row.referral)?.toString() ?? 0),
      reimbursement: accumulator.reimbursement + Number(parseOptionalDecimal(row.reimbursement)?.toString() ?? 0)
    }),
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
    summary: {
      totalTransactions: summary.totalTransactions,
      totalAskingPrice: formatCurrency(summary.askingPrice),
      totalPurchasedPrice: formatCurrency(summary.purchasedPrice),
      totalGrossCommission: formatCurrency(summary.grossCommission),
      totalRebate: formatCurrency(summary.rebate),
      totalReferral: formatCurrency(summary.referral),
      totalReimbursement: formatCurrency(summary.reimbursement)
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
