import { Prisma, TransactionRepresenting, TransactionStatus, TransactionType, UserRole } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import {
  buildTransactionVisibilityWhere,
  canViewCrossMemberFinancials,
  canViewFinancialsForMembership,
  redactCurrency,
  resolveOfficeDataScope
} from "./access";
import { prisma } from "./client";
import {
  getOfficeTransactionIntakeSchema,
  type OfficeTransactionCustomFieldDefinitionRecord,
  type OfficeTransactionFieldSettingRecord
} from "./field-settings";
import { listAvailableContactsForTransaction, type OfficeTransactionContact, type OfficeTransactionContactOption } from "./transaction-contacts";
import {
  listTransactionDocumentsSnapshot,
  type OfficeFormTemplateOption,
  type OfficeIncomingUpdate,
  type OfficeTransactionDocument,
  type OfficeTransactionForm
} from "./transaction-documents";

export type OfficeTransactionStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";

export type OfficeTransactionRecord = {
  id: string;
  address: string;
  importantDate: string;
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
};

export type OfficeTransactionSelectOption = {
  id: string;
  label: string;
};

export type OfficeTransactionFilterOptions = {
  ownerOptions: OfficeTransactionSelectOption[];
  teamOptions: OfficeTransactionSelectOption[];
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
  additionalFields: Record<string, string>;
  contacts: OfficeTransactionContact[];
  availableContacts: OfficeTransactionContactOption[];
  documents: OfficeTransactionDocument[];
  forms: OfficeTransactionForm[];
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
  price: string;
  buyerAgreementDate?: string;
  buyerExpirationDate?: string;
  acceptanceDate?: string;
  listingDate?: string;
  listingExpirationDate?: string;
  closingDate?: string;
  grossCommission?: string;
  referralFee?: string;
  officeNet?: string;
  agentNet?: string;
  financeNotes?: string;
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
  price: string;
  buyerAgreementDate?: string;
  buyerExpirationDate?: string;
  acceptanceDate?: string;
  listingDate?: string;
  listingExpirationDate?: string;
  closingDate?: string;
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
  price: string;
  buyerAgreementDate: string;
  buyerExpirationDate: string;
  acceptanceDate: string;
  listingDate: string;
  listingExpirationDate: string;
  closingDate: string;
  additionalFields: Record<string, string>;
};

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

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
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

function parseCreateFinanceDecimal(explicitValue: string | undefined, fallbackValue: string | undefined) {
  return parseOptionalDecimal(explicitValue) ?? parseOptionalDecimal(fallbackValue);
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
    price: "",
    buyerAgreementDate: "",
    buyerExpirationDate: "",
    acceptanceDate: "",
    listingDate: "",
    listingExpirationDate: "",
    closingDate: ""
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
      case "price":
        return input.existingTransaction?.price ?? "";
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
      case "price":
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
      case "price":
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
    price: builtInValues.price,
    buyerAgreementDate: builtInValues.buyerAgreementDate,
    buyerExpirationDate: builtInValues.buyerExpirationDate,
    acceptanceDate: builtInValues.acceptanceDate,
    listingDate: builtInValues.listingDate,
    listingExpirationDate: builtInValues.listingExpirationDate,
    closingDate: builtInValues.closingDate,
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
  return {
    id: transaction.id,
    address: `${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`.replace(/,\s+,/g, ", "),
    importantDate: formatImportantDate(transaction.importantDate),
    price: formatCurrency(transaction.price),
    owner: transaction.ownerMembership
      ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
      : "Unassigned",
    representing: representingLabelMap[transaction.representing],
    status: transactionStatusLabelMap[transaction.status],
    volume: Number(transaction.price ?? 0),
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
    companyReferral: boolean;
    companyReferralEmployeeName: string | null;
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
    incomingUpdates?: OfficeIncomingUpdate[];
    formTemplates?: OfficeFormTemplateOption[];
  },
  canViewFinancials: boolean
): OfficeTransactionDetail {
  const ownerName = transaction.ownerMembership
    ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
    : "Unassigned";

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
    price: transaction.price ? String(transaction.price) : "",
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
    additionalFields:
      transaction.additionalFields && typeof transaction.additionalFields === "object" && !Array.isArray(transaction.additionalFields)
        ? Object.fromEntries(
            Object.entries(transaction.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [key, String(value ?? "")])
          )
        : {},
    contacts: transaction.transactionContacts ?? [],
    availableContacts: transaction.availableContacts ?? [],
    documents: transaction.documents ?? [],
    forms: transaction.forms ?? [],
    incomingUpdates: transaction.incomingUpdates ?? [],
    formTemplates: transaction.formTemplates ?? [],
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

export async function listTransactions(input: ListTransactionsInput): Promise<OfficeTransactionListResult> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });
  const whereConditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    buildTransactionVisibilityWhere(scope)
  ];
  const requestedPage = Number.isFinite(input.page) ? Number(input.page) : defaultTransactionsPage;
  const requestedPageSize = Number.isFinite(input.pageSize) ? Number(input.pageSize) : defaultTransactionsPageSize;
  const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || defaultTransactionsPageSize, 1), maxTransactionsPageSize);
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
              teamId: input.teamId.trim(),
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

  const where = whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };

  const totalCount = await prisma.transaction.count({
    where
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(Math.trunc(requestedPage) || defaultTransactionsPage, 1), totalPages);
  const [transactions, financeAggregate, selfFinancialAggregate, ownerMemberships, teams] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        ownerMembership: {
          include: {
            user: true
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
    prisma.transaction.aggregate({
      where: {
        ...where,
        ownerMembershipId: scope.viewerMembershipId
      },
      _sum: {
        agentNet: true
      }
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: "active",
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
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
    }),
    prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
        ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ name: "asc" }]
    })
  ]);

  return {
    transactions: transactions.map(mapTransactionRecord),
    summary: {
      totalCount,
      totalNetIncome: canViewCrossMemberFinancials(scope)
        ? formatCurrency(financeAggregate._sum.officeNet)
        : formatCurrency(selfFinancialAggregate._sum.agentNet)
    },
    totalCount,
    totalPages,
    page,
    pageSize,
    filterOptions: {
      ownerOptions: ownerMemberships.map((membership) => ({
        id: membership.id,
        label: `${membership.user.firstName} ${membership.user.lastName}`
      })),
      teamOptions: teams.map((team) => ({
        id: team.id,
        label: team.name
      }))
    }
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
      documents: documentsSnapshot.documents,
      forms: documentsSnapshot.forms,
      incomingUpdates: documentsSnapshot.incomingUpdates,
      formTemplates: documentsSnapshot.formTemplates
    },
    canViewFinancials
  );
}

export async function createTransaction(input: CreateTransactionInput): Promise<OfficeTransactionDetail> {
  const additionalFields = { ...(input.additionalFields ?? {}) };

  const companyReferralValue = (additionalFields.companyReferral ?? "").toString().toLowerCase();
  const companyReferral = companyReferralValue === "yes";
  const companyReferralEmployeeName = (additionalFields.companyReferralEmployeesName ?? additionalFields.companyReferralEmployeeName ?? "").trim();
  const grossCommission = parseCreateFinanceDecimal(input.grossCommission, additionalFields.commissionAmount);
  const referralFee = parseCreateFinanceDecimal(input.referralFee, additionalFields.referralFee);
  const officeNet = parseCreateFinanceDecimal(input.officeNet, additionalFields.officeNet);
  const agentNet = parseCreateFinanceDecimal(input.agentNet, additionalFields.agentNet);
  const financeNotes = parseOptionalText(input.financeNotes) ?? parseOptionalText(additionalFields.note);

  const transaction = await prisma.$transaction(async (tx) => {
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
        price: parseOptionalDecimal(input.price),
        importantDate: parseOptionalDate(input.buyerExpirationDate) ?? parseOptionalDate(input.closingDate),
        buyerAgreementDate: parseOptionalDate(input.buyerAgreementDate),
        buyerExpirationDate: parseOptionalDate(input.buyerExpirationDate),
        acceptanceDate: parseOptionalDate(input.acceptanceDate),
        listingDate: parseOptionalDate(input.listingDate),
        listingExpirationDate: parseOptionalDate(input.listingExpirationDate),
        closingDate: parseOptionalDate(input.closingDate),
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
      grossCommission: true,
      referralFee: true,
      officeNet: true,
      agentNet: true,
      financeNotes: true
    }
  });

  if (!existing) {
    return null;
  }

  const nextGrossCommission = parseOptionalDecimal(input.grossCommission);
  const nextReferralFee = parseOptionalDecimal(input.referralFee);
  const nextOfficeNet = parseOptionalDecimal(input.officeNet);
  const nextAgentNet = parseOptionalDecimal(input.agentNet);
  const nextFinanceNotes = parseOptionalText(input.financeNotes);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: {
        id: input.transactionId
      },
      data: {
        grossCommission: nextGrossCommission,
        referralFee: nextReferralFee,
        officeNet: nextOfficeNet,
        agentNet: nextAgentNet,
        financeNotes: nextFinanceNotes
      }
    });

    const details = [
      buildAuditDetail("Gross commission", formatAuditCurrencyValue(existing.grossCommission), formatAuditCurrencyValue(nextGrossCommission)),
      buildAuditDetail("Referral fee", formatAuditCurrencyValue(existing.referralFee), formatAuditCurrencyValue(nextReferralFee)),
      buildAuditDetail("Office net", formatAuditCurrencyValue(existing.officeNet), formatAuditCurrencyValue(nextOfficeNet)),
      buildAuditDetail("Agent net", formatAuditCurrencyValue(existing.agentNet), formatAuditCurrencyValue(nextAgentNet)),
      buildAuditDetail("Finance notes", formatAuditTextValue(existing.financeNotes), formatAuditTextValue(nextFinanceNotes))
    ].filter((detail): detail is string => Boolean(detail));
    const changes = [
      buildAuditChange("Gross commission", formatAuditCurrencyValue(existing.grossCommission), formatAuditCurrencyValue(nextGrossCommission)),
      buildAuditChange("Referral fee", formatAuditCurrencyValue(existing.referralFee), formatAuditCurrencyValue(nextReferralFee)),
      buildAuditChange("Office net", formatAuditCurrencyValue(existing.officeNet), formatAuditCurrencyValue(nextOfficeNet)),
      buildAuditChange("Agent net", formatAuditCurrencyValue(existing.agentNet), formatAuditCurrencyValue(nextAgentNet)),
      buildAuditChange("Finance notes", formatAuditTextValue(existing.financeNotes), formatAuditTextValue(nextFinanceNotes))
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
      companyReferral: true,
      companyReferralEmployeeName: true,
      grossCommission: true,
      referralFee: true,
      officeNet: true,
      agentNet: true,
      financeNotes: true,
      additionalFields: true
    }
  });

  if (!existing) {
    return null;
  }

  const existingAdditionalFields =
    existing.additionalFields && typeof existing.additionalFields === "object" && !Array.isArray(existing.additionalFields)
      ? Object.fromEntries(
          Object.entries(existing.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [key, String(value ?? "")])
        )
      : {};
  const mergedAdditionalFields = {
    ...existingAdditionalFields,
    ...(input.additionalFields ?? {})
  };
  const companyReferralValue = (mergedAdditionalFields.companyReferral ?? "").toString().trim().toLowerCase();
  const nextCompanyReferral = companyReferralValue ? companyReferralValue === "yes" : existing.companyReferral;
  const nextCompanyReferralEmployeeName = (
    mergedAdditionalFields.companyReferralEmployeesName ?? mergedAdditionalFields.companyReferralEmployeeName ?? ""
  ).trim() || existing.companyReferralEmployeeName || "";
  const nextGrossCommission = parseCreateFinanceDecimal(undefined, mergedAdditionalFields.commissionAmount) ?? existing.grossCommission;
  const nextReferralFee = parseCreateFinanceDecimal(undefined, mergedAdditionalFields.referralFee) ?? existing.referralFee;
  const nextOfficeNet = parseCreateFinanceDecimal(undefined, mergedAdditionalFields.officeNet) ?? existing.officeNet;
  const nextAgentNet = parseCreateFinanceDecimal(undefined, mergedAdditionalFields.agentNet) ?? existing.agentNet;
  const nextFinanceNotes = parseOptionalText(mergedAdditionalFields.note) ?? existing.financeNotes;
  const nextTitle = input.transactionName.trim() || input.address.trim() || existing.title;
  const nextAddress = input.address.trim();
  const nextCity = input.city.trim();
  const nextState = input.state.trim();
  const nextZipCode = input.zipCode.trim();
  const nextPrice = parseOptionalDecimal(input.price);
  const nextBuyerAgreementDate = parseOptionalDate(input.buyerAgreementDate);
  const nextBuyerExpirationDate = parseOptionalDate(input.buyerExpirationDate);
  const nextAcceptanceDate = parseOptionalDate(input.acceptanceDate);
  const nextListingDate = parseOptionalDate(input.listingDate);
  const nextListingExpirationDate = parseOptionalDate(input.listingExpirationDate);
  const nextClosingDate = parseOptionalDate(input.closingDate);
  const nextImportantDate = parseOptionalDate(input.buyerExpirationDate) ?? parseOptionalDate(input.closingDate);
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
        price: nextPrice,
        importantDate: nextImportantDate,
        buyerAgreementDate: nextBuyerAgreementDate,
        buyerExpirationDate: nextBuyerExpirationDate,
        acceptanceDate: nextAcceptanceDate,
        listingDate: nextListingDate,
        listingExpirationDate: nextListingExpirationDate,
        closingDate: nextClosingDate,
        companyReferral: nextCompanyReferral,
        companyReferralEmployeeName: nextCompanyReferralEmployeeName || null,
        grossCommission: nextGrossCommission,
        referralFee: nextReferralFee,
        officeNet: nextOfficeNet,
        agentNet: nextAgentNet,
        financeNotes: nextFinanceNotes,
        referralContext: nextCompanyReferral
          ? {
              companyReferralEmployeeName: nextCompanyReferralEmployeeName
            }
          : Prisma.JsonNull,
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
      buildAuditDetail("Price", formatAuditCurrencyValue(existing.price), formatAuditCurrencyValue(nextPrice)),
      buildAuditDetail("Buyer agreement date", formatAuditTextValue(formatDateValue(existing.buyerAgreementDate)), formatAuditTextValue(input.buyerAgreementDate)),
      buildAuditDetail("Buyer expiration date", formatAuditTextValue(formatDateValue(existing.buyerExpirationDate)), formatAuditTextValue(input.buyerExpirationDate)),
      buildAuditDetail("Acceptance date", formatAuditTextValue(formatDateValue(existing.acceptanceDate)), formatAuditTextValue(input.acceptanceDate)),
      buildAuditDetail("Listing date", formatAuditTextValue(formatDateValue(existing.listingDate)), formatAuditTextValue(input.listingDate)),
      buildAuditDetail("Listing expiration date", formatAuditTextValue(formatDateValue(existing.listingExpirationDate)), formatAuditTextValue(input.listingExpirationDate)),
      buildAuditDetail("Closing date", formatAuditTextValue(formatDateValue(existing.closingDate)), formatAuditTextValue(input.closingDate)),
      ...Object.keys(input.additionalFields ?? {}).map((fieldKey) =>
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
      buildAuditChange("Price", formatAuditCurrencyValue(existing.price), formatAuditCurrencyValue(nextPrice)),
      buildAuditChange("Buyer agreement date", formatAuditTextValue(formatDateValue(existing.buyerAgreementDate)), formatAuditTextValue(input.buyerAgreementDate)),
      buildAuditChange("Buyer expiration date", formatAuditTextValue(formatDateValue(existing.buyerExpirationDate)), formatAuditTextValue(input.buyerExpirationDate)),
      buildAuditChange("Acceptance date", formatAuditTextValue(formatDateValue(existing.acceptanceDate)), formatAuditTextValue(input.acceptanceDate)),
      buildAuditChange("Listing date", formatAuditTextValue(formatDateValue(existing.listingDate)), formatAuditTextValue(input.listingDate)),
      buildAuditChange("Listing expiration date", formatAuditTextValue(formatDateValue(existing.listingExpirationDate)), formatAuditTextValue(input.listingExpirationDate)),
      buildAuditChange("Closing date", formatAuditTextValue(formatDateValue(existing.closingDate)), formatAuditTextValue(input.closingDate)),
      ...Object.keys(input.additionalFields ?? {}).map((fieldKey) =>
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
