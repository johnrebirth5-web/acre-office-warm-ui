import {
  ContactCustomFieldDefinition,
  ContactFieldSetting,
  OfferCustomFieldDefinition,
  OfferFieldSetting,
  Prisma,
  TransactionContactRole,
  TransactionCustomFieldDefinition,
  TransactionCustomFieldType,
  TransactionFieldKey,
  TransactionFieldSetting
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";

type BuiltInSelectOptionCatalogEntry = {
  value: string;
  label: string;
};

type OfficeFieldBuiltInCatalogEntry = {
  key: string;
  label: string;
  inputName: string;
  section?: "top" | "primary";
  control: "text" | "date" | "select" | "textarea";
  className?: string;
  sortOrder: number;
  defaultValue?: string;
  options?: BuiltInSelectOptionCatalogEntry[];
  isLockedRequired?: boolean;
  isLockedVisible?: boolean;
};

type OfficeFieldDefaultCustomCatalogEntry = {
  fieldKey: string;
  label: string;
  type: TransactionCustomFieldType;
  sortOrder: number;
  options: string[];
  isDeletionLocked?: boolean;
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

const transactionIntakeBuiltInFieldCatalog: OfficeFieldBuiltInCatalogEntry[] = [
  {
    key: "transaction_type",
    label: "Type",
    inputName: "transactionType",
    section: "top",
    control: "select",
    sortOrder: 0,
    defaultValue: "other",
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
    sortOrder: 1,
    defaultValue: "opportunity",
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
    sortOrder: 2,
    defaultValue: "buyer",
    options: [
      { value: "buyer", label: "Buyer" },
      { value: "seller", label: "Seller" },
      { value: "both", label: "Both" },
      { value: "tenant", label: "Tenant" },
      { value: "landlord", label: "Landlord" }
    ]
  },
  { key: "address", label: "Address", inputName: "address", section: "primary", control: "text", sortOrder: 10 },
  { key: "city", label: "City", inputName: "city", section: "primary", control: "text", sortOrder: 11 },
  { key: "state", label: "State", inputName: "state", section: "primary", control: "text", className: "is-compact", sortOrder: 12 },
  { key: "zip_code", label: "Zip", inputName: "zipCode", section: "primary", control: "text", className: "is-compact", sortOrder: 13 },
  {
    key: "transaction_name",
    label: "Transaction Name",
    inputName: "transactionName",
    section: "primary",
    control: "text",
    className: "is-span-4",
    sortOrder: 14
  },
  { key: "price", label: "Price", inputName: "price", section: "primary", control: "text", sortOrder: 15 },
  {
    key: "buyer_agreement_date",
    label: "Buyer Agreement Date",
    inputName: "buyerAgreementDate",
    section: "primary",
    control: "date",
    sortOrder: 16
  },
  {
    key: "buyer_expiration_date",
    label: "Buyer Expiration Date",
    inputName: "buyerExpirationDate",
    section: "primary",
    control: "date",
    sortOrder: 17
  },
  {
    key: "acceptance_date",
    label: "Acceptance Date",
    inputName: "acceptanceDate",
    section: "primary",
    control: "date",
    sortOrder: 18
  },
  {
    key: "listing_date",
    label: "Listing Date",
    inputName: "listingDate",
    section: "primary",
    control: "date",
    sortOrder: 19
  },
  {
    key: "listing_expiration_date",
    label: "Listing Expiration Date",
    inputName: "listingExpirationDate",
    section: "primary",
    control: "date",
    sortOrder: 20
  },
  {
    key: "closing_date",
    label: "Closing Date",
    inputName: "closingDate",
    section: "primary",
    control: "date",
    sortOrder: 21
  }
];

const legacyCustomFieldSettingKeyMap: Partial<Record<string, TransactionFieldKey>> = {
  companyReferral: "company_referral",
  companyReferralEmployeeName: "company_referral_employee_name"
};

const defaultTransactionCustomFieldCatalog: OfficeFieldDefaultCustomCatalogEntry[] = [
  {
    fieldKey: "agentName",
    label: "Agent Name",
    type: "text",
    sortOrder: 100,
    options: [],
    isDeletionLocked: true
  },
  { fieldKey: "licensedAgentName", label: "Licensed Agent Name", type: "text", sortOrder: 102, options: [] },
  { fieldKey: "invoiceNumber", label: "Invoice Number", type: "text", sortOrder: 103, options: [] },
  { fieldKey: "buyerTenant", label: "Buyer/Tenant", type: "text", sortOrder: 104, options: [] },
  { fieldKey: "buildingName", label: "Building Name", type: "text", sortOrder: 105, options: [] },
  { fieldKey: "additionalAddress", label: "Address", type: "text", sortOrder: 106, options: [] },
  { fieldKey: "unitNumber", label: "Unit # (If it's a house, fill out \"house\")", type: "text", sortOrder: 107, options: [] },
  { fieldKey: "layout", label: "Layout", type: "text", sortOrder: 108, options: [] },
  { fieldKey: "additionalCity", label: "City", type: "text", sortOrder: 109, options: [] },
  { fieldKey: "additionalState", label: "State", type: "text", sortOrder: 110, options: [] },
  { fieldKey: "additionalZipCode", label: "Zip Code", type: "text", sortOrder: 111, options: [] },
  { fieldKey: "moveInDateClosingDate", label: "Move-In Date/Closing Date", type: "text", sortOrder: 112, options: [] },
  { fieldKey: "commissionType", label: "Commission Type", type: "select", sortOrder: 113, options: ["Gross", "Net", "Custom"] },
  { fieldKey: "leasingContact", label: "Leasing Contact", type: "text", sortOrder: 114, options: [] },
  { fieldKey: "invoiceBillTo", label: "Invoice Bill To", type: "text", sortOrder: 115, options: [] },
  { fieldKey: "currencyType", label: "Currency Type", type: "select", sortOrder: 116, options: ["USD"] },
  { fieldKey: "commissionAmount", label: "Commission($)", type: "text", sortOrder: 117, options: [] },
  { fieldKey: "yourCommissionRate", label: "Your Commission Rate", type: "text", sortOrder: 118, options: [] },
  { fieldKey: "rebate", label: "Rebate", type: "text", sortOrder: 119, options: [] },
  { fieldKey: "reimbursement", label: "Reimbursement", type: "text", sortOrder: 120, options: [] },
  { fieldKey: "coAgentLegalName", label: "Co-Agent Legal Name", type: "text", sortOrder: 121, options: [] },
  { fieldKey: "commissionBreakdown", label: "Commission Breakdown", type: "text", sortOrder: 122, options: [] },
  { fieldKey: "companyReferral", label: "Company Referral", type: "select", sortOrder: 123, options: ["Yes", "No"] },
  { fieldKey: "outsideReferral", label: "Outside Referral", type: "select", sortOrder: 124, options: ["Yes", "No"] },
  { fieldKey: "referralFee", label: "Referral Fee", type: "text", sortOrder: 125, options: [] },
  { fieldKey: "externalPartners", label: "External Partners", type: "text", sortOrder: 126, options: [] },
  { fieldKey: "companyReferralEmployeeName", label: "Company Referral Employee's Name", type: "text", sortOrder: 127, options: [] },
  { fieldKey: "clientEmail", label: "Client's Email", type: "text", sortOrder: 128, options: [] },
  { fieldKey: "uploadInvoiceToVendorCafe", label: "Upload Invoice to VendorCafe", type: "select", sortOrder: 129, options: ["Yes", "No"] },
  { fieldKey: "note", label: "Note(Rebate, Referral, Others)", type: "text", sortOrder: 130, options: [] },
  { fieldKey: "commissionReceivedStatus", label: "Status of Commission Received(For Admin)", type: "select", sortOrder: 131, options: ["No", "Yes", "Partial"] },
  {
    fieldKey: "commissionConfirmation",
    label: "Commission Confirmation(For Agent, we'll process the payment once you select yes)",
    type: "select",
    sortOrder: 132,
    options: ["Yes", "No"]
  }
];

const retiredTransactionCustomFieldKeys = new Set(["teamLeader"]);
const systemManagedTransactionCustomFieldConfig: Partial<Record<string, { isVisible?: boolean; options?: string[] }>> = {
  currencyType: {
    isVisible: false,
    options: ["USD"]
  }
};

const contactBuiltInFieldCatalog: OfficeFieldBuiltInCatalogEntry[] = [
  {
    key: "fullName",
    label: "Full name",
    inputName: "fullName",
    control: "text",
    sortOrder: 0,
    isLockedRequired: true,
    isLockedVisible: true
  },
  { key: "email", label: "Email", inputName: "email", control: "text", sortOrder: 1 },
  { key: "phone", label: "Phone", inputName: "phone", control: "text", sortOrder: 2 },
  { key: "contactType", label: "Contact type", inputName: "contactType", control: "text", sortOrder: 3 },
  { key: "source", label: "Source", inputName: "source", control: "text", sortOrder: 4, defaultValue: "Manual entry" },
  { key: "stage", label: "Stage", inputName: "stage", control: "text", sortOrder: 5, defaultValue: "New" },
  { key: "intent", label: "Intent", inputName: "intent", control: "text", sortOrder: 6, defaultValue: "Unknown" },
  { key: "budgetMin", label: "Budget min", inputName: "budgetMin", control: "text", sortOrder: 7 },
  { key: "budgetMax", label: "Budget max", inputName: "budgetMax", control: "text", sortOrder: 8 },
  {
    key: "preferredAreas",
    label: "Preferred areas",
    inputName: "preferredAreas",
    control: "text",
    className: "is-span-4",
    sortOrder: 9
  },
  { key: "lastContactAt", label: "Last contact", inputName: "lastContactAt", control: "date", sortOrder: 10 },
  { key: "nextFollowUpAt", label: "Next follow-up", inputName: "nextFollowUpAt", control: "date", sortOrder: 11 },
  { key: "notes", label: "Notes", inputName: "notes", control: "textarea", className: "is-span-4", sortOrder: 12 }
];

const offerBuiltInFieldCatalog: OfficeFieldBuiltInCatalogEntry[] = [
  {
    key: "title",
    label: "Offer title",
    inputName: "title",
    control: "text",
    sortOrder: 0,
    isLockedRequired: true,
    isLockedVisible: true
  },
  {
    key: "offeringPartyName",
    label: "Offering party",
    inputName: "offeringPartyName",
    control: "text",
    sortOrder: 1,
    isLockedRequired: true,
    isLockedVisible: true
  },
  { key: "buyerName", label: "Buyer name", inputName: "buyerName", control: "text", sortOrder: 2 },
  { key: "price", label: "Price", inputName: "price", control: "text", sortOrder: 3 },
  { key: "earnestMoneyAmount", label: "Earnest money", inputName: "earnestMoneyAmount", control: "text", sortOrder: 4 },
  { key: "financingType", label: "Financing type", inputName: "financingType", control: "text", sortOrder: 5 },
  { key: "closingDateOffered", label: "Closing date offered", inputName: "closingDateOffered", control: "date", sortOrder: 6 },
  { key: "expirationAt", label: "Expiration", inputName: "expirationAt", control: "date", sortOrder: 7 },
  { key: "notes", label: "Notes", inputName: "notes", control: "textarea", className: "is-span-4", sortOrder: 8 }
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

const fieldModuleCatalog = {
  transaction: {
    label: "Transaction fields",
    description: "Built-in transaction intake fields, custom fields, and required contact roles for the current office."
  },
  contact: {
    label: "Contact fields",
    description: "Organization-wide contact profile fields and custom follow-up metadata."
  },
  offer: {
    label: "Offer fields",
    description: "Office-scoped offer form fields used when creating and editing offers inside transaction detail."
  }
} as const;

export type OfficeFieldModule = keyof typeof fieldModuleCatalog;

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

export type OfficeFieldBuiltInRecord = {
  fieldKey: string;
  inputName: string;
  label: string;
  section: "top" | "primary";
  control: "text" | "date" | "select" | "textarea";
  className: string;
  options: string[];
  selectOptions: OfficeTransactionBuiltInSelectOptionRecord[];
  isRequired: boolean;
  isVisible: boolean;
  isLockedRequired: boolean;
  isLockedVisible: boolean;
  sortOrder: number;
};

export type OfficeFieldCustomDefinitionRecord = {
  id: string | null;
  fieldKey: string;
  inputName: string;
  label: string;
  type: TransactionCustomFieldType;
  isRequired: boolean;
  isVisible: boolean;
  isDeletionLocked: boolean;
  isLockedDeletion: boolean;
  sortOrder: number;
  options: string[];
  isDefault: boolean;
  isArchived: boolean;
};

export type OfficeTransactionFieldSettingRecord = OfficeFieldBuiltInRecord & {
  fieldKey: TransactionFieldKey;
};

export type OfficeTransactionCustomFieldDefinitionRecord = OfficeFieldCustomDefinitionRecord;
export type OfficeContactFieldSettingRecord = OfficeFieldBuiltInRecord;
export type OfficeContactCustomFieldDefinitionRecord = OfficeFieldCustomDefinitionRecord;
export type OfficeOfferFieldSettingRecord = OfficeFieldBuiltInRecord;
export type OfficeOfferCustomFieldDefinitionRecord = OfficeFieldCustomDefinitionRecord;

type OfficeFieldSchemaSummary = {
  builtInFieldCount: number;
  visibleBuiltInFieldCount: number;
  requiredBuiltInFieldCount: number;
  customFieldCount: number;
  visibleCustomFieldCount: number;
  requiredCustomFieldCount: number;
};

export type OfficeTransactionIntakeSchema = {
  summary: OfficeFieldSchemaSummary;
  builtInFields: OfficeTransactionFieldSettingRecord[];
  customFields: OfficeTransactionCustomFieldDefinitionRecord[];
};

export type OfficeContactFieldSchema = {
  summary: OfficeFieldSchemaSummary;
  builtInFields: OfficeContactFieldSettingRecord[];
  customFields: OfficeContactCustomFieldDefinitionRecord[];
};

export type OfficeOfferFieldSchema = {
  summary: OfficeFieldSchemaSummary;
  builtInFields: OfficeOfferFieldSettingRecord[];
  customFields: OfficeOfferCustomFieldDefinitionRecord[];
};

export type OfficeFieldModuleSettingsSnapshot = {
  module: OfficeFieldModule;
  label: string;
  description: string;
  summary: {
    fieldCount: number;
    customFieldCount: number;
    visibleFieldCount: number;
    hiddenFieldCount: number;
    requiredFieldCount: number;
  };
  builtInFields: OfficeFieldBuiltInRecord[];
  customFields: OfficeFieldCustomDefinitionRecord[];
  requiredContactRoles: OfficeRequiredContactRoleRecord[];
};

export type OfficeFieldSettingsSnapshot = {
  selectedModule: OfficeFieldModule;
  modules: Array<{
    module: OfficeFieldModule;
    label: string;
    description: string;
    fieldCount: number;
    customFieldCount: number;
    hiddenFieldCount: number;
  }>;
  currentModule: OfficeFieldModuleSettingsSnapshot;
};

export type SaveOfficeFieldSettingsInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  module: OfficeFieldModule;
  contactRoleSettings?: Array<{
    role: string;
    isRequired: boolean;
  }>;
  builtInFieldSettings: Array<{
    fieldKey: string;
    isRequired: boolean;
    isVisible: boolean;
    sortOrder?: number;
    selectOptions?: Array<{
      value: string;
      label: string;
      isEnabled: boolean;
    }>;
  }>;
  customFieldDefinitions?: Array<{
    fieldKey: string;
    label?: string;
    type?: string;
    isRequired: boolean;
    isVisible: boolean;
    isDeletionLocked?: boolean;
    sortOrder?: number;
    options?: string[];
  }>;
};

export type CreateOfficeCustomFieldDefinitionInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  module: OfficeFieldModule;
  label: string;
  type: string;
  isRequired?: boolean;
  isVisible?: boolean;
  isDeletionLocked?: boolean;
  options?: string[];
};

export type UpdateOfficeCustomFieldDefinitionInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  module: OfficeFieldModule;
  fieldKey: string;
  label?: string;
  type?: string;
  isRequired?: boolean;
  isVisible?: boolean;
  isDeletionLocked?: boolean;
  sortOrder?: number;
  options?: string[];
};

export type DeleteOfficeCustomFieldDefinitionInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  module: OfficeFieldModule;
  fieldKey: string;
};

export type ReorderOfficeFieldsInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  module: OfficeFieldModule;
  fieldOrder: Array<{
    kind: "builtIn" | "custom";
    fieldKey: string;
  }>;
};

export type CreateOfficeTransactionCustomFieldDefinitionInput = Omit<CreateOfficeCustomFieldDefinitionInput, "module">;
export type UpdateOfficeTransactionCustomFieldDefinitionInput = Omit<UpdateOfficeCustomFieldDefinitionInput, "module">;

export type PreparedContactFieldSubmission = {
  fullName: string;
  email: string;
  phone: string;
  contactType: string;
  source: string;
  stage: string;
  intent: string;
  budgetMin: string;
  budgetMax: string;
  preferredAreas: string;
  notes: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  additionalFields: Record<string, string>;
};

export type PreparedOfferFieldSubmission = {
  title: string;
  offeringPartyName: string;
  buyerName: string;
  price: string;
  earnestMoneyAmount: string;
  financingType: string;
  closingDateOffered: string;
  expirationAt: string;
  notes: string;
  additionalFields: Record<string, string>;
};

type PersistedFieldSetting = TransactionFieldSetting | ContactFieldSetting | OfferFieldSetting;
type PersistedCustomFieldDefinition = TransactionCustomFieldDefinition | ContactCustomFieldDefinition | OfferCustomFieldDefinition;

function buildChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue ? null : { label, previousValue, nextValue };
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePayloadString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOfficeFieldModule(value: string | undefined): OfficeFieldModule {
  if (value === "contact" || value === "offer") {
    return value;
  }

  return "transaction";
}

function resolveFieldSettingsOfficeId(module: OfficeFieldModule, officeId: string | null | undefined) {
  return module === "contact" ? null : officeId ?? null;
}

function getBuiltInCatalog(module: OfficeFieldModule) {
  switch (module) {
    case "contact":
      return contactBuiltInFieldCatalog;
    case "offer":
      return offerBuiltInFieldCatalog;
    case "transaction":
    default:
      return transactionIntakeBuiltInFieldCatalog;
  }
}

function getDefaultCustomCatalog(module: OfficeFieldModule) {
  return module === "transaction"
    ? defaultTransactionCustomFieldCatalog.filter((entry) => !retiredTransactionCustomFieldKeys.has(entry.fieldKey))
    : [];
}

function isDefaultCustomFieldDeletionLocked(
  defaultEntry: OfficeFieldDefaultCustomCatalogEntry | null | undefined
) {
  return Boolean(defaultEntry?.isDeletionLocked);
}

function getFieldSettingsAction(module: OfficeFieldModule) {
  if (module === "contact") {
    return activityLogActions.settingsContactFieldSettingsChanged;
  }

  if (module === "offer") {
    return activityLogActions.settingsOfferFieldSettingsChanged;
  }

  return activityLogActions.settingsTransactionFieldSettingsChanged;
}

function getFieldSettingsObjectLabel(module: OfficeFieldModule) {
  if (module === "contact") {
    return "Contact field settings";
  }

  if (module === "offer") {
    return "Offer field settings";
  }

  return "Transaction field settings";
}

function getBuiltInCatalogEntry(module: OfficeFieldModule, fieldKey: string) {
  return getBuiltInCatalog(module).find((entry) => entry.key === fieldKey) ?? null;
}

function normalizeBuiltInFieldKey(module: OfficeFieldModule, value: string) {
  const catalogEntry = getBuiltInCatalogEntry(module, value.trim());

  if (!catalogEntry) {
    throw new Error(`A valid ${module} field key is required.`);
  }

  return catalogEntry.key;
}

function normalizeTransactionFieldKey(value: string): TransactionFieldKey {
  const key = normalizeBuiltInFieldKey("transaction", value);
  return key as TransactionFieldKey;
}

function normalizeTransactionCustomFieldType(value: string): TransactionCustomFieldType {
  if (value === "text" || value === "select" || value === "date") {
    return value;
  }

  throw new Error("A valid custom field type is required.");
}

function normalizeTransactionCustomFieldKey(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error("A valid custom field key is required.");
  }

  return trimmed;
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

function buildOfficeBuiltInFieldRecord(input: {
  module: OfficeFieldModule;
  fieldKey: string;
  isRequired: boolean;
  isVisible: boolean;
  sortOrder: number;
  options?: Prisma.JsonValue | null;
  isLockedRequired?: boolean;
  isLockedVisible?: boolean;
}): OfficeFieldBuiltInRecord {
  const catalogEntry = getBuiltInCatalogEntry(input.module, input.fieldKey);

  if (!catalogEntry) {
    throw new Error("Unsupported built-in field.");
  }

  const selectOptions =
    input.module === "transaction" && catalogEntry.control === "select"
      ? readTransactionBuiltInSelectOptions(catalogEntry.key as TransactionFieldKey, input.options)
      : [];

  return {
    fieldKey: catalogEntry.key,
    inputName: catalogEntry.inputName,
    label: catalogEntry.label,
    section: catalogEntry.section ?? "primary",
    control: catalogEntry.control,
    className: catalogEntry.className ?? "",
    options: selectOptions.filter((option) => option.isEnabled).map((option) => option.value),
    selectOptions,
    isRequired: input.isRequired,
    isVisible: input.isVisible,
    isLockedRequired: Boolean(input.isLockedRequired ?? catalogEntry.isLockedRequired),
    isLockedVisible: Boolean(input.isLockedVisible ?? catalogEntry.isLockedVisible),
    sortOrder: input.sortOrder
  };
}

function buildOfficeCustomFieldRecord(input: {
  id?: string | null;
  fieldKey: string;
  label: string;
  type: TransactionCustomFieldType;
  isRequired: boolean;
  isVisible: boolean;
  isDeletionLocked: boolean;
  isLockedDeletion?: boolean;
  sortOrder: number;
  options?: string[];
  isDefault: boolean;
  isArchived?: boolean;
}): OfficeFieldCustomDefinitionRecord {
  return {
    id: input.id ?? null,
    fieldKey: input.fieldKey,
    inputName: input.fieldKey,
    label: input.label,
    type: input.type,
    isRequired: input.isRequired,
    isVisible: input.isVisible,
    isDeletionLocked: input.isDeletionLocked,
    isLockedDeletion: Boolean(input.isLockedDeletion),
    sortOrder: input.sortOrder,
    options: input.options ?? [],
    isDefault: input.isDefault,
    isArchived: Boolean(input.isArchived)
  };
}

function buildFieldSchemaSummary(
  builtInFields: OfficeFieldBuiltInRecord[],
  customFields: OfficeFieldCustomDefinitionRecord[]
): OfficeFieldSchemaSummary {
  return {
    builtInFieldCount: builtInFields.length,
    visibleBuiltInFieldCount: builtInFields.filter((entry) => entry.isVisible).length,
    requiredBuiltInFieldCount: builtInFields.filter((entry) => entry.isRequired).length,
    customFieldCount: customFields.length,
    visibleCustomFieldCount: customFields.filter((entry) => entry.isVisible).length,
    requiredCustomFieldCount: customFields.filter((entry) => entry.isRequired).length
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

async function listPersistedBuiltInFieldSettings(
  module: OfficeFieldModule,
  input: { organizationId: string; officeId?: string | null }
): Promise<PersistedFieldSetting[]> {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);

  switch (module) {
    case "contact":
      return prisma.contactFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
    case "offer":
      return prisma.offerFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
    case "transaction":
    default:
      return prisma.transactionFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
  }
}

async function listPersistedCustomFieldDefinitions(
  module: OfficeFieldModule,
  input: { organizationId: string; officeId?: string | null; includeArchived?: boolean }
): Promise<PersistedCustomFieldDefinition[]> {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);

  switch (module) {
    case "contact":
      return prisma.contactCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
    case "offer":
      return prisma.offerCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
    case "transaction":
    default:
      return prisma.transactionCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
  }
}

async function getRequiredContactRoleRows(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeRequiredContactRoleRecord[]> {
  const requiredRoleSettings = await prisma.requiredContactRoleSetting.findMany({
    where: {
      organizationId: input.organizationId,
      officeId: resolveFieldSettingsOfficeId("transaction", input.officeId)
    }
  });

  const requiredRoleMap = new Map(requiredRoleSettings.map((entry) => [entry.role, entry.isRequired]));

  return contactRoleCatalog.map((entry) => ({
    role: entry.role,
    label: entry.label,
    isRequired: requiredRoleMap.get(entry.role) ?? false
  }));
}

function sortBuiltInFields<T extends OfficeFieldBuiltInRecord>(fields: T[]) {
  return [...fields].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.section !== right.section) {
      return left.section.localeCompare(right.section);
    }

    return left.label.localeCompare(right.label);
  });
}

function sortCustomFields<T extends OfficeFieldCustomDefinitionRecord>(fields: T[]) {
  return [...fields].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

export async function getOfficeTransactionIntakeSchema(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeTransactionIntakeSchema> {
  const [transactionFieldSettings, transactionCustomFieldDefinitions] = await Promise.all([
    listPersistedBuiltInFieldSettings("transaction", input),
    listPersistedCustomFieldDefinitions("transaction", { ...input, includeArchived: true })
  ]);

  const fieldSettingsMap = new Map(
    transactionFieldSettings.map((entry) => [
      entry.fieldKey as TransactionFieldKey,
      {
        isRequired: entry.isRequired,
        isVisible: entry.isVisible,
        options: entry.options,
        sortOrder: entry.sortOrder
      }
    ])
  );

  const builtInFields = applyTransactionIdentityFallback(
    transactionIntakeBuiltInFieldCatalog.map((entry) =>
      ({
        ...buildOfficeBuiltInFieldRecord({
          module: "transaction",
          fieldKey: entry.key,
          isRequired: fieldSettingsMap.get(entry.key as TransactionFieldKey)?.isRequired ?? false,
          isVisible: fieldSettingsMap.get(entry.key as TransactionFieldKey)?.isVisible ?? true,
          sortOrder: fieldSettingsMap.get(entry.key as TransactionFieldKey)?.sortOrder ?? entry.sortOrder,
          options: fieldSettingsMap.get(entry.key as TransactionFieldKey)?.options
        }),
        fieldKey: entry.key as TransactionFieldKey
      }) satisfies OfficeTransactionFieldSettingRecord
    )
  );

  const defaultTransactionCustomFields = getDefaultCustomCatalog("transaction");
  const activeTransactionCustomFieldDefinitions = transactionCustomFieldDefinitions.filter(
    (entry) => !retiredTransactionCustomFieldKeys.has(entry.fieldKey)
  );
  const persistedCustomFieldMap = new Map(activeTransactionCustomFieldDefinitions.map((entry) => [entry.fieldKey, entry]));
  const customFields = defaultTransactionCustomFields
    .map((entry) => {
      const persisted = persistedCustomFieldMap.get(entry.fieldKey) ?? null;
      const isDeletionLocked = isDefaultCustomFieldDeletionLocked(entry) || Boolean(persisted?.isDeletionLocked);

      if (persisted?.isArchived && !isDeletionLocked) {
        return null;
      }

      const legacyFallback = buildLegacyCustomFieldFallbackState(entry.fieldKey, new Map(
        [...fieldSettingsMap.entries()].map(([fieldKey, value]) => [fieldKey, { isRequired: value.isRequired, isVisible: value.isVisible }])
      ));
      const systemManagedConfig = systemManagedTransactionCustomFieldConfig[entry.fieldKey];

      return buildOfficeCustomFieldRecord({
        id: persisted?.id ?? null,
        fieldKey: entry.fieldKey,
        label: persisted?.label ?? entry.label,
        type: (persisted?.type ?? entry.type) as TransactionCustomFieldType,
        isRequired: persisted?.isRequired ?? legacyFallback?.isRequired ?? false,
        isVisible: systemManagedConfig?.isVisible ?? persisted?.isVisible ?? legacyFallback?.isVisible ?? true,
        isDeletionLocked,
        isLockedDeletion: isDefaultCustomFieldDeletionLocked(entry),
        sortOrder: persisted?.sortOrder ?? entry.sortOrder,
        options: systemManagedConfig?.options ?? (persisted ? readTransactionCustomFieldOptions(persisted.options) : entry.options),
        isDefault: true,
        isArchived: false
      });
    })
    .filter((entry): entry is OfficeTransactionCustomFieldDefinitionRecord => Boolean(entry))
    .concat(
      activeTransactionCustomFieldDefinitions
        .filter(
          (entry) => !entry.isArchived && !defaultTransactionCustomFields.some((defaultEntry) => defaultEntry.fieldKey === entry.fieldKey)
        )
        .map((entry) =>
          buildOfficeCustomFieldRecord({
            id: entry.id,
            fieldKey: entry.fieldKey,
            label: entry.label,
            type: entry.type,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible,
            isDeletionLocked: entry.isDeletionLocked,
            isLockedDeletion: false,
            sortOrder: entry.sortOrder,
            options: readTransactionCustomFieldOptions(entry.options),
            isDefault: false,
            isArchived: false
          })
        )
    );

  const sortedBuiltIns = sortBuiltInFields(builtInFields);
  const sortedCustomFields = sortCustomFields(customFields);

  return {
    summary: buildFieldSchemaSummary(sortedBuiltIns, sortedCustomFields),
    builtInFields: sortedBuiltIns,
    customFields: sortedCustomFields
  };
}

function buildGenericModuleFieldSchema(
  module: "contact" | "offer",
  builtInSettings: PersistedFieldSetting[],
  customDefinitions: PersistedCustomFieldDefinition[]
): OfficeContactFieldSchema | OfficeOfferFieldSchema {
  const builtInSettingMap = new Map(
    builtInSettings.map((entry) => [
      entry.fieldKey,
      {
        isRequired: entry.isRequired,
        isVisible: entry.isVisible,
        sortOrder: entry.sortOrder,
        options: entry.options
      }
    ])
  );

  const builtInFields = sortBuiltInFields(
    getBuiltInCatalog(module).map((entry) =>
      buildOfficeBuiltInFieldRecord({
        module,
        fieldKey: entry.key,
        isRequired: builtInSettingMap.get(entry.key)?.isRequired ?? false,
        isVisible: builtInSettingMap.get(entry.key)?.isVisible ?? true,
        sortOrder: builtInSettingMap.get(entry.key)?.sortOrder ?? entry.sortOrder,
        options: builtInSettingMap.get(entry.key)?.options
      })
    )
  );

  const customFields = sortCustomFields(
    customDefinitions
      .filter((entry) => !entry.isArchived)
      .map((entry) =>
        buildOfficeCustomFieldRecord({
          id: entry.id,
          fieldKey: entry.fieldKey,
          label: entry.label,
          type: entry.type,
          isRequired: entry.isRequired,
          isVisible: entry.isVisible,
          isDeletionLocked: entry.isDeletionLocked,
          isLockedDeletion: false,
          sortOrder: entry.sortOrder,
          options: readTransactionCustomFieldOptions(entry.options),
          isDefault: false,
          isArchived: false
        })
      )
  );

  return {
    summary: buildFieldSchemaSummary(builtInFields, customFields),
    builtInFields,
    customFields
  };
}

export async function getOfficeContactFieldSchema(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeContactFieldSchema> {
  const [builtInSettings, customDefinitions] = await Promise.all([
    listPersistedBuiltInFieldSettings("contact", input),
    listPersistedCustomFieldDefinitions("contact", { ...input, includeArchived: false })
  ]);

  return buildGenericModuleFieldSchema("contact", builtInSettings, customDefinitions) as OfficeContactFieldSchema;
}

export async function getOfficeOfferFieldSchema(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeOfferFieldSchema> {
  const [builtInSettings, customDefinitions] = await Promise.all([
    listPersistedBuiltInFieldSettings("offer", input),
    listPersistedCustomFieldDefinitions("offer", { ...input, includeArchived: false })
  ]);

  return buildGenericModuleFieldSchema("offer", builtInSettings, customDefinitions) as OfficeOfferFieldSchema;
}

async function getOfficeFieldModuleSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
  module: OfficeFieldModule;
}): Promise<OfficeFieldModuleSettingsSnapshot> {
  const module = normalizeOfficeFieldModule(input.module);
  const catalogEntry = fieldModuleCatalog[module];

  if (module === "transaction") {
    const [schema, requiredContactRoles] = await Promise.all([
      getOfficeTransactionIntakeSchema(input),
      getRequiredContactRoleRows(input)
    ]);

    const hiddenFieldCount =
      schema.builtInFields.filter((entry) => !entry.isVisible).length +
      schema.customFields.filter((entry) => !entry.isVisible).length;

    return {
      module,
      label: catalogEntry.label,
      description: catalogEntry.description,
      summary: {
        fieldCount: schema.summary.builtInFieldCount + schema.summary.customFieldCount,
        customFieldCount: schema.summary.customFieldCount,
        visibleFieldCount: schema.summary.visibleBuiltInFieldCount + schema.summary.visibleCustomFieldCount,
        hiddenFieldCount,
        requiredFieldCount: schema.summary.requiredBuiltInFieldCount + schema.summary.requiredCustomFieldCount
      },
      builtInFields: schema.builtInFields,
      customFields: schema.customFields,
      requiredContactRoles
    };
  }

  const schema = module === "contact" ? await getOfficeContactFieldSchema(input) : await getOfficeOfferFieldSchema(input);
  const hiddenFieldCount =
    schema.builtInFields.filter((entry) => !entry.isVisible).length +
    schema.customFields.filter((entry) => !entry.isVisible).length;

  return {
    module,
    label: catalogEntry.label,
    description: catalogEntry.description,
    summary: {
      fieldCount: schema.summary.builtInFieldCount + schema.summary.customFieldCount,
      customFieldCount: schema.summary.customFieldCount,
      visibleFieldCount: schema.summary.visibleBuiltInFieldCount + schema.summary.visibleCustomFieldCount,
      hiddenFieldCount,
      requiredFieldCount: schema.summary.requiredBuiltInFieldCount + schema.summary.requiredCustomFieldCount
    },
    builtInFields: schema.builtInFields,
    customFields: schema.customFields,
    requiredContactRoles: []
  };
}

export async function getOfficeFieldSettingsSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
  selectedModule?: string;
}): Promise<OfficeFieldSettingsSnapshot> {
  const selectedModule = normalizeOfficeFieldModule(input.selectedModule);
  const [transactionSnapshot, contactSnapshot, offerSnapshot] = await Promise.all([
    getOfficeFieldModuleSnapshot({ ...input, module: "transaction" }),
    getOfficeFieldModuleSnapshot({ ...input, module: "contact" }),
    getOfficeFieldModuleSnapshot({ ...input, module: "offer" })
  ]);

  const snapshotMap: Record<OfficeFieldModule, OfficeFieldModuleSettingsSnapshot> = {
    transaction: transactionSnapshot,
    contact: contactSnapshot,
    offer: offerSnapshot
  };

  return {
    selectedModule,
    modules: [transactionSnapshot, contactSnapshot, offerSnapshot].map((moduleSnapshot) => ({
      module: moduleSnapshot.module,
      label: moduleSnapshot.label,
      description: moduleSnapshot.description,
      fieldCount: moduleSnapshot.summary.fieldCount,
      customFieldCount: moduleSnapshot.summary.customFieldCount,
      hiddenFieldCount: moduleSnapshot.summary.hiddenFieldCount
    })),
    currentModule: snapshotMap[selectedModule]
  };
}

function validateTransactionIntakeSelectValue(
  field: Pick<OfficeFieldBuiltInRecord | OfficeFieldCustomDefinitionRecord, "label" | "options">,
  value: string
) {
  if (!value) {
    return;
  }

  if (!field.options.includes(value)) {
    throw new Error(`${field.label} has an invalid option.`);
  }
}

function parseFieldDateValue(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }

  return date.toISOString().slice(0, 10);
}

function prepareVisibleCustomFieldValues(input: {
  customFields: OfficeFieldCustomDefinitionRecord[];
  payload: Record<string, unknown>;
  existingValues?: Record<string, string>;
}) {
  const additionalFields = { ...(input.existingValues ?? {}) };

  for (const field of input.customFields.filter((entry) => entry.isVisible)) {
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

    additionalFields[field.fieldKey] = field.type === "date" ? parseFieldDateValue(rawValue) : rawValue;
  }

  return additionalFields;
}

export function prepareContactFieldSubmission(input: {
  schema: OfficeContactFieldSchema;
  payload: Record<string, unknown>;
  existingContact?: {
    fullName: string;
    email: string;
    phone: string;
    contactType: string;
    source: string;
    stage: string;
    intent: string;
    budgetMin: string;
    budgetMax: string;
    areas: string[];
    notes: string;
    lastContactAt: string;
    nextFollowUpAt: string;
    additionalFields?: Record<string, string>;
  } | null;
}): PreparedContactFieldSubmission {
  const existingContactValues = input.existingContact
    ? {
        fullName: input.existingContact.fullName,
        email: input.existingContact.email,
        phone: input.existingContact.phone,
        contactType: input.existingContact.contactType,
        source: input.existingContact.source,
        stage: input.existingContact.stage,
        intent: input.existingContact.intent,
        budgetMin: input.existingContact.budgetMin,
        budgetMax: input.existingContact.budgetMax,
        preferredAreas: input.existingContact.areas.join(", "),
        notes: input.existingContact.notes,
        lastContactAt: input.existingContact.lastContactAt,
        nextFollowUpAt: input.existingContact.nextFollowUpAt
      }
    : null;

  const defaults = new Map(
    contactBuiltInFieldCatalog.map((field) => [
      field.inputName,
      existingContactValues
        ? existingContactValues[field.inputName as keyof typeof existingContactValues] ?? ""
        : field.defaultValue ?? ""
    ])
  );

  const values = {
    fullName: defaults.get("fullName") ?? "",
    email: defaults.get("email") ?? "",
    phone: defaults.get("phone") ?? "",
    contactType: defaults.get("contactType") ?? "",
    source: defaults.get("source") ?? "",
    stage: defaults.get("stage") ?? "",
    intent: defaults.get("intent") ?? "",
    budgetMin: defaults.get("budgetMin") ?? "",
    budgetMax: defaults.get("budgetMax") ?? "",
    preferredAreas: defaults.get("preferredAreas") ?? "",
    notes: defaults.get("notes") ?? "",
    lastContactAt: defaults.get("lastContactAt") ?? "",
    nextFollowUpAt: defaults.get("nextFollowUpAt") ?? ""
  };

  for (const field of input.schema.builtInFields.filter((entry) => entry.isVisible)) {
    const rawValue = normalizePayloadString(input.payload[field.inputName]);
    const submittedValue = rawValue || values[field.inputName as keyof typeof values];

    if (field.isRequired && !submittedValue) {
      throw new Error(`${field.label} is required.`);
    }

    values[field.inputName as keyof typeof values] = field.control === "date" ? parseFieldDateValue(rawValue) || submittedValue : rawValue || submittedValue;
  }

  const additionalFields = prepareVisibleCustomFieldValues({
    customFields: input.schema.customFields,
    payload: input.payload,
    existingValues: input.existingContact?.additionalFields
  });

  return {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    contactType: values.contactType,
    source: values.source,
    stage: values.stage,
    intent: values.intent,
    budgetMin: values.budgetMin,
    budgetMax: values.budgetMax,
    preferredAreas: values.preferredAreas,
    notes: values.notes,
    lastContactAt: values.lastContactAt,
    nextFollowUpAt: values.nextFollowUpAt,
    additionalFields
  };
}

export function prepareOfferFieldSubmission(input: {
  schema: OfficeOfferFieldSchema;
  payload: Record<string, unknown>;
  existingOffer?: {
    title: string;
    offeringPartyName: string;
    buyerName: string;
    price: string;
    earnestMoneyAmount: string;
    financingType: string;
    closingDateOffered: string;
    expirationAt: string;
    notes: string;
    additionalFields?: Record<string, string>;
  } | null;
}): PreparedOfferFieldSubmission {
  const existingOfferValues = input.existingOffer
    ? {
        title: input.existingOffer.title,
        offeringPartyName: input.existingOffer.offeringPartyName,
        buyerName: input.existingOffer.buyerName,
        price: input.existingOffer.price,
        earnestMoneyAmount: input.existingOffer.earnestMoneyAmount,
        financingType: input.existingOffer.financingType,
        closingDateOffered: input.existingOffer.closingDateOffered,
        expirationAt: input.existingOffer.expirationAt,
        notes: input.existingOffer.notes
      }
    : null;

  const defaults = new Map(
    offerBuiltInFieldCatalog.map((field) => [
      field.inputName,
      existingOfferValues
        ? existingOfferValues[field.inputName as keyof typeof existingOfferValues] ?? ""
        : field.defaultValue ?? ""
    ])
  );

  const values = {
    title: defaults.get("title") ?? "",
    offeringPartyName: defaults.get("offeringPartyName") ?? "",
    buyerName: defaults.get("buyerName") ?? "",
    price: defaults.get("price") ?? "",
    earnestMoneyAmount: defaults.get("earnestMoneyAmount") ?? "",
    financingType: defaults.get("financingType") ?? "",
    closingDateOffered: defaults.get("closingDateOffered") ?? "",
    expirationAt: defaults.get("expirationAt") ?? "",
    notes: defaults.get("notes") ?? ""
  };

  for (const field of input.schema.builtInFields.filter((entry) => entry.isVisible)) {
    const rawValue = normalizePayloadString(input.payload[field.inputName]);
    const submittedValue = rawValue || values[field.inputName as keyof typeof values];

    if (field.isRequired && !submittedValue) {
      throw new Error(`${field.label} is required.`);
    }

    values[field.inputName as keyof typeof values] = field.control === "date" ? parseFieldDateValue(rawValue) || submittedValue : rawValue || submittedValue;
  }

  const additionalFields = prepareVisibleCustomFieldValues({
    customFields: input.schema.customFields,
    payload: input.payload,
    existingValues: input.existingOffer?.additionalFields
  });

  return {
    title: values.title,
    offeringPartyName: values.offeringPartyName,
    buyerName: values.buyerName,
    price: values.price,
    earnestMoneyAmount: values.earnestMoneyAmount,
    financingType: values.financingType,
    closingDateOffered: values.closingDateOffered,
    expirationAt: values.expirationAt,
    notes: values.notes,
    additionalFields
  };
}

function getModuleFieldSettingsContextHref() {
  return "/office/settings/fields";
}

async function findPersistedBuiltInFieldSettingsTx(
  tx: Prisma.TransactionClient,
  module: OfficeFieldModule,
  input: { organizationId: string; officeId?: string | null }
): Promise<PersistedFieldSetting[]> {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);

  switch (module) {
    case "contact":
      return tx.contactFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
    case "offer":
      return tx.offerFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
    case "transaction":
    default:
      return tx.transactionFieldSetting.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId
        }
      });
  }
}

async function findPersistedCustomFieldDefinitionsTx(
  tx: Prisma.TransactionClient,
  module: OfficeFieldModule,
  input: { organizationId: string; officeId?: string | null; includeArchived?: boolean }
): Promise<PersistedCustomFieldDefinition[]> {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);

  switch (module) {
    case "contact":
      return tx.contactCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        }
      });
    case "offer":
      return tx.offerCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        }
      });
    case "transaction":
    default:
      return tx.transactionCustomFieldDefinition.findMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          ...(input.includeArchived ? {} : { isArchived: false })
        }
      });
  }
}

async function upsertBuiltInFieldSettingTx(
  tx: Prisma.TransactionClient,
  module: OfficeFieldModule,
  input: {
    organizationId: string;
    officeId?: string | null;
    fieldKey: string;
    isRequired: boolean;
    isVisible: boolean;
    sortOrder: number;
    options?: Array<{ value: string; label: string }>;
  }
) {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);
  const builtInFieldKey = normalizeBuiltInFieldKey(module, input.fieldKey);

  switch (module) {
    case "contact": {
      const existing = await tx.contactFieldSetting.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey
        }
      });

      if (existing) {
        return tx.contactFieldSetting.update({
          where: { id: existing.id },
          data: {
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            sortOrder: input.sortOrder,
            options: Prisma.JsonNull
          }
        });
      }

      return tx.contactFieldSetting.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          sortOrder: input.sortOrder,
          options: Prisma.JsonNull
        }
      });
    }
    case "offer": {
      const existing = await tx.offerFieldSetting.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey
        }
      });

      if (existing) {
        return tx.offerFieldSetting.update({
          where: { id: existing.id },
          data: {
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            sortOrder: input.sortOrder,
            options: Prisma.JsonNull
          }
        });
      }

      return tx.offerFieldSetting.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          sortOrder: input.sortOrder,
          options: Prisma.JsonNull
        }
      });
    }
    case "transaction":
    default: {
      const existing = await tx.transactionFieldSetting.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey as TransactionFieldKey
        }
      });

      if (existing) {
        return tx.transactionFieldSetting.update({
          where: { id: existing.id },
          data: {
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            sortOrder: input.sortOrder,
            options: input.options ?? Prisma.JsonNull
          }
        });
      }

      return tx.transactionFieldSetting.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: builtInFieldKey as TransactionFieldKey,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          sortOrder: input.sortOrder,
          options: input.options ?? Prisma.JsonNull
        }
      });
    }
  }
}

async function upsertCustomFieldDefinitionTx(
  tx: Prisma.TransactionClient,
  module: OfficeFieldModule,
  input: {
    organizationId: string;
    officeId?: string | null;
    fieldKey: string;
    label: string;
    type: TransactionCustomFieldType;
    isRequired: boolean;
    isVisible: boolean;
    isDeletionLocked: boolean;
    sortOrder: number;
    options: string[];
    isArchived?: boolean;
  }
) {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);
  const fieldKey = normalizeTransactionCustomFieldKey(input.fieldKey);

  switch (module) {
    case "contact": {
      const existing = await tx.contactCustomFieldDefinition.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey
        }
      });

      if (existing) {
        return tx.contactCustomFieldDefinition.update({
          where: { id: existing.id },
          data: {
            label: input.label,
            type: input.type,
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            isDeletionLocked: input.isDeletionLocked,
            sortOrder: input.sortOrder,
            isArchived: Boolean(input.isArchived),
            options: input.options
          }
        });
      }

      return tx.contactCustomFieldDefinition.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey,
          label: input.label,
          type: input.type,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          isDeletionLocked: input.isDeletionLocked,
          sortOrder: input.sortOrder,
          isArchived: Boolean(input.isArchived),
          options: input.options
        }
      });
    }
    case "offer": {
      const existing = await tx.offerCustomFieldDefinition.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey
        }
      });

      if (existing) {
        return tx.offerCustomFieldDefinition.update({
          where: { id: existing.id },
          data: {
            label: input.label,
            type: input.type,
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            isDeletionLocked: input.isDeletionLocked,
            sortOrder: input.sortOrder,
            isArchived: Boolean(input.isArchived),
            options: input.options
          }
        });
      }

      return tx.offerCustomFieldDefinition.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey,
          label: input.label,
          type: input.type,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          isDeletionLocked: input.isDeletionLocked,
          sortOrder: input.sortOrder,
          isArchived: Boolean(input.isArchived),
          options: input.options
        }
      });
    }
    case "transaction":
    default: {
      const existing = await tx.transactionCustomFieldDefinition.findFirst({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey
        }
      });

      if (existing) {
        return tx.transactionCustomFieldDefinition.update({
          where: { id: existing.id },
          data: {
            label: input.label,
            type: input.type,
            isRequired: input.isRequired,
            isVisible: input.isVisible,
            isDeletionLocked: input.isDeletionLocked,
            sortOrder: input.sortOrder,
            isArchived: Boolean(input.isArchived),
            options: input.options
          }
        });
      }

      return tx.transactionCustomFieldDefinition.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey,
          label: input.label,
          type: input.type,
          isRequired: input.isRequired,
          isVisible: input.isVisible,
          isDeletionLocked: input.isDeletionLocked,
          sortOrder: input.sortOrder,
          isArchived: Boolean(input.isArchived),
          options: input.options
        }
      });
    }
  }
}

async function updateCustomFieldArchiveStateTx(
  tx: Prisma.TransactionClient,
  module: OfficeFieldModule,
  input: {
    organizationId: string;
    officeId?: string | null;
    fieldKey: string;
    isArchived: boolean;
    isVisible?: boolean;
  }
) {
  const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);

  switch (module) {
    case "contact":
      return tx.contactCustomFieldDefinition.updateMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: input.fieldKey
        },
        data: {
          isArchived: input.isArchived,
          ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {})
        }
      });
    case "offer":
      return tx.offerCustomFieldDefinition.updateMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: input.fieldKey
        },
        data: {
          isArchived: input.isArchived,
          ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {})
        }
      });
    case "transaction":
    default:
      return tx.transactionCustomFieldDefinition.updateMany({
        where: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
          fieldKey: input.fieldKey
        },
        data: {
          isArchived: input.isArchived,
          ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {})
        }
      });
  }
}

async function hasSavedCustomFieldValues(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    module: OfficeFieldModule;
    fieldKey: string;
  }
) {
  const scopedOfficeId = resolveFieldSettingsOfficeId(input.module, input.officeId);

  if (input.module === "contact") {
    const rows = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Client"
      WHERE "organizationId" = ${input.organizationId}
      AND "additionalFields" ? ${input.fieldKey}
    `);

    return Number(rows[0]?.count ?? 0) > 0;
  }

  if (input.module === "offer") {
    const officeFilter = scopedOfficeId
      ? Prisma.sql`AND "officeId" = ${scopedOfficeId}`
      : Prisma.sql`AND "officeId" IS NULL`;
    const rows = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Offer"
      WHERE "organizationId" = ${input.organizationId}
      ${officeFilter}
      AND "additionalFields" ? ${input.fieldKey}
    `);

    return Number(rows[0]?.count ?? 0) > 0;
  }

  const officeFilter = scopedOfficeId
    ? Prisma.sql`AND "officeId" = ${scopedOfficeId}`
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

function buildFieldChangeLabel(label: string, suffix: string) {
  return `${label} ${suffix}`;
}

async function saveRequiredContactRolesTx(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    actorMembershipId: string;
    contactRoleSettings: Array<{ role: string; isRequired: boolean }>;
  }
) {
  const scopedOfficeId = resolveFieldSettingsOfficeId("transaction", input.officeId);
  const existingRoleSettings = await tx.requiredContactRoleSetting.findMany({
    where: {
      organizationId: input.organizationId,
      officeId: scopedOfficeId
    }
  });
  const roleChanges: ActivityLogChange[] = [];

  for (const entry of input.contactRoleSettings) {
    const role = entry.role as TransactionContactRole;
    const existing = existingRoleSettings.find((setting) => setting.role === role) ?? null;
    const previousValue = existing?.isRequired ? "Required" : "Optional";
    const nextValue = entry.isRequired ? "Required" : "Optional";

    if (existing) {
      await tx.requiredContactRoleSetting.update({
        where: { id: existing.id },
        data: { isRequired: entry.isRequired }
      });
    } else {
      await tx.requiredContactRoleSetting.create({
        data: {
          organizationId: input.organizationId,
          officeId: scopedOfficeId,
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

  if (roleChanges.length) {
    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "required_contact_role_setting",
      entityId: `required-roles:${scopedOfficeId ?? "organization"}`,
      action: activityLogActions.settingsRequiredContactRolesChanged,
      payload: {
        objectLabel: "Required contact roles",
        contextHref: getModuleFieldSettingsContextHref(),
        details: roleChanges.map((change) => `${change.label}: ${change.nextValue}`),
        changes: roleChanges
      }
    });
  }
}

function ensureVisibleSelectHasEnabledOption(
  module: OfficeFieldModule,
  fieldKey: string,
  isVisible: boolean,
  normalizedSelectOptions: Array<{ value: string; label: string }>
) {
  if (module !== "transaction" || !isVisible) {
    return;
  }

  const catalogEntry = getBuiltInCatalogEntry(module, fieldKey);

  if (catalogEntry?.control === "select" && normalizedSelectOptions.length === 0) {
    throw new Error(`${catalogEntry.label} must keep at least one enabled option while the field is visible.`);
  }
}

export async function saveOfficeFieldSettings(input: SaveOfficeFieldSettingsInput) {
  const module = normalizeOfficeFieldModule(input.module);

  return prisma.$transaction(async (tx) => {
    if (module === "transaction" && input.contactRoleSettings?.length) {
      await saveRequiredContactRolesTx(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        actorMembershipId: input.actorMembershipId,
        contactRoleSettings: input.contactRoleSettings
      });
    }

    const existingBuiltInSettings = await findPersistedBuiltInFieldSettingsTx(tx, module, input);
    const existingCustomFieldDefinitions = await findPersistedCustomFieldDefinitionsTx(tx, module, {
      ...input,
      includeArchived: true
    });
    const fieldChanges: ActivityLogChange[] = [];

    for (const [index, entry] of input.builtInFieldSettings.entries()) {
      const fieldKey = normalizeBuiltInFieldKey(module, entry.fieldKey);
      const catalogEntry = getBuiltInCatalogEntry(module, fieldKey);
      const existing = existingBuiltInSettings.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const previousRequired = existing?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? true;
      const previousSortOrder = existing?.sortOrder ?? catalogEntry?.sortOrder ?? index;
      const previousSelectOptions =
        module === "transaction" && catalogEntry?.control === "select"
          ? readTransactionBuiltInSelectOptions(fieldKey as TransactionFieldKey, existing?.options)
          : [];
      const normalizedSelectOptions =
        module === "transaction" && catalogEntry?.control === "select"
          ? normalizeTransactionBuiltInSelectOptions(fieldKey as TransactionFieldKey, entry.selectOptions, previousSelectOptions)
          : [];

      ensureVisibleSelectHasEnabledOption(module, fieldKey, entry.isVisible, normalizedSelectOptions);

      await upsertBuiltInFieldSettingTx(tx, module, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey,
        isRequired: entry.isRequired,
        isVisible: entry.isVisible,
        sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
        options: module === "transaction" && catalogEntry?.control === "select" ? normalizedSelectOptions : undefined
      });

      const fieldLabel = catalogEntry?.label ?? fieldKey;
      const requiredChange = buildChange(buildFieldChangeLabel(fieldLabel, "required"), previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No");
      const visibilityChange = buildChange(buildFieldChangeLabel(fieldLabel, "visible"), previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No");
      const sortOrderChange = buildChange(buildFieldChangeLabel(fieldLabel, "order"), String(previousSortOrder), String(typeof entry.sortOrder === "number" ? entry.sortOrder : index));
      const optionsChange =
        module === "transaction" && catalogEntry?.control === "select"
          ? buildChange(
              buildFieldChangeLabel(fieldLabel, "options"),
              formatTransactionBuiltInSelectOptions(previousSelectOptions.filter((option) => option.isEnabled).map((option) => ({ value: option.value, label: option.label }))),
              formatTransactionBuiltInSelectOptions(normalizedSelectOptions)
            )
          : null;

      for (const change of [requiredChange, visibilityChange, sortOrderChange, optionsChange]) {
        if (change) {
          fieldChanges.push(change);
        }
      }
    }

    for (const entry of input.customFieldDefinitions ?? []) {
      const fieldKey = normalizeTransactionCustomFieldKey(entry.fieldKey);
      const existing = existingCustomFieldDefinitions.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const defaultEntry = getDefaultCustomCatalog(module).find((setting) => setting.fieldKey === fieldKey) ?? null;
      const defaultDeletionLock = isDefaultCustomFieldDeletionLocked(defaultEntry);
      const label = parseOptionalText(entry.label) ?? existing?.label ?? defaultEntry?.label ?? fieldKey;
      const type = normalizeTransactionCustomFieldType(entry.type ?? existing?.type ?? defaultEntry?.type ?? "text");
      const options = normalizeTransactionCustomFieldOptions(type, entry.options ?? (existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options));
      const sortOrder = typeof entry.sortOrder === "number" ? entry.sortOrder : existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;
      const previousLabel = existing?.label ?? defaultEntry?.label ?? fieldKey;
      const previousType = existing?.type ?? defaultEntry?.type ?? "text";
      const previousRequired = existing?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? true;
      const previousDeletionLock = defaultDeletionLock || Boolean(existing?.isDeletionLocked);
      const previousSortOrder = existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;
      const previousOptions = existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [];
      const nextDeletionLock =
        defaultDeletionLock ||
        (typeof entry.isDeletionLocked === "boolean"
          ? entry.isDeletionLocked
          : Boolean(existing?.isDeletionLocked));

      await upsertCustomFieldDefinitionTx(tx, module, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey,
        label,
        type,
        isRequired: entry.isRequired,
        isVisible: entry.isVisible,
        isDeletionLocked: nextDeletionLock,
        sortOrder,
        options,
        isArchived: false
      });

      for (const change of [
        buildChange(`${fieldKey} label`, previousLabel, label),
        buildChange(`${label} type`, previousType, type),
        buildChange(buildFieldChangeLabel(label, "required"), previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No"),
        buildChange(buildFieldChangeLabel(label, "visible"), previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No"),
        buildChange(buildFieldChangeLabel(label, "delete lock"), previousDeletionLock ? "Yes" : "No", nextDeletionLock ? "Yes" : "No"),
        buildChange(buildFieldChangeLabel(label, "order"), String(previousSortOrder), String(sortOrder)),
        buildChange(buildFieldChangeLabel(label, "options"), previousOptions.join(", ") || "—", options.join(", ") || "—")
      ]) {
        if (change) {
          fieldChanges.push(change);
        }
      }
    }

    if (fieldChanges.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "transaction_field_setting",
        entityId: `${module}-fields:${resolveFieldSettingsOfficeId(module, input.officeId) ?? "organization"}`,
        action: getFieldSettingsAction(module),
        payload: {
          objectLabel: getFieldSettingsObjectLabel(module),
          contextHref: getModuleFieldSettingsContextHref(),
          details: fieldChanges.map((change) => `${change.label}: ${change.nextValue}`),
          changes: fieldChanges
        }
      });
    }

    return getOfficeFieldModuleSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId,
      module
    });
  });
}

export async function createOfficeCustomFieldDefinition(input: CreateOfficeCustomFieldDefinitionInput) {
  const module = normalizeOfficeFieldModule(input.module);

  return prisma.$transaction(async (tx) => {
    const existingDefinitions = await findPersistedCustomFieldDefinitionsTx(tx, module, {
      ...input,
      includeArchived: true
    });
    const existingFieldKeys = new Set(
      getDefaultCustomCatalog(module).map((entry) => entry.fieldKey).concat(existingDefinitions.map((entry) => entry.fieldKey))
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

    const currentSnapshot = await getOfficeFieldModuleSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId,
      module
    });
    const sortOrder = Math.max(-1, ...currentSnapshot.builtInFields.map((entry) => entry.sortOrder), ...currentSnapshot.customFields.map((entry) => entry.sortOrder)) + 1;
    const isDeletionLocked = Boolean(input.isDeletionLocked);

    await upsertCustomFieldDefinitionTx(tx, module, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      fieldKey,
      label,
      type,
      isRequired: Boolean(input.isRequired),
      isVisible: typeof input.isVisible === "boolean" ? input.isVisible : true,
      isDeletionLocked,
      sortOrder,
      options,
      isArchived: false
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `${module}-custom-field:${fieldKey}`,
      action: getFieldSettingsAction(module),
      payload: {
        objectLabel: getFieldSettingsObjectLabel(module),
        contextHref: getModuleFieldSettingsContextHref(),
        details: [`Created custom field: ${label}`],
        changes: [
          { label: `${label} type`, previousValue: "—", nextValue: type },
          { label: `${label} required`, previousValue: "No", nextValue: input.isRequired ? "Yes" : "No" },
          { label: `${label} visible`, previousValue: "No", nextValue: typeof input.isVisible === "boolean" ? (input.isVisible ? "Yes" : "No") : "Yes" },
          { label: `${label} delete lock`, previousValue: "No", nextValue: isDeletionLocked ? "Yes" : "No" }
        ]
      }
    });

    return getOfficeFieldModuleSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId,
      module
    });
  });
}

export async function updateOfficeCustomFieldDefinition(input: UpdateOfficeCustomFieldDefinitionInput) {
  const module = normalizeOfficeFieldModule(input.module);

  return prisma.$transaction(async (tx) => {
    const scopedOfficeId = resolveFieldSettingsOfficeId(module, input.officeId);
    const existingDefinitions = await findPersistedCustomFieldDefinitionsTx(tx, module, {
      ...input,
      includeArchived: true
    });
    const existing = existingDefinitions.find((entry) => entry.fieldKey === input.fieldKey) ?? null;
    const defaultEntry = getDefaultCustomCatalog(module).find((entry) => entry.fieldKey === input.fieldKey) ?? null;

    if (!existing && !defaultEntry) {
      throw new Error("Custom field was not found.");
    }

    const nextLabel = parseOptionalText(input.label) ?? existing?.label ?? defaultEntry?.label ?? input.fieldKey;
    const nextType = normalizeTransactionCustomFieldType(input.type ?? existing?.type ?? defaultEntry?.type ?? "text");
    const previousType = existing?.type ?? defaultEntry?.type ?? "text";

    if (nextType !== previousType) {
      const hasStoredValues = await hasSavedCustomFieldValues(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        module,
        fieldKey: input.fieldKey
      });

      if (hasStoredValues) {
        throw new Error("Field type cannot change after records have stored values.");
      }
    }

    const nextOptions = normalizeTransactionCustomFieldOptions(
      nextType,
      input.options ?? (existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options)
    );
    const defaultDeletionLock = isDefaultCustomFieldDeletionLocked(defaultEntry);
    const nextRequired = typeof input.isRequired === "boolean" ? input.isRequired : existing?.isRequired ?? false;
    const nextVisible = typeof input.isVisible === "boolean" ? input.isVisible : existing?.isVisible ?? true;
    const nextDeletionLock =
      defaultDeletionLock ||
      (typeof input.isDeletionLocked === "boolean"
        ? input.isDeletionLocked
        : Boolean(existing?.isDeletionLocked));
    const nextSortOrder = typeof input.sortOrder === "number" ? input.sortOrder : existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;

    await upsertCustomFieldDefinitionTx(tx, module, {
      organizationId: input.organizationId,
      officeId: scopedOfficeId,
      fieldKey: input.fieldKey,
      label: nextLabel,
      type: nextType,
      isRequired: nextRequired,
      isVisible: nextVisible,
      isDeletionLocked: nextDeletionLock,
      sortOrder: nextSortOrder,
      options: nextOptions,
      isArchived: false
    });

    const previousLabel = existing?.label ?? defaultEntry?.label ?? input.fieldKey;
    const previousOptions = existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [];
    const previousDeletionLock = defaultDeletionLock || Boolean(existing?.isDeletionLocked);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `${module}-custom-field:${input.fieldKey}`,
      action: getFieldSettingsAction(module),
      payload: {
        objectLabel: getFieldSettingsObjectLabel(module),
        contextHref: getModuleFieldSettingsContextHref(),
        details: [`Updated custom field: ${nextLabel}`],
        changes: [
          buildChange(`${input.fieldKey} label`, previousLabel, nextLabel),
          buildChange(`${nextLabel} type`, previousType, nextType),
          buildChange(buildFieldChangeLabel(nextLabel, "required"), (existing?.isRequired ?? false) ? "Yes" : "No", nextRequired ? "Yes" : "No"),
          buildChange(buildFieldChangeLabel(nextLabel, "visible"), (existing?.isVisible ?? true) ? "Yes" : "No", nextVisible ? "Yes" : "No"),
          buildChange(buildFieldChangeLabel(nextLabel, "delete lock"), previousDeletionLock ? "Yes" : "No", nextDeletionLock ? "Yes" : "No"),
          buildChange(buildFieldChangeLabel(nextLabel, "order"), String(existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0), String(nextSortOrder)),
          buildChange(buildFieldChangeLabel(nextLabel, "options"), previousOptions.join(", ") || "—", nextOptions.join(", ") || "—")
        ].filter(Boolean) as ActivityLogChange[]
      }
    });

    return getOfficeFieldModuleSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId,
      module
    });
  });
}

export async function deleteOfficeCustomFieldDefinition(input: DeleteOfficeCustomFieldDefinitionInput) {
  const module = normalizeOfficeFieldModule(input.module);

  return prisma.$transaction(async (tx) => {
    const existingDefinitions = await findPersistedCustomFieldDefinitionsTx(tx, module, {
      ...input,
      includeArchived: true
    });
    const existing = existingDefinitions.find((entry) => entry.fieldKey === input.fieldKey) ?? null;
    const defaultEntry = getDefaultCustomCatalog(module).find((entry) => entry.fieldKey === input.fieldKey) ?? null;

    if (!existing && !defaultEntry) {
      throw new Error("Custom field was not found.");
    }

    const label = existing?.label ?? defaultEntry?.label ?? input.fieldKey;
    const type = existing?.type ?? defaultEntry?.type ?? "text";
    const isDeletionLocked =
      isDefaultCustomFieldDeletionLocked(defaultEntry) || Boolean(existing?.isDeletionLocked);
    const sortOrder = existing?.sortOrder ?? defaultEntry?.sortOrder ?? 0;
    const options = existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [];

    if (isDeletionLocked) {
      throw new Error("This field is protected from deletion.");
    }

    const hasStoredValues = await hasSavedCustomFieldValues(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      module,
      fieldKey: input.fieldKey
    });

    if (hasStoredValues) {
      throw new Error("This field already has saved values. Hide it instead of deleting it.");
    }

    if (existing) {
      await updateCustomFieldArchiveStateTx(tx, module, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey: input.fieldKey,
        isArchived: true,
        isVisible: false
      });
    } else if (defaultEntry) {
      await upsertCustomFieldDefinitionTx(tx, module, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey: input.fieldKey,
        label,
        type: defaultEntry.type,
        isRequired: false,
        isVisible: false,
        isDeletionLocked,
        sortOrder,
        options: defaultEntry.options,
        isArchived: true
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `${module}-custom-field:${input.fieldKey}`,
      action: getFieldSettingsAction(module),
      payload: {
        objectLabel: getFieldSettingsObjectLabel(module),
        contextHref: getModuleFieldSettingsContextHref(),
        details: [`Deleted custom field: ${label}`],
        changes: [
          buildChange(buildFieldChangeLabel(label, "visible"), "Yes", "No"),
          buildChange(buildFieldChangeLabel(label, "archived"), "No", "Yes")
        ].filter(Boolean) as ActivityLogChange[]
      }
    });

    return {
      outcome: "deleted" as const,
      snapshot: await getOfficeFieldModuleSnapshot({
        organizationId: input.organizationId,
        officeId: input.officeId,
        module
      })
    };
  });
}

export async function reorderOfficeFields(input: ReorderOfficeFieldsInput) {
  const module = normalizeOfficeFieldModule(input.module);

  return prisma.$transaction(async (tx) => {
    const existingBuiltIns = await findPersistedBuiltInFieldSettingsTx(tx, module, input);
    const existingCustoms = await findPersistedCustomFieldDefinitionsTx(tx, module, {
      ...input,
      includeArchived: true
    });

    for (const [index, item] of input.fieldOrder.entries()) {
      if (item.kind === "builtIn") {
        const existing = existingBuiltIns.find((entry) => entry.fieldKey === item.fieldKey) ?? null;
        const catalogEntry = getBuiltInCatalogEntry(module, item.fieldKey);

        if (!catalogEntry) {
          continue;
        }

        const previousSelectOptions =
          module === "transaction" && catalogEntry.control === "select"
            ? readTransactionBuiltInSelectOptions(item.fieldKey as TransactionFieldKey, existing?.options)
            : [];

        await upsertBuiltInFieldSettingTx(tx, module, {
          organizationId: input.organizationId,
          officeId: input.officeId,
          fieldKey: item.fieldKey,
          isRequired: existing?.isRequired ?? false,
          isVisible: existing?.isVisible ?? true,
          sortOrder: index,
          options:
            module === "transaction" && catalogEntry.control === "select"
              ? normalizeTransactionBuiltInSelectOptions(item.fieldKey as TransactionFieldKey, undefined, previousSelectOptions)
              : undefined
        });

        continue;
      }

      const existing = existingCustoms.find((entry) => entry.fieldKey === item.fieldKey) ?? null;
      const defaultEntry = getDefaultCustomCatalog(module).find((entry) => entry.fieldKey === item.fieldKey) ?? null;
      const isDeletionLocked =
        isDefaultCustomFieldDeletionLocked(defaultEntry) || Boolean(existing?.isDeletionLocked);

      if (!existing && !defaultEntry) {
        continue;
      }

      await upsertCustomFieldDefinitionTx(tx, module, {
        organizationId: input.organizationId,
        officeId: input.officeId,
        fieldKey: item.fieldKey,
        label: existing?.label ?? defaultEntry?.label ?? item.fieldKey,
        type: (existing?.type ?? defaultEntry?.type ?? "text") as TransactionCustomFieldType,
        isRequired: existing?.isRequired ?? false,
        isVisible: existing?.isVisible ?? true,
        isDeletionLocked,
        sortOrder: index,
        options: existing ? readTransactionCustomFieldOptions(existing.options) : defaultEntry?.options ?? [],
        isArchived: false
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_field_setting",
      entityId: `${module}-fields:${resolveFieldSettingsOfficeId(module, input.officeId) ?? "organization"}`,
      action: getFieldSettingsAction(module),
      payload: {
        objectLabel: getFieldSettingsObjectLabel(module),
        contextHref: getModuleFieldSettingsContextHref(),
        details: ["Updated field order"],
        changes: []
      }
    });

    return getOfficeFieldModuleSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId,
      module
    });
  });
}

export async function createOfficeTransactionCustomFieldDefinition(input: CreateOfficeTransactionCustomFieldDefinitionInput) {
  return createOfficeCustomFieldDefinition({
    ...input,
    module: "transaction"
  });
}

export async function updateOfficeTransactionCustomFieldDefinition(input: UpdateOfficeTransactionCustomFieldDefinitionInput) {
  return updateOfficeCustomFieldDefinition({
    ...input,
    module: "transaction"
  });
}
