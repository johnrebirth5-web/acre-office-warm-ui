import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import {
  membershipHasAccessToOffice,
  normalizeSelectedOfficeIds,
  resolveMembershipOfficeAssignment,
} from "./membership-office-access";
import { getMembershipEffectivePermissionKeys } from "./permissions";
import type { CreateTransactionInput } from "./transactions";
import { ensureBootstrapAdminAccount } from "./auth";

type AuditLogWriter = Prisma.TransactionClient | PrismaClient;

const PASSWORD_HASH_ROUNDS = 12;
const implicitAllOfficeRoles = new Set<UserRole>([
  "owner",
  "office_admin",
  "office_manager",
]);
const importEligibleRoleCatalog: UserRole[] = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_user",
  "office_manager",
] as const;
const legacyTransactionTypeLabelMap = new Map<string, string>([
  ["sales", "Sales"],
  ["sales listing", "Sales (listing)"],
  ["rental leasing", "Rental/Leasing"],
  ["rent lease", "Rental/Leasing"],
  ["rental listing", "Rental (listing)"],
  ["commercial sale", "Commercial Sales"],
  ["commercial sales", "Commercial Sales"],
  ["commercial lease", "Commercial Lease"],
  ["other", "Other"],
]);
const legacyRepresentingValues = new Set([
  "buyer",
  "seller",
  "both",
  "tenant",
  "landlord",
]);
const constrainedCustomFieldOptions = {
  commissionType: new Set(["Gross", "Net", "Custom"]),
  currencyType: new Set(["USD"]),
  outsideReferral: new Set(["Yes", "No"]),
  uploadInvoiceToVendorCafe: new Set(["Yes", "No"]),
  commissionReceivedStatus: new Set(["Yes", "No", "Partial"]),
} as const;

type OfficeScopeRecord = {
  id: string;
  name: string;
  slug: string;
  market: string;
  isPrimary: boolean;
};

type LegacyImportIssueCode =
  | "single_token_name"
  | "unsupported_role"
  | "unsupported_status"
  | "unsupported_type"
  | "unsupported_representing"
  | "non_usd_currency"
  | "missing_address_parts";

export type LegacyImportIssue = {
  code: LegacyImportIssueCode;
  message: string;
};

export type SplitImportedFullNameResult = {
  firstName: string;
  lastName: string;
  warnings: LegacyImportIssue[];
};

export type LegacyUserImportRole = "agent" | "team_lead";

export type UpsertImportedActiveUserInput = {
  organizationId: string;
  actorMembershipId: string;
  viewerOfficeId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  defaultOfficeId: string;
  accessibleOfficeIds?: string[];
  title?: string | null;
  initialPassword: string;
};

export type UpsertImportedActiveUserResult = {
  membershipId: string;
  userId: string;
  createdUser: boolean;
  createdMembership: boolean;
  createdCredential: boolean;
};

export type ResetOrganizationBusinessDataInput = {
  organizationId: string;
  preserveMembershipIds?: string[];
  preserveUserIds?: string[];
};

export type ResetOrganizationBusinessDataPreview = {
  preservedMembershipIds: string[];
  preservedUserIds: string[];
  counts: Record<string, number>;
};

export type ResetOrganizationBusinessDataResult =
  ResetOrganizationBusinessDataPreview;

export type LegacyTransactionContactMatchInput = {
  clientEmail: string;
  clientName: string;
  buyerTenant: string;
  preferredCreateName: string;
};

export type LegacyNormalizedTransactionRow = {
  sourceRowId: string;
  shouldImport: boolean;
  skipReason: string | null;
  rawStatus: string;
  createInput: Omit<
    CreateTransactionInput,
    "organizationId" | "officeId" | "ownerMembershipId" | "actorMembershipId"
  >;
  ownerCandidateNames: string[];
  contactMatchInput: LegacyTransactionContactMatchInput;
  additionalFields: Record<string, string>;
  warnings: LegacyImportIssue[];
};

function isPrivilegedBackOfficeRole(role: UserRole) {
  return role === "owner" || role === "office_admin";
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRequiredText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

async function hashImportedPassword(password: string) {
  const { hash } = await import("bcryptjs");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return hash(password, PASSWORD_HASH_ROUNDS);
}

function buildRoleDetail(role: UserRole) {
  switch (role) {
    case "owner":
      return "Role: Owner";
    case "office_admin":
      return "Role: Office Admin";
    case "accountant":
      return "Role: Accountant";
    case "human_resources":
      return "Role: Human Resources";
    case "team_lead":
      return "Role: Team Lead";
    case "agent":
      return "Role: Agent";
    case "office_manager":
      return "Role: Office Manager";
    case "office_user":
      return "Role: Office User";
    default:
      return `Role: ${role}`;
  }
}

function toNormalizedAsciiTokens(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function readTrimmedCell(record: Record<string, string>, key: string) {
  return (record[key] ?? "").trim();
}

function pickFirstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";

    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function normalizeLegacyTypeLookup(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[()]/g, " ")
    .replace(/[\/]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseLegacyAddress(fullAddress: string) {
  const trimmed = fullAddress.trim();

  if (!trimmed) {
    return {
      address: "",
      city: "",
      state: "",
      zipCode: "",
    };
  }

  const parts = trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);

  if (parts.length >= 3) {
    const stateZip = parts.at(-1) ?? "";
    const match = stateZip.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);

    if (match) {
      return {
        address: parts.slice(0, -2).join(", ").trim(),
        city: (parts.at(-2) ?? "").trim(),
        state: match[1]?.toUpperCase() ?? "",
        zipCode: match[2] ?? "",
      };
    }
  }

  return {
    address: trimmed,
    city: "",
    state: "",
    zipCode: "",
  };
}

function pushAdditionalField(
  additionalFields: Record<string, string>,
  key: string,
  value: string | undefined,
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return;
  }

  additionalFields[key] = trimmed;
}

function buildTransactionSourceRowId(record: Record<string, string>) {
  return pickFirstNonEmpty(
    readTrimmedCell(record, "custom_id"),
    readTrimmedCell(record, "id"),
    readTrimmedCell(record, "transaction_name"),
  );
}

function buildLegacyTransactionAdditionalFields(record: Record<string, string>) {
  const additionalFields: Record<string, string> = {};
  const rawCommissionType = readTrimmedCell(record, "Commission Type");
  const rawCurrencyType = readTrimmedCell(record, "Currency Type");
  const outsideReferral = readTrimmedCell(record, "Outside Referral");
  const uploadInvoiceToVendorCafe = readTrimmedCell(record, "Upload Invoice to VendorCafe");
  const commissionReceivedStatus = readTrimmedCell(record, "Status of Commission Received(For Admin)");

  pushAdditionalField(additionalFields, "invoiceNumber", readTrimmedCell(record, "Invoice Number"));
  pushAdditionalField(additionalFields, "buyerTenant", readTrimmedCell(record, "Buyer/Tenant"));
  pushAdditionalField(additionalFields, "buildingName", readTrimmedCell(record, "Building Name"));
  pushAdditionalField(
    additionalFields,
    "unitNumber",
    readTrimmedCell(record, 'Unit # (If it\'s a house, fill out "house")'),
  );
  pushAdditionalField(additionalFields, "layout", readTrimmedCell(record, "Layout"));
  pushAdditionalField(additionalFields, "licensedAgentName", readTrimmedCell(record, "Licensed Agent Name"));
  pushAdditionalField(additionalFields, "clientEmail", readTrimmedCell(record, "Client's Email"));
  pushAdditionalField(additionalFields, "invoiceBillTo", readTrimmedCell(record, "Invoice Bill To"));
  pushAdditionalField(additionalFields, "commissionAmount", readTrimmedCell(record, "Commission($)"));
  pushAdditionalField(additionalFields, "yourCommissionRate", readTrimmedCell(record, "Your Commission Rate"));
  pushAdditionalField(additionalFields, "rebate", readTrimmedCell(record, "Rebate"));
  pushAdditionalField(additionalFields, "reimbursement", readTrimmedCell(record, "Reimbursement"));
  pushAdditionalField(additionalFields, "coAgentLegalName", readTrimmedCell(record, "Co-Agent Legal Name"));
  pushAdditionalField(additionalFields, "commissionBreakdown", readTrimmedCell(record, "Commission Breakdown"));
  pushAdditionalField(additionalFields, "externalPartners", readTrimmedCell(record, "External Partners"));
  pushAdditionalField(additionalFields, "note", readTrimmedCell(record, "Note(Rebate, Referral, Others)"));
  pushAdditionalField(additionalFields, "leasingContact", readTrimmedCell(record, "Leasing Contact"));
  pushAdditionalField(additionalFields, "moveInDateClosingDate", readTrimmedCell(record, "Move-In Date/Closing Date"));
  pushAdditionalField(additionalFields, "additionalAddress", readTrimmedCell(record, "Address"));
  pushAdditionalField(additionalFields, "additionalCity", readTrimmedCell(record, "City"));
  pushAdditionalField(additionalFields, "additionalState", readTrimmedCell(record, "State"));
  pushAdditionalField(additionalFields, "additionalZipCode", readTrimmedCell(record, "Zip Code"));

  if (constrainedCustomFieldOptions.commissionType.has(rawCommissionType)) {
    additionalFields.commissionType = rawCommissionType;
  }

  if (constrainedCustomFieldOptions.currencyType.has(rawCurrencyType)) {
    additionalFields.currencyType = rawCurrencyType;
  }

  if (constrainedCustomFieldOptions.outsideReferral.has(outsideReferral)) {
    additionalFields.outsideReferral = outsideReferral;
  }

  if (constrainedCustomFieldOptions.uploadInvoiceToVendorCafe.has(uploadInvoiceToVendorCafe)) {
    additionalFields.uploadInvoiceToVendorCafe = uploadInvoiceToVendorCafe;
  }

  if (constrainedCustomFieldOptions.commissionReceivedStatus.has(commissionReceivedStatus)) {
    additionalFields.commissionReceivedStatus = commissionReceivedStatus;
  }

  pushAdditionalField(additionalFields, "legacyRecordId", readTrimmedCell(record, "id"));
  pushAdditionalField(additionalFields, "legacyAccountId", readTrimmedCell(record, "account_id"));
  pushAdditionalField(additionalFields, "legacyCustomId", readTrimmedCell(record, "custom_id"));
  pushAdditionalField(additionalFields, "legacyExternalId", readTrimmedCell(record, "external_id"));
  pushAdditionalField(additionalFields, "legacyUsers", readTrimmedCell(record, "users"));
  pushAdditionalField(additionalFields, "legacyOwnerName", readTrimmedCell(record, "owner_name"));
  pushAdditionalField(additionalFields, "legacyTeamLeader", readTrimmedCell(record, "Team Leader"));
  pushAdditionalField(
    additionalFields,
    "legacyCompanyDollarContribution",
    readTrimmedCell(record, "company_dollar_contribution"),
  );
  pushAdditionalField(additionalFields, "legacyAgentSplit", readTrimmedCell(record, "agent_split"));
  pushAdditionalField(additionalFields, "legacyCompanySplit", readTrimmedCell(record, "company_split"));
  pushAdditionalField(additionalFields, "legacySalesVolume", readTrimmedCell(record, "sales_volume"));
  pushAdditionalField(
    additionalFields,
    "legacyProratedSalesVolume",
    readTrimmedCell(record, "prorated_sales_volume"),
  );
  pushAdditionalField(additionalFields, "legacySides", readTrimmedCell(record, "sides"));
  pushAdditionalField(
    additionalFields,
    "legacyCommissionsFinalizedAt",
    readTrimmedCell(record, "commissions_finalized_at"),
  );
  pushAdditionalField(
    additionalFields,
    "legacyTransactionMovedDate",
    readTrimmedCell(record, "transaction_moved_date"),
  );
  pushAdditionalField(additionalFields, "legacyLeaseContact", readTrimmedCell(record, "Lease Contact"));
  pushAdditionalField(additionalFields, "legacyLeaseStartDate", readTrimmedCell(record, "Lease Start Date"));
  pushAdditionalField(
    additionalFields,
    "legacyMoveOutDate",
    readTrimmedCell(record, "Move-Out Date (for rental transactions)"),
  );
  pushAdditionalField(additionalFields, "legacyCurrencyType", rawCurrencyType);
  pushAdditionalField(additionalFields, "legacyCommissionType", rawCommissionType);
  pushAdditionalField(
    additionalFields,
    "legacyCommissionConfirmation",
    readTrimmedCell(record, "Commission Confirmation(For Agent, we'll process the payment on"),
  );

  return additionalFields;
}

function normalizeLegacyTransactionType(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: "Other",
      warning: {
        code: "unsupported_type" as const,
        message: "Transaction type was blank and defaulted to Other.",
      },
    };
  }

  const normalized = legacyTransactionTypeLabelMap.get(normalizeLegacyTypeLookup(trimmed));

  if (normalized) {
    return {
      value: normalized,
      warning: null,
    };
  }

  return {
    value: "Other",
    warning: {
      code: "unsupported_type" as const,
      message: `Unsupported transaction type "${trimmed}" defaulted to Other.`,
    },
  };
}

function normalizeLegacyRepresenting(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return {
      value: "buyer",
      warning: {
        code: "unsupported_representing" as const,
        message: "Representing was blank and defaulted to buyer.",
      },
    };
  }

  if (legacyRepresentingValues.has(trimmed)) {
    return {
      value: trimmed,
      warning: null,
    };
  }

  return {
    value: "buyer",
    warning: {
      code: "unsupported_representing" as const,
      message: `Unsupported representing value "${value}" defaulted to buyer.`,
    },
  };
}

export function normalizeLegacyImportNameForLookup(value: string | null | undefined) {
  return toNormalizedAsciiTokens(value);
}

export function splitImportedFullName(value: string) {
  const trimmed = value.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length <= 1) {
    return {
      firstName: trimmed || "Imported",
      lastName: "Imported",
      warnings: trimmed
        ? [
            {
              code: "single_token_name" as const,
              message: `Imported name "${trimmed}" only had one token; lastName defaulted to Imported.`,
            },
          ]
        : [],
    } satisfies SplitImportedFullNameResult;
  }

  return {
    firstName: tokens.slice(0, -1).join(" "),
    lastName: tokens.at(-1) ?? "Imported",
    warnings: [],
  } satisfies SplitImportedFullNameResult;
}

export function mapLegacyImportedUserRole(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "agent") {
    return {
      role: "agent" as const,
      warning: null,
    };
  }

  if (normalized === "team leader") {
    return {
      role: "team_lead" as const,
      warning: null,
    };
  }

  return {
    role: null,
    warning: {
      code: "unsupported_role" as const,
      message: `Unsupported imported role "${value}".`,
    },
  };
}

export function normalizeLegacyTransactionRow(record: Record<string, string>) {
  const warnings: LegacyImportIssue[] = [];
  const rawStatus = readTrimmedCell(record, "status").toLowerCase();
  const sourceRowId = buildTransactionSourceRowId(record);
  const fullAddress = pickFirstNonEmpty(
    readTrimmedCell(record, "full_address"),
    readTrimmedCell(record, "location"),
  );
  const parsedFallbackAddress = parseLegacyAddress(fullAddress);
  const address = pickFirstNonEmpty(readTrimmedCell(record, "Address"), parsedFallbackAddress.address);
  const city = pickFirstNonEmpty(readTrimmedCell(record, "City"), parsedFallbackAddress.city);
  const state = pickFirstNonEmpty(readTrimmedCell(record, "State"), parsedFallbackAddress.state);
  const zipCode = pickFirstNonEmpty(readTrimmedCell(record, "Zip Code"), parsedFallbackAddress.zipCode);
  const normalizedType = normalizeLegacyTransactionType(readTrimmedCell(record, "transaction_type"));
  const normalizedRepresenting = normalizeLegacyRepresenting(readTrimmedCell(record, "representing"));
  const rawCurrencyType = readTrimmedCell(record, "Currency Type");

  if (normalizedType.warning) {
    warnings.push(normalizedType.warning);
  }

  if (normalizedRepresenting.warning) {
    warnings.push(normalizedRepresenting.warning);
  }

  if (rawCurrencyType && rawCurrencyType.toUpperCase() !== "USD") {
    warnings.push({
      code: "non_usd_currency",
      message: `Currency "${rawCurrencyType}" will be preserved as raw provenance while amounts are imported unchanged.`,
    });
  }

  const shouldImport = rawStatus === "pending" || rawStatus === "closed";
  const skipReason = shouldImport ? null : `Status "${rawStatus || "blank"}" is outside the import scope.`;

  if (!address || !city || !state) {
    warnings.push({
      code: "missing_address_parts",
      message: "Address parsing needed fallback values and may require a manual review after import.",
    });
  }

  return {
    sourceRowId,
    shouldImport,
    skipReason,
    rawStatus,
    createInput: {
      transactionType: normalizedType.value,
      transactionStatus: rawStatus || "pending",
      representing: normalizedRepresenting.value,
      address: address || fullAddress || "Imported legacy address",
      city,
      state,
      zipCode,
      transactionName: pickFirstNonEmpty(
        readTrimmedCell(record, "transaction_name"),
        address,
        fullAddress,
        sourceRowId,
      ),
      askingPrice: pickFirstNonEmpty(readTrimmedCell(record, "price")),
      purchasedPrice: pickFirstNonEmpty(
        readTrimmedCell(record, "Sales Price/Gross Rent"),
        readTrimmedCell(record, "sales_volume"),
        readTrimmedCell(record, "Net Price"),
        readTrimmedCell(record, "price"),
      ),
      buyerAgreementDate: readTrimmedCell(record, "buyer_agreement_date"),
      buyerExpirationDate: pickFirstNonEmpty(
        readTrimmedCell(record, "buyer_expiration_date"),
        readTrimmedCell(record, "important_date"),
      ),
      acceptanceDate: readTrimmedCell(record, "acceptance_date"),
      listingDate: readTrimmedCell(record, "listing_date"),
      listingExpirationDate: readTrimmedCell(record, "expiration_date"),
      closingDate: readTrimmedCell(record, "closing_date"),
      moveInDate: pickFirstNonEmpty(
        readTrimmedCell(record, "Move-In Date/Closing Date"),
        readTrimmedCell(record, "Lease Start Date"),
      ),
      companyReferral: readTrimmedCell(record, "Company Referral"),
      companyReferralEmployeeName: readTrimmedCell(record, "Company Referral Employee's Name"),
      grossCommission: pickFirstNonEmpty(
        readTrimmedCell(record, "total_gross_commission"),
        readTrimmedCell(record, "office_gross"),
        readTrimmedCell(record, "Commission($)"),
      ),
      referralFee: readTrimmedCell(record, "Referral Fee"),
      officeNet: readTrimmedCell(record, "office_net"),
      agentNet: readTrimmedCell(record, "agent_net"),
      financeNotes: readTrimmedCell(record, "Note(Rebate, Referral, Others)"),
      additionalFields: buildLegacyTransactionAdditionalFields(record),
    },
    ownerCandidateNames: normalizeSelectedOfficeIds([
      readTrimmedCell(record, "Agent Name"),
      readTrimmedCell(record, "Licensed Agent Name"),
    ]),
    contactMatchInput: {
      clientEmail: readTrimmedCell(record, "Client's Email"),
      clientName: readTrimmedCell(record, "Client Name"),
      buyerTenant: readTrimmedCell(record, "Buyer/Tenant"),
      preferredCreateName: pickFirstNonEmpty(
        readTrimmedCell(record, "Client Name"),
        readTrimmedCell(record, "Buyer/Tenant"),
      ),
    },
    additionalFields: buildLegacyTransactionAdditionalFields(record),
    warnings,
  } satisfies LegacyNormalizedTransactionRow;
}

export async function upsertImportedActiveUser(input: UpsertImportedActiveUserInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const firstName = normalizeRequiredText(input.firstName, "First name");
  const lastName = normalizeRequiredText(input.lastName, "Last name");

  if (!importEligibleRoleCatalog.includes(input.role)) {
    throw new Error("Unsupported role for imported active user creation.");
  }

  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
      },
      tx,
    );

    assertActorCanManageUsers(actorPermissionKeys);
    assertActorCanAssignPrivilegedRole(actorPermissionKeys, input.role);

    const existingUser = await tx.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    let createdUser = false;
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          timezone: "America/New_York",
          locale: "en-US",
          isActive: true,
        },
      }));

    if (!existingUser) {
      createdUser = true;
    } else if (
      existingUser.firstName !== firstName ||
      existingUser.lastName !== lastName ||
      !existingUser.isActive
    ) {
      await tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          firstName,
          lastName,
          isActive: true,
        },
      });
    }

    const existingMembership = await tx.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: user.id,
        },
      },
      include: {
        officeAccesses: {
          include: {
            office: {
              select: {
                id: true,
                name: true,
                slug: true,
                market: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    });

    const organizationOffices = await tx.office.findMany({
      where: {
        organizationId: input.organizationId,
      },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true,
      },
    });
    const normalizedOfficeAssignment = resolveMembershipOfficeAssignment({
      role: input.role,
      allOffices: organizationOffices,
      defaultOfficeId: input.defaultOfficeId,
      selectedOfficeIds: input.accessibleOfficeIds ?? [input.defaultOfficeId],
    });

    if (
      input.viewerOfficeId &&
      !membershipHasAccessToOffice({
        role: input.role,
        allOffices: organizationOffices,
        defaultOfficeId: normalizedOfficeAssignment.defaultOfficeId,
        officeAccesses: normalizedOfficeAssignment.explicitOfficeIds.map((officeId) => {
          const office = organizationOffices.find((entry) => entry.id === officeId);

          if (!office) {
            throw new Error("Selected company was not found.");
          }

          return {
            officeId,
            office,
          };
        }),
        officeId: input.viewerOfficeId,
      })
    ) {
      throw new Error("Choose the current company in company access or switch the top-level company first.");
    }

    let createdMembership = false;
    const membership =
      existingMembership ??
      (await tx.membership.create({
        data: {
          organizationId: input.organizationId,
          officeId: normalizedOfficeAssignment.defaultOfficeId,
          userId: user.id,
          role: input.role,
          status: "active",
          title: input.title?.trim() ? input.title.trim() : null,
          permissions: Prisma.JsonNull,
          officeAccesses: normalizedOfficeAssignment.explicitOfficeIds.length
            ? {
                createMany: {
                  data: normalizedOfficeAssignment.explicitOfficeIds.map((officeId) => ({
                    organizationId: input.organizationId,
                    officeId,
                    createdByMembershipId: input.actorMembershipId,
                  })),
                },
              }
            : undefined,
        },
      }));

    if (!existingMembership) {
      createdMembership = true;
    } else {
      await tx.invitation.updateMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      await tx.teamMembership.deleteMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
        },
      });
      await tx.membershipCommissionSetting.deleteMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
        },
      });
      await tx.membershipPermissionOverride.deleteMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
        },
      });
      await tx.membershipOfficePermissionOverride.deleteMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
        },
      });
      await tx.membershipOfficeAccess.deleteMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existingMembership.id,
        },
      });
      await tx.membership.update({
        where: {
          id: existingMembership.id,
        },
        data: {
          officeId: normalizedOfficeAssignment.defaultOfficeId,
          role: input.role,
          status: "active",
          title: input.title?.trim() ? input.title.trim() : null,
          permissions: Prisma.JsonNull,
        },
      });

      if (normalizedOfficeAssignment.explicitOfficeIds.length > 0) {
        await tx.membershipOfficeAccess.createMany({
          data: normalizedOfficeAssignment.explicitOfficeIds.map((officeId) => ({
            organizationId: input.organizationId,
            membershipId: existingMembership.id,
            officeId,
            createdByMembershipId: input.actorMembershipId,
          })),
        });
      }
    }

    const credential = await tx.userCredential.findUnique({
      where: {
        userId: user.id,
      },
    });
    const passwordHash = await hashImportedPassword(input.initialPassword);
    let createdCredential = false;

    await tx.userCredential.upsert({
      where: {
        userId: user.id,
      },
      update: {
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastFailedLoginAt: null,
        passwordChangedAt: null,
      },
      create: {
        userId: user.id,
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastFailedLoginAt: null,
        passwordChangedAt: null,
      },
    });

    if (!credential) {
      createdCredential = true;
    }

    const officeLabel =
      organizationOffices.find((office) => office.id === normalizedOfficeAssignment.defaultOfficeId)?.name ?? "All offices";

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "membership",
      entityId: membership.id,
      action: activityLogActions.settingsUserActivated,
      payload: {
        officeId: normalizedOfficeAssignment.defaultOfficeId,
        objectLabel: `${firstName} ${lastName} · ${normalizedEmail}`,
        contextHref: "/office/settings/users",
        details: [
          buildRoleDetail(input.role),
          `Office: ${officeLabel}`,
          "Source: Legacy import",
          "Initial password issued with forced reset",
        ],
      },
    });

    return {
      membershipId: membership.id,
      userId: user.id,
      createdUser,
      createdMembership,
      createdCredential,
    } satisfies UpsertImportedActiveUserResult;
  });
}

async function resolveResetPreservedUsers(
  tx: Prisma.TransactionClient,
  input: ResetOrganizationBusinessDataInput,
) {
  const preservedMemberships = input.preserveMembershipIds?.length
    ? await tx.membership.findMany({
        where: {
          organizationId: input.organizationId,
          id: {
            in: input.preserveMembershipIds,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      })
    : [];

  return {
    preservedMembershipIds: preservedMemberships.map((entry) => entry.id),
    preservedUserIds: [...new Set([...(input.preserveUserIds ?? []), ...preservedMemberships.map((entry) => entry.userId)])],
  };
}

async function getResetPreviewCounts(
  tx: Prisma.TransactionClient,
  input: ResetOrganizationBusinessDataInput,
) {
  const preserved = await resolveResetPreservedUsers(tx, input);
  const membershipExclusion =
    preserved.preservedMembershipIds.length > 0
      ? {
          notIn: preserved.preservedMembershipIds,
        }
      : undefined;

  const counts: Record<string, number> = {};
  counts.auditLogs = await tx.auditLog.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.invitations = await tx.invitation.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.transactions = await tx.transaction.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.contacts = await tx.client.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.teams = await tx.team.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.memberships = await tx.membership.count({
    where: {
      organizationId: input.organizationId,
      ...(membershipExclusion ? { id: membershipExclusion } : {}),
    },
  });
  counts.users = await tx.user.count({
    where: {
      id: {
        notIn: preserved.preservedUserIds,
      },
      memberships: {
        some: {
          organizationId: input.organizationId,
          ...(membershipExclusion ? { id: membershipExclusion } : {}),
        },
      },
    },
  });
  counts.teamMemberships = await tx.teamMembership.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.membershipOfficeAccesses = await tx.membershipOfficeAccess.count({
    where: {
      organizationId: input.organizationId,
      ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
    },
  });
  counts.membershipPermissionOverrides = await tx.membershipPermissionOverride.count({
    where: {
      organizationId: input.organizationId,
      ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
    },
  });
  counts.membershipOfficePermissionOverrides = await tx.membershipOfficePermissionOverride.count({
    where: {
      organizationId: input.organizationId,
      ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
    },
  });
  counts.commissionCalculations = await tx.commissionCalculation.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.accountingTransactions = await tx.accountingTransaction.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.agentPayoutStatements = await tx.agentPayoutStatement.count({
    where: {
      organizationId: input.organizationId,
    },
  });
  counts.transactionFinanceFees = await tx.transactionFinanceFee.count({
    where: {
      organizationId: input.organizationId,
    },
  });

  return {
    preservedMembershipIds: preserved.preservedMembershipIds,
    preservedUserIds: preserved.preservedUserIds,
    counts,
  } satisfies ResetOrganizationBusinessDataPreview;
}

export async function previewResetOrganizationBusinessData(input: ResetOrganizationBusinessDataInput) {
  return prisma.$transaction(async (tx) => getResetPreviewCounts(tx, input));
}

export async function resetOrganizationBusinessData(input: ResetOrganizationBusinessDataInput) {
  return prisma.$transaction(async (tx) => {
    const preview = await getResetPreviewCounts(tx, input);
    const removableOrganizationUserIds = (
      await tx.membership.findMany({
        where: {
          organizationId: input.organizationId,
          ...(preview.preservedMembershipIds.length > 0
            ? {
                id: {
                  notIn: preview.preservedMembershipIds,
                },
              }
            : {}),
        },
        select: {
          userId: true,
        },
      })
    ).map((entry) => entry.userId);
    const membershipExclusion =
      preview.preservedMembershipIds.length > 0
        ? {
            notIn: preview.preservedMembershipIds,
          }
        : undefined;

    await tx.auditLog.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.officeMailAttachment.deleteMany({
      where: {
        message: {
          thread: {
            organizationId: input.organizationId,
          },
        },
      },
    });
    await tx.officeMailMessage.deleteMany({
      where: {
        thread: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.officeMailParticipant.deleteMany({
      where: {
        thread: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.officeMailThread.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.offerComment.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.offer.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.signatureAuditEntry.deleteMany({
      where: {
        signatureRequest: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.signatureField.deleteMany({
      where: {
        signatureRequest: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.signatureArtifact.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.signatureRecipient.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.signatureRequest.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionDocument.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionForm.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.incomingUpdate.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionTask.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionMembershipLink.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionContact.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionFinanceCalculationVersion.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transactionFinanceFee.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.earnestMoneyRecord.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.agentPayoutStatementManualLineItem.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.agentPayoutStatementMessage.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.agentPayoutStatementLine.deleteMany({
      where: {
        statement: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.agentPayoutStatement.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.generalLedgerEntry.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.accountingTransactionApplication.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.accountingTransactionLineItem.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.accountingTransaction.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.frontOfficeAiAcceptedAction.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.frontOfficeSendRecord.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.appointment.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.followUpTask.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.frontOfficeHandoffDraft.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.clientStageHistory.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.transaction.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.client.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.eventRsvp.deleteMany({
      where: {
        event: {
          organizationId: input.organizationId,
        },
      },
    });
    await tx.event.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.notification.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.taskListView.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.agentGoal.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.agentOnboardingItem.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.agentProfile.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.agent1099PaymentRecord.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.agentBankInformation.deleteMany({
      where: {
        membership: {
          organizationId: input.organizationId,
          ...(membershipExclusion ? { id: membershipExclusion } : {}),
        },
      },
    });
    await tx.agentPaymentMethod.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.agentRecurringChargeRule.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.membershipCommissionSetting.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.commissionPlanAssignment.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.teamMembership.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.team.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.membershipNotificationPreference.deleteMany({
      where: {
        membership: {
          organizationId: input.organizationId,
          ...(membershipExclusion ? { id: membershipExclusion } : {}),
        },
      },
    });
    await tx.invitation.deleteMany({
      where: {
        organizationId: input.organizationId,
      },
    });
    await tx.membershipOfficePermissionOverride.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.membershipPermissionOverride.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.membershipOfficeAccess.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { membershipId: membershipExclusion } : {}),
      },
    });
    await tx.membership.deleteMany({
      where: {
        organizationId: input.organizationId,
        ...(membershipExclusion ? { id: membershipExclusion } : {}),
      },
    });

    const orphanUsers = await tx.user.findMany({
      where: {
        id: {
          in: [...new Set(removableOrganizationUserIds)].filter(
            (userId) => !preview.preservedUserIds.includes(userId),
          ),
        },
        memberships: {
          none: {},
        },
      },
      select: {
        id: true,
      },
    });
    const orphanUserIds = orphanUsers.map((user) => user.id);

    if (orphanUserIds.length > 0) {
      await tx.userCredential.deleteMany({
        where: {
          userId: {
            in: orphanUserIds,
          },
        },
      });
      await tx.user.deleteMany({
        where: {
          id: {
            in: orphanUserIds,
          },
        },
      });
    }

    return {
      preservedMembershipIds: preview.preservedMembershipIds,
      preservedUserIds: preview.preservedUserIds,
      counts: {
        ...preview.counts,
        orphanUsersDeleted: orphanUserIds.length,
      },
    } satisfies ResetOrganizationBusinessDataResult;
  });
}

export async function ensureLegacyImportBootstrapContext() {
  const bootstrap = await ensureBootstrapAdminAccount();

  if (!bootstrap.organizationId || !bootstrap.membershipId || !bootstrap.userId) {
    throw new Error("Bootstrap admin could not be ensured for legacy import.");
  }

  return bootstrap;
}
