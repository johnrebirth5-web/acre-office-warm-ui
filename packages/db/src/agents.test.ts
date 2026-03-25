import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { getOfficeAgentProfileSnapshot } from "./agents.ts";
import { prisma } from "./client.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createAgentsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Agents Test ${suffix}`,
      slug: `agents-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Agents Office ${suffix}`,
      slug: `agents-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string, firstName: string, lastName: string, title?: string | null) {
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
        status: "active",
        title: title ?? null,
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

test("agent can view and manage bank information on their own profile", async () => {
  const context = await createAgentsTestContext();

  try {
    const agent = await context.createMembership("agent", "self-bank", "Self", "Agent", "Agent");

    await prisma.agentBankInformation.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        membershipId: agent.membership.id,
        firstName: "Self",
        lastName: "Agent",
        email: "self.agent@example.com",
        bankName: "Acre Credit Union",
        accountNumber: "123456789",
        routingNumber: "021000021"
      }
    });

    const snapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: agent.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.bankInformation.canView, true);
    assert.equal(snapshot?.bankInformation.canManage, true);
    assert.equal(snapshot?.bankInformation.bankName, "Acre Credit Union");
    assert.equal(snapshot?.bankInformation.accountNumber, "123456789");
  } finally {
    await context.cleanup();
  }
});

test("team lead cannot view or manage another member's bank information without agent management permission", async () => {
  const context = await createAgentsTestContext();

  try {
    const teamLead = await context.createMembership("team_lead", "team-lead", "Taylor", "Lead", "Team Lead");
    const agent = await context.createMembership("agent", "scoped-agent", "Alex", "Agent", "Agent");
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: `Scoped Team ${randomUUID().slice(0, 8)}`,
        slug: `scoped-team-${randomUUID().slice(0, 8)}`
      }
    });

    await prisma.teamMembership.createMany({
      data: [
        {
          organizationId: context.organization.id,
          officeId: context.office.id,
          teamId: team.id,
          membershipId: teamLead.membership.id,
          role: "team_leader"
        },
        {
          organizationId: context.organization.id,
          officeId: context.office.id,
          teamId: team.id,
          membershipId: agent.membership.id,
          role: "member"
        }
      ]
    });

    await prisma.agentBankInformation.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        membershipId: agent.membership.id,
        firstName: "Alex",
        lastName: "Agent",
        accountNumber: "987654321",
        routingNumber: "021000021"
      }
    });

    const snapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: teamLead.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.bankInformation.canView, false);
    assert.equal(snapshot?.bankInformation.canManage, false);
    assert.equal(snapshot?.bankInformation.accountNumber, "");
    assert.equal(snapshot?.bankInformation.routingNumber, "");
  } finally {
    await context.cleanup();
  }
});
