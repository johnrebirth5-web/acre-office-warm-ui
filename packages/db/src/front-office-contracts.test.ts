import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { FrontOfficeHandoffStatus, Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  commitFrontOfficeHandoffDraft,
  getFrontOfficeHandoffPrefill,
} from "./front-office-contracts.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createFrontOfficeHandoffContractTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `FO Contracts Test ${suffix}`,
      slug: `fo-contracts-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `FO Contracts Office ${suffix}`,
      slug: `fo-contracts-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true,
      },
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
        permissions: Prisma.JsonNull,
      },
    });

    return { user, membership };
  }

  const admin = await createMembership("office_admin", "contracts-admin");
  const agent = await createMembership("agent", "contracts-agent");

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      ownerMembershipId: agent.membership.id,
      fullName: `Contracts Client ${suffix}`,
      email: `contracts-client-${suffix}@example.com`,
      phone: "2125550148",
      source: "Regression test",
      stage: "Negotiation",
      intent: "Buyer",
      preferredAreas: ["Brooklyn"],
      additionalFields: {},
    },
  });

  const handoffDraft = await prisma.frontOfficeHandoffDraft.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      clientId: client.id,
      ownerMembershipId: admin.membership.id,
      status: FrontOfficeHandoffStatus.ready,
      targetWorkflow: "transaction",
      stageLabel: "Negotiation",
      summary: `Back Office handoff for ${client.fullName}`,
      metadata: Prisma.JsonNull,
    },
  });

  return {
    organization,
    office,
    adminMembership: admin.membership,
    agentMembership: agent.membership,
    client,
    handoffDraft,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      });
    },
  };
}

test("handoff claim is exclusive until it is released or committed", async () => {
  const context = await createFrontOfficeHandoffContractTestContext();

  try {
    const claim = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      actorMembershipId: context.adminMembership.id,
      mode: "claim",
    });

    assert.equal(claim.ok, true);
    assert.equal(claim.mode, "claim");
    assert.equal(claim.reason, "claimed");
    assert.ok(claim.claimToken);

    const prefill = await getFrontOfficeHandoffPrefill({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      officeId: context.office.id,
    });

    assert.equal(prefill.kind, "submitting");
    assert.equal(prefill.handoffStatus, FrontOfficeHandoffStatus.draft);

    const competingClaim = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      actorMembershipId: context.agentMembership.id,
      mode: "claim",
    });

    assert.equal(competingClaim.ok, false);
    assert.equal(competingClaim.reason, "submission_in_progress");
    assert.equal(competingClaim.claimToken, claim.claimToken);

    const release = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      actorMembershipId: context.adminMembership.id,
      claimToken: claim.claimToken ?? undefined,
      mode: "release",
    });

    assert.equal(release.ok, true);
    assert.equal(release.reason, "released");

    const releasedPrefill = await getFrontOfficeHandoffPrefill({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      officeId: context.office.id,
    });

    assert.equal(releasedPrefill.kind, "available");
  } finally {
    await context.cleanup();
  }
});

test("handoff commit clears the active claim and keeps the committed transaction stable", async () => {
  const context = await createFrontOfficeHandoffContractTestContext();

  try {
    const claim = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      actorMembershipId: context.adminMembership.id,
      mode: "claim",
    });

    assert.equal(claim.ok, true);
    assert.ok(claim.claimToken);

    const transaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "100 Claim St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: "Claim Commit Transaction",
      price: "750000",
    });

    const commit = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      transactionId: transaction.id,
      claimToken: claim.claimToken ?? undefined,
      mode: "commit",
    });

    assert.equal(commit.ok, true);
    assert.equal(commit.reason, "committed");
    assert.equal(commit.committedTransactionId, transaction.id);

    const staleCommit = await commitFrontOfficeHandoffDraft({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      transactionId: randomUUID(),
      mode: "commit",
    });

    assert.equal(staleCommit.ok, false);
    assert.equal(staleCommit.reason, "already_committed");
    assert.equal(staleCommit.committedTransactionId, transaction.id);

    const committedPrefill = await getFrontOfficeHandoffPrefill({
      organizationId: context.organization.id,
      handoffDraftId: context.handoffDraft.id,
      officeId: context.office.id,
    });

    assert.equal(committedPrefill.kind, "committed");
    assert.equal(committedPrefill.committedTransactionId, transaction.id);
  } finally {
    await context.cleanup();
  }
});
