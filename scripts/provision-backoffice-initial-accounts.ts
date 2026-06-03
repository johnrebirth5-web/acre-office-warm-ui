import { Prisma, type MembershipStatus, type UserRole } from "@prisma/client";
import { addAgentToTeam, issueInvitationForMembership, prisma } from "@acre/db";

type AccountSpec = {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  title?: string;
  preserveActive?: boolean;
};

type TeamSpec = {
  name: string;
  parentTeamName?: string;
  memberships: Array<{
    email: string;
    role: "team_leader" | "junior_team_leader" | "member";
    reportsToEmail?: string;
  }>;
};

const invitationBaseUrl = process.env.ACRE_BASE_URL ?? "http://localhost:3105";
const bootstrapEmail = "office@example-brokerage.test";

const accountSpecs: AccountSpec[] = [
  {
    email: "office@example-brokerage.test",
    firstName: "Alex",
    lastName: "Admin",
    role: "office_admin",
    title: "Office Admin",
    preserveActive: true
  },
  {
    email: "cathy@example-brokerage.test",
    firstName: "Jordan",
    lastName: "Owner",
    role: "owner",
    title: "Owner"
  },
  {
    email: "pay@example-brokerage.test",
    firstName: "Taylor",
    lastName: "Accountant",
    role: "accountant",
    title: "Accountant"
  },
  {
    email: "hr@example-brokerage.test",
    firstName: "Morgan",
    lastName: "HR",
    role: "human_resources",
    title: "Human Resources"
  },
  {
    email: "yue.yu@example-brokerage.test",
    firstName: "Yue",
    lastName: "Yu",
    role: "team_lead",
    title: "Yue Team / Team Leader"
  },
  {
    email: "yun@example-brokerage.test",
    firstName: "Yunhao",
    lastName: "Teng",
    role: "agent",
    title: "Yue Team / Member"
  },
  {
    email: "linfen@example-brokerage.test",
    firstName: "Linfen",
    lastName: "Ruan",
    role: "team_lead",
    title: "Candy Team / Team Leader"
  },
  {
    email: "dcai@example-brokerage.test",
    firstName: "Ding",
    lastName: "Cai",
    role: "team_lead",
    title: "Candy Team / Junior Team Leader (Ding Team)"
  },
  {
    email: "elaine@example-brokerage.test",
    firstName: "Shuyu",
    lastName: "Fang",
    role: "agent",
    title: "Candy Team / Junior Team Leader (Ding Team) / Member"
  },
  {
    email: "jessie@example-brokerage.test",
    firstName: "Yu",
    lastName: "Pan",
    role: "agent",
    title: "Independent"
  }
];

const teamSpecs: TeamSpec[] = [
  {
    name: "Yue Team",
    memberships: [
      { email: "yue.yu@example-brokerage.test", role: "team_leader" },
      { email: "yun@example-brokerage.test", role: "member", reportsToEmail: "yue.yu@example-brokerage.test" }
    ]
  },
  {
    name: "Candy Team",
    memberships: [
      { email: "linfen@example-brokerage.test", role: "team_leader" }
    ]
  },
  {
    name: "Ding Team",
    parentTeamName: "Candy Team",
    memberships: [
      { email: "dcai@example-brokerage.test", role: "junior_team_leader" },
      { email: "elaine@example-brokerage.test", role: "member", reportsToEmail: "dcai@example-brokerage.test" }
    ]
  }
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildInvitationUrl(invitationPath: string) {
  return new URL(invitationPath, invitationBaseUrl).toString();
}

async function ensureBootstrapContext() {
  const membership = await prisma.membership.findFirst({
    where: {
      user: {
        email: bootstrapEmail
      }
    },
    include: {
      user: true,
      organization: true,
      office: true
    }
  });

  if (!membership) {
    throw new Error(`Bootstrap account ${bootstrapEmail} was not found. Create it before running this script.`);
  }

  return membership;
}

async function ensureAccount(
  spec: AccountSpec,
  context: {
    organizationId: string;
    officeId: string | null;
    actorMembershipId: string;
  }
) {
  const normalizedEmail = spec.email.trim().toLowerCase();
  const user =
    (await prisma.user.findUnique({
      where: {
        email: normalizedEmail
      }
    })) ??
    (await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: spec.firstName,
        lastName: spec.lastName,
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true
      }
    }));

  if (user.firstName !== spec.firstName || user.lastName !== spec.lastName || !user.isActive) {
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        isActive: true
      }
    });
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: context.organizationId,
        userId: user.id
      }
    }
  });

  const membership =
    existingMembership ??
    (await prisma.membership.create({
      data: {
        organizationId: context.organizationId,
        officeId: context.officeId,
        userId: user.id,
        role: spec.role,
        status: spec.preserveActive ? "active" : "invited",
        title: spec.title?.trim() ? spec.title.trim() : null,
        permissions: Prisma.JsonNull
      }
    }));

  const nextStatus: MembershipStatus =
    spec.preserveActive || membership.status === "active" || membership.status === "disabled" ? "active" : "invited";

  if (
    membership.role !== spec.role ||
    (membership.officeId ?? null) !== context.officeId ||
    membership.status !== nextStatus ||
    (membership.title ?? null) !== (spec.title?.trim() ? spec.title.trim() : null)
  ) {
    await prisma.membership.update({
      where: {
        id: membership.id
      },
      data: {
        officeId: context.officeId,
        role: spec.role,
        status: nextStatus,
        title: spec.title?.trim() ? spec.title.trim() : null,
        permissions: Prisma.JsonNull
      }
    });
  }

  const invitation = await issueInvitationForMembership({
    organizationId: context.organizationId,
    actorMembershipId: context.actorMembershipId,
    membershipId: membership.id
  });

  return {
    membershipId: membership.id,
    email: normalizedEmail,
    role: spec.role,
    title: spec.title ?? "",
    invitationUrl: buildInvitationUrl(invitation.invitationPath),
    expiresAt: invitation.expiresAt.toISOString()
  };
}

async function ensureTeam(name: string, organizationId: string, officeId: string | null, parentTeamId: string | null) {
  const existing = await prisma.team.findFirst({
    where: {
      organizationId,
      slug: slugify(name)
    }
  });

  if (existing) {
    if (
      existing.name !== name ||
      existing.isActive === false ||
      (existing.officeId ?? null) !== officeId ||
      (existing.parentTeamId ?? null) !== parentTeamId
    ) {
      return prisma.team.update({
        where: {
          id: existing.id
        },
        data: {
          name,
          officeId,
          parentTeamId,
          isActive: true
        }
      });
    }

    return existing;
  }

  return prisma.team.create({
    data: {
      organizationId,
      officeId,
      name,
      slug: slugify(name),
      parentTeamId,
      isActive: true
    }
  });
}

async function main() {
  const bootstrap = await ensureBootstrapContext();
  const context = {
    organizationId: bootstrap.organizationId,
    officeId: bootstrap.officeId ?? null,
    actorMembershipId: bootstrap.id
  };

  const ensuredAccounts = new Map<string, Awaited<ReturnType<typeof ensureAccount>>>();
  const ensuredTeams = new Map<string, Awaited<ReturnType<typeof ensureTeam>>>();

  for (const spec of accountSpecs) {
    const account = await ensureAccount(spec, context);
    ensuredAccounts.set(account.email, account);
  }

  for (const teamSpec of teamSpecs) {
    const parentTeamId =
      teamSpec.parentTeamName
        ? (ensuredTeams.get(teamSpec.parentTeamName)?.id ?? null)
        : null;

    if (teamSpec.parentTeamName && !parentTeamId) {
      throw new Error(`Missing parent team ${teamSpec.parentTeamName} for ${teamSpec.name}.`);
    }

    const team = await ensureTeam(teamSpec.name, context.organizationId, context.officeId, parentTeamId);
    ensuredTeams.set(teamSpec.name, team);
    const teamMembershipsByEmail = new Map<string, string>();

    const sortedAssignments = [
      ...teamSpec.memberships.filter((membership) => membership.role === "team_leader"),
      ...teamSpec.memberships.filter((membership) => membership.role === "junior_team_leader"),
      ...teamSpec.memberships.filter((membership) => membership.role === "member")
    ];

    for (const assignment of sortedAssignments) {
      const membershipRecord = ensuredAccounts.get(assignment.email);

      if (!membershipRecord) {
        throw new Error(`Missing ensured account for ${assignment.email}.`);
      }

      const teamMembership = await addAgentToTeam({
        organizationId: context.organizationId,
        officeId: context.officeId,
        actorMembershipId: context.actorMembershipId,
        teamId: team.id,
        membershipId: membershipRecord.membershipId,
        role: assignment.role,
        reportsToTeamMembershipId: assignment.reportsToEmail ? teamMembershipsByEmail.get(assignment.reportsToEmail) ?? null : null
      });

      teamMembershipsByEmail.set(assignment.email, teamMembership.id);
    }
  }

  const output = accountSpecs.map((spec) => {
    const ensured = ensuredAccounts.get(spec.email);

    if (!ensured) {
      throw new Error(`Provisioning result missing for ${spec.email}.`);
    }

    return {
      email: ensured.email,
      role: ensured.role,
      title: ensured.title,
      invitationUrl: ensured.invitationUrl,
      expiresAt: ensured.expiresAt
    };
  });

  console.table(output);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Provisioning failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
