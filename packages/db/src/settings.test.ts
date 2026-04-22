import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { addAgentToTeam, createAgentTeam, deleteAgentTeam, getOfficeAgentsRosterSnapshot } from "./agents.ts";
import { prisma } from "./client.ts";
import {
  getOfficeAdminUserDetailSnapshot,
  getOfficeAdminUsersSnapshot,
  updateOfficeAdminUser,
} from "./settings.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createSettingsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Settings Test ${suffix}`,
      slug: `settings-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Settings Office ${suffix}`,
      slug: `settings-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });
  const secondaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Settings Secondary ${suffix}`,
      slug: `settings-secondary-${suffix}`,
      market: "New Jersey",
      isPrimary: false,
    },
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
    } = {},
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
                  officeId,
                })),
              },
            }
          : undefined,
      }
    });

    return {
      user,
      membership
    };
  }

  const admin = await createMembership("office_admin", `settings-admin-${suffix}`, "Settings", "Admin", "Office Admin");

  return {
    organization,
    office,
    secondaryOffice,
    adminMembership: admin.membership,
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

test("getOfficeAdminUsersSnapshot defaults to the current company scope", async () => {
  const context = await createSettingsTestContext();

  try {
    const primaryOnly = await context.createMembership(
      "agent",
      "primary-only",
      "Primary",
      "Only",
      "Agent",
      {
        officeId: context.office.id,
        accessibleOfficeIds: [context.office.id],
      },
    );
    const sharedUser = await context.createMembership(
      "agent",
      "shared-user",
      "Shared",
      "User",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.office.id, context.secondaryOffice.id],
      },
    );
    const secondaryOnly = await context.createMembership(
      "agent",
      "secondary-only",
      "Secondary",
      "Only",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.secondaryOffice.id],
      },
    );

    const snapshot = await getOfficeAdminUsersSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
    });

    assert.equal(snapshot.filters.officeId, context.office.id);
    assert.equal(snapshot.summary.totalUsers, 3);
    assert.equal(
      snapshot.rows.some((row) => row.membershipId === primaryOnly.membership.id),
      true,
    );
    assert.equal(
      snapshot.rows.some((row) => row.membershipId === sharedUser.membership.id),
      true,
    );
    assert.equal(
      snapshot.rows.some((row) => row.membershipId === secondaryOnly.membership.id),
      false,
    );
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAdminUsersSnapshot paginates filtered user results at 50 rows per page", async () => {
  const context = await createSettingsTestContext();

  try {
    for (let index = 0; index < 55; index += 1) {
      await context.createMembership(
        "agent",
        `paged-agent-${index}`,
        `Paged${String(index).padStart(2, "0")}`,
        "Agent",
        "Agent",
        {
          officeId: context.office.id,
          accessibleOfficeIds: [context.office.id],
        },
      );
    }

    const firstPage = await getOfficeAdminUsersSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      role: "agent",
      page: 1,
      pageSize: 50,
    });
    const secondPage = await getOfficeAdminUsersSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      role: "agent",
      page: 2,
      pageSize: 50,
    });

    assert.equal(firstPage.totalCount, 55);
    assert.equal(firstPage.page, 1);
    assert.equal(firstPage.pageSize, 50);
    assert.equal(firstPage.totalPages, 2);
    assert.equal(firstPage.rows.length, 50);
    assert.equal(secondPage.totalCount, 55);
    assert.equal(secondPage.page, 2);
    assert.equal(secondPage.rows.length, 5);

    const firstPageIds = new Set(firstPage.rows.map((row) => row.membershipId));
    assert.equal(
      secondPage.rows.some((row) => firstPageIds.has(row.membershipId)),
      false,
    );
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAdminUserDetailSnapshot hides users outside the current company scope", async () => {
  const context = await createSettingsTestContext();

  try {
    const secondaryOnly = await context.createMembership(
      "agent",
      "detail-secondary-only",
      "Detail",
      "Secondary",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.secondaryOffice.id],
      },
    );

    const snapshot = await getOfficeAdminUserDetailSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      membershipId: secondaryOnly.membership.id,
    });

    assert.equal(snapshot, null);
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser blocks downgrading an active team leader to agent", async () => {
  const context = await createSettingsTestContext();

  try {
    const leader = await context.createMembership("team_lead", "team-leader", "Team", "Leader", "Team Lead");
    await prisma.userCredential.create({
      data: {
        userId: leader.user.id,
        passwordHash: "test-password-hash"
      }
    });
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Leader Team",
        slug: `leader-team-${randomUUID().slice(0, 8)}`
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: leader.membership.id,
        role: "team_leader"
      }
    });

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: context.adminMembership.id,
          membershipId: leader.membership.id,
          role: "agent"
        }),
      /Remove or transfer this user's active Team \/ Junior Team leadership assignments in Settings > Teams before changing the account role to Agent\./
    );

    const refreshedMembership = await prisma.membership.findUnique({
      where: {
        id: leader.membership.id
      }
    });

    assert.equal(refreshedMembership?.role, "team_lead");
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser blocks managing users outside the current company scope", async () => {
  const context = await createSettingsTestContext();

  try {
    const secondaryOnly = await context.createMembership(
      "agent",
      "update-secondary-only",
      "Update",
      "Secondary",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.secondaryOffice.id],
      },
    );

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: context.adminMembership.id,
          viewerOfficeId: context.office.id,
          membershipId: secondaryOnly.membership.id,
          status: "disabled",
        }),
      /This user is outside the current company scope\./,
    );
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAgentsRosterSnapshot stays side-effect free for legacy junior leader cleanup", async () => {
  const context = await createSettingsTestContext();

  try {
    const legacyLeader = await context.createMembership("team_lead", "legacy-leader", "Legacy", "Leader", "Team Lead");
    const rootTeam = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Legacy Root Team",
        slug: `legacy-root-${randomUUID().slice(0, 8)}`
      }
    });

    const legacyTeamMembership = await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: rootTeam.id,
        membershipId: legacyLeader.membership.id,
        role: "junior_team_leader"
      }
    });

    const [initialTeamCount, initialAuditCount] = await Promise.all([
      prisma.team.count({
        where: {
          organizationId: context.organization.id
        }
      }),
      prisma.auditLog.count({
        where: {
          organizationId: context.organization.id
        }
      })
    ]);

    await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });

    const [finalTeamCount, finalAuditCount, refreshedTeamMembership] = await Promise.all([
      prisma.team.count({
        where: {
          organizationId: context.organization.id
        }
      }),
      prisma.auditLog.count({
        where: {
          organizationId: context.organization.id
        }
      }),
      prisma.teamMembership.findUnique({
        where: {
          id: legacyTeamMembership.id
        }
      })
    ]);

    assert.equal(finalTeamCount, initialTeamCount);
    assert.equal(finalAuditCount, initialAuditCount);
    assert.equal(refreshedTeamMembership?.teamId, rootTeam.id);
    assert.equal(refreshedTeamMembership?.role, "junior_team_leader");
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAgentsRosterSnapshot honors agent visibility instead of transaction visibility", async () => {
  const context = await createSettingsTestContext();

  try {
    const viewer = await context.createMembership("office_admin", "agent-scope-viewer", "Scoped", "Viewer", "Office Admin");
    const teammate = await context.createMembership("agent", "agent-scope-target", "Visible", "Agent", "Agent");

    await prisma.membershipPermissionOverride.create({
      data: {
        organizationId: context.organization.id,
        membershipId: viewer.membership.id,
        permissionKey: "transactions:view:company",
        effect: "deny"
      }
    });

    const snapshot = await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: viewer.membership.id,
      officeId: context.office.id
    });

    assert.equal(snapshot.rows.some((row) => row.membershipId === teammate.membership.id), true);
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAgentsRosterSnapshot includes memberships whose current company access is explicit even when home office differs", async () => {
  const context = await createSettingsTestContext();

  try {
    const sharedUser = await context.createMembership(
      "agent",
      "cross-office-roster",
      "Cross",
      "Roster",
      "Agent",
      {
        officeId: context.secondaryOffice.id,
        accessibleOfficeIds: [context.office.id, context.secondaryOffice.id]
      }
    );

    const snapshot = await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });

    assert.equal(
      snapshot.rows.some((row) => row.membershipId === sharedUser.membership.id),
      true
    );
  } finally {
    await context.cleanup();
  }
});

test("getOfficeAgentsRosterSnapshot paginates filtered roster results at 50 rows per page", async () => {
  const context = await createSettingsTestContext();

  try {
    for (let index = 0; index < 55; index += 1) {
      await context.createMembership(
        "agent",
        `roster-agent-${index}`,
        `Roster${String(index).padStart(2, "0")}`,
        "Agent",
        "Agent",
        {
          officeId: context.office.id,
          accessibleOfficeIds: [context.office.id],
        },
      );
    }

    const firstPage = await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      role: "agent",
      page: 1,
      pageSize: 50,
    });
    const secondPage = await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      role: "agent",
      page: 2,
      pageSize: 50,
    });

    assert.equal(firstPage.totalCount, 55);
    assert.equal(firstPage.page, 1);
    assert.equal(firstPage.pageSize, 50);
    assert.equal(firstPage.totalPages, 2);
    assert.equal(firstPage.summary.totalMembers, 55);
    assert.equal(firstPage.allRows.length, 55);
    assert.equal(firstPage.rows.length, 50);
    assert.equal(secondPage.totalCount, 55);
    assert.equal(secondPage.allRows.length, 55);
    assert.equal(secondPage.page, 2);
    assert.equal(secondPage.rows.length, 5);

    const firstPageIds = new Set(firstPage.rows.map((row) => row.membershipId));
    assert.equal(
      secondPage.rows.some((row) => firstPageIds.has(row.membershipId)),
      false,
    );
    assert.equal(
      firstPage.allRows.some((row) => secondPage.rows.some((secondPageRow) => secondPageRow.membershipId === row.membershipId)),
      true,
    );
  } finally {
    await context.cleanup();
  }
});

test("teams scope snapshot stays organization-wide even when agent visibility is narrower", async () => {
  const context = await createSettingsTestContext();

  try {
    const viewer = await context.createMembership("office_admin", "team-viewer", "Team", "Viewer", "Office Admin");
    const teammate = await context.createMembership("agent", "team-target", "Branch", "Agent", "Agent");
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Scoped Team",
        slug: `scoped-team-${randomUUID().slice(0, 8)}`
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: teammate.membership.id,
        role: "member"
      }
    });

    await prisma.membershipPermissionOverride.createMany({
      data: [
        {
          organizationId: context.organization.id,
          membershipId: viewer.membership.id,
          permissionKey: "agents:view:company",
          effect: "deny"
        },
        {
          organizationId: context.organization.id,
          membershipId: viewer.membership.id,
          permissionKey: "transactions:view:company",
          effect: "deny"
        }
      ]
    });

    const snapshot = await getOfficeAgentsRosterSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: viewer.membership.id,
      officeId: context.office.id,
      scopeMode: "teams"
    });

    const scopedTeam = snapshot.teams.find((item) => item.id === team.id) ?? null;

    assert.ok(scopedTeam);
    assert.equal(scopedTeam?.members.some((member) => member.membershipId === teammate.membership.id), true);
    assert.equal(snapshot.rows.some((row) => row.membershipId === teammate.membership.id), true);
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser blocks changing an actively assigned team member to a non-agent role", async () => {
  const context = await createSettingsTestContext();

  try {
    const member = await context.createMembership("agent", "team-member", "Assigned", "Agent", "Agent");
    await prisma.userCredential.create({
      data: {
        userId: member.user.id,
        passwordHash: "test-password-hash"
      }
    });
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Assigned Team",
        slug: `assigned-team-${randomUUID().slice(0, 8)}`
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: member.membership.id,
        role: "member"
      }
    });

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: context.adminMembership.id,
          membershipId: member.membership.id,
          role: "accountant"
        }),
      /Remove this user's active Team \/ Junior Team assignments in Settings > Teams before changing the account role to a non-agent role\./
    );

    const refreshedMembership = await prisma.membership.findUnique({
      where: {
        id: member.membership.id
      }
    });

    assert.equal(refreshedMembership?.role, "agent");
  } finally {
    await context.cleanup();
  }
});

test("non-admin user managers cannot promote or manage admin-tier accounts", async () => {
  const context = await createSettingsTestContext();

  try {
    const actor = await context.createMembership("accountant", "settings-actor", "Access", "Manager", "Accountant");
    const targetAgent = await context.createMembership("agent", "settings-target-agent", "Target", "Agent", "Agent");
    const targetAdmin = await context.createMembership("office_admin", "settings-target-admin", "Target", "Admin", "Office Admin");

    await prisma.userCredential.create({
      data: {
        userId: targetAgent.user.id,
        passwordHash: "test-password-hash"
      }
    });

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: actor.membership.id,
          membershipId: targetAgent.membership.id,
          role: "office_admin"
        }),
      /Only Owner \/ Office Admin can assign Owner or Office Admin roles\./
    );

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: actor.membership.id,
          membershipId: targetAdmin.membership.id,
          status: "disabled"
        }),
      /Only Owner \/ Office Admin can manage Owner or Office Admin accounts\./
    );
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser still allows non-role updates for legacy non-hierarchy team assignments", async () => {
  const context = await createSettingsTestContext();

  try {
    const member = await context.createMembership("accountant", "legacy-team-accountant", "Legacy", "Accountant", "Accountant");
    await prisma.userCredential.create({
      data: {
        userId: member.user.id,
        passwordHash: "test-password-hash"
      }
    });
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Legacy Accountant Team",
        slug: `legacy-accountant-team-${randomUUID().slice(0, 8)}`
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: member.membership.id,
        role: "member"
      }
    });

    const updatedMembership = await updateOfficeAdminUser({
      organizationId: context.organization.id,
      actorMembershipId: context.adminMembership.id,
      membershipId: member.membership.id,
      status: "disabled"
    });

    assert.equal(updatedMembership.status, "disabled");
    assert.equal(updatedMembership.role, "accountant");
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser lets admins update a back-office user's identity", async () => {
  const context = await createSettingsTestContext();

  try {
    const member = await context.createMembership(
      "agent",
      "rename-target",
      "Original",
      "Name",
      "Agent",
    );
    await prisma.userCredential.create({
      data: {
        userId: member.user.id,
        passwordHash: "test-password-hash",
      },
    });

    await updateOfficeAdminUser({
      organizationId: context.organization.id,
      actorMembershipId: context.adminMembership.id,
      membershipId: member.membership.id,
      viewerOfficeId: context.office.id,
      firstName: "Ada",
      lastName: "Lovelace",
      email: " Ada.Lovelace@example.com ",
    });

    const savedUser = await prisma.user.findUnique({
      where: {
        id: member.user.id,
      },
    });
    const snapshot = await getOfficeAdminUserDetailSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: member.membership.id,
      viewerMembershipId: context.adminMembership.id,
    });

    assert.equal(savedUser?.firstName, "Ada");
    assert.equal(savedUser?.lastName, "Lovelace");
    assert.equal(savedUser?.email, "ada.lovelace@example.com");
    assert.equal(snapshot?.profile.firstName, "Ada");
    assert.equal(snapshot?.profile.lastName, "Lovelace");
    assert.equal(snapshot?.profile.name, "Ada Lovelace");
    assert.equal(snapshot?.profile.email, "ada.lovelace@example.com");
  } finally {
    await context.cleanup();
  }
});

test("updateOfficeAdminUser rejects duplicate email addresses", async () => {
  const context = await createSettingsTestContext();

  try {
    const target = await context.createMembership(
      "agent",
      "email-target",
      "Target",
      "Member",
      "Agent",
    );
    const duplicate = await context.createMembership(
      "accountant",
      "email-duplicate",
      "Existing",
      "Member",
      "Accountant",
    );
    await prisma.userCredential.create({
      data: {
        userId: target.user.id,
        passwordHash: "test-password-hash",
      },
    });

    await assert.rejects(
      () =>
        updateOfficeAdminUser({
          organizationId: context.organization.id,
          actorMembershipId: context.adminMembership.id,
          membershipId: target.membership.id,
          viewerOfficeId: context.office.id,
          email: duplicate.user.email,
        }),
      /Another user already uses that email address\./,
    );
  } finally {
    await context.cleanup();
  }
});

test("team membership writes reject non team-hierarchy account roles", async () => {
  const context = await createSettingsTestContext();

  try {
    const accountant = await context.createMembership("accountant", "team-accountant", "Team", "Accountant", "Accountant");
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: "Guarded Team",
        slug: `guarded-team-${randomUUID().slice(0, 8)}`
      }
    });

    await assert.rejects(
      () =>
        addAgentToTeam({
          organizationId: context.organization.id,
          officeId: context.office.id,
          actorMembershipId: context.adminMembership.id,
          teamId: team.id,
          membershipId: accountant.membership.id,
          role: "member"
        }),
      /Only Agent \/ Team Lead accounts can be assigned inside Team \/ Junior Team hierarchy\./
    );

    await assert.rejects(
      () =>
        createAgentTeam({
          organizationId: context.organization.id,
          officeId: context.office.id,
          actorMembershipId: context.adminMembership.id,
          name: "Accountant Team",
          leaderMembershipId: accountant.membership.id
        }),
      /Only Agent \/ Team Lead accounts can own a Team or Junior Team\./
    );
  } finally {
    await context.cleanup();
  }
});

test("deleteAgentTeam removes the final owner assignment when it is the only remaining member", async () => {
  const context = await createSettingsTestContext();

  try {
    const leader = await context.createMembership(
      "team_lead",
      "delete-team-owner",
      "Delete",
      "Owner",
      "No active team"
    );
    const team = await createAgentTeam({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      name: `Delete Ready ${randomUUID().slice(0, 8)}`,
      leaderMembershipId: leader.membership.id
    });

    const beforeDeleteLeader = await prisma.membership.findUnique({
      where: {
        id: leader.membership.id
      },
      select: {
        title: true
      }
    });

    assert.match(beforeDeleteLeader?.title ?? "", /Team Leader/);

    await deleteAgentTeam({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.adminMembership.id,
      teamId: team.id
    });

    const [deletedTeam, deletedTeamMembershipCount, refreshedLeader] = await Promise.all([
      prisma.team.findUnique({
        where: {
          id: team.id
        }
      }),
      prisma.teamMembership.count({
        where: {
          organizationId: context.organization.id,
          teamId: team.id
        }
      }),
      prisma.membership.findUnique({
        where: {
          id: leader.membership.id
        },
        select: {
          role: true,
          title: true
        }
      })
    ]);

    assert.equal(deletedTeam, null);
    assert.equal(deletedTeamMembershipCount, 0);
    assert.equal(refreshedLeader?.role, "team_lead");
    assert.equal(refreshedLeader?.title, "No active team");
  } finally {
    await context.cleanup();
  }
});
