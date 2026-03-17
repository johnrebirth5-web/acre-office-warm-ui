import {
  getPermissionTree,
  getRoleSummary,
  getSystemRoleTemplatePermissions,
  resolveEffectivePermissions,
  type PermissionKey,
  type PermissionTreeNode,
  type UserRole
} from "@acre/auth";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";

type PermissionDbClient = Pick<typeof prisma, "organizationRoleTemplate" | "membershipPermissionOverride" | "membership">;

const fixedRoleCatalog: UserRole[] = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_manager",
  "office_user"
];

export type PermissionOverrideValue = "allow" | "deny";

export type PermissionTreeStateNode = {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  parentKey: PermissionKey | null;
  children: PermissionTreeStateNode[];
  inheritedEnabled: boolean;
  overrideEffect: PermissionOverrideValue | null;
  effectiveEnabled: boolean;
  editable: boolean;
};

export type MembershipPermissionOverrideRecord = {
  permissionKey: PermissionKey;
  effect: PermissionOverrideValue;
};

export type OrganizationRoleTemplateSnapshot = {
  role: UserRole;
  label: string;
  description: string;
  memberCount: number;
  permissions: PermissionKey[];
  tree: PermissionTreeStateNode[];
};

export type OrganizationRoleTemplatesSnapshot = {
  roles: OrganizationRoleTemplateSnapshot[];
};

export type MembershipEffectivePermissionsSnapshot = {
  membershipId: string;
  role: UserRole;
  roleLabel: string;
  roleDescription: string;
  inheritedPermissions: PermissionKey[];
  overrides: MembershipPermissionOverrideRecord[];
  effectivePermissions: PermissionKey[];
  tree: PermissionTreeStateNode[];
};

export type SaveOrganizationRoleTemplatePermissionsInput = {
  organizationId: string;
  actorMembershipId: string;
  role: UserRole;
  permissions: string[];
};

export type SaveMembershipPermissionOverridesInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
  overrides: Array<{
    permissionKey: string;
    effect: PermissionOverrideValue;
  }>;
};

export type ResetMembershipPermissionOverridesInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
};

function flattenPermissionTree(nodes: PermissionTreeNode[]): PermissionKey[] {
  return nodes.flatMap((node) => [node.key, ...flattenPermissionTree(node.children)]);
}

const permissionCatalogKeys = new Set<PermissionKey>(flattenPermissionTree(getPermissionTree()));

function assertPermissionKey(value: string): PermissionKey {
  if (!permissionCatalogKeys.has(value as PermissionKey)) {
    throw new Error(`Unknown permission key: ${value}`);
  }

  return value as PermissionKey;
}

function sanitizePermissionKeys(values: string[]) {
  return [...new Set(values.map((value) => assertPermissionKey(value.trim())).filter(Boolean))];
}

function normalizeOverrideEffect(value: string): PermissionOverrideValue {
  if (value !== "allow" && value !== "deny") {
    throw new Error(`Unknown permission override effect: ${value}`);
  }

  return value;
}

function buildEffectivePermissionTree(
  nodes: PermissionTreeNode[],
  inheritedPermissions: Set<PermissionKey>,
  overrides: Map<PermissionKey, PermissionOverrideValue>,
  effectivePermissions: Set<PermissionKey>
): PermissionTreeStateNode[] {
  return nodes.map((node) => ({
    key: node.key,
    label: node.label,
    description: node.description,
    group: node.group,
    parentKey: node.parentKey ?? null,
    children: buildEffectivePermissionTree(node.children, inheritedPermissions, overrides, effectivePermissions),
    inheritedEnabled: inheritedPermissions.has(node.key),
    overrideEffect: overrides.get(node.key) ?? null,
    effectiveEnabled: effectivePermissions.has(node.key),
    editable: true
  }));
}

function buildPermissionDeltaChanges(previousPermissions: PermissionKey[], nextPermissions: PermissionKey[], label: string): ActivityLogChange[] {
  const previousValue = previousPermissions.join(", ") || "None";
  const nextValue = nextPermissions.join(", ") || "None";

  if (previousValue === nextValue) {
    return [];
  }

  return [
    {
      label,
      previousValue,
      nextValue
    }
  ];
}

function buildOverrideDeltaChanges(
  previousOverrides: MembershipPermissionOverrideRecord[],
  nextOverrides: MembershipPermissionOverrideRecord[]
): ActivityLogChange[] {
  const previousValue = previousOverrides.map((entry) => `${entry.permissionKey} (${entry.effect})`).join(", ") || "None";
  const nextValue = nextOverrides.map((entry) => `${entry.permissionKey} (${entry.effect})`).join(", ") || "None";

  if (previousValue === nextValue) {
    return [];
  }

  return [
    {
      label: "Permission overrides",
      previousValue,
      nextValue
    }
  ];
}

async function createMissingRoleTemplates(
  organizationId: string,
  db: PermissionDbClient,
  updatedByMembershipId?: string | null
) {
  const existingTemplates = await db.organizationRoleTemplate.findMany({
    where: {
      organizationId
    },
    select: {
      role: true
    }
  });

  const existingRoles = new Set<UserRole>(existingTemplates.map((template: { role: UserRole }) => template.role));
  const missingRoles = fixedRoleCatalog.filter((role) => !existingRoles.has(role));

  if (missingRoles.length === 0) {
    return;
  }

  for (const role of missingRoles) {
    const summary = getRoleSummary(role);
    const permissions = getSystemRoleTemplatePermissions(role);

    await db.organizationRoleTemplate.create({
      data: {
        organizationId,
        role,
        label: summary.label,
        description: summary.description,
        updatedByMembershipId: updatedByMembershipId ?? null,
        permissions: permissions.length
          ? {
              createMany: {
                data: permissions.map((permissionKey) => ({
                  organizationId,
                  permissionKey
                }))
              }
            }
          : undefined
      }
    });
  }
}

async function getRoleTemplatesWithPermissions(organizationId: string, db: PermissionDbClient) {
  await createMissingRoleTemplates(organizationId, db);

  return db.organizationRoleTemplate.findMany({
    where: {
      organizationId
    },
    include: {
      permissions: {
        orderBy: [{ permissionKey: "asc" }]
      }
    }
  });
}

function getTemplatePermissionsOrFallback(templatePermissions: string[], role: UserRole) {
  const normalized = templatePermissions.length > 0 ? sanitizePermissionKeys(templatePermissions) : getSystemRoleTemplatePermissions(role);
  return resolveEffectivePermissions({
    role,
    permissions: normalized
  });
}

function applyOverrides(
  role: UserRole,
  inheritedPermissions: PermissionKey[],
  overrides: MembershipPermissionOverrideRecord[]
) {
  const nextPermissions = new Set(inheritedPermissions);

  for (const override of overrides) {
    if (override.effect === "allow") {
      nextPermissions.add(override.permissionKey);
      continue;
    }

    nextPermissions.delete(override.permissionKey);
  }

  return resolveEffectivePermissions({
    role,
    permissions: [...nextPermissions]
  });
}

export async function ensureOrganizationRoleTemplates(
  organizationId: string,
  db: PermissionDbClient = prisma,
  updatedByMembershipId?: string | null
) {
  await createMissingRoleTemplates(organizationId, db, updatedByMembershipId);
}

export async function getMembershipEffectivePermissionKeys(
  input: {
    organizationId: string;
    membershipId: string;
  },
  db: PermissionDbClient = prisma
): Promise<PermissionKey[]> {
  const [membership, templates, overrides] = await Promise.all([
    db.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        role: true
      }
    }),
    getRoleTemplatesWithPermissions(input.organizationId, db),
    db.membershipPermissionOverride.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      orderBy: [{ permissionKey: "asc" }]
    })
  ]);

  if (!membership) {
    throw new Error("Membership was not found.");
  }

  const template = templates.find((entry: { role: UserRole }) => entry.role === membership.role) ?? null;
  const inheritedPermissions = getTemplatePermissionsOrFallback(
    template?.permissions.map((permission: { permissionKey: string }) => permission.permissionKey) ?? [],
    membership.role
  );
  const normalizedOverrides = overrides.map((override: { permissionKey: string; effect: PermissionOverrideValue }) => ({
    permissionKey: assertPermissionKey(override.permissionKey),
    effect: override.effect
  })) satisfies MembershipPermissionOverrideRecord[];

  return applyOverrides(membership.role, inheritedPermissions, normalizedOverrides);
}

export async function getMembershipEffectivePermissions(
  input: {
    organizationId: string;
    membershipId: string;
  },
  db: PermissionDbClient = prisma
): Promise<MembershipEffectivePermissionsSnapshot> {
  const [membership, templates, overrides] = await Promise.all([
    db.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        role: true
      }
    }),
    getRoleTemplatesWithPermissions(input.organizationId, db),
    db.membershipPermissionOverride.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      orderBy: [{ permissionKey: "asc" }]
    })
  ]);

  if (!membership) {
    throw new Error("Membership was not found.");
  }

  const template = templates.find((entry: { role: UserRole }) => entry.role === membership.role) ?? null;
  const inheritedPermissions = getTemplatePermissionsOrFallback(
    template?.permissions.map((permission: { permissionKey: string }) => permission.permissionKey) ?? [],
    membership.role
  );
  const normalizedOverrides = overrides.map((override: { permissionKey: string; effect: PermissionOverrideValue }) => ({
    permissionKey: assertPermissionKey(override.permissionKey),
    effect: override.effect
  })) satisfies MembershipPermissionOverrideRecord[];
  const effectivePermissions = applyOverrides(membership.role, inheritedPermissions, normalizedOverrides);
  const inheritedSet = new Set(inheritedPermissions);
  const overrideMap = new Map<PermissionKey, PermissionOverrideValue>(
    normalizedOverrides.map((override) => [override.permissionKey, override.effect])
  );
  const effectiveSet = new Set(effectivePermissions);
  const roleSummary = getRoleSummary(membership.role);

  return {
    membershipId: membership.id,
    role: membership.role,
    roleLabel: roleSummary.label,
    roleDescription: roleSummary.description,
    inheritedPermissions,
    overrides: normalizedOverrides,
    effectivePermissions,
    tree: buildEffectivePermissionTree(getPermissionTree(), inheritedSet, overrideMap, effectiveSet)
  };
}

export async function getOrganizationRoleTemplatesSnapshot(
  organizationId: string,
  db: PermissionDbClient = prisma
): Promise<OrganizationRoleTemplatesSnapshot> {
  const [templates, membershipCounts] = await Promise.all([
    getRoleTemplatesWithPermissions(organizationId, db),
    db.membership.groupBy({
      by: ["role"],
      where: {
        organizationId
      },
      _count: {
        _all: true
      }
    })
  ]);

  const membershipCountMap = new Map<UserRole, number>(
    membershipCounts.map((entry: { role: UserRole; _count: { _all: number } }) => [entry.role, entry._count._all])
  );

  return {
    roles: fixedRoleCatalog.map((role) => {
      const template = templates.find((entry: { role: UserRole }) => entry.role === role) ?? null;
      const summary = getRoleSummary(role);
      const permissions = getTemplatePermissionsOrFallback(
        template?.permissions.map((permission: { permissionKey: string }) => permission.permissionKey) ?? [],
        role
      );
      const permissionSet = new Set(permissions);

      return {
        role,
        label: template?.label ?? summary.label,
        description: template?.description ?? summary.description,
        memberCount: membershipCountMap.get(role) ?? 0,
        permissions,
        tree: buildEffectivePermissionTree(getPermissionTree(), permissionSet, new Map<PermissionKey, PermissionOverrideValue>(), permissionSet)
      };
    })
  };
}

export async function saveOrganizationRoleTemplatePermissions(input: SaveOrganizationRoleTemplatePermissionsInput) {
  const permissions = sanitizePermissionKeys(input.permissions);

  return prisma.$transaction(async (tx) => {
    await createMissingRoleTemplates(input.organizationId, tx, input.actorMembershipId);

    const template = await tx.organizationRoleTemplate.findFirst({
      where: {
        organizationId: input.organizationId,
        role: input.role
      },
      include: {
        permissions: {
          orderBy: [{ permissionKey: "asc" }]
        }
      }
    });

    if (!template) {
      throw new Error("Role template was not found.");
    }

    const summary = getRoleSummary(input.role);
    const previousPermissions = getTemplatePermissionsOrFallback(
      template.permissions.map((permission: { permissionKey: string }) => permission.permissionKey),
      input.role
    );
    const nextPermissions = resolveEffectivePermissions({
      role: input.role,
      permissions
    });

    await tx.organizationRoleTemplate.update({
      where: {
        id: template.id
      },
      data: {
        label: summary.label,
        description: summary.description,
        updatedByMembershipId: input.actorMembershipId,
        permissions: {
          deleteMany: {},
          createMany: {
            data: permissions.map((permissionKey) => ({
              organizationId: input.organizationId,
              permissionKey
            }))
          }
        }
      }
    });

    const changes = buildPermissionDeltaChanges(previousPermissions, nextPermissions, "Role template permissions");

    if (changes.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "organization_role_template",
        entityId: template.id,
        action: activityLogActions.settingsRoleTemplateUpdated,
        payload: {
          objectLabel: summary.label,
          contextHref: "/office/settings/roles",
          details: [`Role template updated for ${summary.label}`],
          changes
        }
      });
    }

    return getOrganizationRoleTemplatesSnapshot(input.organizationId, tx);
  });
}

export async function saveMembershipPermissionOverrides(input: SaveMembershipPermissionOverridesInput) {
  const normalizedOverrideMap = new Map<PermissionKey, PermissionOverrideValue>(
    input.overrides.map((override) => [assertPermissionKey(override.permissionKey), normalizeOverrideEffect(override.effect)])
  );
  const normalizedOverrides = [...normalizedOverrideMap.entries()].map(([permissionKey, effect]) => ({
    permissionKey,
    effect
  })) satisfies MembershipPermissionOverrideRecord[];

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!membership) {
      throw new Error("Membership was not found.");
    }

    const previousOverrides = await tx.membershipPermissionOverride.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      orderBy: [{ permissionKey: "asc" }]
    });

    const previousNormalizedOverrides = previousOverrides.map((override: { permissionKey: string; effect: PermissionOverrideValue }) => ({
      permissionKey: assertPermissionKey(override.permissionKey),
      effect: override.effect
    })) satisfies MembershipPermissionOverrideRecord[];

    const incomingPermissionKeys = new Set<PermissionKey>(normalizedOverrides.map((override) => override.permissionKey));

    await tx.membershipPermissionOverride.deleteMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        ...(incomingPermissionKeys.size > 0
          ? {
              permissionKey: {
                notIn: [...incomingPermissionKeys]
              }
            }
          : {})
      }
    });

    for (const override of normalizedOverrides) {
      await tx.membershipPermissionOverride.upsert({
        where: {
          membershipId_permissionKey: {
            membershipId: input.membershipId,
            permissionKey: override.permissionKey
          }
        },
        create: {
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          permissionKey: override.permissionKey,
          effect: override.effect,
          createdByMembershipId: input.actorMembershipId
        },
        update: {
          effect: override.effect,
          createdByMembershipId: input.actorMembershipId
        }
      });
    }

    const changes = buildOverrideDeltaChanges(previousNormalizedOverrides, normalizedOverrides);

    if (changes.length > 0) {
      const userLabel = `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership_permission_override",
        entityId: membership.id,
        action: activityLogActions.settingsUserPermissionsChanged,
        payload: {
          objectLabel: userLabel,
          contextHref: `/office/settings/users/${membership.id}`,
          details: ["User permission overrides updated"],
          changes
        }
      });
    }

    return getMembershipEffectivePermissions(
      {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      tx
    );
  });
}

export async function resetMembershipPermissionOverrides(input: ResetMembershipPermissionOverridesInput) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!membership) {
      throw new Error("Membership was not found.");
    }

    const deleted = await tx.membershipPermissionOverride.deleteMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      }
    });

    if (deleted.count > 0) {
      const userLabel = `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership_permission_override",
        entityId: membership.id,
        action: activityLogActions.settingsUserPermissionsReset,
        payload: {
          objectLabel: userLabel,
          contextHref: `/office/settings/users/${membership.id}`,
          details: ["User permission overrides reset to role defaults"]
        }
      });
    }

    return getMembershipEffectivePermissions(
      {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      },
      tx
    );
  });
}
