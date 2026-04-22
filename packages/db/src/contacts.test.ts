import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  ClientFollowUpReminderMode,
  ClientFollowUpStatus,
  Prisma,
  type UserRole,
} from "@prisma/client";
import { prisma } from "./client.ts";
import {
  createContact,
  getContactById,
  listContacts,
  mergeFrontOfficeClients,
  updateFrontOfficeClientExecution,
} from "./contacts.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createContactsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Contacts Test ${suffix}`,
      slug: `contacts-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Contacts Office ${suffix}`,
      slug: `contacts-office-${suffix}`,
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

  const admin = await createMembership("office_admin", `contacts-admin-${suffix}`);

  return {
    organization,
    office,
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

function buildTransactionInput(
  context: Awaited<ReturnType<typeof createContactsTestContext>>,
  ownerMembershipId: string,
  label: string
) {
  return {
    organizationId: context.organization.id,
    officeId: context.office.id,
    ownerMembershipId,
    actorMembershipId: context.adminMembership.id,
    transactionType: "sales" as const,
    transactionStatus: "pending" as const,
    representing: "buyer" as const,
    address: `${label} Address`,
    city: "Queens",
    state: "NY",
    zipCode: "11101",
    transactionName: label,
    price: "100000"
  };
}

function addUtcDays(value: Date, days: number) {
  const nextValue = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  nextValue.setUTCDate(nextValue.getUTCDate() + days);
  return nextValue.toISOString().slice(0, 10);
}

test("createContact stores an empty additionalFields object when none is provided", async () => {
  const context = await createContactsTestContext();

  try {
    await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });

    const created = await createContact({
      organizationId: context.organization.id,
      ownerMembershipId: context.adminMembership.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      fullName: "Empty Additional Fields Contact",
      source: "Manual entry",
      stage: "New",
      intent: "Buyer"
    });

    const stored = await prisma.client.findUnique({
      where: {
        id: created.id
      },
      select: {
        additionalFields: true
      }
    });

    assert.deepEqual(stored?.additionalFields, {});
  } finally {
    await context.cleanup();
  }
});

test("mergeFrontOfficeClients normalizes scalar additionalFields to an empty object", async () => {
  const context = await createContactsTestContext();

  try {
    await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id
    });

    const target = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.adminMembership.id,
        fullName: "Merge Target",
        source: "Manual entry",
        stage: "New",
        intent: "Buyer",
        preferredAreas: [],
        additionalFields: Prisma.JsonNull
      }
    });

    const source = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.adminMembership.id,
        fullName: "Merge Source",
        source: "Manual entry",
        stage: "New",
        intent: "Buyer",
        preferredAreas: [],
        additionalFields: Prisma.JsonNull
      }
    });

    await mergeFrontOfficeClients({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      targetClientId: target.id,
      sourceClientId: source.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id
    });

    const stored = await prisma.client.findUnique({
      where: {
        id: target.id
      },
      select: {
        additionalFields: true
      }
    });

    assert.deepEqual(stored?.additionalFields, {});
  } finally {
    await context.cleanup();
  }
});

test("createContact applies automated follow-up defaults and prefers the WeChat display name", async () => {
  const context = await createContactsTestContext();

  try {
    await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
    });

    const created = await createContact({
      organizationId: context.organization.id,
      ownerMembershipId: context.adminMembership.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      fullName: "Annie Chen",
      wechatDisplayName: "安妮",
      stage: "Warm Lead",
      intent: "Buyer",
      followUpStatus: ClientFollowUpStatus.waiting_reply,
      useFollowUpAutomation: true,
    });

    assert.equal(created.displayName, "安妮");
    assert.equal(created.wechatDisplayName, "安妮");
    assert.equal(created.followUpStatus, ClientFollowUpStatus.waiting_reply);
    assert.equal(
      created.followUpReminderMode,
      ClientFollowUpReminderMode.auto,
    );
    assert.equal(created.nextFollowUpAt, addUtcDays(new Date(), 3));
  } finally {
    await context.cleanup();
  }
});

test("updateFrontOfficeClientExecution keeps a manual reminder pinned until the agent restores auto mode", async () => {
  const context = await createContactsTestContext();

  try {
    await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
    });

    const created = await createContact({
      organizationId: context.organization.id,
      ownerMembershipId: context.adminMembership.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      fullName: "Pinned Reminder Client",
      stage: "Warm Lead",
      intent: "Buyer",
      followUpStatus: ClientFollowUpStatus.active_follow_up,
      useFollowUpAutomation: true,
    });

    const manualReminder = "2026-05-12";
    const manualResult = await updateFrontOfficeClientExecution({
      organizationId: context.organization.id,
      clientId: created.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      nextFollowUpAt: manualReminder,
    });

    assert.equal(
      manualResult?.followUpReminderMode,
      ClientFollowUpReminderMode.manual,
    );
    assert.equal(manualResult?.nextFollowUpAt, manualReminder);

    const followedUpResult = await updateFrontOfficeClientExecution({
      organizationId: context.organization.id,
      clientId: created.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      markFollowedUpNow: true,
    });

    assert.equal(
      followedUpResult?.followUpReminderMode,
      ClientFollowUpReminderMode.manual,
    );
    assert.equal(followedUpResult?.nextFollowUpAt, manualReminder);
    assert.ok(followedUpResult?.lastContactAt);

    const autoResult = await updateFrontOfficeClientExecution({
      organizationId: context.organization.id,
      clientId: created.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.office.id,
      followUpReminderMode: ClientFollowUpReminderMode.auto,
    });

    assert.equal(
      autoResult?.followUpReminderMode,
      ClientFollowUpReminderMode.auto,
    );
    assert.equal(autoResult?.nextFollowUpAt, addUtcDays(new Date(), 2));
  } finally {
    await context.cleanup();
  }
});

test("contacts list and detail respect membership scope", async () => {
  const context = await createContactsTestContext();

  try {
    const teamLead = await context.createMembership("team_lead", "contacts-lead");
    const agent = await context.createMembership("agent", "contacts-agent");
    const outsider = await context.createMembership("agent", "contacts-outsider");

    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        name: `Contacts Team ${randomUUID().slice(0, 8)}`,
        slug: `contacts-team-${randomUUID().slice(0, 8)}`
      }
    });
    const leaderTeamMembership = await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: teamLead.membership.id,
        role: "team_leader"
      }
    });

    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        teamId: team.id,
        membershipId: agent.membership.id,
        role: "member",
        reportsToTeamMembershipId: leaderTeamMembership.id
      }
    });

    const contact = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: agent.membership.id,
        fullName: "Scoped Contact",
        email: "scoped-contact@example.com",
        source: "Manual entry",
        stage: "New",
        intent: "Buyer",
        preferredAreas: []
      }
    });

    const visibleLinkedTransaction = await createTransaction(
      buildTransactionInput(context, agent.membership.id, "Visible Linked Transaction")
    );
    const hiddenLinkedTransaction = await createTransaction(
      buildTransactionInput(context, outsider.membership.id, "Hidden Linked Transaction")
    );
    const visibleAvailableTransaction = await createTransaction(
      buildTransactionInput(context, agent.membership.id, "Visible Available Transaction")
    );
    await createTransaction(buildTransactionInput(context, outsider.membership.id, "Hidden Available Transaction"));

    await prisma.transactionContact.createMany({
      data: [
        {
          organizationId: context.organization.id,
          transactionId: visibleLinkedTransaction.id,
          clientId: contact.id,
          role: "buyer",
          isPrimary: true
        },
        {
          organizationId: context.organization.id,
          transactionId: hiddenLinkedTransaction.id,
          clientId: contact.id,
          role: "buyer",
          isPrimary: false
        }
      ]
    });

    const ownerList = await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: agent.membership.id,
      officeId: context.office.id
    });
    const teamLeadList = await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: teamLead.membership.id,
      officeId: context.office.id
    });
    const outsiderList = await listContacts({
      organizationId: context.organization.id,
      viewerMembershipId: outsider.membership.id,
      officeId: context.office.id
    });

    const ownerDetail = await getContactById({
      organizationId: context.organization.id,
      viewerMembershipId: agent.membership.id,
      officeId: context.office.id,
      contactId: contact.id
    });
    const teamLeadDetail = await getContactById({
      organizationId: context.organization.id,
      viewerMembershipId: teamLead.membership.id,
      officeId: context.office.id,
      contactId: contact.id
    });
    const outsiderDetail = await getContactById({
      organizationId: context.organization.id,
      viewerMembershipId: outsider.membership.id,
      officeId: context.office.id,
      contactId: contact.id
    });

    assert.equal(ownerList.totalCount, 1);
    assert.equal(ownerList.contacts[0]?.id, contact.id);
    assert.equal(teamLeadList.totalCount, 1);
    assert.equal(teamLeadList.contacts[0]?.id, contact.id);
    assert.equal(outsiderList.totalCount, 0);

    assert.ok(ownerDetail);
    assert.equal(ownerDetail.linkedTransactions.length, 1);
    assert.equal(ownerDetail.linkedTransactions[0]?.id, visibleLinkedTransaction.id);
    assert.deepEqual(
      ownerDetail.availableTransactions.map((transaction) => transaction.id),
      [visibleAvailableTransaction.id]
    );

    assert.ok(teamLeadDetail);
    assert.equal(teamLeadDetail.linkedTransactions.length, 1);
    assert.equal(teamLeadDetail.linkedTransactions[0]?.id, visibleLinkedTransaction.id);
    assert.deepEqual(
      teamLeadDetail.availableTransactions.map((transaction) => transaction.id),
      [visibleAvailableTransaction.id]
    );

    assert.equal(outsiderDetail, null);
  } finally {
    await context.cleanup();
  }
});
