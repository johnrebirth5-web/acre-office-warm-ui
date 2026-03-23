import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
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

  const admin = await createMembership("office_admin", "reports-admin");
  const teamLead = await createMembership("team_lead", "reports-team-lead");
  const agent = await createMembership("agent", "reports-agent");
  const outsider = await createMembership("agent", "reports-outsider");

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

test("reports workspace enforces agent and team-lead scope while keeping export rows aligned to the same filtered dataset", async () => {
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

    await prisma.transactionFinanceFee.upsert({
      where: {
        transactionId_feeType: {
          transactionId: leadTransaction.id,
          feeType: "rebate"
        }
      },
      update: {
        amount: new Prisma.Decimal("1000")
      },
      create: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        transactionId: leadTransaction.id,
        feeType: "rebate",
        amount: new Prisma.Decimal("1000"),
        defaultCalculationType: "pre_split",
        selectedCalculationType: "pre_split"
      }
    });

    await prisma.transactionFinanceFee.upsert({
      where: {
        transactionId_feeType: {
          transactionId: agentTransaction.id,
          feeType: "external_referral"
        }
      },
      update: {
        amount: new Prisma.Decimal("500")
      },
      create: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        transactionId: agentTransaction.id,
        feeType: "external_referral",
        amount: new Prisma.Decimal("500"),
        defaultCalculationType: "pre_split",
        selectedCalculationType: "pre_split"
      }
    });

    await prisma.transactionFinanceFee.upsert({
      where: {
        transactionId_feeType: {
          transactionId: agentTransaction.id,
          feeType: "reimbursement"
        }
      },
      update: {
        amount: new Prisma.Decimal("125")
      },
      create: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        transactionId: agentTransaction.id,
        feeType: "reimbursement",
        amount: new Prisma.Decimal("125"),
        defaultCalculationType: "reimbursement",
        selectedCalculationType: "reimbursement"
      }
    });

    await createTransaction({
      organizationId: context.organization.id,
      officeId: context.office.id,
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

    const exportRows = await listOfficeTransactionReportExportRows({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      officeId: context.office.id,
      closingMoveInOperator: "eq",
      closingMoveInValue: "2026-03-10"
    });

    assert.deepEqual(exportRows.map((row) => row.transactionNumber), [agentTransaction.id]);
    assert.deepEqual(exportRows.map((row) => row.transactionNumber), agentWorkspace.rows.map((row) => row.transactionNumber));
  } finally {
    await context.cleanup();
  }
});
