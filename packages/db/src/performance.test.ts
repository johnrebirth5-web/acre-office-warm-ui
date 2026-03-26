import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type TransactionFinanceFeeType, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  getOfficePerformanceWorkspace,
  listOfficePerformanceExportRows
} from "./performance.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createPerformanceTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Performance Test ${suffix}`,
      slug: `performance-test-${suffix}`
    }
  });
  const nyOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: "Acre NY Realty Inc",
      slug: `acre-ny-realty-inc-${suffix}`,
      market: "New York Sales",
      isPrimary: true
    }
  });
  const njOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: "Acre NJ LLC",
      slug: `acre-nj-llc-${suffix}`,
      market: "New Jersey",
      isPrimary: false
    }
  });
  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string, officeId = nyOffice.id) {
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
        title: role === "team_lead" ? "Team Lead" : role === "office_admin" ? "Office Admin" : "Agent",
        permissions: Prisma.JsonNull
      }
    });

    return {
      user,
      membership
    };
  }

  const admin = await createMembership("office_admin", "performance-admin");
  const teamLead = await createMembership("team_lead", "performance-lead");
  const agent = await createMembership("agent", "performance-agent");
  const outsider = await createMembership("agent", "performance-outsider", njOffice.id);
  const team = await prisma.team.create({
    data: {
      organizationId: organization.id,
      officeId: nyOffice.id,
      name: `Performance Team ${suffix}`,
      slug: `performance-team-${suffix}`
    }
  });
  const leaderTeamMembership = await prisma.teamMembership.create({
    data: {
      organizationId: organization.id,
      officeId: nyOffice.id,
      teamId: team.id,
      membershipId: teamLead.membership.id,
      role: "team_leader"
    }
  });

  await prisma.teamMembership.create({
    data: {
      organizationId: organization.id,
      officeId: nyOffice.id,
      teamId: team.id,
      membershipId: agent.membership.id,
      role: "member",
      reportsToTeamMembershipId: leaderTeamMembership.id
    }
  });

  return {
    organization,
    nyOffice,
    njOffice,
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

test("performance workspace enforces NY scope, uses move-in attribution, and redacts peer amounts for agents", async () => {
  const context = await createPerformanceTestContext();

  try {
    const leadTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
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
      grossCommission: "19000",
      closingDate: "2026-03-15"
    });
    const agentMarchTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "rental_leasing",
      transactionStatus: "closed",
      representing: "tenant",
      address: "20 Agent Ln",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      transactionName: "Agent March Deal",
      grossCommission: "4000",
      closingDate: "2026-02-28",
      moveInDate: "2026-03-10"
    });
    const agentJanuaryTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: "22 Agent Ln",
      city: "Queens",
      state: "NY",
      zipCode: "11101",
      transactionName: "Agent January Deal",
      grossCommission: "2000",
      closingDate: "2026-01-05"
    });

    await createTransaction({
      organizationId: context.organization.id,
      officeId: context.njOffice.id,
      ownerMembershipId: context.outsiderMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "seller",
      address: "30 Outside Rd",
      city: "Jersey City",
      state: "NJ",
      zipCode: "07302",
      transactionName: "NJ Outside Deal",
      grossCommission: "5500",
      closingDate: "2026-03-12"
    });

    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: leadTransaction.id,
      feeType: "rebate",
      amount: "1000"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentMarchTransaction.id,
      feeType: "external_referral",
      amount: "500"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentMarchTransaction.id,
      feeType: "reimbursement",
      amount: "125"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentJanuaryTransaction.id,
      feeType: "rebate",
      amount: "200"
    });

    const agentWorkspace = await getOfficePerformanceWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      officeId: context.nyOffice.id,
      period: "month",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.deepEqual(agentWorkspace.filters.companyOptions.map((option) => option.id), ["ny"]);
    assert.equal(agentWorkspace.filters.canExport, false);
    assert.equal(agentWorkspace.table.rows.length, 1);
    assert.equal(agentWorkspace.table.rows[0]?.totalLabel, "$5,175");
    assert.equal(agentWorkspace.table.rows[0]?.cellLabels["2026-01"], "$1,800");
    assert.equal(agentWorkspace.table.rows[0]?.cellLabels["2026-03"], "$3,375");
    assert.deepEqual(
      agentWorkspace.leaderboards[0]?.entries.map((entry) => ({
        name: entry.name,
        amountVisible: entry.amountVisible,
        performanceLabel: entry.performanceLabel
      })),
      [
        {
          name: "performance-lead User",
          amountVisible: false,
          performanceLabel: ""
        },
        {
          name: "performance-agent User",
          amountVisible: true,
          performanceLabel: "$3,375"
        }
      ]
    );
    assert.equal(agentWorkspace.leaderboards[0]?.viewerEntry?.rank, 2);
    assert.equal(agentWorkspace.leaderboards[1]?.viewerEntry?.rank, 2);
    assert.equal(agentWorkspace.leaderboards[2]?.viewerEntry?.rank, 2);

    const teamLeadWorkspace = await getOfficePerformanceWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.teamLeadMembership.id,
      officeId: context.nyOffice.id,
      period: "month",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.deepEqual(
      teamLeadWorkspace.table.rows.map((row) => row.name),
      ["performance-agent User", "performance-lead User"]
    );
    assert.equal(teamLeadWorkspace.leaderboards[0]?.entries[0]?.performanceLabel, "$18,000");
    assert.equal(teamLeadWorkspace.leaderboards[0]?.entries[1]?.performanceLabel, "$3,375");

    const adminWorkspace = await getOfficePerformanceWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.nyOffice.id,
      period: "month",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.equal(adminWorkspace.filters.canExport, true);
    assert.deepEqual(
      adminWorkspace.table.rows.map((row) => row.name),
      ["performance-agent User", "performance-lead User"]
    );
    assert.equal(adminWorkspace.summary.cards[0]?.value, "$23,175");
  } finally {
    await context.cleanup();
  }
});

test("performance workspace supports quarter and year tables, and export rows stay aligned", async () => {
  const context = await createPerformanceTestContext();

  try {
    const leadTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
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
      grossCommission: "19000",
      closingDate: "2026-03-15"
    });
    const agentMarchTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "rental_leasing",
      transactionStatus: "closed",
      representing: "tenant",
      address: "20 Agent Ln",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      transactionName: "Agent March Deal",
      grossCommission: "4000",
      moveInDate: "2026-03-10"
    });
    const agentJanuaryTransaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      ownerMembershipId: context.agentMembership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: "22 Agent Ln",
      city: "Queens",
      state: "NY",
      zipCode: "11101",
      transactionName: "Agent January Deal",
      grossCommission: "2000",
      closingDate: "2026-01-05"
    });

    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: leadTransaction.id,
      feeType: "rebate",
      amount: "1000"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentMarchTransaction.id,
      feeType: "external_referral",
      amount: "500"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentMarchTransaction.id,
      feeType: "reimbursement",
      amount: "125"
    });
    await upsertFinanceFee({
      organizationId: context.organization.id,
      officeId: context.nyOffice.id,
      transactionId: agentJanuaryTransaction.id,
      feeType: "rebate",
      amount: "200"
    });

    const quarterWorkspace = await getOfficePerformanceWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.teamLeadMembership.id,
      officeId: context.nyOffice.id,
      period: "quarter",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.deepEqual(
      quarterWorkspace.table.columns.map((column) => column.label),
      ["Q1", "Q2", "Q3", "Q4"]
    );
    assert.equal(
      quarterWorkspace.table.rows.find((row) => row.membershipId === context.teamLeadMembership.id)?.cellLabels["2026-Q1"],
      "$18,000"
    );
    assert.equal(
      quarterWorkspace.table.rows.find((row) => row.membershipId === context.agentMembership.id)?.cellLabels["2026-Q1"],
      "$5,175"
    );

    const yearWorkspace = await getOfficePerformanceWorkspace({
      organizationId: context.organization.id,
      viewerMembershipId: context.teamLeadMembership.id,
      officeId: context.nyOffice.id,
      period: "year",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.deepEqual(
      yearWorkspace.table.columns.map((column) => column.label),
      ["2025", "2026"]
    );
    assert.equal(
      yearWorkspace.table.rows.find((row) => row.membershipId === context.agentMembership.id)?.cellLabels["2026"],
      "$5,175"
    );

    const exportRows = await listOfficePerformanceExportRows({
      organizationId: context.organization.id,
      viewerMembershipId: context.teamLeadMembership.id,
      officeId: context.nyOffice.id,
      period: "month",
      company: "ny",
      year: "2026",
      month: "03",
      quarter: "1",
      yearStart: "2025",
      yearEnd: "2026"
    });

    assert.equal(exportRows.columns[0], "Name");
    assert.equal(exportRows.columns[1], "Role");
    assert.equal(exportRows.columns[2], "Jan");
    assert.equal(exportRows.columns[4], "Mar");
    const agentRow = exportRows.rows.find((row) => row[0] === "performance-agent User");
    assert.ok(agentRow);
    assert.equal(agentRow?.[1], "Agent");
    assert.equal(agentRow?.[2], "$1,800");
    assert.equal(agentRow?.[4], "$3,375");
  } finally {
    await context.cleanup();
  }
});
