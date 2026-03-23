import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type TransactionFinanceFeeType, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import { getOfficeTransactionReportsWorkspace, listOfficeTransactionReportExportRows } from "./reports.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createReportsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Reports Test ${suffix}`,
      slug: `reports-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Reports Office ${suffix}`,
      slug: `reports-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const secondaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Reports Office Secondary ${suffix}`,
      slug: `reports-office-secondary-${suffix}`,
      market: "New Jersey",
      isPrimary: false
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string, officeId = office.id) {
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
        officeId,
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

  const admin = await createMembership("office_admin", "reports-admin");
  const teamLead = await createMembership("team_lead", "reports-team-lead");
  const agent = await createMembership("agent", "reports-agent");
  const outsider = await createMembership("agent", "reports-outsider", secondaryOffice.id);

  const team = await prisma.team.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      name: `Reports Team ${suffix}`,
      slug: `reports-team-${suffix}`
    }
  });

  const leaderTeamMembership = await prisma.teamMembership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      teamId: team.id,
      membershipId: teamLead.membership.id,
      role: "team_leader"
    }
  });

  await prisma.teamMembership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      teamId: team.id,
      membershipId: agent.membership.id,
      role: "member",
      reportsToTeamMembershipId: leaderTeamMembership.id
    }
  });

  return {
    organization,
    office,
    secondaryOffice,
    adminMembership: admin.membership,
    teamLeadMembership: teamLead.membership,
    agentMembership: agent.membership,
    outsiderMembership: outsider.membership,
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

async function upsertFinanceFee(input: {
  organizationId: string;
  officeId: string;
  transactionId: string;
  feeType: TransactionFinanceFeeType;
  amount: string;
}) {
  await prisma.transactionFinanceFee.upsert({
    where: {
      transactionId_feeType: {
        transactionId: input.transactionId,
        feeType: input.feeType
      }
    },
    update: {
      amount: new Prisma.Decimal(input.amount)
    },
    create: {
      organizationId: input.organizationId,
      officeId: input.officeId,
      transactionId: input.transactionId,
      feeType: input.feeType,
      amount: new Prisma.Decimal(input.amount),
      defaultCalculationType: input.feeType === "reimbursement" ? "reimbursement" : "pre_split",
      selectedCalculationType: input.feeType === "reimbursement" ? "reimbursement" : "pre_split"
    }
  });
}

test("reports workspace enforces scope, keeps exports aligned, and derives team leaders from hierarchy", async () => {
  const context = await createReportsTestContext();

  try {
    const leadTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.teamLeadMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "10 Team Lead Ave",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: "Lead Deal",
      askingPrice: "1000000",
      purchasedPrice: "950000",
      grossCommission: "19000",
      closingDate: "2026-02-15",
      additionalFields: {
        buyerTenant: "Lead Buyer",
        invoiceNumber: "INV-LEAD",
        layout: "2B",
        licensedAgentName: "Lead Agent"
      }
    });

    const agentTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "rental_leasing",
      transactionStatus: "closed",
      representing: "tenant",
      address: "20 Agent Ln",
      city: "Jersey City",
      state: "NJ",
      zipCode: "07302",
      transactionName: "Agent Deal",
      askingPrice: "4200",
      purchasedPrice: "4000",
      grossCommission: "4000",
      moveInDate: "2026-03-10",
      additionalFields: {
        buyerTenant: "Agent Tenant",
        invoiceNumber: "INV-AGENT",
        layout: "1B",
        licensedAgentName: "Agent Worker",
        companyReferral: "Yes",
        companyReferralEmployeeName: "Referral Desk"
      }
    });

    await createTransaction({
      organizationId: context.organization.id,
      officeId: context.secondaryOffice.id,
      ownerMembershipId: context.outsiderMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "commercial_sales",
      transactionStatus: "cancelled",
      representing: "seller",
      address: "30 Outside Rd",
      city: "Newark",
      state: "NJ",
      zipCode: "07102",
      transactionName: "Outside Deal",
      askingPrice: "300000",
      purchasedPrice: "275000",
      grossCommission: "5500",
      closingDate: "2026-04-05",
      additionalFields: {
        buyerTenant: "Outside Buyer",
        invoiceNumber: "INV-OUT"
      }
    });

    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.office.id,
      transactionId: leadTransaction.id,
      feeType: "rebate",
      amount: "1000"
    });

    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.office.id,
      transactionId: agentTransaction.id,
      feeType: "external_referral",
      amount: "500"
    });

    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.office.id,
      transactionId: agentTransaction.id,
      feeType: "reimbursement",
      amount: "125"
    });

    const teamLeadWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.teamLeadMembership.id,
      officeId: context.office.id,
      teamLeaderMembershipIds: [context.teamLeadMembership.id]
    });

    assert.deepEqual(
      teamLeadWorkspace.rows.map((row) => row.transactionNumber).sort(),
      [agentTransaction.id, leadTransaction.id].sort()
    );
    assert.equal(teamLeadWorkspace.totalCount, 2);
    assert.equal(teamLeadWorkspace.summary.totalPurchasedPrice, "$954,000");
    assert.equal(teamLeadWorkspace.summary.totalRebate, "$1,000");
    assert.equal(teamLeadWorkspace.summary.totalReferral, "$500");
    assert.equal(teamLeadWorkspace.summary.totalReimbursement, "$125");
    assert.deepEqual(teamLeadWorkspace.filters.departmentOptions.map((option) => option.id), [context.office.id]);

    const teamLeaderOption = teamLeadWorkspace.filters.teamLeaderOptions.find(
      (option) => option.id === context.teamLeadMembership.id
    );
    assert.ok(teamLeaderOption);
    assert.match(teamLeaderOption.label, /· Team Leader(?: ·|$)/);
    assert.doesNotMatch(teamLeaderOption.label, /· Member(?: ·|$)/);

    const adminWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id
    });

    assert.deepEqual(
      adminWorkspace.filters.departmentOptions.map((option) => option.id).sort(),
      [context.office.id, context.secondaryOffice.id].sort()
    );

    const scopedAdminWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });

    assert.deepEqual(
      scopedAdminWorkspace.rows.map((row) => row.transactionNumber).sort(),
      [agentTransaction.id, leadTransaction.id].sort()
    );
    assert.deepEqual(scopedAdminWorkspace.filters.departmentOptions.map((option) => option.id), [context.office.id]);

    const agentWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      officeId: context.office.id,
      closingMoveInOperator: "eq",
      closingMoveInValue: "2026-03-10"
    });

    assert.deepEqual(agentWorkspace.rows.map((row) => row.transactionNumber), [agentTransaction.id]);
    assert.equal(agentWorkspace.rows[0]?.companyReferral, "Yes");
    assert.equal(agentWorkspace.rows[0]?.invoiceNumber, "INV-AGENT");
    assert.equal(agentWorkspace.rows[0]?.teamLeader, "reports-team-lead User");
    assert.deepEqual(agentWorkspace.filters.departmentOptions.map((option) => option.id), [context.office.id]);

    const exportRows = await listOfficeTransactionReportExportRows({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      officeId: context.office.id,
      closingMoveInOperator: "eq",
      closingMoveInValue: "2026-03-10"
    });

    assert.deepEqual(exportRows.map((row) => row.transactionNumber), [agentTransaction.id]);
    assert.deepEqual(
      exportRows.map((row) => row.transactionNumber),
      agentWorkspace.rows.map((row) => row.transactionNumber)
    );
  } finally {
    await context.cleanup();
  }
});

test("reports workspace normalizes legacy price, layout, referral fallbacks, and blank monetary values", async () => {
  const context = await createReportsTestContext();

  try {
    const leadTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.teamLeadMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: "40 High Value St",
      city: "New York",
      state: "NY",
      zipCode: "10013",
      transactionName: "High Value Deal",
      purchasedPrice: "950000",
      additionalFields: {
        invoiceNumber: "INV-HIGH"
      }
    });

    const legacyPriceTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: "50 Legacy Price Ave",
      city: "New York",
      state: "NY",
      zipCode: "10014",
      transactionName: "Legacy Price Deal",
      purchasedPrice: "100",
      additionalFields: {
        invoiceNumber: "INV-LEGACY-PRICE"
      }
    });

    await prisma.transaction.update({
      where: {
        id: legacyPriceTransaction.id
      },
      data: {
        purchasedPrice: null,
        price: new Prisma.Decimal("100")
      }
    });

    const oneBedroomTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "rental_listing",
      transactionStatus: "pending",
      representing: "seller",
      address: "60 Layout Way",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      transactionName: "One Bedroom Deal",
      additionalFields: {
        invoiceNumber: "INV-1BR",
        layout: "1 BR"
      }
    });

    const legacyReferralTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "other",
      transactionStatus: "pending",
      representing: "tenant",
      address: "70 Legacy Referral Rd",
      city: "Queens",
      state: "NY",
      zipCode: "11101",
      transactionName: "Legacy Referral Deal",
      additionalFields: {
        invoiceNumber: "INV-LEGACY-REF",
        layout: "Studio",
        companyReferral: "Yes",
        companyReferralEmployeesName: "Legacy Desk"
      }
    });

    await prisma.transaction.update({
      where: {
        id: legacyReferralTransaction.id
      },
      data: {
        companyReferral: false,
        companyReferralEmployeeName: null
      }
    });

    const sortedWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      sortBy: "purchased_price",
      sortDirection: "desc"
    });

    const sortedIds = sortedWorkspace.rows.map((row) => row.transactionNumber);
    assert.ok(sortedIds.indexOf(leadTransaction.id) < sortedIds.indexOf(legacyPriceTransaction.id));

    const oneBedroomWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      layouts: ["1B"]
    });

    assert.deepEqual(oneBedroomWorkspace.rows.map((row) => row.transactionNumber), [oneBedroomTransaction.id]);

    const othersWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      layouts: ["Others"]
    });

    assert.deepEqual(othersWorkspace.rows.map((row) => row.transactionNumber), [legacyReferralTransaction.id]);

    const legacyReferralWorkspace = await getOfficeTransactionReportsWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      invoiceNumber: "INV-LEGACY-REF",
      companyReferral: "yes"
    });

    assert.deepEqual(legacyReferralWorkspace.rows.map((row) => row.transactionNumber), [legacyReferralTransaction.id]);
    assert.equal(legacyReferralWorkspace.rows[0]?.companyReferral, "Yes");
    assert.equal(legacyReferralWorkspace.rows[0]?.companyReferralEmployeeName, "Legacy Desk");
    assert.equal(legacyReferralWorkspace.rows[0]?.askingPrice, "");
    assert.equal(legacyReferralWorkspace.rows[0]?.purchasedPrice, "");
    assert.equal(legacyReferralWorkspace.rows[0]?.grossCommission, "");
    assert.equal(legacyReferralWorkspace.rows[0]?.rebate, "");
    assert.equal(legacyReferralWorkspace.rows[0]?.referral, "");
    assert.equal(legacyReferralWorkspace.rows[0]?.reimbursement, "");
  } finally {
    await context.cleanup();
  }
});
