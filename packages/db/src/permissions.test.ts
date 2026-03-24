import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import { getMembershipEffectivePermissionKeys, resetMembershipPermissionOverrides, saveMembershipPermissionOverrides } from "./permissions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createPermissionsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Permissions Test ${suffix}`,
      slug: `permissions-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Permissions Office ${suffix}`,
      slug: `permissions-office-${suffix}`,
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

test("only owner or office admin can save user permission overrides", async () => {
  const context = await createPermissionsTestContext();

  try {
    const actor = await context.createMembership("accountant", "permissions-actor");
    const target = await context.createMembership("agent", "permissions-target");

    await assert.rejects(
      () =>
        saveMembershipPermissionOverrides({
          organizationId: context.organization.id,
          actorMembershipId: actor.membership.id,
          membershipId: target.membership.id,
          overrides: [{ permissionKey: "settings:manage", effect: "allow" }]
        }),
      /Only Owner \/ Office Admin can manage user permission overrides\./
    );

    const storedOverrides = await prisma.membershipPermissionOverride.findMany({
      where: {
        organizationId: context.organization.id,
        membershipId: target.membership.id
      }
    });

    assert.equal(storedOverrides.length, 0);
  } finally {
    await context.cleanup();
  }
});

test("only owner or office admin can reset user permission overrides", async () => {
  const context = await createPermissionsTestContext();

  try {
    const admin = await context.createMembership("office_admin", "permissions-admin");
    const actor = await context.createMembership("human_resources", "permissions-actor-reset");
    const target = await context.createMembership("agent", "permissions-target-reset");

    await saveMembershipPermissionOverrides({
      organizationId: context.organization.id,
      actorMembershipId: admin.membership.id,
      membershipId: target.membership.id,
      overrides: [{ permissionKey: "notifications:view", effect: "deny" }]
    });

    await assert.rejects(
      () =>
        resetMembershipPermissionOverrides({
          organizationId: context.organization.id,
          actorMembershipId: actor.membership.id,
          membershipId: target.membership.id
        }),
      /Only Owner \/ Office Admin can manage user permission overrides\./
    );

    const storedOverrides = await prisma.membershipPermissionOverride.findMany({
      where: {
        organizationId: context.organization.id,
        membershipId: target.membership.id
      }
    });

    assert.equal(storedOverrides.length, 1);
    assert.equal(storedOverrides[0]?.permissionKey, "notifications:view");
  } finally {
    await context.cleanup();
  }
});

test("leader team assignments inherit team lead permissions even before the saved membership role is repaired", async () => {
  const context = await createPermissionsTestContext();

  try {
    const leader = await context.createMembership("agent", "permissions-junior-leader");
    const rootTeam = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: `Permissions Root ${randomUUID().slice(0, 8)}`,
        slug: `permissions-root-${randomUUID().slice(0, 8)}`
      }
    });
    const childTeam = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: `Permissions Child ${randomUUID().slice(0, 8)}`,
        slug: `permissions-child-${randomUUID().slice(0, 8)}`,
        parentTeamId: rootTeam.id
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: childTeam.id,
        membershipId: leader.membership.id,
        role: "junior_team_leader"
      }
    });

    const permissionKeys = await getMembershipEffectivePermissionKeys({
      organizationId: context.organization.id,
      membershipId: leader.membership.id
    });

    assert.equal(permissionKeys.includes("transactions:view:team"), true);
    assert.equal(permissionKeys.includes("reports:view:team"), true);
    assert.equal(permissionKeys.includes("transactions:view:company"), false);
    assert.equal(permissionKeys.includes("settings:manage"), false);
  } finally {
    await context.cleanup();
  }
});
