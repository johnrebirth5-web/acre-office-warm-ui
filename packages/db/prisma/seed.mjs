import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the Acre seed workflow.");
}

function getSeedDocumentsRoot() {
  return process.env.ACRE_DOCUMENTS_STORAGE_DIR?.trim() || path.join(process.cwd(), "..", "..", ".local-storage", "documents");
}

function sanitizeStorageSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "file";
}

async function writeSeedStoredFile({ organizationId, scopeSegments, fileName, content }) {
  const directory = path.join(
    getSeedDocumentsRoot(),
    sanitizeStorageSegment(organizationId),
    ...scopeSegments.map((segment) => sanitizeStorageSegment(segment))
  );
  await mkdir(directory, { recursive: true });

  const normalizedFileName = sanitizeStorageSegment(fileName);
  const absolutePath = path.join(directory, normalizedFileName);
  const fileBody =
    typeof content === "string"
      ? Buffer.from(content, "utf8")
      : content instanceof Uint8Array
        ? Buffer.from(content)
        : Buffer.from(JSON.stringify(content, null, 2), "utf8");

  await writeFile(absolutePath, fileBody);

  return {
    fileName: normalizedFileName,
    storageKey: absolutePath,
    fileSizeBytes: fileBody.byteLength
  };
}

async function writeSeedStoredDocument({ organizationId, transactionId, fileName, content }) {
  return writeSeedStoredFile({
    organizationId,
    scopeSegments: [transactionId],
    fileName,
    content
  });
}

async function writeSeedStoredLibraryDocument({ organizationId, officeId, fileName, content }) {
  return writeSeedStoredFile({
    organizationId,
    scopeSegments: ["library", officeId ? `office-${officeId}` : "company"],
    fileName,
    content
  });
}

function escapePdfText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildMinimalPdf({ title, lines }) {
  const commands = ["BT", "/F1 16 Tf", "50 760 Td", `(${escapePdfText(title)}) Tj`, "/F1 10 Tf"];

  for (const line of lines) {
    commands.push("0 -20 Td", `(${escapePdfText(line)}) Tj`);
  }

  commands.push("ET");

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

async function upsertUser({ email, firstName, lastName }) {
  return prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      isActive: true
    },
    create: {
      email,
      firstName,
      lastName,
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true
    }
  });
}

async function upsertLedgerAccount({ organizationId, officeId, code, name, accountType, isSystem = true, isActive = true }) {
  return prisma.ledgerAccount.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code
      }
    },
    update: {
      officeId,
      name,
      accountType,
      isSystem,
      isActive
    },
    create: {
      organizationId,
      officeId,
      code,
      name,
      accountType,
      isSystem,
      isActive
    }
  });
}

async function upsertAccountingTransactionWithPostings({
  id,
  organizationId,
  officeId,
  relatedTransactionId,
  relatedMembershipId,
  isAgentBilling = false,
  billingCategory = null,
  originRecurringChargeRuleId = null,
  type,
  status,
  accountingDate,
  dueDate,
  paymentMethod,
  referenceNumber,
  counterpartyName,
  memo,
  notes,
  totalAmount,
  createdByMembershipId,
  postedAt,
  lineItems,
  ledgerEntries
}) {
  const transaction = await prisma.accountingTransaction.upsert({
    where: { id },
    update: {
      organizationId,
      officeId,
      relatedTransactionId,
      relatedMembershipId,
      isAgentBilling,
      billingCategory,
      originRecurringChargeRuleId,
      type,
      status,
      accountingDate,
      dueDate,
      paymentMethod,
      referenceNumber,
      counterpartyName,
      memo,
      notes,
      totalAmount,
      createdByMembershipId,
      postedAt
    },
    create: {
      id,
      organizationId,
      officeId,
      relatedTransactionId,
      relatedMembershipId,
      isAgentBilling,
      billingCategory,
      originRecurringChargeRuleId,
      type,
      status,
      accountingDate,
      dueDate,
      paymentMethod,
      referenceNumber,
      counterpartyName,
      memo,
      notes,
      totalAmount,
      createdByMembershipId,
      postedAt
    }
  });

  await prisma.accountingTransactionLineItem.deleteMany({
    where: {
      accountingTransactionId: id
    }
  });

  await prisma.generalLedgerEntry.deleteMany({
    where: {
      accountingTransactionId: id
    }
  });

  if (lineItems.length) {
    await prisma.accountingTransactionLineItem.createMany({
      data: lineItems.map((lineItem, index) => ({
        id: lineItem.id,
        organizationId,
        officeId,
        accountingTransactionId: id,
        relatedTransactionId,
        ledgerAccountId: lineItem.ledgerAccountId,
        description: lineItem.description ?? null,
        entrySide: lineItem.entrySide,
        amount: lineItem.amount,
        sortOrder: lineItem.sortOrder ?? index
      }))
    });
  }

  if (ledgerEntries.length) {
    await prisma.generalLedgerEntry.createMany({
      data: ledgerEntries.map((entry) => ({
        id: entry.id,
        organizationId,
        officeId,
        accountingTransactionId: id,
        relatedTransactionId,
        accountId: entry.accountId,
        entryDate: entry.entryDate,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        memo: entry.memo ?? null
      }))
    });
  }

  return transaction;
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "acre" },
    update: {
      name: "Acre",
      timezone: "America/New_York"
    },
    create: {
      name: "Acre",
      slug: "acre",
      timezone: "America/New_York"
    }
  });

  const office = await prisma.office.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "acre-ny"
      }
    },
    update: {
      name: "Acre NY Realty Inc",
      market: "New York Sales",
      isPrimary: true
    },
    create: {
      organizationId: organization.id,
      name: "Acre NY Realty Inc",
      slug: "acre-ny",
      market: "New York Sales",
      isPrimary: true
    }
  });

  const users = await Promise.all([
    upsertUser({ email: "jane@acre.com", firstName: "Jane", lastName: "Wu" }),
    upsertUser({ email: "simon@acre.com", firstName: "Simon", lastName: "Park" }),
    upsertUser({ email: "naomi@acre.com", firstName: "Naomi", lastName: "Chen" })
  ]);

  const memberships = [
    { user: users[0], role: "agent", title: "Senior Agent" },
    { user: users[1], role: "office_manager", title: "Office Manager" },
    { user: users[2], role: "office_admin", title: "Office Admin" }
  ];

  const membershipByEmail = new Map();

  for (const membership of memberships) {
    const savedMembership = await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: membership.user.id
        }
      },
      update: {
        officeId: office.id,
        role: membership.role,
        status: "active",
        title: membership.title,
        permissions: null
      },
      create: {
        organizationId: organization.id,
        officeId: office.id,
        userId: membership.user.id,
        role: membership.role,
        status: "active",
        title: membership.title,
        permissions: null
      }
    });

    membershipByEmail.set(membership.user.email, savedMembership);
  }

  const seededAgentProfiles = [
    {
      membershipEmail: "jane@acre.com",
      displayName: "Jane Wu",
      bio: "Buyer-side agent focused on Brooklyn and LIC investor inventory.",
      notes: "Primary mentor for new buyer-side workflows.",
      licenseNumber: "NY-AG-10428",
      licenseState: "NY",
      startDate: new Date("2025-09-01T00:00:00.000Z"),
      onboardingStatus: "in_progress",
      commissionPlanName: "Senior agent split",
      avatarUrl: "",
      internalExtension: "201"
    },
    {
      membershipEmail: "simon@acre.com",
      displayName: "Simon Park",
      bio: "Office manager supervising transaction operations and finance review.",
      notes: "Reviews finance-side tasks and vendor billing workflows.",
      licenseNumber: "",
      licenseState: "",
      startDate: new Date("2024-07-15T00:00:00.000Z"),
      onboardingStatus: "complete",
      commissionPlanName: "",
      avatarUrl: "",
      internalExtension: "102"
    },
    {
      membershipEmail: "naomi@acre.com",
      displayName: "Naomi Chen",
      bio: "Office administrator coordinating approvals, documents, and back-office operations.",
      notes: "Primary secondary approver for compliance-sensitive work.",
      licenseNumber: "",
      licenseState: "",
      startDate: new Date("2024-11-01T00:00:00.000Z"),
      onboardingStatus: "complete",
      commissionPlanName: "",
      avatarUrl: "",
      internalExtension: "101"
    }
  ];

  for (const profile of seededAgentProfiles) {
    const membership = membershipByEmail.get(profile.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.agentProfile.upsert({
      where: {
        membershipId: membership.id
      },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        displayName: profile.displayName,
        bio: profile.bio,
        notes: profile.notes,
        licenseNumber: profile.licenseNumber || null,
        licenseState: profile.licenseState || null,
        startDate: profile.startDate,
        onboardingStatus: profile.onboardingStatus,
        commissionPlanName: profile.commissionPlanName || null,
        avatarUrl: profile.avatarUrl || null,
        internalExtension: profile.internalExtension || null
      },
      create: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        displayName: profile.displayName,
        bio: profile.bio,
        notes: profile.notes,
        licenseNumber: profile.licenseNumber || null,
        licenseState: profile.licenseState || null,
        startDate: profile.startDate,
        onboardingStatus: profile.onboardingStatus,
        commissionPlanName: profile.commissionPlanName || null,
        avatarUrl: profile.avatarUrl || null,
        internalExtension: profile.internalExtension || null
      }
    });
  }

  const seededTeams = [
    {
      id: "seed-team-east-river",
      name: "East River Team",
      slug: "east-river-team",
      isActive: true
    },
    {
      id: "seed-team-operations",
      name: "Operations",
      slug: "operations",
      isActive: true
    }
  ];

  for (const team of seededTeams) {
    await prisma.team.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: team.slug
        }
      },
      update: {
        officeId: office.id,
        name: team.name,
        isActive: team.isActive
      },
      create: {
        id: team.id,
        organizationId: organization.id,
        officeId: office.id,
        name: team.name,
        slug: team.slug,
        isActive: team.isActive
      }
    });
  }

  const seededTeamMemberships = [
    {
      id: "seed-team-membership-jane",
      teamId: "seed-team-east-river",
      membershipEmail: "jane@acre.com",
      role: "leader_i"
    },
    {
      id: "seed-team-membership-simon",
      teamId: "seed-team-operations",
      membershipEmail: "simon@acre.com",
      role: "leader_i"
    },
    {
      id: "seed-team-membership-naomi",
      teamId: "seed-team-operations",
      membershipEmail: "naomi@acre.com",
      role: "member",
      reportsToTeamMembershipId: "seed-team-membership-simon"
    }
  ];

  for (const teamMembership of seededTeamMemberships) {
    const membership = membershipByEmail.get(teamMembership.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.teamMembership.upsert({
      where: {
        teamId_membershipId: {
          teamId: teamMembership.teamId,
          membershipId: membership.id
        }
      },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        role: teamMembership.role,
        reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId ?? null
      },
      create: {
        id: teamMembership.id,
        organizationId: organization.id,
        officeId: office.id,
        teamId: teamMembership.teamId,
        membershipId: membership.id,
        role: teamMembership.role,
        reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId ?? null
      }
    });
  }

  const seededRequiredContactRoleSettings = [
    { id: "seed-required-role-buyer", role: "buyer", isRequired: true },
    { id: "seed-required-role-seller", role: "seller", isRequired: true },
    { id: "seed-required-role-tenant", role: "tenant", isRequired: false },
    { id: "seed-required-role-landlord", role: "landlord", isRequired: false }
  ];

  for (const roleSetting of seededRequiredContactRoleSettings) {
    await prisma.requiredContactRoleSetting.upsert({
      where: {
        organizationId_officeId_role: {
          organizationId: organization.id,
          officeId: office.id,
          role: roleSetting.role
        }
      },
      update: {
        isRequired: roleSetting.isRequired
      },
      create: {
        id: roleSetting.id,
        organizationId: organization.id,
        officeId: office.id,
        role: roleSetting.role,
        isRequired: roleSetting.isRequired
      }
    });
  }

  const seededTransactionFieldSettings = [
    { id: "seed-field-transaction-type", fieldKey: "transaction_type", isRequired: false, isVisible: true },
    { id: "seed-field-transaction-status", fieldKey: "transaction_status", isRequired: false, isVisible: true },
    { id: "seed-field-representing", fieldKey: "representing", isRequired: false, isVisible: true },
    { id: "seed-field-address", fieldKey: "address", isRequired: false, isVisible: true },
    { id: "seed-field-city", fieldKey: "city", isRequired: false, isVisible: true },
    { id: "seed-field-state", fieldKey: "state", isRequired: false, isVisible: true },
    { id: "seed-field-zip-code", fieldKey: "zip_code", isRequired: false, isVisible: true },
    { id: "seed-field-transaction-name", fieldKey: "transaction_name", isRequired: false, isVisible: true },
    { id: "seed-field-asking-price", fieldKey: "asking_price", isRequired: false, isVisible: true },
    { id: "seed-field-purchased-price", fieldKey: "purchased_price", isRequired: false, isVisible: true },
    { id: "seed-field-buyer-agreement", fieldKey: "buyer_agreement_date", isRequired: false, isVisible: true },
    { id: "seed-field-buyer-expiration", fieldKey: "buyer_expiration_date", isRequired: false, isVisible: true },
    { id: "seed-field-acceptance-date", fieldKey: "acceptance_date", isRequired: false, isVisible: true },
    { id: "seed-field-listing-date", fieldKey: "listing_date", isRequired: false, isVisible: true },
    { id: "seed-field-listing-expiration", fieldKey: "listing_expiration_date", isRequired: false, isVisible: true },
    { id: "seed-field-closing-date", fieldKey: "closing_date", isRequired: false, isVisible: true },
    { id: "seed-field-move-in-date", fieldKey: "move_in_date", isRequired: false, isVisible: true }
  ];

  for (const fieldSetting of seededTransactionFieldSettings) {
    await prisma.transactionFieldSetting.upsert({
      where: {
        organizationId_officeId_fieldKey: {
          organizationId: organization.id,
          officeId: office.id,
          fieldKey: fieldSetting.fieldKey
        }
      },
      update: {
        isRequired: fieldSetting.isRequired,
        isVisible: fieldSetting.isVisible
      },
      create: {
        id: fieldSetting.id,
        organizationId: organization.id,
        officeId: office.id,
        fieldKey: fieldSetting.fieldKey,
        isRequired: fieldSetting.isRequired,
        isVisible: fieldSetting.isVisible
      }
    });
  }

  const seededTransactionCustomFieldDefinitions = [
    { id: "seed-custom-field-agent-name", fieldKey: "agentName", label: "Agent Name", type: "text", sortOrder: 0, options: [], isDeletionLocked: true },
    { id: "seed-custom-field-team-leader", fieldKey: "teamLeader", label: "Team Leader", type: "select", sortOrder: 1, options: ["Simon Park", "Naomi Chen", "Alice Tang"] },
    { id: "seed-custom-field-licensed-agent-name", fieldKey: "licensedAgentName", label: "Licensed Agent Name", type: "text", sortOrder: 2, options: [] },
    { id: "seed-custom-field-invoice-number", fieldKey: "invoiceNumber", label: "Invoice Number", type: "text", sortOrder: 3, options: [] },
    { id: "seed-custom-field-buyer-tenant", fieldKey: "buyerTenant", label: "Buyer/Tenant", type: "text", sortOrder: 4, options: [] },
    { id: "seed-custom-field-building-name", fieldKey: "buildingName", label: "Building Name", type: "text", sortOrder: 5, options: [] },
    { id: "seed-custom-field-additional-address", fieldKey: "additionalAddress", label: "Address", type: "text", sortOrder: 6, options: [] },
    { id: "seed-custom-field-unit-number", fieldKey: "unitNumber", label: "Unit # (If it's a house, fill out \"house\")", type: "text", sortOrder: 7, options: [] },
    { id: "seed-custom-field-layout", fieldKey: "layout", label: "Layout", type: "text", sortOrder: 8, options: [] },
    { id: "seed-custom-field-additional-city", fieldKey: "additionalCity", label: "City", type: "text", sortOrder: 9, options: [] },
    { id: "seed-custom-field-additional-state", fieldKey: "additionalState", label: "State", type: "text", sortOrder: 10, options: [] },
    { id: "seed-custom-field-additional-zip", fieldKey: "additionalZipCode", label: "Zip Code", type: "text", sortOrder: 11, options: [] },
    { id: "seed-custom-field-move-in", fieldKey: "moveInDateClosingDate", label: "Move-In Date/Closing Date", type: "text", sortOrder: 12, options: [] },
    { id: "seed-custom-field-commission-type", fieldKey: "commissionType", label: "Commission Type", type: "select", sortOrder: 13, options: ["Gross", "Net", "Custom"] },
    { id: "seed-custom-field-leasing-contact", fieldKey: "leasingContact", label: "Leasing Contact", type: "text", sortOrder: 14, options: [] },
    { id: "seed-custom-field-invoice-bill-to", fieldKey: "invoiceBillTo", label: "Invoice Bill To", type: "text", sortOrder: 15, options: [] },
    { id: "seed-custom-field-currency-type", fieldKey: "currencyType", label: "Currency Type", type: "select", sortOrder: 16, options: ["USD"] },
    { id: "seed-custom-field-commission-amount", fieldKey: "commissionAmount", label: "Commission($)", type: "text", sortOrder: 17, options: [] },
    { id: "seed-custom-field-your-rate", fieldKey: "yourCommissionRate", label: "Your Commission Rate", type: "text", sortOrder: 18, options: [] },
    { id: "seed-custom-field-rebate", fieldKey: "rebate", label: "Rebate", type: "text", sortOrder: 19, options: [] },
    { id: "seed-custom-field-reimbursement", fieldKey: "reimbursement", label: "Reimbursement", type: "text", sortOrder: 20, options: [] },
    { id: "seed-custom-field-co-agent", fieldKey: "coAgentLegalName", label: "Co-Agent Legal Name", type: "text", sortOrder: 21, options: [] },
    { id: "seed-custom-field-breakdown", fieldKey: "commissionBreakdown", label: "Commission Breakdown", type: "text", sortOrder: 22, options: [] },
    { id: "seed-custom-field-company-referral", fieldKey: "companyReferral", label: "Company Referral", type: "select", sortOrder: 23, options: ["Yes", "No"] },
    { id: "seed-custom-field-outside-referral", fieldKey: "outsideReferral", label: "Outside Referral", type: "select", sortOrder: 24, options: ["Yes", "No"] },
    { id: "seed-custom-field-referral-fee", fieldKey: "referralFee", label: "Referral Fee", type: "text", sortOrder: 25, options: [] },
    { id: "seed-custom-field-external-partners", fieldKey: "externalPartners", label: "External Partners", type: "text", sortOrder: 26, options: [] },
    { id: "seed-custom-field-company-referral-employee", fieldKey: "companyReferralEmployeeName", label: "Company Referral Employee's Name", type: "text", sortOrder: 27, options: [] },
    { id: "seed-custom-field-client-email", fieldKey: "clientEmail", label: "Client's Email", type: "text", sortOrder: 28, options: [] },
    { id: "seed-custom-field-vendor-cafe", fieldKey: "uploadInvoiceToVendorCafe", label: "Upload Invoice to VendorCafe", type: "select", sortOrder: 29, options: ["Yes", "No"] },
    { id: "seed-custom-field-note", fieldKey: "note", label: "Note(Rebate, Referral, Others)", type: "text", sortOrder: 30, options: [] },
    { id: "seed-custom-field-commission-received", fieldKey: "commissionReceivedStatus", label: "Status of Commission Received(For Admin)", type: "select", sortOrder: 31, options: ["No", "Yes", "Partial"] },
    { id: "seed-custom-field-commission-confirmation", fieldKey: "commissionConfirmation", label: "Commission Confirmation(For Agent, we'll process the payment once you select yes)", type: "select", sortOrder: 32, options: ["Yes", "No"] }
  ];

  for (const fieldDefinition of seededTransactionCustomFieldDefinitions) {
    await prisma.transactionCustomFieldDefinition.upsert({
      where: {
        organizationId_officeId_fieldKey: {
          organizationId: organization.id,
          officeId: office.id,
          fieldKey: fieldDefinition.fieldKey
        }
      },
      update: {
        label: fieldDefinition.label,
        type: fieldDefinition.type,
        isRequired: false,
        isVisible: true,
        isDeletionLocked: Boolean(fieldDefinition.isDeletionLocked),
        sortOrder: fieldDefinition.sortOrder,
        options: fieldDefinition.options
      },
      create: {
        id: fieldDefinition.id,
        organizationId: organization.id,
        officeId: office.id,
        fieldKey: fieldDefinition.fieldKey,
        label: fieldDefinition.label,
        type: fieldDefinition.type,
        isRequired: false,
        isVisible: true,
        isDeletionLocked: Boolean(fieldDefinition.isDeletionLocked),
        sortOrder: fieldDefinition.sortOrder,
        options: fieldDefinition.options
      }
    });
  }

  const seededChecklistTemplates = [
    {
      id: "seed-checklist-template-office-default",
      name: "Office default transaction checklist",
      description: "Core office-wide transaction operations checklist for every deal.",
      transactionType: null,
      isActive: true,
      items: [
        {
          id: "seed-checklist-template-office-default-0",
          checklistGroup: "Intake",
          title: "Confirm transaction data and contact roster",
          description: "Validate address, price, key dates, and required contact roles before processing.",
          dueDaysOffset: 0,
          sortOrder: 0,
          requiresDocument: false,
          requiresDocumentApproval: false,
          requiresSecondaryApproval: false
        },
        {
          id: "seed-checklist-template-office-default-1",
          checklistGroup: "Compliance",
          title: "Upload contract package",
          description: "Collect and upload the executed contract package into Back Office.",
          dueDaysOffset: 1,
          sortOrder: 1,
          requiresDocument: true,
          requiresDocumentApproval: true,
          requiresSecondaryApproval: false
        },
        {
          id: "seed-checklist-template-office-default-2",
          checklistGroup: "Finance",
          title: "Review finance and commission inputs",
          description: "Confirm referral, finance values, and commission readiness for accounting.",
          dueDaysOffset: 3,
          sortOrder: 2,
          requiresDocument: false,
          requiresDocumentApproval: false,
          requiresSecondaryApproval: false
        }
      ]
    },
    {
      id: "seed-checklist-template-sales",
      name: "Sales transaction checklist",
      description: "Extra sales-side milestones for offer acceptance, contract, and closing prep.",
      transactionType: "sales",
      isActive: true,
      items: [
        {
          id: "seed-checklist-template-sales-0",
          checklistGroup: "Offer",
          title: "Review accepted offer terms",
          description: "Confirm accepted price, closing date, and buyer contact alignment.",
          dueDaysOffset: 0,
          sortOrder: 0,
          requiresDocument: false,
          requiresDocumentApproval: false,
          requiresSecondaryApproval: false
        },
        {
          id: "seed-checklist-template-sales-1",
          checklistGroup: "Compliance",
          title: "Submit signed disclosures for approval",
          description: "Upload disclosures and route them for office review before completion.",
          dueDaysOffset: 2,
          sortOrder: 1,
          requiresDocument: true,
          requiresDocumentApproval: true,
          requiresSecondaryApproval: true
        }
      ]
    },
    {
      id: "seed-checklist-template-rental",
      name: "Rental leasing checklist",
      description: "Standard rental-side checklist for tenant package, approvals, and move-in readiness.",
      transactionType: "rental_leasing",
      isActive: true,
      items: [
        {
          id: "seed-checklist-template-rental-0",
          checklistGroup: "Documents",
          title: "Collect rental application package",
          description: "Upload pay stubs, ID, and tenant application documents.",
          dueDaysOffset: 0,
          sortOrder: 0,
          requiresDocument: true,
          requiresDocumentApproval: true,
          requiresSecondaryApproval: false
        },
        {
          id: "seed-checklist-template-rental-1",
          checklistGroup: "Move-in",
          title: "Confirm move-in logistics",
          description: "Coordinate lease signing and move-in checklist after approval.",
          dueDaysOffset: 5,
          sortOrder: 1,
          requiresDocument: false,
          requiresDocumentApproval: false,
          requiresSecondaryApproval: false
        }
      ]
    }
  ];

  const checklistEditorMembershipId = membershipByEmail.get("naomi@acre.com")?.id ?? membershipByEmail.get("simon@acre.com")?.id ?? null;

  for (const template of seededChecklistTemplates) {
    if (!checklistEditorMembershipId) {
      continue;
    }

    await prisma.checklistTemplate.upsert({
      where: { id: template.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        name: template.name,
        description: template.description,
        transactionType: template.transactionType,
        isActive: template.isActive,
        createdByMembershipId: checklistEditorMembershipId,
        updatedByMembershipId: checklistEditorMembershipId
      },
      create: {
        id: template.id,
        organizationId: organization.id,
        officeId: office.id,
        name: template.name,
        description: template.description,
        transactionType: template.transactionType,
        isActive: template.isActive,
        createdByMembershipId: checklistEditorMembershipId,
        updatedByMembershipId: checklistEditorMembershipId
      }
    });

    await prisma.checklistTemplateItem.deleteMany({
      where: {
        checklistTemplateId: template.id
      }
    });

    await prisma.checklistTemplateItem.createMany({
      data: template.items.map((item) => ({
        id: item.id,
        organizationId: organization.id,
        officeId: office.id,
        checklistTemplateId: template.id,
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
  }

  const seededAgentOnboardingTemplates = [
    {
      id: "seed-agent-template-license",
      title: "Upload license and state ID",
      description: "Provide the current NY license and state ID for compliance review.",
      category: "Compliance",
      dueDaysOffset: 3,
      sortOrder: 0
    },
    {
      id: "seed-agent-template-packet",
      title: "Complete brokerage onboarding packet",
      description: "Review commission setup, office policies, and required agreements.",
      category: "Operations",
      dueDaysOffset: 5,
      sortOrder: 1
    },
    {
      id: "seed-agent-template-training",
      title: "Review transaction workflow basics",
      description: "Walk through tasks, documents, approvals, and finance checkpoints before going live.",
      category: "Training",
      dueDaysOffset: 7,
      sortOrder: 2
    }
  ];

  for (const template of seededAgentOnboardingTemplates) {
    await prisma.agentOnboardingTemplateItem.upsert({
      where: { id: template.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        title: template.title,
        description: template.description,
        category: template.category,
        dueDaysOffset: template.dueDaysOffset,
        sortOrder: template.sortOrder,
        isActive: true
      },
      create: {
        id: template.id,
        organizationId: organization.id,
        officeId: office.id,
        title: template.title,
        description: template.description,
        category: template.category,
        dueDaysOffset: template.dueDaysOffset,
        sortOrder: template.sortOrder,
        isActive: true
      }
    });
  }

  const janeMembership = membershipByEmail.get("jane@acre.com") ?? null;
  const seededAgentOnboardingItems = janeMembership
    ? [
        {
          id: "seed-agent-onboarding-license",
          membershipId: janeMembership.id,
          templateItemId: "seed-agent-template-license",
          title: "Upload license and state ID",
          description: "Provide the current NY license and state ID for compliance review.",
          category: "Compliance",
          dueAt: new Date("2026-03-18T00:00:00.000Z"),
          status: "completed",
          sortOrder: 0,
          completedAt: new Date("2026-03-07T15:00:00.000Z"),
          completedByMembershipId: membershipByEmail.get("naomi@acre.com")?.id ?? null
        },
        {
          id: "seed-agent-onboarding-packet",
          membershipId: janeMembership.id,
          templateItemId: "seed-agent-template-packet",
          title: "Complete brokerage onboarding packet",
          description: "Review commission setup, office policies, and required agreements.",
          category: "Operations",
          dueAt: new Date("2026-03-20T00:00:00.000Z"),
          status: "in_progress",
          sortOrder: 1,
          completedAt: null,
          completedByMembershipId: null
        },
        {
          id: "seed-agent-onboarding-training",
          membershipId: janeMembership.id,
          templateItemId: "seed-agent-template-training",
          title: "Review transaction workflow basics",
          description: "Walk through tasks, documents, approvals, and finance checkpoints before going live.",
          category: "Training",
          dueAt: new Date("2026-03-24T00:00:00.000Z"),
          status: "pending",
          sortOrder: 2,
          completedAt: null,
          completedByMembershipId: null
        }
      ]
    : [];

  for (const item of seededAgentOnboardingItems) {
    await prisma.agentOnboardingItem.upsert({
      where: { id: item.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: item.membershipId,
        templateItemId: item.templateItemId,
        title: item.title,
        description: item.description,
        category: item.category,
        dueAt: item.dueAt,
        status: item.status,
        sortOrder: item.sortOrder,
        completedAt: item.completedAt,
        completedByMembershipId: item.completedByMembershipId
      },
      create: {
        id: item.id,
        organizationId: organization.id,
        officeId: office.id,
        membershipId: item.membershipId,
        templateItemId: item.templateItemId,
        title: item.title,
        description: item.description,
        category: item.category,
        dueAt: item.dueAt,
        status: item.status,
        sortOrder: item.sortOrder,
        completedAt: item.completedAt,
        completedByMembershipId: item.completedByMembershipId
      }
    });
  }

  const seededAgentGoals = [
    {
      id: "seed-agent-goal-jane-annual",
      membershipEmail: "jane@acre.com",
      periodType: "annual",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
      targetTransactionCount: 8,
      targetClosedVolume: "6000000",
      targetOfficeNet: "90000",
      targetAgentNet: "55000",
      notes: "Focus on buyer-side production and clean task compliance."
    },
    {
      id: "seed-agent-goal-simon-quarterly",
      membershipEmail: "simon@acre.com",
      periodType: "quarterly",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-03-31T23:59:59.000Z"),
      targetTransactionCount: 4,
      targetClosedVolume: "3000000",
      targetOfficeNet: "45000",
      targetAgentNet: "20000",
      notes: "Balance office operations leadership with direct production."
    }
  ];

  for (const goal of seededAgentGoals) {
    const membership = membershipByEmail.get(goal.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.agentGoal.upsert({
      where: { id: goal.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        periodType: goal.periodType,
        startsAt: goal.startsAt,
        endsAt: goal.endsAt,
        targetTransactionCount: goal.targetTransactionCount,
        targetClosedVolume: goal.targetClosedVolume,
        targetOfficeNet: goal.targetOfficeNet,
        targetAgentNet: goal.targetAgentNet,
        notes: goal.notes
      },
      create: {
        id: goal.id,
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        periodType: goal.periodType,
        startsAt: goal.startsAt,
        endsAt: goal.endsAt,
        targetTransactionCount: goal.targetTransactionCount,
        targetClosedVolume: goal.targetClosedVolume,
        targetOfficeNet: goal.targetOfficeNet,
        targetAgentNet: goal.targetAgentNet,
        notes: goal.notes
      }
    });
  }

  const seededTransactions = [
    {
      id: "seed-tx-600-frank",
      ownerEmail: "simon@acre.com",
      type: "sales",
      status: "active",
      representing: "buyer",
      title: "600 Frank E Rodgers Blvd S",
      address: "600 Frank E Rodgers Blvd S",
      city: "Harrison",
      state: "NJ",
      zipCode: "07029",
      price: "2470",
      importantDate: null,
      grossCommission: "2470",
      referralFee: "0",
      officeNet: "1800",
      agentNet: "670",
      financeNotes: "Seeded lease-side commission snapshot."
    },
    {
      id: "seed-tx-70-christopher",
      ownerEmail: "naomi@acre.com",
      type: "sales",
      status: "active",
      representing: "buyer",
      title: "70 Christopher Columbus Dr",
      address: "70 Christopher Columbus Dr",
      city: "Jersey City",
      state: "NJ",
      zipCode: "07302",
      price: "3585",
      importantDate: null,
      closingDate: new Date("2026-03-13T00:00:00.000Z"),
      grossCommission: "3585",
      referralFee: "0",
      officeNet: "2500",
      agentNet: "1085",
      financeNotes: "Seeded rental commission snapshot."
    },
    {
      id: "seed-tx-3820-parson",
      ownerEmail: "naomi@acre.com",
      type: "sales_listing",
      status: "active",
      representing: "seller",
      title: "3820 Parson Blvd",
      address: "3820 Parson Blvd",
      city: "Flushing",
      state: "NY",
      zipCode: "11354",
      price: "625000",
      importantDate: new Date("2026-12-26T00:00:00.000Z"),
      grossCommission: "18750",
      referralFee: "2500",
      officeNet: "10000",
      agentNet: "6250",
      financeNotes: "Referral split pending final settlement."
    },
    {
      id: "seed-tx-graham-court",
      ownerEmail: "jane@acre.com",
      type: "sales",
      status: "opportunity",
      representing: "buyer",
      title: "Graham Court 4F",
      address: "Graham Court 4F",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11206",
      price: "925000",
      importantDate: null,
      grossCommission: null,
      referralFee: null,
      officeNet: null,
      agentNet: null,
      financeNotes: null
    },
    {
      id: "seed-tx-45-10-court-square",
      ownerEmail: "simon@acre.com",
      type: "commercial_sales",
      status: "pending",
      representing: "seller",
      title: "45-10 Court Square W",
      address: "45-10 Court Square W",
      city: "Long Island City",
      state: "NY",
      zipCode: "11101",
      price: "0",
      importantDate: new Date("2026-04-15T00:00:00.000Z"),
      companyReferral: true,
      companyReferralEmployeeName: "Acre小助手",
      grossCommission: "32000",
      referralFee: "3200",
      officeNet: "18000",
      agentNet: "10800",
      financeNotes: "Company referral 10% applied in seed data."
    }
  ];

  for (const transaction of seededTransactions) {
    const ownerMembership = membershipByEmail.get(transaction.ownerEmail) ?? null;

    await prisma.transaction.upsert({
      where: { id: transaction.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        ownerMembershipId: ownerMembership?.id ?? null,
        type: transaction.type,
        status: transaction.status,
        representing: transaction.representing,
        title: transaction.title,
        address: transaction.address,
        city: transaction.city,
        state: transaction.state,
        zipCode: transaction.zipCode,
        askingPrice: transaction.price,
        purchasedPrice: transaction.price,
        price: transaction.price,
        importantDate: transaction.importantDate,
        closingDate: transaction.closingDate ?? null,
        grossCommission: transaction.grossCommission,
        referralFee: transaction.referralFee,
        officeNet: transaction.officeNet,
        agentNet: transaction.agentNet,
        financeNotes: transaction.financeNotes ?? null,
        companyReferral: transaction.companyReferral ?? false,
        companyReferralEmployeeName: transaction.companyReferralEmployeeName ?? null,
        additionalFields: { seeded: true }
      },
      create: {
        id: transaction.id,
        organizationId: organization.id,
        officeId: office.id,
        ownerMembershipId: ownerMembership?.id ?? null,
        type: transaction.type,
        status: transaction.status,
        representing: transaction.representing,
        title: transaction.title,
        address: transaction.address,
        city: transaction.city,
        state: transaction.state,
        zipCode: transaction.zipCode,
        askingPrice: transaction.price,
        purchasedPrice: transaction.price,
        price: transaction.price,
        importantDate: transaction.importantDate,
        closingDate: transaction.closingDate ?? null,
        grossCommission: transaction.grossCommission,
        referralFee: transaction.referralFee,
        officeNet: transaction.officeNet,
        agentNet: transaction.agentNet,
        financeNotes: transaction.financeNotes ?? null,
        companyReferral: transaction.companyReferral ?? false,
        companyReferralEmployeeName: transaction.companyReferralEmployeeName ?? null,
        additionalFields: { seeded: true }
      }
    });
  }

  const seededClients = [
    {
      id: "seed-client-evelyn",
      ownerEmail: "jane@acre.com",
      fullName: "Evelyn Zhao",
      email: "evelyn@example.com",
      phone: "917-555-0110",
      contactType: "Buyer",
      source: "WeChat OCR import",
      stage: "Warm",
      intent: "Investor",
      budgetMin: "850000",
      budgetMax: "1050000",
      preferredAreas: ["Long Island City", "Astoria"],
      notes: "Interested in LIC investor inventory.",
      lastContactAt: new Date("2026-03-06T15:00:00.000Z"),
      nextFollowUpAt: new Date("2026-03-10T22:00:00.000Z")
    },
    {
      id: "seed-client-daniel",
      ownerEmail: "simon@acre.com",
      fullName: "Daniel Morgan",
      email: "daniel@example.com",
      phone: "646-555-0144",
      contactType: "Buyer",
      source: "Website inquiry",
      stage: "Tour booked",
      intent: "End-user",
      budgetMin: "1200000",
      budgetMax: "1500000",
      preferredAreas: ["Brooklyn Heights", "Downtown Brooklyn"],
      notes: "Saturday tour booked for Downtown Brooklyn.",
      lastContactAt: new Date("2026-03-08T18:30:00.000Z"),
      nextFollowUpAt: new Date("2026-03-15T14:00:00.000Z")
    },
    {
      id: "seed-client-iris",
      ownerEmail: "naomi@acre.com",
      fullName: "Iris Chen",
      email: "iris@example.com",
      phone: "718-555-0138",
      contactType: "Tenant",
      source: "Agent manual entry",
      stage: "Nurture",
      intent: "Rental",
      budgetMin: "4800",
      budgetMax: "4800",
      preferredAreas: ["Midtown", "Long Island City"],
      notes: "Wants a spring rental move-in.",
      lastContactAt: new Date("2026-03-03T16:00:00.000Z"),
      nextFollowUpAt: new Date("2026-03-12T15:00:00.000Z")
    }
  ];

  const clientById = new Map();

  for (const client of seededClients) {
    const ownerMembership = membershipByEmail.get(client.ownerEmail) ?? null;

    const savedClient = await prisma.client.upsert({
      where: { id: client.id },
      update: {
        organizationId: organization.id,
        ownerMembershipId: ownerMembership?.id ?? null,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
        contactType: client.contactType,
        source: client.source,
        stage: client.stage,
        intent: client.intent,
        budgetMin: client.budgetMin,
        budgetMax: client.budgetMax,
        preferredAreas: client.preferredAreas,
        notes: client.notes,
        lastContactAt: client.lastContactAt,
        nextFollowUpAt: client.nextFollowUpAt
      },
      create: {
        id: client.id,
        organizationId: organization.id,
        ownerMembershipId: ownerMembership?.id ?? null,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
        contactType: client.contactType,
        source: client.source,
        stage: client.stage,
        intent: client.intent,
        budgetMin: client.budgetMin,
        budgetMax: client.budgetMax,
        preferredAreas: client.preferredAreas,
        notes: client.notes,
        lastContactAt: client.lastContactAt,
        nextFollowUpAt: client.nextFollowUpAt
      }
    });

    clientById.set(client.id, savedClient);
  }

  const seededTasks = [
    {
      id: "seed-task-evelyn",
      clientId: "seed-client-evelyn",
      assigneeEmail: "jane@acre.com",
      title: "Follow up on LIC investor inventory",
      status: "queued",
      dueAt: new Date("2026-03-09T22:00:00.000Z")
    },
    {
      id: "seed-task-daniel",
      clientId: "seed-client-daniel",
      assigneeEmail: "simon@acre.com",
      title: "Confirm Saturday tour logistics",
      status: "in_progress",
      dueAt: new Date("2026-03-12T16:00:00.000Z")
    }
  ];

  for (const task of seededTasks) {
    const assigneeMembership = membershipByEmail.get(task.assigneeEmail) ?? null;
    const client = clientById.get(task.clientId) ?? null;

    await prisma.followUpTask.upsert({
      where: { id: task.id },
      update: {
        organizationId: organization.id,
        clientId: client?.id ?? null,
        assigneeMemberId: assigneeMembership?.id ?? null,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt,
        metadata: null
      },
      create: {
        id: task.id,
        organizationId: organization.id,
        clientId: client?.id ?? null,
        assigneeMemberId: assigneeMembership?.id ?? null,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt,
        metadata: null
      }
    });
  }

  const seededEvents = [
    {
      id: "seed-event-weekly-meeting",
      createdByEmail: "simon@acre.com",
      title: "Acre Weekly Meeting",
      description: "Weekly office ops sync covering pending transactions and marketing priorities.",
      visibility: "office_only",
      startsAt: new Date("2026-03-12T15:00:00.000Z"),
      endsAt: new Date("2026-03-12T15:30:00.000Z"),
      location: "Zoom",
      meetingUrl: "https://us06web.zoom.us/j/88901672776",
      officeScoped: true
    },
    {
      id: "seed-event-contract-workshop",
      createdByEmail: "naomi@acre.com",
      title: "Contract review workshop",
      description: "Walk through current pending deals and contract pain points with the office team.",
      visibility: "all_agents",
      startsAt: new Date("2026-03-14T18:00:00.000Z"),
      endsAt: new Date("2026-03-14T19:00:00.000Z"),
      location: "45-10 Court Square W, LIC",
      meetingUrl: null,
      officeScoped: false
    }
  ];

  for (const event of seededEvents) {
    const createdByMembership = membershipByEmail.get(event.createdByEmail) ?? null;

    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        organizationId: organization.id,
        officeId: event.officeScoped ? office.id : null,
        createdByMemberId: createdByMembership?.id ?? null,
        title: event.title,
        description: event.description,
        visibility: event.visibility,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        meetingUrl: event.meetingUrl
      },
      create: {
        id: event.id,
        organizationId: organization.id,
        officeId: event.officeScoped ? office.id : null,
        createdByMemberId: createdByMembership?.id ?? null,
        title: event.title,
        description: event.description,
        visibility: event.visibility,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        meetingUrl: event.meetingUrl
      }
    });
  }

  const seededEventRsvps = [
    {
      eventId: "seed-event-weekly-meeting",
      membershipEmail: "jane@acre.com",
      status: "going"
    },
    {
      eventId: "seed-event-weekly-meeting",
      membershipEmail: "naomi@acre.com",
      status: "going"
    },
    {
      eventId: "seed-event-contract-workshop",
      membershipEmail: "simon@acre.com",
      status: "maybe"
    }
  ];

  for (const rsvp of seededEventRsvps) {
    const membership = membershipByEmail.get(rsvp.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.eventRsvp.upsert({
      where: {
        eventId_membershipId: {
          eventId: rsvp.eventId,
          membershipId: membership.id
        }
      },
      update: {
        status: rsvp.status
      },
      create: {
        eventId: rsvp.eventId,
        membershipId: membership.id,
        status: rsvp.status
      }
    });
  }

  const seededNotifications = [
    {
      id: "seed-notification-followup-evelyn",
      membershipEmail: "jane@acre.com",
      followUpTaskId: "seed-task-evelyn",
      eventId: null,
      type: "follow_up",
      title: "Follow up due for Evelyn Zhao",
      body: "LIC investor follow-up is due today. Review the contact note before calling.",
      actionUrl: "/office/contacts/seed-client-evelyn",
      readAt: null
    },
    {
      id: "seed-notification-weekly-meeting",
      membershipEmail: null,
      followUpTaskId: null,
      eventId: "seed-event-weekly-meeting",
      type: "event",
      title: "Weekly office meeting this Thursday",
      body: "Acre Weekly Meeting starts at 10:00 AM. Review pending transaction blockers before joining.",
      actionUrl: "/office/activity",
      readAt: null
    },
    {
      id: "seed-notification-contract-workshop",
      membershipEmail: "simon@acre.com",
      followUpTaskId: null,
      eventId: "seed-event-contract-workshop",
      type: "system",
      title: "Contract review workshop reminder",
      body: "Bring open pending deals and current finance questions to the workshop.",
      actionUrl: "/office/reports",
      readAt: new Date("2026-03-09T18:00:00.000Z")
    }
  ];

  for (const notification of seededNotifications) {
    const membership = notification.membershipEmail ? membershipByEmail.get(notification.membershipEmail) ?? null : null;

    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {
        organizationId: organization.id,
        membershipId: membership?.id ?? null,
        followUpTaskId: notification.followUpTaskId,
        eventId: notification.eventId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        readAt: notification.readAt
      },
      create: {
        id: notification.id,
        organizationId: organization.id,
        membershipId: membership?.id ?? null,
        followUpTaskId: notification.followUpTaskId,
        eventId: notification.eventId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        readAt: notification.readAt
      }
    });
  }

  await prisma.transaction.update({
    where: { id: "seed-tx-graham-court" },
    data: {
      primaryClientId: "seed-client-evelyn"
    }
  });

  await prisma.transactionContact.updateMany({
    where: {
      transactionId: "seed-tx-graham-court",
      NOT: {
        clientId: "seed-client-evelyn"
      }
    },
    data: {
      isPrimary: false
    }
  });

  await prisma.transaction.update({
    where: { id: "seed-tx-45-10-court-square" },
    data: {
      primaryClientId: "seed-client-daniel"
    }
  });

  await prisma.transactionContact.updateMany({
    where: {
      transactionId: "seed-tx-45-10-court-square",
      NOT: {
        clientId: "seed-client-daniel"
      }
    },
    data: {
      isPrimary: false
    }
  });

  await prisma.transactionContact.upsert({
    where: {
      transactionId_clientId: {
        transactionId: "seed-tx-graham-court",
        clientId: "seed-client-evelyn"
      }
    },
    update: {
      organizationId: organization.id,
      role: "buyer",
      isPrimary: true,
      notes: "Seeded primary client link"
    },
    create: {
      id: "seed-transaction-contact-evelyn",
      organizationId: organization.id,
      transactionId: "seed-tx-graham-court",
      clientId: "seed-client-evelyn",
      role: "buyer",
      isPrimary: true,
      notes: "Seeded primary client link"
    }
  });

  await prisma.transactionContact.upsert({
    where: {
      transactionId_clientId: {
        transactionId: "seed-tx-45-10-court-square",
        clientId: "seed-client-daniel"
      }
    },
    update: {
      organizationId: organization.id,
      role: "tenant",
      isPrimary: true,
      notes: "Seeded primary client link"
    },
    create: {
      id: "seed-transaction-contact-daniel",
      organizationId: organization.id,
      transactionId: "seed-tx-45-10-court-square",
      clientId: "seed-client-daniel",
      role: "tenant",
      isPrimary: true,
      notes: "Seeded primary client link"
    }
  });

  const seededTransactionTasks = [
    {
      id: "seed-transaction-task-graham-contract",
      transactionId: "seed-tx-graham-court",
      checklistGroup: "Contract",
      title: "Collect signed buyer agreement",
      description: "Confirm executed contract PDF is available from the buyer side.",
      assigneeEmail: "jane@acre.com",
      dueAt: new Date("2026-03-08T16:00:00.000Z"),
      status: "review_requested",
      requiresDocument: true,
      requiresDocumentApproval: true,
      requiresSecondaryApproval: false,
      reviewStatus: "review_requested",
      complianceStatus: "in_review",
      completedAt: null,
      completedByEmail: null,
      submittedForReviewAt: new Date("2026-03-07T15:30:00.000Z"),
      firstApprovedAt: null,
      firstApprovedByEmail: null,
      secondApprovedAt: null,
      secondApprovedByEmail: null,
      rejectedAt: null,
      rejectedByEmail: null,
      reopenedAt: null,
      sortOrder: 0
    },
    {
      id: "seed-transaction-task-graham-intro",
      transactionId: "seed-tx-graham-court",
      checklistGroup: "Client care",
      title: "Send attorney introduction",
      description: "Email the standard attorney introduction once offer terms are confirmed.",
      assigneeEmail: "jane@acre.com",
      dueAt: new Date("2026-03-16T15:00:00.000Z"),
      status: "in_progress",
      requiresDocument: false,
      requiresDocumentApproval: false,
      requiresSecondaryApproval: false,
      reviewStatus: "not_required",
      complianceStatus: "not_applicable",
      completedAt: null,
      completedByEmail: null,
      submittedForReviewAt: null,
      firstApprovedAt: null,
      firstApprovedByEmail: null,
      secondApprovedAt: null,
      secondApprovedByEmail: null,
      rejectedAt: null,
      rejectedByEmail: null,
      reopenedAt: null,
      sortOrder: 1
    },
    {
      id: "seed-transaction-task-court-square-invoice",
      transactionId: "seed-tx-45-10-court-square",
      checklistGroup: "Finance",
      title: "Upload vendor invoice package",
      description: "Prepare the pending invoice package for vendor review.",
      assigneeEmail: "simon@acre.com",
      dueAt: new Date("2026-03-18T17:00:00.000Z"),
      status: "completed",
      requiresDocument: true,
      requiresDocumentApproval: true,
      requiresSecondaryApproval: true,
      reviewStatus: "approved",
      complianceStatus: "approved",
      completedAt: new Date("2026-03-09T16:30:00.000Z"),
      completedByEmail: "simon@acre.com",
      submittedForReviewAt: new Date("2026-03-08T19:00:00.000Z"),
      firstApprovedAt: new Date("2026-03-09T13:00:00.000Z"),
      firstApprovedByEmail: "naomi@acre.com",
      secondApprovedAt: new Date("2026-03-09T16:00:00.000Z"),
      secondApprovedByEmail: "simon@acre.com",
      rejectedAt: null,
      rejectedByEmail: null,
      reopenedAt: null,
      sortOrder: 0
    }
  ];

  for (const task of seededTransactionTasks) {
    const assigneeMembership = membershipByEmail.get(task.assigneeEmail) ?? null;
    const completedByMembership = task.completedByEmail ? membershipByEmail.get(task.completedByEmail) ?? null : null;
    const firstApprovedByMembership = task.firstApprovedByEmail ? membershipByEmail.get(task.firstApprovedByEmail) ?? null : null;
    const secondApprovedByMembership = task.secondApprovedByEmail ? membershipByEmail.get(task.secondApprovedByEmail) ?? null : null;
    const rejectedByMembership = task.rejectedByEmail ? membershipByEmail.get(task.rejectedByEmail) ?? null : null;

    await prisma.transactionTask.upsert({
      where: { id: task.id },
      update: {
        organizationId: organization.id,
        transactionId: task.transactionId,
        checklistGroup: task.checklistGroup,
        title: task.title,
        description: task.description,
        assigneeMembershipId: assigneeMembership?.id ?? null,
        dueAt: task.dueAt,
        status: task.status,
        requiresDocument: task.requiresDocument,
        requiresDocumentApproval: task.requiresDocumentApproval,
        requiresSecondaryApproval: task.requiresSecondaryApproval,
        reviewStatus: task.reviewStatus,
        complianceStatus: task.complianceStatus,
        completedAt: task.completedAt,
        completedByMembershipId: completedByMembership?.id ?? null,
        submittedForReviewAt: task.submittedForReviewAt,
        firstApprovedAt: task.firstApprovedAt,
        firstApprovedByMembershipId: firstApprovedByMembership?.id ?? null,
        secondApprovedAt: task.secondApprovedAt,
        secondApprovedByMembershipId: secondApprovedByMembership?.id ?? null,
        rejectedAt: task.rejectedAt,
        rejectedByMembershipId: rejectedByMembership?.id ?? null,
        reopenedAt: task.reopenedAt,
        sortOrder: task.sortOrder
      },
      create: {
        id: task.id,
        organizationId: organization.id,
        transactionId: task.transactionId,
        checklistGroup: task.checklistGroup,
        title: task.title,
        description: task.description,
        assigneeMembershipId: assigneeMembership?.id ?? null,
        dueAt: task.dueAt,
        status: task.status,
        requiresDocument: task.requiresDocument,
        requiresDocumentApproval: task.requiresDocumentApproval,
        requiresSecondaryApproval: task.requiresSecondaryApproval,
        reviewStatus: task.reviewStatus,
        complianceStatus: task.complianceStatus,
        completedAt: task.completedAt,
        completedByMembershipId: completedByMembership?.id ?? null,
        submittedForReviewAt: task.submittedForReviewAt,
        firstApprovedAt: task.firstApprovedAt,
        firstApprovedByMembershipId: firstApprovedByMembership?.id ?? null,
        secondApprovedAt: task.secondApprovedAt,
        secondApprovedByMembershipId: secondApprovedByMembership?.id ?? null,
        rejectedAt: task.rejectedAt,
        rejectedByMembershipId: rejectedByMembership?.id ?? null,
        reopenedAt: task.reopenedAt,
        sortOrder: task.sortOrder
      }
    });
  }

  const seededOffers = [
    {
      id: "seed-offer-graham-evelyn",
      transactionId: "seed-tx-graham-court",
      createdByEmail: "jane@acre.com",
      title: "Offer from Evelyn Zhao",
      offeringPartyName: "Evelyn Zhao",
      buyerName: "Evelyn Zhao",
      status: "received",
      price: "910000",
      earnestMoneyAmount: "45000",
      financingType: "Conventional",
      closingDateOffered: new Date("2026-04-01T00:00:00.000Z"),
      expirationAt: new Date("2026-03-15T20:00:00.000Z"),
      isPrimaryOffer: false,
      notes: "Buyer agent delivered signed packet and pre-approval letter.",
      submittedAt: new Date("2026-03-11T13:30:00.000Z"),
      acceptedAt: null,
      rejectedAt: null,
      withdrawnAt: null
    },
    {
      id: "seed-offer-graham-countered",
      transactionId: "seed-tx-graham-court",
      createdByEmail: "jane@acre.com",
      title: "Countered cash offer",
      offeringPartyName: "Brookline Holdings LLC",
      buyerName: "Brookline Holdings LLC",
      status: "countered",
      price: "925000",
      earnestMoneyAmount: "50000",
      financingType: "Cash",
      closingDateOffered: new Date("2026-03-28T00:00:00.000Z"),
      expirationAt: new Date("2026-03-13T19:00:00.000Z"),
      isPrimaryOffer: true,
      notes: "Seller asked for faster close and shorter contingency window.",
      submittedAt: new Date("2026-03-11T16:00:00.000Z"),
      acceptedAt: null,
      rejectedAt: null,
      withdrawnAt: null
    }
  ];

  for (const offer of seededOffers) {
    const createdByMembership = membershipByEmail.get(offer.createdByEmail) ?? null;

    await prisma.offer.upsert({
      where: { id: offer.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: offer.transactionId,
        createdByMembershipId: createdByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        title: offer.title,
        offeringPartyName: offer.offeringPartyName,
        buyerName: offer.buyerName,
        status: offer.status,
        price: offer.price,
        earnestMoneyAmount: offer.earnestMoneyAmount,
        financingType: offer.financingType,
        closingDateOffered: offer.closingDateOffered,
        expirationAt: offer.expirationAt,
        isPrimaryOffer: offer.isPrimaryOffer,
        notes: offer.notes,
        submittedAt: offer.submittedAt,
        acceptedAt: offer.acceptedAt,
        rejectedAt: offer.rejectedAt,
        withdrawnAt: offer.withdrawnAt
      },
      create: {
        id: offer.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: offer.transactionId,
        createdByMembershipId: createdByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        title: offer.title,
        offeringPartyName: offer.offeringPartyName,
        buyerName: offer.buyerName,
        status: offer.status,
        price: offer.price,
        earnestMoneyAmount: offer.earnestMoneyAmount,
        financingType: offer.financingType,
        closingDateOffered: offer.closingDateOffered,
        expirationAt: offer.expirationAt,
        isPrimaryOffer: offer.isPrimaryOffer,
        notes: offer.notes,
        submittedAt: offer.submittedAt,
        acceptedAt: offer.acceptedAt,
        rejectedAt: offer.rejectedAt,
        withdrawnAt: offer.withdrawnAt
      }
    });
  }

  const seededOfferComments = [
    {
      id: "seed-offer-comment-graham-1",
      offerId: "seed-offer-graham-countered",
      membershipEmail: "jane@acre.com",
      body: "Counter package is strongest on price, but seller wants a faster close.",
      createdAt: new Date("2026-03-11T16:30:00.000Z")
    },
    {
      id: "seed-offer-comment-graham-2",
      offerId: "seed-offer-graham-countered",
      membershipEmail: "simon@acre.com",
      body: "Keep an eye on expiration. Ask for proof of funds before accepting.",
      createdAt: new Date("2026-03-11T17:00:00.000Z")
    }
  ];

  for (const comment of seededOfferComments) {
    const membership = membershipByEmail.get(comment.membershipEmail) ?? null;

    await prisma.offerComment.upsert({
      where: { id: comment.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        offerId: comment.offerId,
        membershipId: membership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        body: comment.body,
        createdAt: comment.createdAt
      },
      create: {
        id: comment.id,
        organizationId: organization.id,
        officeId: office.id,
        offerId: comment.offerId,
        membershipId: membership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        body: comment.body,
        createdAt: comment.createdAt
      }
    });
  }

  const seededFormTemplates = [
    {
      id: "seed-form-template-buyer-agreement",
      key: "buyer-agreement-packet",
      name: "Buyer agreement packet",
      description: "Basic buyer-side agreement packet merged from transaction and contact data.",
      documentType: "Buyer agreement",
      mergeFields: [
        "transaction_title",
        "transaction_address",
        "transaction_city",
        "transaction_state",
        "transaction_zip_code",
        "transaction_type",
        "transaction_status",
        "transaction_representing",
        "transaction_owner",
        "primary_contact_name",
        "primary_contact_email",
        "primary_contact_phone",
        "finance_gross_commission",
        "finance_office_net"
      ]
    },
    {
      id: "seed-form-template-emd-receipt",
      key: "emd-receipt",
      name: "Earnest money receipt",
      description: "Internal receipt used to document EMD expectations and receipt details.",
      documentType: "Earnest money receipt",
      mergeFields: [
        "transaction_title",
        "transaction_address",
        "transaction_status",
        "finance_office_net",
        "closing_date"
      ]
    }
  ];

  for (const template of seededFormTemplates) {
    await prisma.formTemplate.upsert({
      where: { key: template.key },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        mergeFields: template.mergeFields,
        isSystem: true,
        isActive: true
      },
      create: {
        id: template.id,
        organizationId: organization.id,
        officeId: office.id,
        key: template.key,
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        mergeFields: template.mergeFields,
        isSystem: true,
        isActive: true
      }
    });
  }

  const storedSeedFiles = {
    grahamContractUpload: await writeSeedStoredDocument({
      organizationId: organization.id,
      transactionId: "seed-tx-graham-court",
      fileName: "graham-court-buyer-agreement-upload.txt",
      content: [
        "Graham Court 4F buyer agreement upload",
        "Uploaded by Jane Wu for contract review.",
        "Linked task: Collect signed buyer agreement."
      ].join("\n")
    }),
    grahamUnsortedEmail: await writeSeedStoredDocument({
      organizationId: organization.id,
      transactionId: "seed-tx-graham-court",
      fileName: "graham-court-unsorted-email-pdf.txt",
      content: [
        "Loose PDF from email import.",
        "This file is intentionally unsorted so the transaction workflow has something to classify."
      ].join("\n")
    }),
    grahamGeneratedPacket: await writeSeedStoredDocument({
      organizationId: organization.id,
      transactionId: "seed-tx-graham-court",
      fileName: "graham-court-buyer-packet.json",
      content: {
        template: "Buyer agreement packet",
        transaction: "Graham Court 4F",
        primaryContact: "Evelyn Zhao",
        owner: "Jane Wu"
      }
    }),
    courtSquareInvoicePackage: await writeSeedStoredDocument({
      organizationId: organization.id,
      transactionId: "seed-tx-45-10-court-square",
      fileName: "court-square-vendor-invoice-package.txt",
      content: [
        "Vendor invoice package",
        "Prepared for secondary approval in the finance checklist."
      ].join("\n")
    })
  };

  const storedSeedLibraryFiles = {
    userManual: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: null,
      fileName: "acre-agent-os-user-manual.pdf",
      content: buildMinimalPdf({
        title: "Acre Agent OS User Manual",
        lines: [
          "Internal reference for the Office / Back Office workspace.",
          "Covers navigation, daily operating flows, and audit expectations.",
          "Use this as the first-stop guide for new office users."
        ]
      })
    }),
    financialGuide: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: null,
      fileName: "financial-document-controls.pdf",
      content: buildMinimalPdf({
        title: "Financial Document Controls",
        lines: [
          "Checklist for invoices, brokerage receipts, and reimbursement packets.",
          "Store statement-ready PDFs with clean naming and office scoping.",
          "Accounting review remains manager-driven in the MVP."
        ]
      })
    }),
    legalGuide: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: null,
      fileName: "legal-compliance-reference.pdf",
      content: buildMinimalPdf({
        title: "Legal and Compliance Reference",
        lines: [
          "Quick handbook for disclosures, fair housing reminders, and audit prep.",
          "Pair this library copy with transaction-level compliance tasks.",
          "Update whenever office policy or state guidance changes."
        ]
      })
    }),
    onboardingGuide: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: null,
      fileName: "new-agent-onboarding-packet.pdf",
      content: buildMinimalPdf({
        title: "New Agent Onboarding Packet",
        lines: [
          "Day 1 through Day 14 checklist for office onboarding.",
          "Includes account setup, compliance reading, and training milestones.",
          "Managers should assign related onboarding items separately."
        ]
      })
    }),
    offerPlaybook: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: office.id,
      fileName: "offer-review-playbook.pdf",
      content: buildMinimalPdf({
        title: "Offer Review Playbook",
        lines: [
          "Office-only playbook for structuring and comparing offer packages.",
          "Use with transaction offers, supporting documents, and approval queues.",
          "Keep office-specific negotiation notes here, not in the public site."
        ]
      })
    }),
    benefitsReference: await writeSeedStoredLibraryDocument({
      organizationId: organization.id,
      officeId: null,
      fileName: "company-benefits-reference.pdf",
      content: buildMinimalPdf({
        title: "Company Benefits Quick Reference",
        lines: [
          "Unfiled sample document for root-level library behavior.",
          "Useful for testing search, preview, and download flows.",
          "Move into a folder once the final category is agreed."
        ]
      })
    })
  };

  const seededLibraryFolders = [
    {
      id: "seed-library-folder-manuals",
      officeId: null,
      parentFolderId: null,
      createdByEmail: "naomi@acre.com",
      name: "User Manual Documents",
      description: "Core company manuals and how-to PDFs for office operations.",
      sortOrder: 0
    },
    {
      id: "seed-library-folder-financial",
      officeId: null,
      parentFolderId: null,
      createdByEmail: "simon@acre.com",
      name: "Financial Documents",
      description: "Accounting policies, internal financial references, and support packets.",
      sortOrder: 1
    },
    {
      id: "seed-library-folder-legal",
      officeId: null,
      parentFolderId: null,
      createdByEmail: "naomi@acre.com",
      name: "Legal Documents",
      description: "Compliance and legal guidance used by the back office.",
      sortOrder: 2
    },
    {
      id: "seed-library-folder-onboarding",
      officeId: null,
      parentFolderId: null,
      createdByEmail: "naomi@acre.com",
      name: "Onboarding Documents",
      description: "Internal onboarding references and training packets.",
      sortOrder: 3
    },
    {
      id: "seed-library-folder-onboarding-packets",
      officeId: null,
      parentFolderId: "seed-library-folder-onboarding",
      createdByEmail: "naomi@acre.com",
      name: "Starter Packets",
      description: "Nested onboarding packet examples for new hires and transfers.",
      sortOrder: 0
    },
    {
      id: "seed-library-folder-playbooks",
      officeId: office.id,
      parentFolderId: null,
      createdByEmail: "simon@acre.com",
      name: "Templates and Playbooks",
      description: "Office-only playbooks, quick-start packets, and reusable internal guides.",
      sortOrder: 4
    }
  ];

  for (const folder of seededLibraryFolders) {
    const createdByMembership = folder.createdByEmail ? membershipByEmail.get(folder.createdByEmail) ?? null : null;

    await prisma.libraryFolder.upsert({
      where: { id: folder.id },
      update: {
        organizationId: organization.id,
        officeId: folder.officeId,
        parentFolderId: folder.parentFolderId,
        createdByMembershipId: createdByMembership?.id ?? null,
        name: folder.name,
        description: folder.description,
        sortOrder: folder.sortOrder,
        isActive: true
      },
      create: {
        id: folder.id,
        organizationId: organization.id,
        officeId: folder.officeId,
        parentFolderId: folder.parentFolderId,
        createdByMembershipId: createdByMembership?.id ?? null,
        name: folder.name,
        description: folder.description,
        sortOrder: folder.sortOrder,
        isActive: true
      }
    });
  }

  const seededLibraryDocuments = [
    {
      id: "seed-library-doc-user-manual",
      officeId: null,
      folderId: "seed-library-folder-manuals",
      uploadedByEmail: "naomi@acre.com",
      title: "Acre Agent OS User Manual",
      originalFileName: "acre-agent-os-user-manual.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.userManual.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.userManual.storageKey,
      pageCount: 1,
      summary: "Primary internal user manual for the company back-office workspace.",
      tags: ["manual", "office", "training"],
      category: "User Manual Documents",
      visibility: "company_wide",
      sortOrder: 0
    },
    {
      id: "seed-library-doc-financial-guide",
      officeId: null,
      folderId: "seed-library-folder-financial",
      uploadedByEmail: "simon@acre.com",
      title: "Financial Document Controls",
      originalFileName: "financial-document-controls.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.financialGuide.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.financialGuide.storageKey,
      pageCount: 1,
      summary: "Reference guide for internal accounting and finance document handling.",
      tags: ["finance", "accounting", "policy"],
      category: "Financial Documents",
      visibility: "company_wide",
      sortOrder: 1
    },
    {
      id: "seed-library-doc-legal-guide",
      officeId: null,
      folderId: "seed-library-folder-legal",
      uploadedByEmail: "naomi@acre.com",
      title: "Legal and Compliance Reference",
      originalFileName: "legal-compliance-reference.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.legalGuide.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.legalGuide.storageKey,
      pageCount: 1,
      summary: "Internal legal and compliance quick-reference used by office operations.",
      tags: ["legal", "compliance", "policy"],
      category: "Legal Documents",
      visibility: "company_wide",
      sortOrder: 2
    },
    {
      id: "seed-library-doc-onboarding-packet",
      officeId: null,
      folderId: "seed-library-folder-onboarding-packets",
      uploadedByEmail: "naomi@acre.com",
      title: "New Agent Onboarding Packet",
      originalFileName: "new-agent-onboarding-packet.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.onboardingGuide.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.onboardingGuide.storageKey,
      pageCount: 1,
      summary: "Starter onboarding packet for first-week office setup and training.",
      tags: ["onboarding", "training", "packet"],
      category: "Onboarding Documents",
      visibility: "company_wide",
      sortOrder: 3
    },
    {
      id: "seed-library-doc-offer-playbook",
      officeId: office.id,
      folderId: "seed-library-folder-playbooks",
      uploadedByEmail: "simon@acre.com",
      title: "Offer Review Playbook",
      originalFileName: "offer-review-playbook.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.offerPlaybook.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.offerPlaybook.storageKey,
      pageCount: 1,
      summary: "Office-only playbook for document-heavy offer review and negotiation prep.",
      tags: ["playbook", "offers", "office-only"],
      category: "Templates and Playbooks",
      visibility: "office_only",
      sortOrder: 4
    },
    {
      id: "seed-library-doc-benefits-reference",
      officeId: null,
      folderId: null,
      uploadedByEmail: "naomi@acre.com",
      title: "Company Benefits Quick Reference",
      originalFileName: "company-benefits-reference.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: storedSeedLibraryFiles.benefitsReference.fileSizeBytes,
      storageKey: storedSeedLibraryFiles.benefitsReference.storageKey,
      pageCount: 1,
      summary: "Unfiled sample reference used to verify root-level library document behavior.",
      tags: ["reference", "benefits", "unfiled"],
      category: "General",
      visibility: "company_wide",
      sortOrder: 5
    }
  ];

  for (const document of seededLibraryDocuments) {
    const uploadedByMembership = document.uploadedByEmail ? membershipByEmail.get(document.uploadedByEmail) ?? null : null;

    await prisma.libraryDocument.upsert({
      where: { id: document.id },
      update: {
        organizationId: organization.id,
        officeId: document.officeId,
        folderId: document.folderId,
        uploadedByMembershipId: uploadedByMembership?.id ?? null,
        title: document.title,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        storageKey: document.storageKey,
        pageCount: document.pageCount,
        summary: document.summary,
        tags: document.tags,
        category: document.category,
        visibility: document.visibility,
        sortOrder: document.sortOrder
      },
      create: {
        id: document.id,
        organizationId: organization.id,
        officeId: document.officeId,
        folderId: document.folderId,
        uploadedByMembershipId: uploadedByMembership?.id ?? null,
        title: document.title,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        storageKey: document.storageKey,
        pageCount: document.pageCount,
        summary: document.summary,
        tags: document.tags,
        category: document.category,
        visibility: document.visibility,
        sortOrder: document.sortOrder
      }
    });
  }

  const seededTransactionDocuments = [
    {
      id: "seed-doc-graham-contract-upload",
      transactionId: "seed-tx-graham-court",
      offerId: "seed-offer-graham-evelyn",
      uploadedByEmail: "jane@acre.com",
      linkedTaskId: "seed-transaction-task-graham-contract",
      title: "Buyer agreement upload",
      fileName: storedSeedFiles.grahamContractUpload.fileName,
      mimeType: "text/plain",
      fileSizeBytes: storedSeedFiles.grahamContractUpload.fileSizeBytes,
      storageKey: storedSeedFiles.grahamContractUpload.storageKey,
      documentType: "Buyer agreement",
      status: "submitted",
      source: "manual_upload",
      isRequired: true,
      isSigned: false,
      isUnsorted: false,
      signedAt: null
    },
    {
      id: "seed-doc-graham-unsorted-email",
      transactionId: "seed-tx-graham-court",
      offerId: null,
      uploadedByEmail: "jane@acre.com",
      linkedTaskId: null,
      title: "Loose email PDF",
      fileName: storedSeedFiles.grahamUnsortedEmail.fileName,
      mimeType: "text/plain",
      fileSizeBytes: storedSeedFiles.grahamUnsortedEmail.fileSizeBytes,
      storageKey: storedSeedFiles.grahamUnsortedEmail.storageKey,
      documentType: "Email PDF",
      status: "uploaded",
      source: "email_pdf",
      isRequired: false,
      isSigned: false,
      isUnsorted: true,
      signedAt: null
    },
    {
      id: "seed-doc-graham-generated-packet",
      transactionId: "seed-tx-graham-court",
      offerId: "seed-offer-graham-countered",
      uploadedByEmail: "jane@acre.com",
      linkedTaskId: "seed-transaction-task-graham-contract",
      title: "Buyer agreement packet document",
      fileName: storedSeedFiles.grahamGeneratedPacket.fileName,
      mimeType: "application/json",
      fileSizeBytes: storedSeedFiles.grahamGeneratedPacket.fileSizeBytes,
      storageKey: storedSeedFiles.grahamGeneratedPacket.storageKey,
      documentType: "Buyer agreement",
      status: "signed",
      source: "generated_form",
      isRequired: true,
      isSigned: true,
      isUnsorted: false,
      signedAt: new Date("2026-03-10T18:00:00.000Z")
    },
    {
      id: "seed-doc-court-square-invoice-package",
      transactionId: "seed-tx-45-10-court-square",
      offerId: null,
      uploadedByEmail: "simon@acre.com",
      linkedTaskId: "seed-transaction-task-court-square-invoice",
      title: "Vendor invoice support package",
      fileName: storedSeedFiles.courtSquareInvoicePackage.fileName,
      mimeType: "text/plain",
      fileSizeBytes: storedSeedFiles.courtSquareInvoicePackage.fileSizeBytes,
      storageKey: storedSeedFiles.courtSquareInvoicePackage.storageKey,
      documentType: "Vendor invoice",
      status: "approved",
      source: "manual_upload",
      isRequired: true,
      isSigned: false,
      isUnsorted: false,
      signedAt: null
    }
  ];

  for (const document of seededTransactionDocuments) {
    const uploadedByMembership = document.uploadedByEmail ? membershipByEmail.get(document.uploadedByEmail) ?? null : null;

    await prisma.transactionDocument.upsert({
      where: { id: document.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: document.transactionId,
        offerId: document.offerId,
        uploadedByMembershipId: uploadedByMembership?.id ?? null,
        linkedTaskId: document.linkedTaskId,
        title: document.title,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        storageKey: document.storageKey,
        storageUrl: null,
        documentType: document.documentType,
        status: document.status,
        source: document.source,
        isRequired: document.isRequired,
        isSigned: document.isSigned,
        isUnsorted: document.isUnsorted,
        signedAt: document.signedAt
      },
      create: {
        id: document.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: document.transactionId,
        offerId: document.offerId,
        uploadedByMembershipId: uploadedByMembership?.id ?? null,
        linkedTaskId: document.linkedTaskId,
        title: document.title,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        storageKey: document.storageKey,
        storageUrl: null,
        documentType: document.documentType,
        status: document.status,
        source: document.source,
        isRequired: document.isRequired,
        isSigned: document.isSigned,
        isUnsorted: document.isUnsorted,
        signedAt: document.signedAt
      }
    });
  }

  const seededTransactionForms = [
    {
      id: "seed-form-graham-buyer-agreement",
      transactionId: "seed-tx-graham-court",
      offerId: "seed-offer-graham-countered",
      templateKey: "buyer-agreement-packet",
      linkedTaskId: "seed-transaction-task-graham-contract",
      documentId: "seed-doc-graham-generated-packet",
      name: "Graham Court buyer agreement packet",
      status: "fully_signed",
      createdByEmail: "jane@acre.com",
      generatedPayload: {
        transaction_title: "Graham Court 4F",
        transaction_address: "Graham Court 4F",
        transaction_city: "Brooklyn",
        transaction_state: "NY",
        transaction_zip_code: "11206",
        transaction_type: "Sales",
        transaction_status: "Opportunity",
        transaction_representing: "Buyer",
        transaction_owner: "Jane Wu",
        primary_contact_name: "Evelyn Zhao",
        primary_contact_email: "evelyn@example.com",
        finance_gross_commission: "",
        finance_office_net: ""
      }
    },
    {
      id: "seed-form-court-square-emd-receipt",
      transactionId: "seed-tx-45-10-court-square",
      offerId: null,
      templateKey: "emd-receipt",
      linkedTaskId: null,
      documentId: null,
      name: "Court Square earnest money receipt",
      status: "prepared",
      createdByEmail: "simon@acre.com",
      generatedPayload: {
        transaction_title: "45-10 Court Square W",
        transaction_address: "45-10 Court Square W",
        transaction_status: "Pending",
        finance_office_net: "18000",
        closing_date: ""
      }
    }
  ];

  for (const form of seededTransactionForms) {
    const createdByMembership = membershipByEmail.get(form.createdByEmail) ?? null;
    const template = seededFormTemplates.find((template) => template.key === form.templateKey);

    await prisma.transactionForm.upsert({
      where: { id: form.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: form.transactionId,
        offerId: form.offerId,
        templateId: template?.id ?? null,
        linkedTaskId: form.linkedTaskId,
        documentId: form.documentId,
        name: form.name,
        status: form.status,
        generatedPayload: form.generatedPayload,
        createdByMembershipId: createdByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id
      },
      create: {
        id: form.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: form.transactionId,
        offerId: form.offerId,
        templateId: template?.id ?? null,
        linkedTaskId: form.linkedTaskId,
        documentId: form.documentId,
        name: form.name,
        status: form.status,
        generatedPayload: form.generatedPayload,
        createdByMembershipId: createdByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id
      }
    });
  }

  const seededSignatureRequests = [
    {
      id: "seed-signature-graham-buyer",
      transactionId: "seed-tx-graham-court",
      offerId: "seed-offer-graham-countered",
      formId: "seed-form-graham-buyer-agreement",
      documentId: "seed-doc-graham-generated-packet",
      requestedByEmail: "jane@acre.com",
      recipientName: "Evelyn Zhao",
      recipientEmail: "evelyn@example.com",
      recipientRole: "Buyer",
      signingOrder: 1,
      status: "signed",
      sentAt: new Date("2026-03-10T15:00:00.000Z"),
      viewedAt: new Date("2026-03-10T16:00:00.000Z"),
      completedAt: new Date("2026-03-10T18:00:00.000Z"),
      declinedAt: null
    },
    {
      id: "seed-signature-court-square-manager",
      transactionId: "seed-tx-45-10-court-square",
      offerId: null,
      formId: "seed-form-court-square-emd-receipt",
      documentId: null,
      requestedByEmail: "simon@acre.com",
      recipientName: "Office manager review",
      recipientEmail: "simon@acre.com",
      recipientRole: "Office manager",
      signingOrder: 1,
      status: "sent",
      sentAt: new Date("2026-03-11T14:00:00.000Z"),
      viewedAt: null,
      completedAt: null,
      declinedAt: null
    }
  ];

  for (const request of seededSignatureRequests) {
    const requestedByMembership = membershipByEmail.get(request.requestedByEmail) ?? null;

    await prisma.signatureRequest.upsert({
      where: { id: request.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: request.transactionId,
        offerId: request.offerId,
        formId: request.formId,
        documentId: request.documentId,
        requestedByMembershipId: requestedByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        recipientName: request.recipientName,
        recipientEmail: request.recipientEmail,
        recipientRole: request.recipientRole,
        signingOrder: request.signingOrder,
        status: request.status,
        sentAt: request.sentAt,
        viewedAt: request.viewedAt,
        completedAt: request.completedAt,
        declinedAt: request.declinedAt
      },
      create: {
        id: request.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: request.transactionId,
        offerId: request.offerId,
        formId: request.formId,
        documentId: request.documentId,
        requestedByMembershipId: requestedByMembership?.id ?? membershipByEmail.get("naomi@acre.com")?.id,
        recipientName: request.recipientName,
        recipientEmail: request.recipientEmail,
        recipientRole: request.recipientRole,
        signingOrder: request.signingOrder,
        status: request.status,
        sentAt: request.sentAt,
        viewedAt: request.viewedAt,
        completedAt: request.completedAt,
        declinedAt: request.declinedAt
      }
    });
  }

  const seededIncomingUpdates = [
    {
      id: "seed-incoming-graham-closing-review",
      transactionId: "seed-tx-graham-court",
      sourceSystem: "Manual test feed",
      sourceReference: "graham-closing-review-001",
      status: "pending_review",
      summary: "Closing date revision requires review",
      payload: {
        closingDate: "2026-03-28",
        importantDate: "2026-03-22",
        status: "pending"
      },
      reviewedAt: null,
      reviewedByEmail: null,
      acceptedAt: null,
      rejectedAt: null
    },
    {
      id: "seed-incoming-graham-price-rejected",
      transactionId: "seed-tx-graham-court",
      sourceSystem: "Manual test feed",
      sourceReference: "graham-price-rejected-001",
      status: "rejected",
      summary: "Unsupported outside price revision was rejected",
      payload: {
        price: "950000",
        summary: "Price update from external intake"
      },
      reviewedAt: new Date("2026-03-10T13:15:00.000Z"),
      reviewedByEmail: "simon@acre.com",
      acceptedAt: null,
      rejectedAt: new Date("2026-03-10T13:15:00.000Z")
    }
  ];

  for (const incomingUpdate of seededIncomingUpdates) {
    const reviewedByMembership = incomingUpdate.reviewedByEmail
      ? membershipByEmail.get(incomingUpdate.reviewedByEmail) ?? null
      : null;

    await prisma.incomingUpdate.upsert({
      where: {
        organizationId_sourceSystem_sourceReference: {
          organizationId: organization.id,
          sourceSystem: incomingUpdate.sourceSystem,
          sourceReference: incomingUpdate.sourceReference
        }
      },
      update: {
        officeId: office.id,
        transactionId: incomingUpdate.transactionId,
        status: incomingUpdate.status,
        summary: incomingUpdate.summary,
        payload: incomingUpdate.payload,
        receivedAt: new Date("2026-03-10T12:00:00.000Z"),
        reviewedAt: incomingUpdate.reviewedAt,
        reviewedByMembershipId: reviewedByMembership?.id ?? null,
        acceptedAt: incomingUpdate.acceptedAt,
        rejectedAt: incomingUpdate.rejectedAt
      },
      create: {
        id: incomingUpdate.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: incomingUpdate.transactionId,
        sourceSystem: incomingUpdate.sourceSystem,
        sourceReference: incomingUpdate.sourceReference,
        status: incomingUpdate.status,
        summary: incomingUpdate.summary,
        payload: incomingUpdate.payload,
        receivedAt: new Date("2026-03-10T12:00:00.000Z"),
        reviewedAt: incomingUpdate.reviewedAt,
        reviewedByMembershipId: reviewedByMembership?.id ?? null,
        acceptedAt: incomingUpdate.acceptedAt,
        rejectedAt: incomingUpdate.rejectedAt
      }
    });
  }

  const seededLedgerAccounts = [
    { code: "1000", name: "Operating Bank", accountType: "asset" },
    { code: "1010", name: "Earnest Money Holding Bank", accountType: "asset" },
    { code: "1100", name: "Accounts Receivable", accountType: "asset" },
    { code: "2000", name: "Accounts Payable", accountType: "liability" },
    { code: "2100", name: "Earnest Money Liability", accountType: "liability" },
    { code: "4000", name: "Commission Income", accountType: "income" },
    { code: "4010", name: "Agent Billing Income", accountType: "income" },
    { code: "4050", name: "Refund / Contra Revenue", accountType: "contra_income" },
    { code: "5000", name: "Agent Commission Expense", accountType: "expense" },
    { code: "5100", name: "Referral Expense", accountType: "expense" }
  ];

  const ledgerAccountByCode = new Map();

  for (const account of seededLedgerAccounts) {
    const savedAccount = await upsertLedgerAccount({
      organizationId: organization.id,
      officeId: office.id,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      isSystem: true,
      isActive: true
    });

    ledgerAccountByCode.set(account.code, savedAccount);
  }

  const seededAccountingTransactions = [
    {
      id: "seed-acct-invoice-parson",
      relatedTransactionId: "seed-tx-3820-parson",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "invoice",
      status: "open",
      accountingDate: new Date("2026-03-01T00:00:00.000Z"),
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
      paymentMethod: null,
      referenceNumber: "INV-3820-01",
      counterpartyName: "Queenie Cao",
      memo: "Listing commission invoice",
      notes: "Seeded listing-side invoice.",
      totalAmount: "18750",
      lineItems: [
        {
          id: "seed-acct-li-invoice-parson",
          ledgerAccountCode: "4000",
          description: "Listing commission income",
          entrySide: "credit",
          amount: "18750"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-invoice-parson-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-01T00:00:00.000Z"),
          debitAmount: "18750",
          creditAmount: "0",
          memo: "Invoice INV-3820-01"
        },
        {
          id: "seed-gl-invoice-parson-income",
          accountCode: "4000",
          entryDate: new Date("2026-03-01T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "18750",
          memo: "Invoice INV-3820-01"
        }
      ]
    },
    {
      id: "seed-acct-payment-parson",
      relatedTransactionId: "seed-tx-3820-parson",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "received_payment",
      status: "completed",
      accountingDate: new Date("2026-03-05T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "wire",
      referenceNumber: "PAY-3820-01",
      counterpartyName: "Title Company",
      memo: "Wire received for listing commission",
      notes: "Seeded received payment.",
      totalAmount: "18750",
      lineItems: [],
      ledgerEntries: [
        {
          id: "seed-gl-payment-parson-bank",
          accountCode: "1000",
          entryDate: new Date("2026-03-05T00:00:00.000Z"),
          debitAmount: "18750",
          creditAmount: "0",
          memo: "Received payment PAY-3820-01"
        },
        {
          id: "seed-gl-payment-parson-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-05T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "18750",
          memo: "Received payment PAY-3820-01"
        }
      ]
    },
    {
      id: "seed-acct-bill-referral",
      relatedTransactionId: "seed-tx-3820-parson",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "bill",
      status: "open",
      accountingDate: new Date("2026-03-04T00:00:00.000Z"),
      dueDate: new Date("2026-03-12T00:00:00.000Z"),
      paymentMethod: null,
      referenceNumber: "BILL-3820-REF",
      counterpartyName: "Acre Referral Desk",
      memo: "Referral fee payable",
      notes: "Seeded referral expense bill.",
      totalAmount: "2500",
      lineItems: [
        {
          id: "seed-acct-li-bill-referral",
          ledgerAccountCode: "5100",
          description: "Referral expense",
          entrySide: "debit",
          amount: "2500"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-bill-referral-expense",
          accountCode: "5100",
          entryDate: new Date("2026-03-04T00:00:00.000Z"),
          debitAmount: "2500",
          creditAmount: "0",
          memo: "Bill BILL-3820-REF"
        },
        {
          id: "seed-gl-bill-referral-ap",
          accountCode: "2000",
          entryDate: new Date("2026-03-04T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "2500",
          memo: "Bill BILL-3820-REF"
        }
      ]
    },
    {
      id: "seed-acct-payment-referral",
      relatedTransactionId: "seed-tx-3820-parson",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "made_payment",
      status: "completed",
      accountingDate: new Date("2026-03-09T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "check",
      referenceNumber: "CHK-3820-REF",
      counterpartyName: "Acre Referral Desk",
      memo: "Referral fee paid",
      notes: "Seeded referral payment.",
      totalAmount: "2500",
      lineItems: [],
      ledgerEntries: [
        {
          id: "seed-gl-payment-referral-ap",
          accountCode: "2000",
          entryDate: new Date("2026-03-09T00:00:00.000Z"),
          debitAmount: "2500",
          creditAmount: "0",
          memo: "Made payment CHK-3820-REF"
        },
        {
          id: "seed-gl-payment-referral-bank",
          accountCode: "1000",
          entryDate: new Date("2026-03-09T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "2500",
          memo: "Made payment CHK-3820-REF"
        }
      ]
    },
    {
      id: "seed-acct-deposit-emd-70",
      relatedTransactionId: "seed-tx-70-christopher",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "deposit",
      status: "posted",
      accountingDate: new Date("2026-03-04T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "check",
      referenceNumber: "EMD-70-DEP",
      counterpartyName: "Earnest Money Holding",
      memo: "Earnest money deposited to holding bank",
      notes: "Seeded EMD deposit.",
      totalAmount: "5000",
      lineItems: [
        {
          id: "seed-acct-li-deposit-emd-70",
          ledgerAccountCode: "2100",
          description: "Earnest money liability",
          entrySide: "credit",
          amount: "5000"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-deposit-emd-70-bank",
          accountCode: "1010",
          entryDate: new Date("2026-03-04T00:00:00.000Z"),
          debitAmount: "5000",
          creditAmount: "0",
          memo: "Deposit EMD-70-DEP"
        },
        {
          id: "seed-gl-deposit-emd-70-liability",
          accountCode: "2100",
          entryDate: new Date("2026-03-04T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "5000",
          memo: "Deposit EMD-70-DEP"
        }
      ]
    },
    {
      id: "seed-acct-refund-broker-credit",
      relatedTransactionId: "seed-tx-70-christopher",
      relatedMembershipEmail: "naomi@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "refund",
      status: "completed",
      accountingDate: new Date("2026-03-10T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "check",
      referenceNumber: "RFND-70-001",
      counterpartyName: "Brokerage client credit",
      memo: "Client refund",
      notes: "Seeded refund entry.",
      totalAmount: "500",
      lineItems: [
        {
          id: "seed-acct-li-refund-70",
          ledgerAccountCode: "4050",
          description: "Contra revenue refund",
          entrySide: "debit",
          amount: "500"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-refund-70-contra",
          accountCode: "4050",
          entryDate: new Date("2026-03-10T00:00:00.000Z"),
          debitAmount: "500",
          creditAmount: "0",
          memo: "Refund RFND-70-001"
        },
        {
          id: "seed-gl-refund-70-bank",
          accountCode: "1000",
          entryDate: new Date("2026-03-10T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "500",
          memo: "Refund RFND-70-001"
        }
      ]
    },
    {
      id: "seed-acct-journal-adjustment",
      relatedTransactionId: "seed-tx-graham-court",
      relatedMembershipEmail: "jane@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "journal_entry",
      status: "posted",
      accountingDate: new Date("2026-03-06T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: null,
      referenceNumber: "JE-2026-03-01",
      counterpartyName: "Internal adjustment",
      memo: "Manual journal adjustment",
      notes: "Seeded journal entry for view coverage.",
      totalAmount: "300",
      lineItems: [
        {
          id: "seed-acct-li-je-debit",
          ledgerAccountCode: "5100",
          description: "Manual adjustment debit",
          entrySide: "debit",
          amount: "300"
        },
        {
          id: "seed-acct-li-je-credit",
          ledgerAccountCode: "4050",
          description: "Manual adjustment credit",
          entrySide: "credit",
          amount: "300"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-je-debit",
          accountCode: "5100",
          entryDate: new Date("2026-03-06T00:00:00.000Z"),
          debitAmount: "300",
          creditAmount: "0",
          memo: "Journal entry JE-2026-03-01"
        },
        {
          id: "seed-gl-je-credit",
          accountCode: "4050",
          entryDate: new Date("2026-03-06T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "300",
          memo: "Journal entry JE-2026-03-01"
        }
      ]
    },
    {
      id: "seed-acct-transfer-liquidity",
      relatedTransactionId: "seed-tx-45-10-court-square",
      relatedMembershipEmail: "simon@acre.com",
      createdByEmail: "naomi@acre.com",
      type: "transfer",
      status: "posted",
      accountingDate: new Date("2026-03-11T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "internal_transfer",
      referenceNumber: "XFER-2026-03",
      counterpartyName: "Internal bank transfer",
      memo: "Transfer between operating and earnest money accounts",
      notes: "Seeded transfer for accounting type coverage.",
      totalAmount: "1000",
      lineItems: [
        {
          id: "seed-acct-li-transfer-debit",
          ledgerAccountCode: "1000",
          description: "Operating bank increase",
          entrySide: "debit",
          amount: "1000"
        },
        {
          id: "seed-acct-li-transfer-credit",
          ledgerAccountCode: "1010",
          description: "Earnest money bank decrease",
          entrySide: "credit",
          amount: "1000"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-gl-transfer-debit",
          accountCode: "1000",
          entryDate: new Date("2026-03-11T00:00:00.000Z"),
          debitAmount: "1000",
          creditAmount: "0",
          memo: "Transfer XFER-2026-03"
        },
        {
          id: "seed-gl-transfer-credit",
          accountCode: "1010",
          entryDate: new Date("2026-03-11T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "1000",
          memo: "Transfer XFER-2026-03"
        }
      ]
    }
  ];

  for (const accountingTransaction of seededAccountingTransactions) {
    const relatedMembership = accountingTransaction.relatedMembershipEmail
      ? membershipByEmail.get(accountingTransaction.relatedMembershipEmail) ?? null
      : null;
    const createdByMembership = membershipByEmail.get(accountingTransaction.createdByEmail) ?? null;

    await upsertAccountingTransactionWithPostings({
      id: accountingTransaction.id,
      organizationId: organization.id,
      officeId: office.id,
      relatedTransactionId: accountingTransaction.relatedTransactionId ?? null,
      relatedMembershipId: relatedMembership?.id ?? null,
      type: accountingTransaction.type,
      status: accountingTransaction.status,
      accountingDate: accountingTransaction.accountingDate,
      dueDate: accountingTransaction.dueDate ?? null,
      paymentMethod: accountingTransaction.paymentMethod ?? null,
      referenceNumber: accountingTransaction.referenceNumber,
      counterpartyName: accountingTransaction.counterpartyName,
      memo: accountingTransaction.memo,
      notes: accountingTransaction.notes,
      totalAmount: accountingTransaction.totalAmount,
      createdByMembershipId: createdByMembership.id,
      postedAt: ["draft", "void"].includes(accountingTransaction.status) ? null : accountingTransaction.accountingDate,
      lineItems: accountingTransaction.lineItems.map((lineItem) => ({
        ...lineItem,
        ledgerAccountId: ledgerAccountByCode.get(lineItem.ledgerAccountCode).id
      })),
      ledgerEntries: accountingTransaction.ledgerEntries.map((entry) => ({
        ...entry,
        accountId: ledgerAccountByCode.get(entry.accountCode).id
      }))
    });
  }

  const seededAgentBillingTransactions = [
    {
      id: "seed-agent-invoice-jane-desk-fee",
      relatedTransactionId: null,
      relatedMembershipEmail: "jane@acre.com",
      createdByEmail: "naomi@acre.com",
      isAgentBilling: true,
      billingCategory: "desk_fee",
      type: "invoice",
      status: "open",
      accountingDate: new Date("2026-03-01T00:00:00.000Z"),
      dueDate: new Date("2026-03-12T00:00:00.000Z"),
      paymentMethod: null,
      referenceNumber: "AGINV-2026-03-001",
      counterpartyName: "Jane Wu",
      memo: "March desk fee",
      notes: "Seeded monthly desk fee invoice.",
      totalAmount: "350",
      lineItems: [
        {
          id: "seed-agent-li-jane-desk-fee",
          ledgerAccountCode: "4010",
          description: "Monthly desk fee",
          entrySide: "credit",
          amount: "350"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-agent-gl-jane-desk-fee-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-01T00:00:00.000Z"),
          debitAmount: "350",
          creditAmount: "0",
          memo: "Agent invoice AGINV-2026-03-001"
        },
        {
          id: "seed-agent-gl-jane-desk-fee-income",
          accountCode: "4010",
          entryDate: new Date("2026-03-01T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "350",
          memo: "Agent invoice AGINV-2026-03-001"
        }
      ]
    },
    {
      id: "seed-agent-invoice-jane-marketing-fee",
      relatedTransactionId: "seed-tx-graham-court",
      relatedMembershipEmail: "jane@acre.com",
      createdByEmail: "naomi@acre.com",
      isAgentBilling: true,
      billingCategory: "marketing_fee",
      type: "invoice",
      status: "draft",
      accountingDate: new Date("2026-04-01T00:00:00.000Z"),
      dueDate: new Date("2026-04-01T00:00:00.000Z"),
      paymentMethod: null,
      referenceNumber: "AGINV-2026-04-001",
      counterpartyName: "Jane Wu",
      memo: "April marketing package",
      notes: "Future-dated marketing fee invoice.",
      totalAmount: "125",
      lineItems: [
        {
          id: "seed-agent-li-jane-marketing-fee",
          ledgerAccountCode: "4010",
          description: "Marketing package",
          entrySide: "credit",
          amount: "125"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-agent-gl-jane-marketing-fee-ar",
          accountCode: "1100",
          entryDate: new Date("2026-04-01T00:00:00.000Z"),
          debitAmount: "125",
          creditAmount: "0",
          memo: "Agent invoice AGINV-2026-04-001"
        },
        {
          id: "seed-agent-gl-jane-marketing-fee-income",
          accountCode: "4010",
          entryDate: new Date("2026-04-01T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "125",
          memo: "Agent invoice AGINV-2026-04-001"
        }
      ]
    },
    {
      id: "seed-agent-invoice-simon-office-fee",
      relatedTransactionId: null,
      relatedMembershipEmail: "simon@acre.com",
      createdByEmail: "naomi@acre.com",
      isAgentBilling: true,
      billingCategory: "office_fee",
      type: "invoice",
      status: "open",
      accountingDate: new Date("2026-03-03T00:00:00.000Z"),
      dueDate: new Date("2026-03-15T00:00:00.000Z"),
      paymentMethod: null,
      referenceNumber: "AGINV-2026-03-002",
      counterpartyName: "Simon Park",
      memo: "Office support fee",
      notes: "Seeded office support fee invoice.",
      totalAmount: "400",
      lineItems: [
        {
          id: "seed-agent-li-simon-office-fee",
          ledgerAccountCode: "4010",
          description: "Office support fee",
          entrySide: "credit",
          amount: "400"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-agent-gl-simon-office-fee-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-03T00:00:00.000Z"),
          debitAmount: "400",
          creditAmount: "0",
          memo: "Agent invoice AGINV-2026-03-002"
        },
        {
          id: "seed-agent-gl-simon-office-fee-income",
          accountCode: "4010",
          entryDate: new Date("2026-03-03T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "400",
          memo: "Agent invoice AGINV-2026-03-002"
        }
      ]
    },
    {
      id: "seed-agent-payment-jane-march",
      relatedTransactionId: null,
      relatedMembershipEmail: "jane@acre.com",
      createdByEmail: "naomi@acre.com",
      isAgentBilling: true,
      billingCategory: "collections",
      type: "received_payment",
      status: "completed",
      accountingDate: new Date("2026-03-06T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: "check",
      referenceNumber: "AGPAY-2026-03-001",
      counterpartyName: "Jane Wu",
      memo: "Received agent payment",
      notes: "Partial payment against March charges.",
      totalAmount: "200",
      lineItems: [],
      ledgerEntries: [
        {
          id: "seed-agent-gl-payment-jane-bank",
          accountCode: "1000",
          entryDate: new Date("2026-03-06T00:00:00.000Z"),
          debitAmount: "200",
          creditAmount: "0",
          memo: "Agent payment AGPAY-2026-03-001"
        },
        {
          id: "seed-agent-gl-payment-jane-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-06T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "200",
          memo: "Agent payment AGPAY-2026-03-001"
        }
      ]
    },
    {
      id: "seed-agent-credit-jane-courtesy",
      relatedTransactionId: null,
      relatedMembershipEmail: "jane@acre.com",
      createdByEmail: "naomi@acre.com",
      isAgentBilling: true,
      billingCategory: "courtesy_credit",
      type: "credit_memo",
      status: "posted",
      accountingDate: new Date("2026-03-07T00:00:00.000Z"),
      dueDate: null,
      paymentMethod: null,
      referenceNumber: "AGCR-2026-03-001",
      counterpartyName: "Jane Wu",
      memo: "Courtesy credit",
      notes: "Applied courtesy credit to March desk fee.",
      totalAmount: "50",
      lineItems: [
        {
          id: "seed-agent-li-credit-jane-contra",
          ledgerAccountCode: "4050",
          description: "Courtesy credit",
          entrySide: "debit",
          amount: "50"
        },
        {
          id: "seed-agent-li-credit-jane-ar",
          ledgerAccountCode: "1100",
          description: "Accounts receivable reduction",
          entrySide: "credit",
          amount: "50"
        }
      ],
      ledgerEntries: [
        {
          id: "seed-agent-gl-credit-jane-contra",
          accountCode: "4050",
          entryDate: new Date("2026-03-07T00:00:00.000Z"),
          debitAmount: "50",
          creditAmount: "0",
          memo: "Agent credit AGCR-2026-03-001"
        },
        {
          id: "seed-agent-gl-credit-jane-ar",
          accountCode: "1100",
          entryDate: new Date("2026-03-07T00:00:00.000Z"),
          debitAmount: "0",
          creditAmount: "50",
          memo: "Agent credit AGCR-2026-03-001"
        }
      ]
    }
  ];

  for (const accountingTransaction of seededAgentBillingTransactions) {
    const relatedMembership = accountingTransaction.relatedMembershipEmail
      ? membershipByEmail.get(accountingTransaction.relatedMembershipEmail) ?? null
      : null;
    const createdByMembership = membershipByEmail.get(accountingTransaction.createdByEmail) ?? null;

    await upsertAccountingTransactionWithPostings({
      id: accountingTransaction.id,
      organizationId: organization.id,
      officeId: office.id,
      relatedTransactionId: accountingTransaction.relatedTransactionId ?? null,
      relatedMembershipId: relatedMembership?.id ?? null,
      isAgentBilling: accountingTransaction.isAgentBilling,
      billingCategory: accountingTransaction.billingCategory,
      type: accountingTransaction.type,
      status: accountingTransaction.status,
      accountingDate: accountingTransaction.accountingDate,
      dueDate: accountingTransaction.dueDate ?? null,
      paymentMethod: accountingTransaction.paymentMethod ?? null,
      referenceNumber: accountingTransaction.referenceNumber,
      counterpartyName: accountingTransaction.counterpartyName,
      memo: accountingTransaction.memo,
      notes: accountingTransaction.notes,
      totalAmount: accountingTransaction.totalAmount,
      createdByMembershipId: createdByMembership.id,
      postedAt: ["draft", "void"].includes(accountingTransaction.status) ? null : accountingTransaction.accountingDate,
      lineItems: accountingTransaction.lineItems.map((lineItem) => ({
        ...lineItem,
        ledgerAccountId: ledgerAccountByCode.get(lineItem.ledgerAccountCode).id
      })),
      ledgerEntries: accountingTransaction.ledgerEntries.map((entry) => ({
        ...entry,
        accountId: ledgerAccountByCode.get(entry.accountCode).id
      }))
    });
  }

  const seededAgentBillingApplications = [
    {
      id: "seed-agent-application-payment-jane-desk-fee",
      sourceAccountingTransactionId: "seed-agent-payment-jane-march",
      targetAccountingTransactionId: "seed-agent-invoice-jane-desk-fee",
      amount: "200",
      memo: "Applied payment to March desk fee"
    },
    {
      id: "seed-agent-application-credit-jane-desk-fee",
      sourceAccountingTransactionId: "seed-agent-credit-jane-courtesy",
      targetAccountingTransactionId: "seed-agent-invoice-jane-desk-fee",
      amount: "50",
      memo: "Applied courtesy credit"
    }
  ];

  for (const application of seededAgentBillingApplications) {
    await prisma.accountingTransactionApplication.upsert({
      where: {
        id: application.id
      },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        sourceAccountingTransactionId: application.sourceAccountingTransactionId,
        targetAccountingTransactionId: application.targetAccountingTransactionId,
        createdByMembershipId: membershipByEmail.get("naomi@acre.com")?.id ?? null,
        amount: application.amount,
        memo: application.memo,
        appliedAt: new Date("2026-03-08T00:00:00.000Z")
      },
      create: {
        id: application.id,
        organizationId: organization.id,
        officeId: office.id,
        sourceAccountingTransactionId: application.sourceAccountingTransactionId,
        targetAccountingTransactionId: application.targetAccountingTransactionId,
        createdByMembershipId: membershipByEmail.get("naomi@acre.com")?.id ?? null,
        amount: application.amount,
        memo: application.memo,
        appliedAt: new Date("2026-03-08T00:00:00.000Z")
      }
    });
  }

  const seededAgentRecurringRules = [
    {
      id: "seed-agent-recurring-jane-marketing",
      membershipEmail: "jane@acre.com",
      name: "Monthly marketing package",
      chargeType: "marketing_fee",
      description: "Standard monthly marketing package for active agents.",
      amount: "125",
      frequency: "monthly",
      customIntervalDays: null,
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      nextDueDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: null,
      lastGeneratedAt: new Date("2026-03-01T00:00:00.000Z"),
      autoGenerateInvoice: true,
      isActive: true
    }
  ];

  for (const rule of seededAgentRecurringRules) {
    const membership = membershipByEmail.get(rule.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.agentRecurringChargeRule.upsert({
      where: {
        id: rule.id
      },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        name: rule.name,
        chargeType: rule.chargeType,
        description: rule.description,
        amount: rule.amount,
        frequency: rule.frequency,
        customIntervalDays: rule.customIntervalDays,
        startDate: rule.startDate,
        nextDueDate: rule.nextDueDate,
        endDate: rule.endDate,
        lastGeneratedAt: rule.lastGeneratedAt,
        autoGenerateInvoice: rule.autoGenerateInvoice,
        isActive: rule.isActive
      },
      create: {
        id: rule.id,
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        name: rule.name,
        chargeType: rule.chargeType,
        description: rule.description,
        amount: rule.amount,
        frequency: rule.frequency,
        customIntervalDays: rule.customIntervalDays,
        startDate: rule.startDate,
        nextDueDate: rule.nextDueDate,
        endDate: rule.endDate,
        lastGeneratedAt: rule.lastGeneratedAt,
        autoGenerateInvoice: rule.autoGenerateInvoice,
        isActive: rule.isActive
      }
    });
  }

  const seededAgentPaymentMethods = [
    {
      id: "seed-agent-payment-method-jane-card",
      membershipEmail: "jane@acre.com",
      type: "card_on_file",
      label: "Visa ending 4242",
      provider: "Manual",
      last4: "4242",
      isDefault: true,
      autoPayEnabled: false,
      externalReferenceId: "pm_jane_demo",
      status: "active"
    },
    {
      id: "seed-agent-payment-method-simon-invalid",
      membershipEmail: "simon@acre.com",
      type: "bank_account",
      label: "Bank account ending 8811",
      provider: "Manual",
      last4: "8811",
      isDefault: true,
      autoPayEnabled: false,
      externalReferenceId: "pm_simon_demo",
      status: "invalid"
    }
  ];

  for (const paymentMethod of seededAgentPaymentMethods) {
    const membership = membershipByEmail.get(paymentMethod.membershipEmail) ?? null;

    if (!membership) {
      continue;
    }

    await prisma.agentPaymentMethod.upsert({
      where: {
        id: paymentMethod.id
      },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        type: paymentMethod.type,
        label: paymentMethod.label,
        provider: paymentMethod.provider,
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        autoPayEnabled: paymentMethod.autoPayEnabled,
        externalReferenceId: paymentMethod.externalReferenceId,
        status: paymentMethod.status
      },
      create: {
        id: paymentMethod.id,
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership.id,
        type: paymentMethod.type,
        label: paymentMethod.label,
        provider: paymentMethod.provider,
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        autoPayEnabled: paymentMethod.autoPayEnabled,
        externalReferenceId: paymentMethod.externalReferenceId,
        status: paymentMethod.status
      }
    });
  }

  const seededCommissionPlans = [
    {
      id: "seed-commission-plan-senior",
      name: "Senior agent split",
      description: "Senior split with referral deduction, flat brokerage fee, and a higher tier above $25k gross after referral.",
      isActive: true,
      calculationMode: "split_and_fees",
      defaultCurrency: "USD",
      rules: [
        {
          id: "seed-commission-rule-senior-base",
          ruleType: "base_split",
          ruleName: "Base split",
          sortOrder: 1,
          splitPercent: "70",
          flatAmount: null,
          feeType: null,
          feeAmount: null,
          thresholdStart: null,
          thresholdEnd: null,
          appliesToRole: "agent",
          recipientType: "agent",
          isActive: true
        },
        {
          id: "seed-commission-rule-senior-referral",
          ruleType: "referral_fee",
          ruleName: "Referral fee",
          sortOrder: 2,
          splitPercent: null,
          flatAmount: null,
          feeType: "percentage",
          feeAmount: "10",
          thresholdStart: null,
          thresholdEnd: null,
          appliesToRole: "referral",
          recipientType: "referral",
          isActive: true
        },
        {
          id: "seed-commission-rule-senior-brokerage-fee",
          ruleType: "brokerage_fee",
          ruleName: "Brokerage fee",
          sortOrder: 3,
          splitPercent: null,
          flatAmount: null,
          feeType: "flat",
          feeAmount: "495",
          thresholdStart: null,
          thresholdEnd: null,
          appliesToRole: "agent",
          recipientType: "brokerage",
          isActive: true
        },
        {
          id: "seed-commission-rule-senior-sliding",
          ruleType: "sliding_scale",
          ruleName: "High-volume uplift",
          sortOrder: 4,
          splitPercent: "75",
          flatAmount: null,
          feeType: null,
          feeAmount: null,
          thresholdStart: "25000",
          thresholdEnd: null,
          appliesToRole: "agent",
          recipientType: "agent",
          isActive: true
        }
      ]
    },
    {
      id: "seed-commission-plan-ops",
      name: "Operations manager split",
      description: "Operational split for manager-owned transactions with a lighter brokerage deduction.",
      isActive: true,
      calculationMode: "split_and_fees",
      defaultCurrency: "USD",
      rules: [
        {
          id: "seed-commission-rule-ops-base",
          ruleType: "base_split",
          ruleName: "Base split",
          sortOrder: 1,
          splitPercent: "65",
          flatAmount: null,
          feeType: null,
          feeAmount: null,
          thresholdStart: null,
          thresholdEnd: null,
          appliesToRole: "office_manager",
          recipientType: "agent",
          isActive: true
        },
        {
          id: "seed-commission-rule-ops-flat",
          ruleType: "flat_fee_deduction",
          ruleName: "Operations flat fee",
          sortOrder: 2,
          splitPercent: null,
          flatAmount: "350",
          feeType: null,
          feeAmount: null,
          thresholdStart: null,
          thresholdEnd: null,
          appliesToRole: "office_manager",
          recipientType: "brokerage",
          isActive: true
        }
      ]
    }
  ];

  for (const plan of seededCommissionPlans) {
    await prisma.commissionPlan.upsert({
      where: { id: plan.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        name: plan.name,
        description: plan.description,
        isActive: plan.isActive,
        calculationMode: plan.calculationMode,
        defaultCurrency: plan.defaultCurrency
      },
      create: {
        id: plan.id,
        organizationId: organization.id,
        officeId: office.id,
        name: plan.name,
        description: plan.description,
        isActive: plan.isActive,
        calculationMode: plan.calculationMode,
        defaultCurrency: plan.defaultCurrency
      }
    });

    await prisma.commissionPlanRule.deleteMany({
      where: {
        commissionPlanId: plan.id
      }
    });

    await prisma.commissionPlanRule.createMany({
      data: plan.rules.map((rule) => ({
        id: rule.id,
        organizationId: organization.id,
        commissionPlanId: plan.id,
        ruleType: rule.ruleType,
        ruleName: rule.ruleName,
        sortOrder: rule.sortOrder,
        splitPercent: rule.splitPercent,
        flatAmount: rule.flatAmount,
        feeType: rule.feeType,
        feeAmount: rule.feeAmount,
        thresholdStart: rule.thresholdStart,
        thresholdEnd: rule.thresholdEnd,
        appliesToRole: rule.appliesToRole,
        recipientType: rule.recipientType,
        isActive: rule.isActive
      }))
    });
  }

  const seededCommissionAssignments = [
    {
      id: "seed-commission-assignment-jane",
      membershipEmail: "jane@acre.com",
      commissionPlanId: "seed-commission-plan-senior",
      effectiveFrom: new Date("2025-09-01T00:00:00.000Z"),
      effectiveTo: null
    },
    {
      id: "seed-commission-assignment-simon",
      membershipEmail: "simon@acre.com",
      commissionPlanId: "seed-commission-plan-ops",
      effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
      effectiveTo: null
    },
    {
      id: "seed-commission-assignment-ops-team",
      teamId: "seed-team-operations",
      commissionPlanId: "seed-commission-plan-senior",
      effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
      effectiveTo: null
    }
  ];

  for (const assignment of seededCommissionAssignments) {
    const membership = assignment.membershipEmail ? membershipByEmail.get(assignment.membershipEmail) ?? null : null;
    const teamId = assignment.teamId ?? null;

    if (!membership && !teamId) {
      continue;
    }

    await prisma.commissionPlanAssignment.upsert({
      where: { id: assignment.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership?.id ?? null,
        teamId,
        commissionPlanId: assignment.commissionPlanId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo
      },
      create: {
        id: assignment.id,
        organizationId: organization.id,
        officeId: office.id,
        membershipId: membership?.id ?? null,
        teamId,
        commissionPlanId: assignment.commissionPlanId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo
      }
    });
  }

  const seededCommissionCalculations = [
    {
      id: "seed-commission-calc-70-agent",
      transactionId: "seed-tx-70-christopher",
      membershipEmail: "naomi@acre.com",
      commissionPlanId: "seed-commission-plan-senior",
      recipientType: "agent",
      recipientRole: "office_admin",
      recipientName: "Naomi Chen",
      grossCommission: "3585",
      referralFee: "0",
      fees: "0",
      officeNet: "0",
      agentNet: "1085",
      statementAmount: "1085",
      status: "calculated",
      notes: "Seeded commission snapshot for active rental-side transaction.",
      calculatedAt: new Date("2026-03-08T18:00:00.000Z"),
      calculatedByEmail: "naomi@acre.com"
    },
    {
      id: "seed-commission-calc-70-brokerage",
      transactionId: "seed-tx-70-christopher",
      membershipEmail: null,
      commissionPlanId: "seed-commission-plan-senior",
      recipientType: "brokerage",
      recipientRole: "brokerage",
      recipientName: "Acre NY Realty Inc",
      grossCommission: "3585",
      referralFee: "0",
      fees: "0",
      officeNet: "2500",
      agentNet: "0",
      statementAmount: "2500",
      status: "reviewed",
      notes: "Brokerage side of seeded commission calculation.",
      calculatedAt: new Date("2026-03-08T18:00:00.000Z"),
      calculatedByEmail: "naomi@acre.com"
    },
    {
      id: "seed-commission-calc-3820-agent",
      transactionId: "seed-tx-3820-parson",
      membershipEmail: "naomi@acre.com",
      commissionPlanId: "seed-commission-plan-senior",
      recipientType: "agent",
      recipientRole: "office_admin",
      recipientName: "Naomi Chen",
      grossCommission: "18750",
      referralFee: "2500",
      fees: "0",
      officeNet: "0",
      agentNet: "6250",
      statementAmount: "6250",
      status: "payable",
      notes: "Seeded listing-side payable commission row.",
      calculatedAt: new Date("2026-03-09T15:00:00.000Z"),
      calculatedByEmail: "naomi@acre.com"
    },
    {
      id: "seed-commission-calc-3820-brokerage",
      transactionId: "seed-tx-3820-parson",
      membershipEmail: null,
      commissionPlanId: "seed-commission-plan-senior",
      recipientType: "brokerage",
      recipientRole: "brokerage",
      recipientName: "Acre NY Realty Inc",
      grossCommission: "18750",
      referralFee: "2500",
      fees: "0",
      officeNet: "10000",
      agentNet: "0",
      statementAmount: "10000",
      status: "reviewed",
      notes: "Brokerage side of listing commission.",
      calculatedAt: new Date("2026-03-09T15:00:00.000Z"),
      calculatedByEmail: "naomi@acre.com"
    },
    {
      id: "seed-commission-calc-3820-referral",
      transactionId: "seed-tx-3820-parson",
      membershipEmail: null,
      commissionPlanId: "seed-commission-plan-senior",
      recipientType: "referral",
      recipientRole: "referral",
      recipientName: "External referral partner",
      grossCommission: "18750",
      referralFee: "2500",
      fees: "0",
      officeNet: "0",
      agentNet: "0",
      statementAmount: "2500",
      status: "paid",
      notes: "Referral side already cleared.",
      calculatedAt: new Date("2026-03-09T15:00:00.000Z"),
      calculatedByEmail: "naomi@acre.com"
    },
    {
      id: "seed-commission-calc-45-agent",
      transactionId: "seed-tx-45-10-court-square",
      membershipEmail: "simon@acre.com",
      commissionPlanId: "seed-commission-plan-ops",
      recipientType: "agent",
      recipientRole: "office_manager",
      recipientName: "Simon Park",
      grossCommission: "32000",
      referralFee: "3200",
      fees: "0",
      officeNet: "0",
      agentNet: "10800",
      statementAmount: "10800",
      status: "statement_ready",
      notes: "Seeded company referral commission ready for statement.",
      calculatedAt: new Date("2026-03-10T09:30:00.000Z"),
      calculatedByEmail: "simon@acre.com"
    },
    {
      id: "seed-commission-calc-45-brokerage",
      transactionId: "seed-tx-45-10-court-square",
      membershipEmail: null,
      commissionPlanId: "seed-commission-plan-ops",
      recipientType: "brokerage",
      recipientRole: "brokerage",
      recipientName: "Acre NY Realty Inc",
      grossCommission: "32000",
      referralFee: "3200",
      fees: "0",
      officeNet: "18000",
      agentNet: "0",
      statementAmount: "18000",
      status: "reviewed",
      notes: "Brokerage net retained after referral and agent share.",
      calculatedAt: new Date("2026-03-10T09:30:00.000Z"),
      calculatedByEmail: "simon@acre.com"
    },
    {
      id: "seed-commission-calc-45-referral",
      transactionId: "seed-tx-45-10-court-square",
      membershipEmail: null,
      commissionPlanId: "seed-commission-plan-ops",
      recipientType: "referral",
      recipientRole: "referral",
      recipientName: "Acre小助手",
      grossCommission: "32000",
      referralFee: "3200",
      fees: "0",
      officeNet: "0",
      agentNet: "0",
      statementAmount: "3200",
      status: "reviewed",
      notes: "Seeded referral side for company referral scenario.",
      calculatedAt: new Date("2026-03-10T09:30:00.000Z"),
      calculatedByEmail: "simon@acre.com"
    }
  ];

  for (const calculation of seededCommissionCalculations) {
    const membership = calculation.membershipEmail ? membershipByEmail.get(calculation.membershipEmail) ?? null : null;
    const calculatedByMembership = membershipByEmail.get(calculation.calculatedByEmail) ?? null;

    await prisma.commissionCalculation.upsert({
      where: { id: calculation.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: calculation.transactionId,
        membershipId: membership?.id ?? null,
        commissionPlanId: calculation.commissionPlanId,
        accountingTransactionId: null,
        recipientType: calculation.recipientType,
        recipientRole: calculation.recipientRole,
        recipientName: calculation.recipientName,
        grossCommission: calculation.grossCommission,
        referralFee: calculation.referralFee,
        fees: calculation.fees,
        officeNet: calculation.officeNet,
        agentNet: calculation.agentNet,
        statementAmount: calculation.statementAmount,
        status: calculation.status,
        notes: calculation.notes,
        calculatedAt: calculation.calculatedAt,
        calculatedByMembershipId: calculatedByMembership?.id ?? null
      },
      create: {
        id: calculation.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: calculation.transactionId,
        membershipId: membership?.id ?? null,
        commissionPlanId: calculation.commissionPlanId,
        accountingTransactionId: null,
        recipientType: calculation.recipientType,
        recipientRole: calculation.recipientRole,
        recipientName: calculation.recipientName,
        grossCommission: calculation.grossCommission,
        referralFee: calculation.referralFee,
        fees: calculation.fees,
        officeNet: calculation.officeNet,
        agentNet: calculation.agentNet,
        statementAmount: calculation.statementAmount,
        status: calculation.status,
        notes: calculation.notes,
        calculatedAt: calculation.calculatedAt,
        calculatedByMembershipId: calculatedByMembership?.id ?? null
      }
    });
  }

  const seededEarnestMoneyRecords = [
    {
      id: "seed-emd-graham",
      transactionId: "seed-tx-graham-court",
      expectedAmount: "15000",
      dueAt: new Date("2026-03-05T00:00:00.000Z"),
      receivedAmount: "0",
      refundedAmount: "0",
      paymentDate: null,
      depositDate: null,
      heldByOffice: true,
      heldExternally: false,
      trackInLedger: true,
      status: "overdue",
      notes: "Buyer still owes earnest money."
    },
    {
      id: "seed-emd-70-christopher",
      transactionId: "seed-tx-70-christopher",
      expectedAmount: "5000",
      dueAt: new Date("2026-03-02T00:00:00.000Z"),
      receivedAmount: "5000",
      refundedAmount: "0",
      paymentDate: new Date("2026-03-03T00:00:00.000Z"),
      depositDate: new Date("2026-03-04T00:00:00.000Z"),
      heldByOffice: true,
      heldExternally: false,
      trackInLedger: true,
      status: "fully_deposited",
      notes: "Earnest money received and deposited."
    }
  ];

  for (const record of seededEarnestMoneyRecords) {
    await prisma.earnestMoneyRecord.upsert({
      where: { id: record.id },
      update: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: record.transactionId,
        expectedAmount: record.expectedAmount,
        dueAt: record.dueAt,
        receivedAmount: record.receivedAmount,
        refundedAmount: record.refundedAmount,
        paymentDate: record.paymentDate,
        depositDate: record.depositDate,
        heldByOffice: record.heldByOffice,
        heldExternally: record.heldExternally,
        trackInLedger: record.trackInLedger,
        status: record.status,
        notes: record.notes,
        createdByMembershipId: membershipByEmail.get("naomi@acre.com")?.id ?? null
      },
      create: {
        id: record.id,
        organizationId: organization.id,
        officeId: office.id,
        transactionId: record.transactionId,
        expectedAmount: record.expectedAmount,
        dueAt: record.dueAt,
        receivedAmount: record.receivedAmount,
        refundedAmount: record.refundedAmount,
        paymentDate: record.paymentDate,
        depositDate: record.depositDate,
        heldByOffice: record.heldByOffice,
        heldExternally: record.heldExternally,
        trackInLedger: record.trackInLedger,
        status: record.status,
        notes: record.notes,
        createdByMembershipId: membershipByEmail.get("naomi@acre.com")?.id ?? null
      }
    });
  }

  const seededAuditLogs = [
    {
      id: "seed-audit-transaction-created-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction",
      entityId: "seed-tx-graham-court",
      action: "transaction.created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        details: ["Status: Opportunity", "Representing: buyer", "Owner: Jane Wu"]
      }
    },
    {
      id: "seed-audit-transaction-status-court-square",
      membershipEmail: "simon@acre.com",
      entityType: "transaction",
      entityId: "seed-tx-45-10-court-square",
      action: "transaction.status_changed",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-45-10-court-square",
        transactionLabel: "45-10 Court Square W · 45-10 Court Square W, Long Island City, NY",
        objectLabel: "45-10 Court Square W · 45-10 Court Square W, Long Island City, NY",
        details: ["Status: Active -> Pending"]
      }
    },
    {
      id: "seed-audit-transaction-contact-linked-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction",
      entityId: "seed-tx-graham-court",
      action: "transaction.contact_linked",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        contactId: "seed-client-evelyn",
        contactName: "Evelyn Zhao",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        details: ["Contact: Evelyn Zhao", "Role: Buyer", "Primary contact: Yes"]
      }
    },
    {
      id: "seed-audit-transaction-primary-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction",
      entityId: "seed-tx-graham-court",
      action: "transaction.primary_contact_changed",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        contactId: "seed-client-evelyn",
        contactName: "Evelyn Zhao",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        details: ["Previous primary: None", "New primary: Evelyn Zhao"]
      }
    },
    {
      id: "seed-audit-transaction-finance-parson",
      membershipEmail: "naomi@acre.com",
      entityType: "transaction",
      entityId: "seed-tx-3820-parson",
      action: "transaction.finance_updated",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-3820-parson",
        transactionLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        objectLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        details: [
          "Gross commission: $18,750",
          "Referral fee: $2,500",
          "Office net: $10,000",
          "Agent net: $6,250"
        ]
      }
    },
    {
      id: "seed-audit-task-created-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction_task",
      entityId: "seed-transaction-task-graham-contract",
      action: "transaction.task_created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        taskId: "seed-transaction-task-graham-contract",
        taskTitle: "Collect signed buyer agreement",
        objectLabel: "Collect signed buyer agreement · Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        details: ["Group: Contract", "Status: Todo", "Due: 2026-03-14"]
      }
    },
    {
      id: "seed-audit-task-updated-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction_task",
      entityId: "seed-transaction-task-graham-intro",
      action: "transaction.task_updated",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        taskId: "seed-transaction-task-graham-intro",
        taskTitle: "Send attorney introduction",
        objectLabel: "Send attorney introduction · Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        details: ["Status: Todo -> In progress"]
      }
    },
    {
      id: "seed-audit-task-completed-court-square",
      membershipEmail: "simon@acre.com",
      entityType: "transaction_task",
      entityId: "seed-transaction-task-court-square-invoice",
      action: "transaction.task_completed",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-45-10-court-square",
        taskId: "seed-transaction-task-court-square-invoice",
        taskTitle: "Upload vendor invoice package",
        objectLabel: "Upload vendor invoice package · 45-10 Court Square W · 45-10 Court Square W, Long Island City, NY",
        details: ["Status: In progress -> Completed"]
      }
    },
    {
      id: "seed-audit-contact-created-evelyn",
      membershipEmail: "jane@acre.com",
      entityType: "contact",
      entityId: "seed-client-evelyn",
      action: "contact.created",
      payload: {
        officeId: office.id,
        contactId: "seed-client-evelyn",
        contactName: "Evelyn Zhao",
        objectLabel: "Evelyn Zhao · evelyn@example.com",
        details: ["Stage: Warm", "Intent: Investor"]
      }
    },
    {
      id: "seed-audit-contact-updated-iris",
      membershipEmail: "naomi@acre.com",
      entityType: "contact",
      entityId: "seed-client-iris",
      action: "contact.updated",
      payload: {
        officeId: office.id,
        contactId: "seed-client-iris",
        contactName: "Iris Chen",
        objectLabel: "Iris Chen · iris@example.com",
        details: ["Stage: New -> Nurture", "Notes: rental timing updated"]
      }
    },
    {
      id: "seed-audit-document-uploaded-graham-contract",
      membershipEmail: "jane@acre.com",
      entityType: "transaction_document",
      entityId: "seed-doc-graham-contract-upload",
      action: "document.uploaded",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Buyer agreement upload",
        details: ["Document type: Buyer agreement", "Status: Submitted", "Linked task: Collect signed buyer agreement"]
      }
    },
    {
      id: "seed-audit-form-created-graham",
      membershipEmail: "jane@acre.com",
      entityType: "transaction_form",
      entityId: "seed-form-graham-buyer-agreement",
      action: "form.created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Graham Court buyer agreement packet",
        details: ["Template: Buyer agreement packet", "Status: Fully signed"]
      }
    },
    {
      id: "seed-audit-signature-completed-graham",
      membershipEmail: "jane@acre.com",
      entityType: "signature_request",
      entityId: "seed-signature-graham-buyer",
      action: "signature_request.completed",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Signature request · Evelyn Zhao",
        details: ["Recipient: Evelyn Zhao", "Status: Signed", "Completed: Mar 10, 2026"]
      }
    },
    {
      id: "seed-audit-incoming-update-received-graham",
      membershipEmail: "jane@acre.com",
      entityType: "incoming_update",
      entityId: "seed-incoming-graham-closing-review",
      action: "incoming_update.received",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Closing date revision requires review",
        details: ["Source: Manual test feed", "Status: Pending review"]
      }
    },
    {
      id: "seed-audit-incoming-update-rejected-graham",
      membershipEmail: "simon@acre.com",
      entityType: "incoming_update",
      entityId: "seed-incoming-graham-price-rejected",
      action: "incoming_update.rejected",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Unsupported outside price revision was rejected",
        details: ["Source: Manual test feed", "Decision: Rejected"]
      }
    },
    {
      id: "seed-audit-accounting-invoice-parson",
      membershipEmail: "naomi@acre.com",
      entityType: "accounting_transaction",
      entityId: "seed-acct-invoice-parson",
      action: "accounting.invoice_created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-3820-parson",
        transactionLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        objectLabel: "Invoice INV-3820-01",
        details: ["Type: Invoice", "Status: Open", "Amount: $18,750"]
      }
    },
    {
      id: "seed-audit-accounting-payment-parson",
      membershipEmail: "naomi@acre.com",
      entityType: "accounting_transaction",
      entityId: "seed-acct-payment-parson",
      action: "accounting.payment_received",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-3820-parson",
        transactionLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        objectLabel: "Received payment PAY-3820-01",
        details: ["Type: Received payment", "Status: Completed", "Amount: $18,750"]
      }
    },
    {
      id: "seed-audit-accounting-bill-referral",
      membershipEmail: "naomi@acre.com",
      entityType: "accounting_transaction",
      entityId: "seed-acct-bill-referral",
      action: "accounting.bill_created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-3820-parson",
        transactionLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        objectLabel: "Bill BILL-3820-REF",
        details: ["Type: Bill", "Status: Open", "Amount: $2,500"]
      }
    },
    {
      id: "seed-audit-accounting-payment-made-referral",
      membershipEmail: "naomi@acre.com",
      entityType: "accounting_transaction",
      entityId: "seed-acct-payment-referral",
      action: "accounting.payment_made",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-3820-parson",
        transactionLabel: "3820 Parson Blvd · 3820 Parson Blvd, Flushing, NY",
        objectLabel: "Made payment CHK-3820-REF",
        details: ["Type: Made payment", "Status: Completed", "Amount: $2,500"]
      }
    },
    {
      id: "seed-audit-emd-expected-graham",
      membershipEmail: "naomi@acre.com",
      entityType: "earnest_money",
      entityId: "seed-emd-graham",
      action: "emd.expected_created",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-graham-court",
        transactionLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        objectLabel: "Graham Court 4F · Graham Court 4F, Brooklyn, NY",
        contextHref: "/office/accounting#earnest-money",
        details: ["Expected amount: $15,000", "Due: Mar 5, 2026"]
      }
    },
    {
      id: "seed-audit-emd-received-70",
      membershipEmail: "naomi@acre.com",
      entityType: "earnest_money",
      entityId: "seed-emd-70-christopher",
      action: "emd.received",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-70-christopher",
        transactionLabel: "70 Christopher Columbus Dr · 70 Christopher Columbus Dr, Jersey City, NJ",
        objectLabel: "70 Christopher Columbus Dr · 70 Christopher Columbus Dr, Jersey City, NJ",
        contextHref: "/office/accounting#earnest-money",
        details: ["Received amount: $5,000", "Status: Fully deposited"]
      }
    },
    {
      id: "seed-audit-commission-plan-created-senior",
      membershipEmail: "naomi@acre.com",
      entityType: "commission_plan",
      entityId: "seed-commission-plan-senior",
      action: "commission.plan_created",
      payload: {
        officeId: office.id,
        objectLabel: "Senior agent split",
        contextHref: "/office/accounting#commissions",
        details: ["Mode: Split & fees", "Active rules: 4"]
      }
    },
    {
      id: "seed-audit-commission-plan-assigned-jane",
      membershipEmail: "naomi@acre.com",
      entityType: "commission_plan",
      entityId: "seed-commission-assignment-jane",
      action: "commission.plan_assigned",
      payload: {
        officeId: office.id,
        objectLabel: "Senior agent split · Jane Wu",
        contextHref: `/office/agents/${membershipByEmail.get("jane@acre.com")?.id ?? ""}`,
        details: ["Plan: Senior agent split", "Agent: Jane Wu", "Effective from: 2025-09-01"]
      }
    },
    {
      id: "seed-audit-commission-calculated-court-square",
      membershipEmail: "simon@acre.com",
      entityType: "commission_calculation",
      entityId: "seed-commission-calc-45-agent",
      action: "commission.calculated",
      payload: {
        officeId: office.id,
        transactionId: "seed-tx-45-10-court-square",
        transactionLabel: "45-10 Court Square W · 45-10 Court Square W, Long Island City, NY",
        objectLabel: "45-10 Court Square W · 45-10 Court Square W, Long Island City, NY",
        contextHref: "/office/transactions/seed-tx-45-10-court-square#commission",
        details: ["Plan: Operations manager split", "Agent net: $10,800", "Office net: $18,000"]
      }
    },
    {
      id: "seed-audit-commission-statement-naomi",
      membershipEmail: "naomi@acre.com",
      entityType: "commission_statement",
      entityId: "seed-commission-statement-naomi",
      action: "commission.statement_generated",
      payload: {
        officeId: office.id,
        objectLabel: "Naomi Chen commission statement",
        contextHref: "/office/accounting#commissions",
        details: ["Agent: Naomi Chen", "Statement-ready: $0", "Payable: $6,250"]
      }
    }
  ];

  for (const auditLog of seededAuditLogs) {
    const membership = auditLog.membershipEmail ? membershipByEmail.get(auditLog.membershipEmail) ?? null : null;

    await prisma.auditLog.upsert({
      where: { id: auditLog.id },
      update: {
        organizationId: organization.id,
        membershipId: membership?.id ?? null,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        action: auditLog.action,
        payload: auditLog.payload
      },
      create: {
        id: auditLog.id,
        organizationId: organization.id,
        membershipId: membership?.id ?? null,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        action: auditLog.action,
        payload: auditLog.payload
      }
    });
  }

  console.log(
    `Seeded organization ${organization.slug} with office ${office.slug}, ${memberships.length} memberships, ${seededAgentProfiles.length} agent profiles, ${seededTeams.length} teams, ${seededRequiredContactRoleSettings.length} required contact role settings, ${seededTransactionFieldSettings.length} transaction field settings, ${seededChecklistTemplates.length} checklist templates, ${seededAgentOnboardingTemplates.length} onboarding templates, ${seededAgentOnboardingItems.length} onboarding items, ${seededAgentGoals.length} agent goals, ${seededTransactions.length} transactions, ${seededClients.length} clients, ${seededTasks.length} follow-up tasks, ${seededEvents.length} events, ${seededNotifications.length} notifications, ${seededTransactionTasks.length} transaction tasks, ${seededLibraryFolders.length} library folders, ${seededLibraryDocuments.length} library documents, ${seededFormTemplates.length} form templates, ${seededTransactionDocuments.length} transaction documents, ${seededTransactionForms.length} transaction forms, ${seededSignatureRequests.length} signature requests, ${seededIncomingUpdates.length} incoming updates, ${seededLedgerAccounts.length} ledger accounts, ${seededAccountingTransactions.length} accounting transactions, ${seededCommissionPlans.length} commission plans, ${seededCommissionAssignments.length} commission assignments, ${seededCommissionCalculations.length} commission calculations, ${seededEarnestMoneyRecords.length} earnest money records, and ${seededAuditLogs.length} audit logs.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
