import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { getOfficeAgentProfileSnapshot, saveAgentProfile } from "./agents.ts";
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
  const secondaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Agents Secondary ${suffix}`,
      slug: `agents-secondary-${suffix}`,
      market: "New Jersey",
      isPrimary: false
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(
    role: UserRole,
    prefix: string,
    firstName: string,
    lastName: string,
    title?: string | null,
    options: {
      officeId?: string | null;
      accessibleOfficeIds?: string[];
    } = {}
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
        officeId: options.officeId ?? office.id,
        userId: user.id,
        role,
        status: "active",
        title: title ?? null,
        permissions: Prisma.JsonNull,
        officeAccesses: options.accessibleOfficeIds?.length
          ? {
              createMany: {
                data: options.accessibleOfficeIds.map((officeId) => ({
                  organizationId: organization.id,
                  officeId
                }))
              }
            }
          : undefined
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
    secondaryOffice,
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

test("saving an agent profile persists payee name through the existing bank information flow", async () => {
  const context = await createAgentsTestContext();

  try {
    const admin = await context.createMembership("office_admin", "payee-admin", "Payee", "Admin", "Office Admin");
    const agent = await context.createMembership("agent", "payee-agent", "Payee", "Agent", "Agent");

    await saveAgentProfile({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
      actorMembershipId: admin.membership.id,
      bankPayeeName: "Payee Agent LLC",
      bankEmail: "payee.agent@example.com",
      bankAddress: "101 Broadway, New York, NY 10004",
      bankPhoneNumber: "212-555-0111",
      bankTaxIdType: "ein",
      bankTaxIdValue: "98-7654321"
    });

    const snapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: admin.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.bankInformation.payeeName, "Payee Agent LLC");
    assert.equal(snapshot?.bankInformation.email, "payee.agent@example.com");
    assert.equal(snapshot?.bankInformation.address, "101 Broadway, New York, NY 10004");
    assert.equal(snapshot?.bankInformation.taxIdType, "ein");
    assert.equal(snapshot?.bankInformation.taxIdValue, "98-7654321");
  } finally {
    await context.cleanup();
  }
});

test("agent profile is readable from an office where the membership has access but is not home-based", async () => {
  const context = await createAgentsTestContext();

  try {
    const admin = await context.createMembership("office_admin", "cross-office-admin", "Cross", "Admin", "Office Admin");
    const agent = await context.createMembership(
      "agent",
      "cross-office-agent",
      "Cross",
      "Agent",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.office.id, context.secondaryOffice.id]
      }
    );

    const snapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: admin.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.profile.membershipId, agent.membership.id);
    assert.equal(snapshot?.profile.officeName, context.secondaryOffice.name);
  } finally {
    await context.cleanup();
  }
});

test("saving an agent profile works from an office where the membership has explicit access", async () => {
  const context = await createAgentsTestContext();

  try {
    const admin = await context.createMembership("office_admin", "cross-save-admin", "Cross", "Save Admin", "Office Admin");
    const agent = await context.createMembership(
      "agent",
      "cross-save-agent",
      "Cross",
      "Save Agent",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.office.id, context.secondaryOffice.id]
      }
    );

    await saveAgentProfile({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
      actorMembershipId: admin.membership.id,
      displayName: "Cross Office Agent"
    });

    const snapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: admin.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.profile.displayName, "Cross Office Agent");
  } finally {
    await context.cleanup();
  }
});

test("saving company-specific agent profile fields keeps each office isolated", async () => {
  const context = await createAgentsTestContext();

  try {
    const admin = await context.createMembership(
      "office_admin",
      "office-profile-admin",
      "Office",
      "Admin",
      "Office Admin",
    );
    const agent = await context.createMembership(
      "agent",
      "office-profile-agent",
      "Office",
      "Agent",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.office.id, context.secondaryOffice.id],
      },
    );

    await saveAgentProfile({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
      actorMembershipId: admin.membership.id,
      licenseState: "NY",
      startDate: "2027-10-09",
      notes: "NY notes",
      customAgentPercent: "60",
      commissionEffectiveFrom: "2026-04-22",
    });
    await saveAgentProfile({
      organizationId: context.organization.id,
      officeId: context.secondaryOffice.id,
      membershipId: agent.membership.id,
      actorMembershipId: admin.membership.id,
      licenseState: "NJ",
      startDate: "2028-11-10",
      notes: "NJ notes",
      customAgentPercent: "80%",
      commissionEffectiveFrom: "2026-04-22",
    });

    const nySnapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: admin.membership.id,
      officeId: context.office.id,
      membershipId: agent.membership.id,
    });
    const njSnapshot = await getOfficeAgentProfileSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: admin.membership.id,
      officeId: context.secondaryOffice.id,
      membershipId: agent.membership.id,
    });
    const membership = await prisma.membership.findUnique({
      where: {
        id: agent.membership.id,
      },
      include: {
        agentOfficeProfiles: {
          orderBy: [{ officeId: "asc" }],
        },
        membershipCommissionSettings: {
          orderBy: [{ officeId: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    const nyOfficeProfile = membership?.agentOfficeProfiles.find(
      (profile) => profile.officeId === context.office.id,
    );
    const njOfficeProfile = membership?.agentOfficeProfiles.find(
      (profile) => profile.officeId === context.secondaryOffice.id,
    );
    const nySplit = membership?.membershipCommissionSettings.find(
      (setting) => setting.officeId === context.office.id,
    );
    const njSplit = membership?.membershipCommissionSettings.find(
      (setting) => setting.officeId === context.secondaryOffice.id,
    );

    assert.ok(nySnapshot);
    assert.ok(njSnapshot);
    assert.equal(nySnapshot?.profile.licenseState, "NY");
    assert.equal(njSnapshot?.profile.licenseState, "NJ");
    assert.equal(nySnapshot?.profile.notes, "NY notes");
    assert.equal(njSnapshot?.profile.notes, "NJ notes");
    assert.equal(nySnapshot?.profile.startDate, "2027-10-09");
    assert.equal(njSnapshot?.profile.startDate, "2028-11-10");
    assert.equal(nyOfficeProfile?.licenseState, "NY");
    assert.equal(njOfficeProfile?.licenseState, "NJ");
    assert.equal(
      nyOfficeProfile?.expirationDate?.toISOString().slice(0, 10),
      "2027-10-09",
    );
    assert.equal(
      njOfficeProfile?.expirationDate?.toISOString().slice(0, 10),
      "2028-11-10",
    );
    assert.equal(nySnapshot?.defaultCommission.agentPercent, "60");
    assert.equal(njSnapshot?.defaultCommission.agentPercent, "80");
    assert.equal(Number(nySplit?.agentPercent ?? 0), 60);
    assert.equal(Number(njSplit?.agentPercent ?? 0), 80);
    assert.equal(nySplit?.effectiveTo, null);
    assert.equal(njSplit?.effectiveTo, null);
  } finally {
    await context.cleanup();
  }
});
