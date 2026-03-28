import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type MembershipStatus, type UserRole } from "@prisma/client";
import { activityLogActions } from "./activity-log.ts";
import {
  getOffice1099SummaryDetail,
  getOffice1099SummaryRows,
  getOffice1099TrackerWorkspaceSnapshot,
  listAgent1099PaymentRecords,
  saveAgent1099PaymentRecords
} from "./agent-1099-tracker.ts";
import { prisma } from "./client.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createAgent1099TrackerTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `1099 Test ${suffix}`,
      slug: `tracker-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `1099 Office ${suffix}`,
      slug: `tracker-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(
    role: UserRole,
    prefix: string,
    firstName: string,
    lastName: string,
    status: MembershipStatus = "active"
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName,
        lastName,
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
        status,
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

test("1099 tracker workspace and summary aggregate payments by tax year and include invited agents", async () => {
  const context = await createAgent1099TrackerTestContext();

  try {
    const admin = await context.createMembership("office_admin", "tracker-admin", "Alex", "Admin");
    const activeAgent = await context.createMembership("agent", "tracker-agent", "Casey", "Agent");
    const invitedAgent = await context.createMembership("agent", "tracker-invited", "Ivana", "Invited", "invited");

    await prisma.agentBankInformation.createMany({
      data: [
        {
          organizationId: context.organization.id,
          officeId: context.office.id,
          membershipId: activeAgent.membership.id,
          payeeName: "Casey Agent LLC",
          phoneNumber: "212-555-0100",
          address: "123 Main St, New York, NY 10001",
          email: "payments@caseyagent.com",
          taxIdType: "ein",
          taxIdValue: "12-3456789"
        },
        {
          organizationId: context.organization.id,
          officeId: context.office.id,
          membershipId: invitedAgent.membership.id,
          payeeName: "Ivana Invited",
          phoneNumber: "917-555-0188",
          address: "450 Park Ave, New York, NY 10022",
          email: "ivana@example.com",
          taxIdType: "ssn",
          taxIdValue: "123-45-6789"
        }
      ]
    });

    await saveAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: activeAgent.membership.id,
      taxYear: 2026,
      actorMembershipId: admin.membership.id,
      records: [
        {
          paymentDate: "2026-01-15",
          paymentAmount: "1000.00",
          memo: "January payout"
        },
        {
          paymentDate: "2026-02-15",
          paymentAmount: "250.50",
          memo: "February adjustment"
        }
      ]
    });

    await saveAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: activeAgent.membership.id,
      taxYear: 2025,
      actorMembershipId: admin.membership.id,
      records: [
        {
          paymentDate: "2025-12-20",
          paymentAmount: "300.00",
          memo: "Prior year payout"
        }
      ]
    });

    await saveAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: invitedAgent.membership.id,
      taxYear: 2026,
      actorMembershipId: admin.membership.id,
      records: [
        {
          paymentDate: "2026-03-01",
          paymentAmount: "700.00",
          memo: "Invited agent payout"
        }
      ]
    });

    const summaryRows = await getOffice1099SummaryRows({
      organizationId: context.organization.id,
      officeId: context.office.id,
      taxYear: 2026
    });

    assert.equal(summaryRows.length, 2);
    assert.deepEqual(
      summaryRows.map((row) => row.membershipId).sort(),
      [activeAgent.membership.id, invitedAgent.membership.id].sort()
    );

    const activeSummaryRow = summaryRows.find((row) => row.membershipId === activeAgent.membership.id);
    assert.ok(activeSummaryRow);
    assert.equal(activeSummaryRow?.name, "Casey Agent LLC");
    assert.equal(activeSummaryRow?.totalPaidValue, "1250.50");

    const invitedSummaryRow = summaryRows.find((row) => row.membershipId === invitedAgent.membership.id);
    assert.ok(invitedSummaryRow);
    assert.equal(invitedSummaryRow?.totalPaidValue, "700.00");

    const recordsEditor = await listAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: activeAgent.membership.id,
      taxYear: 2026
    });

    assert.ok(recordsEditor);
    assert.equal(recordsEditor?.rows.length, 2);
    assert.equal(recordsEditor?.totalPaidValue, "1250.50");

    const detail = await getOffice1099SummaryDetail({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: activeAgent.membership.id,
      taxYear: 2026
    });

    assert.ok(detail);
    assert.equal(detail?.paymentRecords.length, 2);
    assert.equal(detail?.totalPaidValue, "1250.50");
    assert.equal(detail?.payeeName, "Casey Agent LLC");

    const snapshot = await getOffice1099TrackerWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      tab: "records",
      membershipId: activeAgent.membership.id,
      taxYear: 2026
    });

    assert.equal(snapshot.recordsEditor?.membershipId, activeAgent.membership.id);
    assert.equal(snapshot.recordsEditor?.totalPaidValue, "1250.50");
    assert.ok(snapshot.filters.memberOptions.some((option) => option.id === invitedAgent.membership.id));
  } finally {
    await context.cleanup();
  }
});

test("1099 payment batch saves support update and delete while logging audit activity and surfacing missing profile warnings", async () => {
  const context = await createAgent1099TrackerTestContext();

  try {
    const admin = await context.createMembership("office_admin", "tracker-admin-2", "Avery", "Admin");
    const agent = await context.createMembership("agent", "tracker-agent-2", "Morgan", "Missing");

    const firstSave = await saveAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
      taxYear: 2026,
      actorMembershipId: admin.membership.id,
      records: [
        {
          paymentDate: "2026-04-10",
          paymentAmount: "900.00",
          memo: "Initial payment"
        },
        {
          paymentDate: "2026-05-10",
          paymentAmount: "350.00",
          memo: "Bonus payment"
        }
      ]
    });

    assert.equal(firstSave.rows.length, 2);
    assert.equal(firstSave.displayName, "Morgan Missing");
    assert.ok(firstSave.missingProfileFields.includes("Payee Name"));
    assert.ok(firstSave.missingProfileFields.includes("Tax ID"));
    assert.ok(firstSave.missingProfileFields.includes("Address"));

    const firstRecordId = firstSave.rows[0]?.id;
    assert.ok(firstRecordId);

    const secondSave = await saveAgent1099PaymentRecords({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
      taxYear: 2026,
      actorMembershipId: admin.membership.id,
      records: [
        {
          id: firstRecordId,
          paymentDate: "2026-04-10",
          paymentAmount: "925.00",
          memo: "Updated initial payment"
        }
      ]
    });

    assert.equal(secondSave.rows.length, 1);
    assert.equal(secondSave.totalPaidValue, "925.00");
    assert.equal(secondSave.rows[0]?.paymentAmountValue, "925.00");
    assert.equal(secondSave.rows[0]?.memo, "Updated initial payment");

    const summaryRows = await getOffice1099SummaryRows({
      organizationId: context.organization.id,
      officeId: context.office.id,
      taxYear: 2026
    });
    const summaryRow = summaryRows.find((row) => row.membershipId === agent.membership.id);

    assert.ok(summaryRow);
    assert.equal(summaryRow?.name, "Morgan Missing");
    assert.equal(summaryRow?.totalPaidValue, "925.00");
    assert.ok(summaryRow?.missingProfileFields.includes("Email"));

    const activityLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: context.organization.id,
        entityType: "agent_1099_payment_record"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    assert.deepEqual(
      activityLogs.map((record: { action: string }) => record.action),
      [
        activityLogActions.agent1099PaymentRecordSaved,
        activityLogActions.agent1099PaymentRecordUpdated,
        activityLogActions.agent1099PaymentRecordDeleted
      ]
    );
  } finally {
    await context.cleanup();
  }
});
