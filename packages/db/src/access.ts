import type { PermissionKey } from "@acre/auth";
import { Prisma, type PrismaClient, type TeamMembershipRole, type UserRole } from "@prisma/client";
import { prisma } from "./client";
import { getMembershipEffectivePermissionKeys } from "./permissions";

export type OfficeScopeResource = "transactions" | "reports" | "contacts" | "agents";

type TeamMembershipNode = {
  id: string;
  teamId: string;
  membershipId: string;
  role: TeamMembershipRole;
  reportsToTeamMembershipId: string | null;
};

export type OfficeDataScope = {
  viewerMembershipId: string;
  viewerRole: UserRole;
  viewerPermissions: PermissionKey[];
  officeId: string | null;
  kind: "organization" | "team" | "self";
  visibleMembershipIds: string[] | null;
  visibleTeamIds: string[] | null;
  visibleTeamMembershipIds: string[] | null;
};

const scopePermissionMap: Record<
  OfficeScopeResource,
  {
    base: PermissionKey;
    team: PermissionKey | null;
    company: PermissionKey | null;
  }
> = {
  transactions: {
    base: "transactions:view",
    team: "transactions:view:team",
    company: "transactions:view:company"
  },
  reports: {
    base: "reports:view:personal",
    team: "reports:view:team",
    company: "reports:view:company"
  },
  contacts: {
    base: "contacts:view",
    team: "contacts:view:team",
    company: "contacts:view:company"
  },
  agents: {
    base: "agents:view",
    team: "agents:view:team",
    company: "agents:view:company"
  }
};

const crossMemberFinancialPermissions = new Set<PermissionKey>([
  "reports:view:company",
  "accounting:view",
  "accounting:billing:view",
  "commissions:view:company",
  "transactions:finance"
]);

function buildScopedOfficeOrNullFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

function collectVisibleHierarchyMembershipIds(
  allTeamMemberships: TeamMembershipNode[],
  viewerTeamMemberships: Array<Pick<TeamMembershipNode, "id" | "role">>
) {
  const visibleTeamMembershipIds = new Set<string>();
  const childrenByParent = new Map<string, TeamMembershipNode[]>();
  const nodeById = new Map(allTeamMemberships.map((teamMembership) => [teamMembership.id, teamMembership]));

  for (const teamMembership of allTeamMemberships) {
    const parentId = teamMembership.reportsToTeamMembershipId;

    if (!parentId) {
      continue;
    }

    const current = childrenByParent.get(parentId) ?? [];
    current.push(teamMembership);
    childrenByParent.set(parentId, current);
  }

  const stack = viewerTeamMemberships
    .filter((teamMembership) => teamMembership.role === "leader_i" || teamMembership.role === "leader_ii")
    .map((teamMembership) => teamMembership.id);

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (!currentId || visibleTeamMembershipIds.has(currentId)) {
      continue;
    }

    const currentNode = nodeById.get(currentId);
    if (!currentNode) {
      continue;
    }

    visibleTeamMembershipIds.add(currentId);

    for (const child of childrenByParent.get(currentId) ?? []) {
      stack.push(child.id);
    }
  }

  const visibleMembershipIds = new Set(
    [...visibleTeamMembershipIds]
      .map((teamMembershipId) => nodeById.get(teamMembershipId)?.membershipId ?? null)
      .filter((membershipId): membershipId is string => Boolean(membershipId))
  );

  return {
    visibleMembershipIds: [...visibleMembershipIds],
    visibleTeamMembershipIds: [...visibleTeamMembershipIds]
  };
}

export async function resolveOfficeDataScope(
  input: {
    organizationId: string;
    viewerMembershipId: string;
    officeId?: string | null;
    resource?: OfficeScopeResource;
  },
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<OfficeDataScope> {
  const membership = await db.membership.findFirst({
    where: {
      id: input.viewerMembershipId,
      organizationId: input.organizationId
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!membership) {
    throw new Error("Viewer membership was not found.");
  }

  const scopedOfficeId = input.officeId ?? null;
  const resource = input.resource ?? "transactions";
  const permissions = await getMembershipEffectivePermissionKeys(
    {
      organizationId: input.organizationId,
      membershipId: membership.id
    },
    db
  );
  const scopePermissions = scopePermissionMap[resource];

  if (scopePermissions.company && permissions.includes(scopePermissions.company)) {
    return {
      viewerMembershipId: membership.id,
      viewerRole: membership.role,
      viewerPermissions: permissions,
      officeId: scopedOfficeId,
      kind: "organization",
      visibleMembershipIds: null,
      visibleTeamIds: null,
      visibleTeamMembershipIds: null
    };
  }

  const viewerTeamMemberships = await db.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: membership.id,
      team: {
        isActive: true,
        ...(buildScopedOfficeOrNullFilter(scopedOfficeId) ?? {})
      }
    },
    select: {
      id: true,
      teamId: true,
      role: true
    }
  });

  const viewerTeamIds = [...new Set(viewerTeamMemberships.map((teamMembership) => teamMembership.teamId))];

  if (scopePermissions.team && permissions.includes(scopePermissions.team) && viewerTeamIds.length > 0) {
    const teamMemberships = await db.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        teamId: {
          in: viewerTeamIds
        },
        team: {
          isActive: true,
          ...(buildScopedOfficeOrNullFilter(scopedOfficeId) ?? {})
        }
      },
      select: {
        id: true,
        teamId: true,
        membershipId: true,
        role: true,
        reportsToTeamMembershipId: true
      }
    });

    const hierarchy = collectVisibleHierarchyMembershipIds(teamMemberships, viewerTeamMemberships);
    const visibleMembershipIds = [...new Set([membership.id, ...hierarchy.visibleMembershipIds])];

    return {
      viewerMembershipId: membership.id,
      viewerRole: membership.role,
      viewerPermissions: permissions,
      officeId: scopedOfficeId,
      kind: "team",
      visibleMembershipIds,
      visibleTeamIds: viewerTeamIds,
      visibleTeamMembershipIds: hierarchy.visibleTeamMembershipIds
    };
  }

  return {
    viewerMembershipId: membership.id,
    viewerRole: membership.role,
    viewerPermissions: permissions,
    officeId: scopedOfficeId,
    kind: "self",
    visibleMembershipIds: [membership.id],
    visibleTeamIds: viewerTeamIds,
    visibleTeamMembershipIds: viewerTeamMemberships.map((teamMembership) => teamMembership.id)
  };
}

export function buildMembershipVisibilityWhere(scope: OfficeDataScope): Prisma.MembershipWhereInput {
  if (scope.visibleMembershipIds === null) {
    return {};
  }

  return {
    id: {
      in: scope.visibleMembershipIds
    }
  };
}

export function buildTransactionVisibilityWhere(scope: OfficeDataScope): Prisma.TransactionWhereInput {
  if (scope.visibleMembershipIds === null) {
    return {};
  }

  const visibleMembershipIds = scope.visibleMembershipIds.length > 0 ? scope.visibleMembershipIds : [scope.viewerMembershipId];

  return {
    OR: [
      {
        ownerMembershipId: {
          in: visibleMembershipIds
        }
      },
      {
        membershipLinks: {
          some: {
            membershipId: {
              in: visibleMembershipIds
            }
          }
        }
      }
    ]
  };
}

export function buildTransactionMembershipLinkVisibilityWhere(scope: OfficeDataScope): Prisma.TransactionMembershipLinkWhereInput {
  if (scope.visibleMembershipIds === null) {
    return {};
  }

  return {
    membershipId: {
      in: scope.visibleMembershipIds.length > 0 ? scope.visibleMembershipIds : [scope.viewerMembershipId]
    }
  };
}

export function getVisibleMembershipIds(scope: OfficeDataScope) {
  return scope.visibleMembershipIds ?? [];
}

export function canAccessMembership(scope: OfficeDataScope, membershipId: string) {
  return scope.visibleMembershipIds === null || scope.visibleMembershipIds.includes(membershipId);
}

export function canViewCrossMemberFinancials(scope: OfficeDataScope) {
  return scope.viewerPermissions.some((permission) => crossMemberFinancialPermissions.has(permission));
}

export function canViewFinancialsForMembership(scope: OfficeDataScope, membershipId: string | null | undefined) {
  if (!membershipId) {
    return canViewCrossMemberFinancials(scope);
  }

  return canViewCrossMemberFinancials(scope) || membershipId === scope.viewerMembershipId;
}

export function redactCurrency(value: string, allowed: boolean) {
  return allowed ? value : "Restricted";
}
