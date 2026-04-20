import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { createContact, linkContactToTransaction } from "./contacts.ts";
import {
  mapLegacyImportedUserRole,
  normalizeLegacyTransactionRow,
  previewResetOrganizationBusinessData,
  resetOrganizationBusinessData,
  splitImportedFullName,
  upsertImportedActiveUser,
} from "./legacy-import.ts";
import { prisma } from "./client.ts";
import { ensureOrganizationRoleTemplates } from "./permissions.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createLegacyImportTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Legacy Import Test ${suffix}`,
      slug: `legacy-import-${suffix}`,
    },
  });
  const primaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Legacy Primary ${suffix}`,
      slug: `legacy-primary-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });
  const secondaryOffice = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Legacy Secondary ${suffix}`,
      slug: `legacy-secondary-${suffix}`,
      market: "New Jersey",
      isPrimary: false,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `legacy-admin-${suffix}@example.com`,
      firstName: "Legacy",
      lastName: "Admin",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true,
    },
  });
  const adminMembership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: primaryOffice.id,
      userId: adminUser.id,
      role: "office_admin",
      status: "active",
      title: "Office Admin",
      permissions: Prisma.JsonNull,
    },
  });
  const trackedUserIds = [adminUser.id];

  async function createMembership(role: UserRole, prefix: string, officeId = primaryOffice.id) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true,
      },
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
        permissions: Prisma.JsonNull,
      },
    });

    return {
      user,
      membership,
    };
  }

  return {
    organization,
    primaryOffice,
    secondaryOffice,
    adminUser,
    adminMembership,
    trackedUserIds,
    createMembership,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      });
    },
  };
}

test("splitImportedFullName and mapLegacyImportedUserRole normalize roster rows", () => {
  const fullName = splitImportedFullName("Taylor Marie Agent");
  const singleToken = splitImportedFullName("Madonna");
  const agentRole = mapLegacyImportedUserRole("Agent");
  const leadRole = mapLegacyImportedUserRole("Team leader");
  const unsupportedRole = mapLegacyImportedUserRole("Broker");

  assert.equal(fullName.firstName, "Taylor Marie");
  assert.equal(fullName.lastName, "Agent");
  assert.deepEqual(fullName.warnings, []);

  assert.equal(singleToken.firstName, "Madonna");
  assert.equal(singleToken.lastName, "Imported");
  assert.equal(singleToken.warnings.length, 1);

  assert.equal(agentRole.role, "agent");
  assert.equal(agentRole.warning, null);
  assert.equal(leadRole.role, "team_lead");
  assert.equal(leadRole.warning, null);
  assert.equal(unsupportedRole.role, null);
  assert.match(unsupportedRole.warning?.message ?? "", /Unsupported imported role/);
});

test("normalizeLegacyTransactionRow maps supported statuses, type fallbacks, and provenance fields", () => {
  const normalized = normalizeLegacyTransactionRow({
    id: "legacy-tx-1",
    status: "pending",
    transaction_type: "Rent/Lease",
    representing: "tenant",
    transaction_name: "Legacy Lease",
    full_address: "123 Main St, New York, NY 10001",
    Address: "",
    City: "",
    State: "",
    "Zip Code": "",
    price: "3500",
    "Sales Price/Gross Rent": "",
    sales_volume: "42000",
    "Net Price": "40000",
    total_gross_commission: "",
    office_gross: "2000",
    "Commission($)": "1800",
    office_net: "1500",
    agent_net: "800",
    "Referral Fee": "100",
    "Company Referral": "Yes",
    "Company Referral Employee's Name": "Amy Admin",
    "Note(Rebate, Referral, Others)": "Imported note",
    "Client's Email": "client@example.com",
    "Client Name": "Client Person",
    "Buyer/Tenant": "Tenant Person",
    "Currency Type": "CNY",
    "Commission Type": "OP Receivable",
    "Agent Name": "Taylor Agent",
    "Licensed Agent Name": "Taylor Agent (NJ)",
  });
  const skipped = normalizeLegacyTransactionRow({
    id: "legacy-tx-2",
    status: "active",
    transaction_type: "sales",
    representing: "buyer",
    transaction_name: "Skip Me",
    Address: "1 Active St",
    City: "New York",
    State: "NY",
    "Zip Code": "10001",
  });

  assert.equal(normalized.shouldImport, true);
  assert.equal(normalized.skipReason, null);
  assert.equal(normalized.createInput.transactionType, "Rental/Leasing");
  assert.equal(normalized.createInput.transactionStatus, "pending");
  assert.equal(normalized.createInput.representing, "tenant");
  assert.equal(normalized.createInput.address, "123 Main St");
  assert.equal(normalized.createInput.city, "New York");
  assert.equal(normalized.createInput.state, "NY");
  assert.equal(normalized.createInput.zipCode, "10001");
  assert.equal(normalized.createInput.purchasedPrice, "42000");
  assert.equal(normalized.createInput.grossCommission, "2000");
  assert.deepEqual(normalized.ownerCandidateNames, ["Taylor Agent", "Taylor Agent (NJ)"]);
  assert.equal(normalized.additionalFields.legacyCurrencyType, "CNY");
  assert.equal(normalized.additionalFields.legacyCommissionType, "OP Receivable");
  assert.equal(normalized.additionalFields.currencyType, undefined);
  assert.equal(normalized.additionalFields.commissionType, undefined);
  assert.ok(normalized.warnings.some((warning) => warning.code === "non_usd_currency"));

  assert.equal(skipped.shouldImport, false);
  assert.match(skipped.skipReason ?? "", /outside the import scope/);
});

test("upsertImportedActiveUser creates an active user with company-only access and a forced password reset", async () => {
  const context = await createLegacyImportTestContext();

  try {
    const imported = await upsertImportedActiveUser({
      organizationId: context.organization.id,
      actorMembershipId: context.adminMembership.id,
      viewerOfficeId: context.secondaryOffice.id,
      email: `legacy-imported-${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Taylor",
      lastName: "Agent",
      role: "agent",
      defaultOfficeId: context.secondaryOffice.id,
      accessibleOfficeIds: [context.secondaryOffice.id],
      title: null,
      initialPassword: "Acreny2026",
    });

    const membership = await prisma.membership.findUnique({
      where: {
        id: imported.membershipId,
      },
      include: {
        officeAccesses: true,
        user: {
          include: {
            credential: true,
          },
        },
      },
    });

    assert.ok(membership);
    assert.equal(membership?.status, "active");
    assert.equal(membership?.role, "agent");
    assert.equal(membership?.officeId, context.secondaryOffice.id);
    assert.equal(membership?.officeAccesses.length, 1);
    assert.equal(membership?.officeAccesses[0]?.officeId, context.secondaryOffice.id);
    assert.equal(membership?.user.credential?.mustChangePassword, true);
    assert.equal(imported.createdCredential, true);
  } finally {
    await context.cleanup();
  }
});

test("resetOrganizationBusinessData preserves the bootstrap shell while clearing imported business data", async () => {
  const context = await createLegacyImportTestContext();

  try {
    const importedAgent = await context.createMembership("agent", "legacy-reset-agent", context.secondaryOffice.id);

    await prisma.userCredential.create({
      data: {
        userId: importedAgent.user.id,
        passwordHash: "placeholder-hash",
        mustChangePassword: true,
      },
    });
    await prisma.membershipNotificationPreference.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.secondaryOffice.id,
        membershipId: importedAgent.membership.id,
      },
    });
    await prisma.membershipOfficeAccess.create({
      data: {
        organizationId: context.organization.id,
        membershipId: importedAgent.membership.id,
        officeId: context.secondaryOffice.id,
        createdByMembershipId: context.adminMembership.id,
      },
    });
    await prisma.membershipPermissionOverride.create({
      data: {
        organizationId: context.organization.id,
        membershipId: importedAgent.membership.id,
        permissionKey: "transactions:view:team",
        effect: "allow",
        createdByMembershipId: context.adminMembership.id,
      },
    });
    await prisma.membershipOfficePermissionOverride.create({
      data: {
        organizationId: context.organization.id,
        membershipId: importedAgent.membership.id,
        officeId: context.secondaryOffice.id,
        permissionKey: "transactions:view:office",
        effect: "allow",
        createdByMembershipId: context.adminMembership.id,
      },
    });
    await prisma.transactionFieldSetting.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.secondaryOffice.id,
        fieldKey: "transaction_name",
        isRequired: false,
        isVisible: true,
        sortOrder: 0,
      },
    });
    await ensureOrganizationRoleTemplates(
      context.organization.id,
      prisma,
      context.adminMembership.id,
    );
    const roleTemplateCountBeforeReset = await prisma.organizationRoleTemplate.count({
      where: {
        organizationId: context.organization.id,
      },
    });
    const roleTemplatePermissionCountBeforeReset = await prisma.organizationRoleTemplatePermission.count({
      where: {
        organizationId: context.organization.id,
      },
    });
    const team = await prisma.team.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.secondaryOffice.id,
        name: "Legacy Reset Team",
        slug: `legacy-reset-team-${randomUUID().slice(0, 8)}`,
      },
    });
    await prisma.teamMembership.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.secondaryOffice.id,
        teamId: team.id,
        membershipId: importedAgent.membership.id,
        role: "member",
      },
    });
    await prisma.invitation.create({
      data: {
        organizationId: context.organization.id,
        membershipId: importedAgent.membership.id,
        email: importedAgent.user.email,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        invitedByMembershipId: context.adminMembership.id,
      },
    });

    const contact = await createContact({
      organizationId: context.organization.id,
      ownerMembershipId: importedAgent.membership.id,
      actorMembershipId: context.adminMembership.id,
      actorOfficeId: context.secondaryOffice.id,
      fullName: "Legacy Contact",
      email: `legacy-contact-${randomUUID().slice(0, 8)}@example.com`,
      source: "Legacy import seed",
      stage: "Imported",
      intent: "Buyer",
    });
    const transaction = await createTransaction({
      organizationId: context.organization.id,
      officeId: context.secondaryOffice.id,
      ownerMembershipId: importedAgent.membership.id,
      actorMembershipId: context.adminMembership.id,
      transactionType: "sales",
      transactionStatus: "pending",
      representing: "buyer",
      address: "1 Reset St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: "Legacy Reset Transaction",
      price: "500000",
      grossCommission: "12000",
      officeNet: "9000",
      agentNet: "3000",
    });
    await linkContactToTransaction(context.organization.id, contact.id, transaction.id, {
      actorMembershipId: context.adminMembership.id,
      isPrimary: true,
    });

    const preview = await previewResetOrganizationBusinessData({
      organizationId: context.organization.id,
      preserveMembershipIds: [context.adminMembership.id],
    });

    assert.equal(preview.counts.memberships, 1);
    assert.equal(preview.counts.users, 1);
    assert.equal(preview.counts.contacts, 1);
    assert.equal(preview.counts.transactions, 1);
    assert.equal(preview.counts.teams, 1);

    const result = await resetOrganizationBusinessData({
      organizationId: context.organization.id,
      preserveMembershipIds: [context.adminMembership.id],
    });

    assert.equal(result.counts.orphanUsersDeleted, 1);

    const preservedAdmin = await prisma.membership.findUnique({
      where: {
        id: context.adminMembership.id,
      },
    });
    const removedMembership = await prisma.membership.findUnique({
      where: {
        id: importedAgent.membership.id,
      },
    });
    const removedUser = await prisma.user.findUnique({
      where: {
        id: importedAgent.user.id,
      },
    });

    assert.ok(preservedAdmin);
    assert.equal(removedMembership, null);
    assert.equal(removedUser, null);
    assert.equal(
      await prisma.transaction.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.client.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.team.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.invitation.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.membershipOfficeAccess.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.membershipPermissionOverride.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.membershipOfficePermissionOverride.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.transactionFieldSetting.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      1,
    );
    assert.equal(
      await prisma.organizationRoleTemplate.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      roleTemplateCountBeforeReset,
    );
    assert.equal(
      await prisma.organizationRoleTemplatePermission.count({
        where: {
          organizationId: context.organization.id,
        },
      }),
      roleTemplatePermissionCountBeforeReset,
    );
  } finally {
    await context.cleanup();
  }
});
