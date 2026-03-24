import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  createOfficeTransactionCustomFieldDefinition,
  deleteOfficeCustomFieldDefinition,
  getOfficeTransactionIntakeSchema,
  saveOfficeFieldSettings
} from "./field-settings.ts";
import {
  createTransaction,
  getOfficeTransactionSearchLayoutSnapshot,
  listTransactions,
  saveOfficeTransactionSearchLayout,
  updateTransactionIntake
} from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createTransactionsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Transactions Test ${suffix}`,
      slug: `transactions-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Transactions Office ${suffix}`,
      slug: `transactions-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true
      }
    });
    trackedUserIds.push(user.id);

    const membership = await prisma.membership.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        userId: user.id,
        role,
        status: "active",
        title: role,
        permissions: Prisma.JsonNull
      }
    });

    return {
      user,
      membership
    };
  }

  const admin = await createMembership("office_admin", `transactions-admin-${suffix}`);

  return {
    organization,
    office,
    adminMembership: admin.membership,
    createMembership,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id
        }
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds
          }
        }
      });
    }
  };
}

function buildTransactionBuiltInSettingsInput(
  schema: Awaited<ReturnType<typeof getOfficeTransactionIntakeSchema>>,
  visibilityOverrides: Partial<Record<string, boolean>> = {}
) {
  return schema.builtInFields.map((field) => ({
    fieldKey: field.fieldKey,
    isRequired: field.isRequired,
    isVisible: visibilityOverrides[field.fieldKey] ?? field.isVisible,
    sortOrder: field.sortOrder,
    selectOptions:
      field.control === "select"
        ? field.selectOptions.map((option) => ({
            value: option.value,
            label: option.label,
            isEnabled: option.isEnabled
          }))
        : undefined
  }));
}

test("updateTransactionIntake preserves finance columns for actors without finance permission", async () => {
  const context = await createTransactionsTestContext();

  try {
    const owner = await context.createMembership("agent", "transaction-owner");
    const transaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: owner.membership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "10 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: "Initial Transaction",
      price: "500000",
      grossCommission: "12000",
      referralFee: "1500",
      financeNotes: "Original note",
      additionalFields: {
        commissionAmount: "12000",
        referralFee: "1500",
        note: "Original note",
        customOpsNote: "Before"
      }
    });

    const updated = await updateTransactionIntake({
      organizationId: context.organization.id,
      transactionId: transaction.id,
      actorMembershipId: owner.membership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "25 Updated Ave",
      city: "New York",
      state: "NY",
      zipCode: "10002",
      transactionName: "Updated Transaction",
      price: "525000",
      additionalFields: {
        commissionAmount: "99999",
        referralFee: "9999",
        note: "Unauthorized finance edit",
        customOpsNote: "After"
      }
    });

    assert.ok(updated);

    const storedTransaction = await prisma.transaction.findUnique({
      where: {
        id: transaction.id
      }
    });

    const storedAdditionalFields =
      storedTransaction?.additionalFields && typeof storedTransaction.additionalFields === "object" && !Array.isArray(storedTransaction.additionalFields)
        ? (storedTransaction.additionalFields as Record<string, string>)
        : {};

    assert.equal(storedTransaction?.address, "25 Updated Ave");
    assert.equal(String(storedTransaction?.grossCommission), "12000");
    assert.equal(String(storedTransaction?.referralFee), "1500");
    assert.equal(storedTransaction?.financeNotes, "Original note");
    assert.equal(storedAdditionalFields.commissionAmount, "12000");
    assert.equal(storedAdditionalFields.referralFee, "1500");
    assert.equal(storedAdditionalFields.note, "Original note");
    assert.equal(storedAdditionalFields.customOpsNote, "After");
  } finally {
    await context.cleanup();
  }
});

test("createTransaction and updateTransactionIntake keep asking price, purchased price, legacy price, and move-in date aligned", async () => {
  const context = await createTransactionsTestContext();

  try {
    const owner = await context.createMembership("agent", "price-bridge-owner");
    const created = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "88 Bridge St",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      transactionName: "Bridge Transaction",
      askingPrice: "810000",
      price: "775000",
      moveInDate: "2026-06-20"
    });

    const storedAfterCreate = await prisma.transaction.findUnique({
      where: {
        id: created.id
      },
      select: {
        askingPrice: true,
        purchasedPrice: true,
        price: true,
        moveInDate: true
      }
    });

    assert.equal(String(storedAfterCreate?.askingPrice), "810000");
    assert.equal(String(storedAfterCreate?.purchasedPrice), "775000");
    assert.equal(String(storedAfterCreate?.price), "775000");
    assert.equal(storedAfterCreate?.moveInDate?.toISOString().slice(0, 10), "2026-06-20");

    await updateTransactionIntake({
      organizationId: context.organization.id,
      transactionId: created.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "88 Bridge St",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      transactionName: "Bridge Transaction",
      askingPrice: "825000",
      purchasedPrice: "790000",
      moveInDate: "2026-07-01"
    });

    const storedAfterUpdate = await prisma.transaction.findUnique({
      where: {
        id: created.id
      },
      select: {
        askingPrice: true,
        purchasedPrice: true,
        price: true,
        moveInDate: true
      }
    });

    assert.equal(String(storedAfterUpdate?.askingPrice), "825000");
    assert.equal(String(storedAfterUpdate?.purchasedPrice), "790000");
    assert.equal(String(storedAfterUpdate?.price), "790000");
    assert.equal(storedAfterUpdate?.moveInDate?.toISOString().slice(0, 10), "2026-07-01");
  } finally {
    await context.cleanup();
  }
});

test("getOfficeTransactionSearchLayoutSnapshot returns the default layout and legacy filter params", async () => {
  const context = await createTransactionsTestContext();

  try {
    const snapshot = await getOfficeTransactionSearchLayoutSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      searchParams: {
        q: "Main Street",
        status: "Pending",
        type: "sales",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        ownerMembershipId: "missing-owner",
        teamId: "missing-team"
      }
    });

    assert.deepEqual(
      snapshot.selectedFields.map((field) => `${field.kind}:${field.key}`),
      [
        "system:search",
        "system:owner",
        "system:team",
        "system:created_at",
        "builtin:transaction_type",
        "builtin:transaction_status",
        "custom:invoiceNumber",
        "custom:buyerTenant",
        "custom:buildingName",
        "custom:additionalAddress",
        "custom:unitNumber",
        "custom:additionalCity",
        "custom:additionalState",
        "builtin:zip_code",
        "custom:moveInDateClosingDate",
        "custom:commissionType",
        "custom:commissionAmount"
      ]
    );
    assert.equal(snapshot.filters.system.q, "Main Street");
    assert.equal(snapshot.filters.system.ownerMembershipId, "");
    assert.equal(snapshot.filters.system.teamId, "");
    assert.equal(snapshot.filters.system.createdAt.from, "2026-01-01");
    assert.equal(snapshot.filters.system.createdAt.to, "2026-01-31");
    assert.equal(snapshot.filters.builtin.transaction_status.value, "pending");
    assert.equal(snapshot.filters.builtin.transaction_type.value, "sales");
    assert.equal(snapshot.listFilters.status, "Pending");
    assert.equal(snapshot.listFilters.type, "sales");
    assert.equal(snapshot.listFilters.startDate, "2026-01-01");
    assert.equal(snapshot.listFilters.endDate, "2026-01-31");
    assert.equal(snapshot.availableFields.some((field) => field.kind === "custom" && field.key === "agentName"), false);
  } finally {
    await context.cleanup();
  }
});

test("getOfficeTransactionSearchLayoutSnapshot removes hidden and archived saved fields", async () => {
  const context = await createTransactionsTestContext();

  try {
    await createOfficeTransactionCustomFieldDefinition({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      label: "Search Note",
      type: "text"
    });

    await saveOfficeTransactionSearchLayout({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      fields: [
        { kind: "system", key: "search" },
        { kind: "builtin", key: "price" },
        { kind: "custom", key: "custom_search_note" }
      ]
    });

    const schema = await getOfficeTransactionIntakeSchema({
      organizationId: context.organization.id,
      officeId: context.office.id
    });

    await saveOfficeFieldSettings({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      module: "transaction",
      builtInFieldSettings: buildTransactionBuiltInSettingsInput(schema, {
        price: false
      })
    });

    await deleteOfficeCustomFieldDefinition({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      module: "transaction",
      fieldKey: "custom_search_note"
    });

    const snapshot = await getOfficeTransactionSearchLayoutSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });
    const savedRecord = await prisma.transactionSearchLayout.findFirst({
      where: {
        organizationId: context.organization.id,
        officeId: context.office.id
      }
    });

    assert.deepEqual(snapshot.savedLayout, [{ kind: "system", key: "search" }]);
    assert.deepEqual(snapshot.selectedFields.map((field) => `${field.kind}:${field.key}`), ["system:search"]);
    assert.deepEqual(savedRecord?.fieldLayout, [{ kind: "system", key: "search" }]);
  } finally {
    await context.cleanup();
  }
});

test("listTransactions applies dynamic built-in field filters", async () => {
  const context = await createTransactionsTestContext();

  try {
    const owner = await context.createMembership("agent", "dynamic-builtin-owner");

    const juneClosing = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "10 Hudson St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: "June Closing",
      price: "500000",
      closingDate: "2026-06-15"
    });

    const sellerDeal = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "active",
      representing: "seller",
      address: "22 Beacon St",
      city: "Boston",
      state: "MA",
      zipCode: "02108",
      transactionName: "Seller Deal",
      price: "620000",
      closingDate: "2026-07-20"
    });

    const sellerNyDeal = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales_listing",
      transactionStatus: "active",
      representing: "seller",
      address: "35 Fifth Ave",
      city: "New York",
      state: "NY",
      zipCode: "10010",
      transactionName: "Seller NY Deal",
      price: "710000",
      closingDate: "2026-05-01"
    });

    const cityResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "builtin",
          key: "city",
          control: "text",
          value: "new york"
        }
      ]
    });
    const representingResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "builtin",
          key: "representing",
          control: "select",
          value: "seller"
        }
      ]
    });
    const closingDateResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "builtin",
          key: "closing_date",
          control: "date",
          from: "2026-06-01",
          to: "2026-06-30"
        }
      ]
    });

    assert.deepEqual(
      [...new Set(cityResult.transactions.map((transaction) => transaction.id))].sort(),
      [juneClosing.id, sellerNyDeal.id].sort()
    );
    assert.deepEqual(
      [...new Set(representingResult.transactions.map((transaction) => transaction.id))].sort(),
      [sellerDeal.id, sellerNyDeal.id].sort()
    );
    assert.deepEqual(closingDateResult.transactions.map((transaction) => transaction.id), [juneClosing.id]);
  } finally {
    await context.cleanup();
  }
});

test("listTransactions applies dynamic custom field filters", async () => {
  const context = await createTransactionsTestContext();

  try {
    const owner = await context.createMembership("agent", "dynamic-custom-owner");

    await createOfficeTransactionCustomFieldDefinition({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      label: "Search Note",
      type: "text"
    });
    await createOfficeTransactionCustomFieldDefinition({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      label: "Deal Channel",
      type: "select",
      options: ["Referral", "Portal"]
    });
    await createOfficeTransactionCustomFieldDefinition({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      label: "Target Close",
      type: "date"
    });

    const vipDeal = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "active",
      representing: "buyer",
      address: "88 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10003",
      transactionName: "VIP Deal",
      price: "880000",
      additionalFields: {
        custom_search_note: "VIP buyer",
        custom_deal_channel: "Referral",
        custom_target_close: "2026-08-10"
      }
    });

    const portalDeal = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "seller",
      address: "120 Broadway",
      city: "New York",
      state: "NY",
      zipCode: "10004",
      transactionName: "Portal Deal",
      price: "540000",
      additionalFields: {
        custom_search_note: "Portal lead",
        custom_deal_channel: "Portal",
        custom_target_close: "2026-09-15"
      }
    });

    const referralLease = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: owner.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "rental_leasing",
      transactionStatus: "active",
      representing: "tenant",
      address: "9 Court Sq",
      city: "Long Island City",
      state: "NY",
      zipCode: "11101",
      transactionName: "Referral Lease",
      price: "4200",
      additionalFields: {
        custom_search_note: "Referral tenant",
        custom_deal_channel: "Referral",
        custom_target_close: "2026-09-20"
      }
    });

    const textResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "custom",
          key: "custom_search_note",
          control: "text",
          value: "vip"
        }
      ]
    });
    const selectResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "custom",
          key: "custom_deal_channel",
          control: "select",
          value: "Referral"
        }
      ]
    });
    const dateResult = await listTransactions({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      fieldFilters: [
        {
          kind: "custom",
          key: "custom_target_close",
          control: "date",
          from: "2026-09-01",
          to: "2026-09-30"
        }
      ]
    });

    assert.deepEqual(textResult.transactions.map((transaction) => transaction.id), [vipDeal.id]);
    assert.deepEqual(
      [...new Set(selectResult.transactions.map((transaction) => transaction.id))].sort(),
      [vipDeal.id, referralLease.id].sort()
    );
    assert.deepEqual(
      [...new Set(dateResult.transactions.map((transaction) => transaction.id))].sort(),
      [portalDeal.id, referralLease.id].sort()
    );
  } finally {
    await context.cleanup();
  }
});
