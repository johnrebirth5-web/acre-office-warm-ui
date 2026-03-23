import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import { createTransaction, updateTransactionIntake } from "./transactions.ts";

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

  return {
    organization,
    office,
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
