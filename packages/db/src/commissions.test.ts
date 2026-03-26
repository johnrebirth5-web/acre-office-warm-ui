import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type MembershipStatus, type UserRole } from "@prisma/client";
import { createAgentPayoutStatement, getOfficeAgentPayoutStatementsWorkspaceSnapshot } from "./agent-payout-statements.ts";
import { prisma } from "./client.ts";
import {
  calculateTransactionCommission,
  getTransactionCommissionSnapshot,
  normalizeTransactionFinanceFeeForPersistence,
  overrideTransactionCommission
} from "./commissions.ts";
import { getOfficeDashboardBusinessSnapshot } from "./dashboard.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createCommissionOverrideTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Commission Override Test ${suffix}`,
      slug: `commission-override-test-${suffix}`
    }
  });

  const primaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Primary Office ${suffix}`,
      slug: `primary-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const secondaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Secondary Office ${suffix}`,
      slug: `secondary-office-${suffix}`,
      market: "New York",
      isPrimary: false
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string, officeId: string, status: MembershipStatus = "active") {
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

    return prisma.membership.create({
      data: {
        organizationId: organization.id,
        officeId,
        userId: user.id,
        role,
        status,
        title: role,
        permissions: Prisma.JsonNull
      },
      include: {
        user: true,
        office: true
      }
    });
  }

  const ownerMembership = await createMembership("owner", "override-owner", primaryOffice.id);
  const primaryAgentMembership = await createMembership("agent", "override-primary-agent", primaryOffice.id);
  const officeAdminMembership = await createMembership("office_admin", "override-admin", primaryOffice.id);
  const officeUserMembership = await createMembership("office_user", "override-office-user", secondaryOffice.id);
  const invitedOfficeUserMembership = await createMembership("office_user", "override-invited-office-user", secondaryOffice.id, "invited");

  async function createCalculatedTransaction() {
    const transaction = await createTransaction({
      organizationId: organization.id,
      officeId: primaryOffice.id,
      ownerMembershipId: primaryAgentMembership.id,
      actorMembershipId: ownerMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: "500 Override Avenue",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: `Override Deal ${suffix}`,
      askingPrice: "1000000",
      purchasedPrice: "980000",
      grossCommission: "5000",
      closingDate: "2026-03-20",
      additionalFields: {
        invoiceNumber: `INV-${suffix}`
      }
    });

    const stakeholderBreakdown = [
      {
        key: primaryAgentMembership.id,
        membershipId: primaryAgentMembership.id,
        recipientLabel: `${primaryAgentMembership.user.firstName} ${primaryAgentMembership.user.lastName}`.trim(),
        recipientRole: "Agent",
        recipientRoleValue: "agent",
        recipientType: "agent",
        isManualParticipant: false,
        sharePercent: "80",
        baseAmount: "4000",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: "4000"
      },
      {
        key: "company",
        membershipId: "",
        recipientLabel: "Company",
        recipientRole: "Brokerage",
        recipientRoleValue: "brokerage",
        recipientType: "brokerage",
        isManualParticipant: false,
        sharePercent: "20",
        baseAmount: "1000",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: "1000"
      }
    ] satisfies Prisma.InputJsonValue;

    const version = await prisma.transactionFinanceCalculationVersion.create({
      data: {
        organizationId: organization.id,
        officeId: primaryOffice.id,
        transactionId: transaction.id,
        versionNumber: 1,
        sourceType: "calculated",
        isCurrent: true,
        grossCommission: new Prisma.Decimal(5000),
        preSplitTotal: new Prisma.Decimal(0),
        postSplitTotal: new Prisma.Decimal(0),
        netCommissionBase: new Prisma.Decimal(5000),
        reimbursementAmount: new Prisma.Decimal(0),
        finalAgentNet: new Prisma.Decimal(4000),
        finalOfficeNet: new Prisma.Decimal(1000),
        feeBreakdown: [] satisfies Prisma.InputJsonValue,
        stakeholderBreakdown,
        blockingIssues: [] satisfies Prisma.InputJsonValue,
        notes: "Initial calculation",
        createdByMembershipId: ownerMembership.id
      }
    });

    await prisma.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        referralFee: new Prisma.Decimal(0),
        officeNet: new Prisma.Decimal(1000),
        agentNet: new Prisma.Decimal(4000)
      }
    });

    await prisma.commissionCalculation.createMany({
      data: [
        {
          organizationId: organization.id,
          officeId: primaryOffice.id,
          transactionId: transaction.id,
          transactionFinanceCalculationVersionId: version.id,
          membershipId: primaryAgentMembership.id,
          recipientType: "agent",
          recipientRole: "agent",
          recipientName: `${primaryAgentMembership.user.firstName} ${primaryAgentMembership.user.lastName}`.trim(),
          grossCommission: new Prisma.Decimal(5000),
          referralFee: new Prisma.Decimal(0),
          fees: new Prisma.Decimal(0),
          officeNet: new Prisma.Decimal(0),
          agentNet: new Prisma.Decimal(4000),
          statementAmount: new Prisma.Decimal(4000),
          status: "calculated",
          calculatedAt: new Date("2026-03-21T00:00:00.000Z"),
          calculatedByMembershipId: ownerMembership.id
        },
        {
          organizationId: organization.id,
          officeId: primaryOffice.id,
          transactionId: transaction.id,
          transactionFinanceCalculationVersionId: version.id,
          membershipId: null,
          recipientType: "brokerage",
          recipientRole: "brokerage",
          recipientName: "Company",
          grossCommission: new Prisma.Decimal(5000),
          referralFee: new Prisma.Decimal(0),
          fees: new Prisma.Decimal(0),
          officeNet: new Prisma.Decimal(1000),
          agentNet: new Prisma.Decimal(0),
          statementAmount: new Prisma.Decimal(1000),
          status: "calculated",
          calculatedAt: new Date("2026-03-21T00:00:00.000Z"),
          calculatedByMembershipId: ownerMembership.id
        }
      ]
    });

    return transaction;
  }

  return {
    organization,
    primaryOffice,
    secondaryOffice,
    ownerMembership,
    primaryAgentMembership,
    officeAdminMembership,
    officeUserMembership,
    invitedOfficeUserMembership,
    createCalculatedTransaction,
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

test("clearing a finance fee removes stored rate and amount instead of restoring defaults", () => {
  const normalized = normalizeTransactionFinanceFeeForPersistence({
    feeType: "rebate",
    grossCommission: new Prisma.Decimal(100000),
    existingRate: new Prisma.Decimal(20),
    existingAmount: new Prisma.Decimal(20000),
    existingCalculationType: "pre_split",
    existingApprovalStatus: "not_required",
    rate: null,
    amount: null,
    selectedCalculationType: null,
    requestedApprovalStatus: null,
    notes: null
  });

  assert.equal(normalized.rate, null);
  assert.equal(normalized.amount, null);
  assert.equal(normalized.selectedCalculationType, "pre_split");
  assert.equal(normalized.approvalRequired, false);
  assert.equal(normalized.approvalStatus, "not_required");
});

test("explicit finance fee rate still derives amount from gross commission", () => {
  const normalized = normalizeTransactionFinanceFeeForPersistence({
    feeType: "client_referral",
    grossCommission: new Prisma.Decimal(100000),
    existingRate: null,
    existingAmount: null,
    existingCalculationType: "pre_split",
    existingApprovalStatus: "not_required",
    rate: new Prisma.Decimal(2),
    amount: null,
    selectedCalculationType: "pre_split",
    requestedApprovalStatus: null,
    notes: null
  });

  assert.equal(normalized.rate?.toString(), "2");
  assert.equal(normalized.amount?.toString(), "2000");
  assert.equal(normalized.selectedCalculationType, "pre_split");
});

test("office admin can add a manual membership participant and the participant sees self-service income and statements", async () => {
  const context = await createCommissionOverrideTestContext();

  try {
    const transaction = await context.createCalculatedTransaction();
    const snapshot = await overrideTransactionCommission({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      transactionId: transaction.id,
      overrideReason: "Referral agent added manually",
      notes: "Cross-office referral participant",
      stakeholderRows: [
        {
          key: context.primaryAgentMembership.id,
          membershipId: context.primaryAgentMembership.id,
          amount: "3000"
        },
        {
          key: context.officeUserMembership.id,
          membershipId: context.officeUserMembership.id,
          amount: "1000"
        },
        {
          key: "company",
          membershipId: "",
          amount: "1000"
        }
      ],
      actorMembershipId: context.officeAdminMembership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.manualParticipantLockActive, true);
    const manualRow = snapshot?.stakeholderBreakdown.find((row) => row.membershipId === context.officeUserMembership.id) ?? null;
    assert.ok(manualRow);
    assert.equal(manualRow?.isManualParticipant, true);
    assert.equal(manualRow?.sharePercentLabel, "Manual");

    const savedRows = await prisma.commissionCalculation.findMany({
      where: {
        organizationId: context.organization.id,
        transactionId: transaction.id
      },
      orderBy: [{ recipientName: "asc" }]
    });
    const officeUserRow = savedRows.find((row) => row.membershipId === context.officeUserMembership.id) ?? null;
    const officeUserLink = await prisma.transactionMembershipLink.findFirst({
      where: {
        organizationId: context.organization.id,
        transactionId: transaction.id,
        membershipId: context.officeUserMembership.id
      }
    });

    assert.ok(officeUserRow);
    assert.equal(officeUserRow?.recipientType, "agent");
    assert.equal(officeUserRow?.statementAmount.toString(), "1000");
    assert.ok(officeUserLink);
    assert.equal(officeUserLink?.role, "commission_manual_participant");

    const dashboardBeforeStatement = await getOfficeDashboardBusinessSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.officeUserMembership.id,
      officeId: context.secondaryOffice.id
    });

    assert.equal(dashboardBeforeStatement.commission.hasSelfServiceData, true);
    assert.equal(dashboardBeforeStatement.commission.totalCommissionLabel, "$1,000");
    assert.equal(dashboardBeforeStatement.commission.statements.length, 0);

    const workspace = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      membershipId: context.officeUserMembership.id
    });

    assert.ok(workspace.filters.memberOptions.some((option) => option.id === context.officeUserMembership.id));
    assert.equal(workspace.candidateRows.length, 0);
    const invoiceNumber = workspace.filters.invoiceOptions[0]?.invoiceNumber ?? "";

    assert.ok(invoiceNumber);

    const statementResult = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      membershipId: context.officeUserMembership.id,
      invoiceNumbers: [invoiceNumber],
      commissionCalculationIds: officeUserRow ? [officeUserRow.id] : [],
      actorMembershipId: context.officeAdminMembership.id
    });

    const dashboardAfterStatement = await getOfficeDashboardBusinessSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.officeUserMembership.id,
      officeId: context.secondaryOffice.id
    });

    assert.equal(dashboardAfterStatement.commission.statements.length, 1);
    assert.ok(dashboardAfterStatement.commission.statements[0]?.pdfHref.includes(statementResult.statementId));
  } finally {
    await context.cleanup();
  }
});

test("office admin can add invited memberships as manual participants and invited members stay statement-eligible", async () => {
  const context = await createCommissionOverrideTestContext();

  try {
    const transaction = await context.createCalculatedTransaction();
    const initialSnapshot = await getTransactionCommissionSnapshot(
      context.organization.id,
      transaction.id,
      context.primaryOffice.id,
      context.officeAdminMembership.id
    );

    const invitedOption =
      initialSnapshot?.manualParticipantOptions.find((option) => option.membershipId === context.invitedOfficeUserMembership.id) ?? null;

    assert.ok(invitedOption);
    assert.match(invitedOption?.label ?? "", /Invited/);

    const snapshot = await overrideTransactionCommission({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      transactionId: transaction.id,
      overrideReason: "Invited referral member added manually",
      notes: "Invited members must stay operationally usable",
      stakeholderRows: [
        {
          key: context.primaryAgentMembership.id,
          membershipId: context.primaryAgentMembership.id,
          amount: "3000"
        },
        {
          key: context.invitedOfficeUserMembership.id,
          membershipId: context.invitedOfficeUserMembership.id,
          amount: "1000"
        },
        {
          key: "company",
          membershipId: "",
          amount: "1000"
        }
      ],
      actorMembershipId: context.officeAdminMembership.id
    });

    const invitedRow =
      snapshot?.stakeholderBreakdown.find((row) => row.membershipId === context.invitedOfficeUserMembership.id) ?? null;

    assert.ok(invitedRow);
    assert.equal(invitedRow?.isManualParticipant, true);

    const savedRow =
      (
        await prisma.commissionCalculation.findMany({
          where: {
            organizationId: context.organization.id,
            transactionId: transaction.id
          }
        })
      ).find((row) => row.membershipId === context.invitedOfficeUserMembership.id) ?? null;

    assert.ok(savedRow);

    const workspace = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      membershipId: context.invitedOfficeUserMembership.id
    });

    assert.ok(workspace.filters.memberOptions.some((option) => option.id === context.invitedOfficeUserMembership.id));
    const invoiceNumber = workspace.filters.invoiceOptions[0]?.invoiceNumber ?? "";

    assert.ok(invoiceNumber);

    const statementResult = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      membershipId: context.invitedOfficeUserMembership.id,
      invoiceNumbers: [invoiceNumber],
      commissionCalculationIds: savedRow ? [savedRow.id] : [],
      actorMembershipId: context.officeAdminMembership.id
    });

    assert.ok(statementResult.statementId);
  } finally {
    await context.cleanup();
  }
});

test("owner cannot change the override participant set and calculate stays locked after office admin adds manual participants", async () => {
  const context = await createCommissionOverrideTestContext();

  try {
    const transaction = await context.createCalculatedTransaction();

    await assert.rejects(
      () =>
        overrideTransactionCommission({
          organizationId: context.organization.id,
          officeId: context.primaryOffice.id,
          transactionId: transaction.id,
          overrideReason: "Owner should not add participants",
          stakeholderRows: [
            {
              key: context.primaryAgentMembership.id,
              membershipId: context.primaryAgentMembership.id,
              amount: "3000"
            },
            {
              key: context.officeUserMembership.id,
              membershipId: context.officeUserMembership.id,
              amount: "1000"
            },
            {
              key: "company",
              membershipId: "",
              amount: "1000"
            }
          ],
          actorMembershipId: context.ownerMembership.id
        }),
      /Only Office Admin can add or remove override participants\./
    );

    await overrideTransactionCommission({
      organizationId: context.organization.id,
      officeId: context.primaryOffice.id,
      transactionId: transaction.id,
      overrideReason: "Office admin adds manual participant",
      stakeholderRows: [
        {
          key: context.primaryAgentMembership.id,
          membershipId: context.primaryAgentMembership.id,
          amount: "3000"
        },
        {
          key: context.officeUserMembership.id,
          membershipId: context.officeUserMembership.id,
          amount: "1000"
        },
        {
          key: "company",
          membershipId: "",
          amount: "1000"
        }
      ],
      actorMembershipId: context.officeAdminMembership.id
    });

    await assert.rejects(
      () =>
        calculateTransactionCommission({
          organizationId: context.organization.id,
          officeId: context.primaryOffice.id,
          transactionId: transaction.id,
          notes: "Should be blocked",
          actorMembershipId: context.officeAdminMembership.id
        }),
      /manual override participants/i
    );

    const refreshedSnapshot = await getTransactionCommissionSnapshot(
      context.organization.id,
      transaction.id,
      context.primaryOffice.id,
      context.officeAdminMembership.id
    );

    assert.equal(refreshedSnapshot?.manualParticipantLockActive, true);
    assert.ok((refreshedSnapshot?.manualParticipantOptions.length ?? 0) > 0);

    const ownerSnapshot = await getTransactionCommissionSnapshot(
      context.organization.id,
      transaction.id,
      context.primaryOffice.id,
      context.ownerMembership.id
    );

    assert.equal(ownerSnapshot?.manualParticipantOptions.length, 0);
  } finally {
    await context.cleanup();
  }
});
