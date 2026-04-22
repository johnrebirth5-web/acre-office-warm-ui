import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma, saveAgentProfile, upsertImportedActiveUser } from "../../../packages/db/src/index.ts";
import { executeSupplementalImport } from "./index.ts";
import {
  aggregateSupplementalRows,
  type SupplementalWorkbookRow,
} from "./supplemental.ts";

after(async () => {
  await prisma.$disconnect();
});

function buildWorkbookData(rows: SupplementalWorkbookRow[]) {
  const aggregated = aggregateSupplementalRows(rows);

  return {
    sourceUrl: "https://docs.google.com/spreadsheets/d/test/export?format=xlsx",
    aggregatedUsers: aggregated.aggregatedUsers,
    countsBySheet: Object.fromEntries(
      Object.entries(aggregated.countsBySheet).map(([sheetName, counts]) => [
        sheetName,
        {
          rows: counts.rows,
          groupedUsers: counts.groupedUsers,
          imported: 0,
          skipped: 0,
          failed: 0,
        },
      ]),
    ),
  };
}

async function createSupplementalImportTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Supplemental Import Test ${suffix}`,
      slug: `supplemental-import-${suffix}`,
    },
  });
  const offices = await Promise.all([
    prisma.office.create({
      data: {
        organizationId: organization.id,
        name: "Acre NY Realty",
        slug: "acre-ny-realty",
        market: "New York",
        isPrimary: true,
      },
    }),
    prisma.office.create({
      data: {
        organizationId: organization.id,
        name: "Acre NJ LLC",
        slug: "acre-nj-llc",
        market: "New Jersey",
        isPrimary: false,
      },
    }),
    prisma.office.create({
      data: {
        organizationId: organization.id,
        name: "Acre NY Rental",
        slug: "acre-ny-rental",
        market: "New York",
        isPrimary: false,
      },
    }),
  ]);
  const officeBySlug = new Map(offices.map((office) => [office.slug, office]));
  const adminUser = await prisma.user.create({
    data: {
      email: `supplemental-admin-${suffix}@example.com`,
      firstName: "Supplemental",
      lastName: "Admin",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true,
    },
  });
  const adminMembership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: officeBySlug.get("acre-ny-realty")?.id ?? "",
      userId: adminUser.id,
      role: "office_admin",
      status: "active",
      title: "Office Admin",
      permissions: Prisma.JsonNull,
    },
  });
  const trackedUserIds = [adminUser.id];

  async function createImportedUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    officeSlug?: "acre-ny-realty" | "acre-nj-llc" | "acre-ny-rental";
  }) {
    const officeSlug = input.officeSlug ?? "acre-ny-realty";
    const office = officeBySlug.get(officeSlug);

    if (!office) {
      throw new Error(`Missing office ${officeSlug} in test context.`);
    }

    const created = await upsertImportedActiveUser({
      organizationId: organization.id,
      actorMembershipId: adminMembership.id,
      viewerOfficeId: office.id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role ?? "agent",
      defaultOfficeId: office.id,
      accessibleOfficeIds: [office.id],
      title: null,
      initialPassword: "Acreny2026",
    });

    trackedUserIds.push(created.userId);

    return {
      membershipId: created.membershipId,
      email: input.email,
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      officeSlugs: [officeSlug],
    };
  }

  return {
    organization,
    adminMembership,
    officeBySlug,
    async createImportedUser(input: {
      email: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
      officeSlug?: "acre-ny-realty" | "acre-nj-llc" | "acre-ny-rental";
    }) {
      return createImportedUser(input);
    },
    runtimeContext: {
      organizationId: organization.id,
      bootstrapMembershipId: adminMembership.id,
      officeBySlug,
      sourceDir: "",
      reportDir: "",
    },
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

test("executeSupplementalImport dry-run resolves alias matches without mutating the database", async () => {
  const context = await createSupplementalImportTestContext();

  try {
    const importedUser = await context.createImportedUser({
      email: `tj.agent.${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Taylor",
      lastName: "Agent",
    });

    const result = await executeSupplementalImport(
      context.runtimeContext,
      [importedUser],
      false,
      "https://docs.google.com/spreadsheets/d/test/edit#gid=0",
      {
        loadSupplementalWorkbookData: async () =>
          buildWorkbookData([
            {
              sheetName: "Acre NY",
              officeSlug: "acre-ny-realty",
              sourceRowNumber: 2,
              userName: "TJ Agent",
              licenseStateRaw: "Acre NY",
              splitRaw: "50%",
              expirationRaw: "10/9/2027",
            },
          ]),
        now: new Date("2026-04-22T12:00:00Z"),
      },
    );

    assert.equal(result.imported, 1);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.successes[0]?.membershipEmail, importedUser.email);
    assert.equal(
      await prisma.agentProfile.count({
        where: {
          membershipId: importedUser.membershipId,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.membershipCommissionSetting.count({
        where: {
          membershipId: importedUser.membershipId,
        },
      }),
      0,
    );
  } finally {
    await context.cleanup();
  }
});

test("executeSupplementalImport execute updates notes, license state, expiration date, and default split", async () => {
  const context = await createSupplementalImportTestContext();

  try {
    const importedUser = await context.createImportedUser({
      email: `supplemental.agent.${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Qiongxiu",
      lastName: "Zhang",
    });

    await saveAgentProfile({
      organizationId: context.organization.id,
      officeId: context.officeBySlug.get("acre-ny-realty")?.id ?? null,
      membershipId: importedUser.membershipId,
      actorMembershipId: context.adminMembership.id,
      notes: "Existing note",
    });

    const result = await executeSupplementalImport(
      context.runtimeContext,
      [importedUser],
      true,
      "https://docs.google.com/spreadsheets/d/test/edit#gid=0",
      {
        loadSupplementalWorkbookData: async () =>
          buildWorkbookData([
            {
              sheetName: "Acre NY",
              officeSlug: "acre-ny-realty",
              sourceRowNumber: 10,
              userName: "Qiongxiu Zhang",
              licenseStateRaw: "NY",
              splitRaw: "0.3",
              expirationRaw: "",
            },
            {
              sheetName: "Acre NY",
              officeSlug: "acre-ny-realty",
              sourceRowNumber: 11,
              userName: "Qiongxiu Zhang",
              licenseStateRaw: "Acre Rental",
              splitRaw:
                "1/31/2025前30%，1/31/2025后40%，2/5/2025后50%，8/21/2025后持证60%",
              expirationRaw: "46619",
            },
          ]),
        now: new Date("2026-04-22T12:00:00Z"),
      },
    );

    const membership = await prisma.membership.findUnique({
      where: {
        id: importedUser.membershipId,
      },
      include: {
        agentProfile: true,
        membershipCommissionSettings: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    assert.equal(result.imported, 1);
    assert.ok(membership?.agentProfile);
    assert.equal(membership?.agentProfile?.licenseState, "Acre Rental");
    assert.equal(
      membership?.agentProfile?.startDate?.toISOString().slice(0, 10),
      "2027-08-20",
    );
    assert.match(membership?.agentProfile?.notes ?? "", /Existing note/);
    assert.match(
      membership?.agentProfile?.notes ?? "",
      /Supplemental roster import: Acre NY/,
    );
    assert.equal(membership?.membershipCommissionSettings.length, 1);
    assert.equal(
      Number(membership?.membershipCommissionSettings[0]?.agentPercent ?? 0),
      60,
    );
    assert.equal(
      membership?.membershipCommissionSettings[0]?.effectiveFrom
        ?.toISOString()
        .slice(0, 10),
      "2026-04-22",
    );
  } finally {
    await context.cleanup();
  }
});

test("executeSupplementalImport reports missing and ambiguous matches as skipped rows", async () => {
  const context = await createSupplementalImportTestContext();

  try {
    const importedUserA = await context.createImportedUser({
      email: `taylor.a.${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Taylor A",
      lastName: "Agent",
    });
    const importedUserB = await context.createImportedUser({
      email: `taylor.b.${randomUUID().slice(0, 8)}@example.com`,
      firstName: "Taylor B",
      lastName: "Agent",
    });

    const result = await executeSupplementalImport(
      context.runtimeContext,
      [importedUserA, importedUserB],
      false,
      "https://docs.google.com/spreadsheets/d/test/edit#gid=0",
      {
        loadSupplementalWorkbookData: async () =>
          buildWorkbookData([
            {
              sheetName: "Acre NY",
              officeSlug: "acre-ny-realty",
              sourceRowNumber: 2,
              userName: "Taylor Agent",
              licenseStateRaw: "Acre NY",
              splitRaw: "50%",
              expirationRaw: "",
            },
            {
              sheetName: "Acre NY",
              officeSlug: "acre-ny-realty",
              sourceRowNumber: 3,
              userName: "Missing Person",
              licenseStateRaw: "Acre NY",
              splitRaw: "30%",
              expirationRaw: "",
            },
          ]),
      },
    );

    assert.equal(result.imported, 0);
    assert.equal(result.skipped.length, 2);
    assert.match(result.skipped[0]?.reason ?? "", /matched multiple imported users/);
    assert.match(result.skipped[1]?.reason ?? "", /No imported user matched/);
  } finally {
    await context.cleanup();
  }
});
