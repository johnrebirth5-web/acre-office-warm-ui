import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma } from "@prisma/client";
import {
  acceptInvitation,
  authenticatePasswordUser,
  createInvitedUser,
  ensureBootstrapAdminAccount,
  getBootstrapAdminEmail,
  unlockInternalAccount
} from "./auth.ts";
import { prisma } from "./client.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createInternalAuthTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Internal Auth Test ${suffix}`,
      slug: `internal-auth-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Internal Office ${suffix}`,
      slug: `internal-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      email: `internal-admin-${suffix}@example.com`,
      firstName: "Internal",
      lastName: "Admin",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true
    }
  });

  const adminMembership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      userId: adminUser.id,
      role: "office_admin",
      status: "active",
      title: "Office Admin",
      permissions: Prisma.JsonNull
    }
  });

  const trackedUserIds = [adminUser.id];

  return {
    organization,
    office,
    adminMembership,
    trackedUserIds,
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

async function createAcceptedUserAccount(password: string) {
  const context = await createInternalAuthTestContext();
  const inviteEmail = `invited-${randomUUID().slice(0, 8)}@example.com`;

  const invitation = await createInvitedUser({
    organizationId: context.organization.id,
    actorMembershipId: context.adminMembership.id,
    email: inviteEmail,
    firstName: "Invited",
    lastName: "User",
    role: "office_user",
    officeId: context.office.id,
    title: "Operations User"
  });

  context.trackedUserIds.push(invitation.userId);

  const accepted = await acceptInvitation({
    token: invitation.rawToken,
    firstName: "Invited",
    lastName: "User",
    password
  });

  assert.equal(accepted.status, "success");

  return {
    ...context,
    invitation,
    inviteEmail
  };
}

test("bootstrap admin exists as an active office_admin account with a stored hash", async () => {
  const result = await ensureBootstrapAdminAccount();

  assert.ok(result.organizationId);
  assert.ok(result.membershipId);
  assert.ok(result.userId);

  const bootstrapUser = await prisma.user.findUnique({
    where: {
      email: getBootstrapAdminEmail()
    },
    include: {
      credential: true,
      memberships: true
    }
  });

  assert.ok(bootstrapUser);
  assert.ok(bootstrapUser?.credential);
  assert.notEqual(bootstrapUser?.credential?.passwordHash, "Acreny2021");

  const bootstrapMembership = bootstrapUser?.memberships.find((membership) => membership.id === result.membershipId);
  assert.equal(bootstrapMembership?.role, "office_admin");
  assert.equal(bootstrapMembership?.status, "active");

  if (result.created) {
    assert.equal(bootstrapUser?.credential?.mustChangePassword, true);
  }
});

test("invited users accept an invitation, set a password, and become active", async () => {
  const context = await createInternalAuthTestContext();

  try {
    const invitation = await createInvitedUser({
      organizationId: context.organization.id,
      actorMembershipId: context.adminMembership.id,
      email: `accept-${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Pending",
      lastName: "User",
      role: "office_user",
      officeId: context.office.id,
      title: "Office User"
    });

    context.trackedUserIds.push(invitation.userId);

    const result = await acceptInvitation({
      token: invitation.rawToken,
      firstName: "Accepted",
      lastName: "User",
      password: "Accept123!"
    });

    assert.equal(result.status, "success");

    const membership = await prisma.membership.findUnique({
      where: {
        id: invitation.membershipId
      },
      include: {
        user: {
          include: {
            credential: true
          }
        }
      }
    });

    const storedInvitation = await prisma.invitation.findUnique({
      where: {
        id: invitation.invitationId
      }
    });

    assert.equal(membership?.status, "active");
    assert.ok(membership?.user.credential);
    assert.equal(membership?.user.credential?.mustChangePassword, false);
    assert.ok(storedInvitation?.acceptedAt);
  } finally {
    await context.cleanup();
  }
});

test("password login succeeds after invitation setup", async () => {
  const context = await createAcceptedUserAccount("Login123!");

  try {
    const login = await authenticatePasswordUser(context.inviteEmail, "Login123!");

    assert.equal(login.status, "success");
    if (login.status === "success") {
      assert.equal(login.context.currentMembership.id, context.invitation.membershipId);
      assert.equal(login.context.currentMembership.role, "office_user");
      assert.equal(login.context.currentUser.email, context.inviteEmail);
      assert.equal(login.context.currentCredential?.failedLoginCount, 0);
    }
  } finally {
    await context.cleanup();
  }
});

test("five failed password attempts lock the account for one hour", async () => {
  const context = await createAcceptedUserAccount("LockMe123!");

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await authenticatePasswordUser(context.inviteEmail, "wrong-password");
      assert.equal(result.status, "invalid");
    }

    const lockedResult = await authenticatePasswordUser(context.inviteEmail, "wrong-password");
    assert.equal(lockedResult.status, "locked");

    const credential = await prisma.userCredential.findUnique({
      where: {
        userId: context.invitation.userId
      }
    });

    assert.equal(credential?.failedLoginCount, 5);
    assert.ok(credential?.lockedUntil);
    assert.ok((credential?.lockedUntil?.getTime() ?? 0) > Date.now());

    const retryWhileLocked = await authenticatePasswordUser(context.inviteEmail, "LockMe123!");
    assert.equal(retryWhileLocked.status, "locked");
  } finally {
    await context.cleanup();
  }
});

test("admins can unlock a locked account and restore password login", async () => {
  const context = await createAcceptedUserAccount("Unlock123!");

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticatePasswordUser(context.inviteEmail, "wrong-password");
    }

    await unlockInternalAccount({
      organizationId: context.organization.id,
      actorMembershipId: context.adminMembership.id,
      membershipId: context.invitation.membershipId
    });

    const credential = await prisma.userCredential.findUnique({
      where: {
        userId: context.invitation.userId
      }
    });

    assert.equal(credential?.failedLoginCount, 0);
    assert.equal(credential?.lockedUntil, null);

    const login = await authenticatePasswordUser(context.inviteEmail, "Unlock123!");
    assert.equal(login.status, "success");
  } finally {
    await context.cleanup();
  }
});
