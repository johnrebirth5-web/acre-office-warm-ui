import { compare, hash } from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PermissionKey, UserRole } from "@acre/auth";
import { Prisma, type PrismaClient } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { assignMembershipToTeamTx, materializeImplicitJuniorTeamsForManagementAction } from "./agents";
import { prisma } from "./client";
import { saveMembershipCommissionSetting } from "./commission-defaults";
import { getMembershipEffectivePermissionKeys } from "./permissions";
import { isTeamHierarchyAssignableUserRole } from "./team-hierarchy";

const BOOTSTRAP_ADMIN_EMAIL = "office@acreny.us";
const BOOTSTRAP_ADMIN_PASSWORD_HASH = "$2b$12$9bAUwJ5kE4bpEEPpOEEMZerc0UTtV9lZrh3EEAQcqu2xxHC.62rmO";
const BOOTSTRAP_ORGANIZATION_SLUG = "acre";
const BOOTSTRAP_ADMIN_FIRST_NAME = "Acre";
const BOOTSTRAP_ADMIN_LAST_NAME = "Admin";
const BOOTSTRAP_ADMIN_TITLE = "Bootstrap Administrator";
const PASSWORD_HASH_ROUNDS = 12;
const INVITATION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7;
const ACCOUNT_LOCKOUT_WINDOW_MS = 1000 * 60 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;
const privilegedBackOfficeRoles = new Set<UserRole>(["owner", "office_admin"]);
const inviteEligibleRoleCatalog: UserRole[] = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_user",
  "office_manager"
] as const;

type AuditLogWriter = Prisma.TransactionClient | PrismaClient;

function isPrivilegedBackOfficeRole(role: UserRole) {
  return privilegedBackOfficeRoles.has(role);
}

function canManageSensitiveUserAccess(permissionKeys: PermissionKey[]) {
  return permissionKeys.includes("settings:manage");
}

function canManageUserLifecycle(permissionKeys: PermissionKey[]) {
  return permissionKeys.includes("users:manage") || canManageSensitiveUserAccess(permissionKeys);
}

function assertActorCanManageUsers(permissionKeys: PermissionKey[]) {
  if (!canManageUserLifecycle(permissionKeys)) {
    throw new Error("User management permission is required.");
  }
}

function assertActorCanAssignPrivilegedRole(permissionKeys: PermissionKey[], role: UserRole) {
  if (isPrivilegedBackOfficeRole(role) && !canManageSensitiveUserAccess(permissionKeys)) {
    throw new Error("Only Owner / Office Admin can assign Owner or Office Admin roles.");
  }
}

function assertActorCanManagePrivilegedMembership(permissionKeys: PermissionKey[], role: UserRole) {
  if (isPrivilegedBackOfficeRole(role) && !canManageSensitiveUserAccess(permissionKeys)) {
    throw new Error("Only Owner / Office Admin can manage Owner or Office Admin accounts.");
  }
}

type MembershipSessionRecord = {
  id: string;
  role: UserRole;
  title: string | null;
  status: "active" | "invited" | "disabled";
  organizationId: string;
  officeId: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    timezone: string;
    locale: string;
    isActive: boolean;
    credential: {
      id: string;
      mustChangePassword: boolean;
      failedLoginCount: number;
      lockedUntil: Date | null;
      lastLoginAt: Date | null;
      lastFailedLoginAt: Date | null;
      passwordChangedAt: Date | null;
    } | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  office: {
    id: string;
    name: string;
    slug: string;
    market: string;
  } | null;
};

export type SessionMembershipContext = {
  currentUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    timezone: string;
    locale: string;
  };
  currentCredential: {
    id: string;
    mustChangePassword: boolean;
    failedLoginCount: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    lastFailedLoginAt: Date | null;
    passwordChangedAt: Date | null;
  } | null;
  currentMembership: {
    id: string;
    role: UserRole;
    title: string | null;
    status: "active" | "invited" | "disabled";
    permissions: PermissionKey[];
  };
  currentOrganization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  currentOffice: {
    id: string;
    name: string;
    slug: string;
    market: string;
  } | null;
};

export type PasswordLoginResult =
  | {
      status: "success";
      context: SessionMembershipContext;
    }
  | {
      status: "invalid";
    }
  | {
      status: "locked";
      lockedUntil: Date | null;
    };

export type InvitationLookupStatus = "ready" | "expired" | "revoked" | "accepted" | "not_found";

export type InvitationSnapshot = {
  status: InvitationLookupStatus;
  invitationId: string | null;
  membershipId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole | null;
  organizationName: string;
  officeName: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  requiresActivation: boolean;
};

export type AcceptInvitationResult =
  | {
      status: "success";
      context: SessionMembershipContext;
    }
  | {
      status: Exclude<InvitationLookupStatus, "ready">;
      snapshot: InvitationSnapshot;
    };

export type IssueInvitationResult = {
  invitationId: string;
  invitationPath: string;
  rawToken: string;
  expiresAt: Date;
};

export type InternalAuthBootstrapResult = {
  created: boolean;
  organizationId: string | null;
  membershipId: string | null;
  userId: string | null;
};

export type CreateInvitedUserInput = {
  organizationId: string;
  actorMembershipId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  officeId?: string | null;
  title?: string | null;
  splitTemplateId?: string;
  customAgentPercent?: string;
  commissionEffectiveFrom?: string;
  teamId?: string;
  reportsToTeamMembershipId?: string;
};

export type AcceptInvitationInput = {
  token: string;
  firstName?: string;
  lastName?: string;
  password: string;
};

export type ChangePasswordInput = {
  organizationId: string;
  membershipId: string;
  currentPassword?: string;
  newPassword: string;
};

export type UnlockInternalAccountInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRequiredText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

function assertValidPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

async function hashPasswordValue(password: string) {
  assertValidPassword(password);
  return hash(password, PASSWORD_HASH_ROUNDS);
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createInvitationToken() {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashInvitationToken(rawToken)
  };
}

function buildInvitationPath(rawToken: string) {
  return `/invite/${rawToken}`;
}

function getInvitationExpiry() {
  return new Date(Date.now() + INVITATION_EXPIRY_MS);
}

function mapMembershipContext(membership: MembershipSessionRecord, permissions: PermissionKey[]): SessionMembershipContext {
  return {
    currentUser: {
      id: membership.user.id,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      timezone: membership.user.timezone,
      locale: membership.user.locale
    },
    currentCredential: membership.user.credential
      ? {
          id: membership.user.credential.id,
          mustChangePassword: membership.user.credential.mustChangePassword,
          failedLoginCount: membership.user.credential.failedLoginCount,
          lockedUntil: membership.user.credential.lockedUntil,
          lastLoginAt: membership.user.credential.lastLoginAt,
          lastFailedLoginAt: membership.user.credential.lastFailedLoginAt,
          passwordChangedAt: membership.user.credential.passwordChangedAt
        }
      : null,
    currentMembership: {
      id: membership.id,
      role: membership.role,
      title: membership.title,
      status: membership.status,
      permissions
    },
    currentOrganization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      timezone: membership.organization.timezone
    },
    currentOffice: membership.office
      ? {
          id: membership.office.id,
          name: membership.office.name,
          slug: membership.office.slug,
          market: membership.office.market
        }
      : null
  };
}

async function buildMembershipContext(
  membership: MembershipSessionRecord,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<SessionMembershipContext> {
  const permissions = await getMembershipEffectivePermissionKeys(
    {
      organizationId: membership.organizationId,
      membershipId: membership.id
    },
    db
  );

  return mapMembershipContext(membership, permissions);
}

async function getPrimaryOrganization() {
  const preferred = await prisma.organization.findFirst({
    where: {
      slug: BOOTSTRAP_ORGANIZATION_SLUG
    },
    include: {
      offices: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }]
      }
    }
  });

  if (preferred) {
    return preferred;
  }

  return prisma.organization.findFirst({
    include: {
      offices: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }]
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });
}

async function recordLoginFailedEvent(input: {
  organizationId: string | null;
  membershipId?: string | null;
  email: string;
  reason: "invalid_credentials" | "locked";
  lockedUntil?: Date | null;
}) {
  if (!input.organizationId) {
    return;
  }

  const details =
    input.reason === "locked"
      ? [
          "Result: Account locked",
          ...(input.lockedUntil ? [`Locked until: ${input.lockedUntil.toISOString()}`] : []),
          `Email: ${input.email || "Unknown"}`
        ]
      : ["Result: Invalid credentials", `Email: ${input.email || "Unknown"}`];

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId ?? null,
    entityType: "session",
    entityId: input.membershipId ?? randomUUID(),
    action: activityLogActions.authLoginFailed,
    payload: {
      objectLabel: input.email || "Unknown email",
      details
    }
  });
}

async function getActiveMembershipByEmail(email: string) {
  return prisma.membership.findFirst({
    where: {
      status: "active",
      user: {
        email,
        isActive: true
      }
    },
    include: {
      user: {
        include: {
          credential: true
        }
      },
      organization: true,
      office: true
    },
    orderBy: [{ createdAt: "asc" }]
  });
}

async function getMembershipSessionRecord(membershipId: string): Promise<MembershipSessionRecord | null> {
  const membership = await prisma.membership.findUnique({
    where: {
      id: membershipId
    },
    include: {
      user: {
        include: {
          credential: true
        }
      },
      organization: true,
      office: true
    }
  });

  if (!membership) {
    return null;
  }

  return membership satisfies MembershipSessionRecord;
}

async function createInvitationRecord(tx: Prisma.TransactionClient, input: {
  organizationId: string;
  membershipId: string;
  email: string;
  invitedByMembershipId?: string | null;
}) {
  const { rawToken, tokenHash } = createInvitationToken();
  const expiresAt = getInvitationExpiry();

  const invitation = await tx.invitation.create({
    data: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      email: input.email,
      tokenHash,
      expiresAt,
      invitedByMembershipId: input.invitedByMembershipId ?? null
    }
  });

  return {
    invitation,
    rawToken,
    expiresAt
  };
}

function buildRoleDetail(role: UserRole) {
  return `Role: ${role}`;
}

export function getBootstrapAdminEmail() {
  return BOOTSTRAP_ADMIN_EMAIL;
}

export function getMinimumPasswordLength() {
  return MIN_PASSWORD_LENGTH;
}

export async function ensureBootstrapAdminAccount(): Promise<InternalAuthBootstrapResult> {
  const organization = await getPrimaryOrganization();

  if (!organization) {
    return {
      created: false,
      organizationId: null,
      membershipId: null,
      userId: null
    };
  }

  const office = organization.offices[0] ?? null;

  return prisma.$transaction(async (tx) => {
    let created = false;

    let user = await tx.user.findUnique({
      where: {
        email: BOOTSTRAP_ADMIN_EMAIL
      }
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email: BOOTSTRAP_ADMIN_EMAIL,
          firstName: BOOTSTRAP_ADMIN_FIRST_NAME,
          lastName: BOOTSTRAP_ADMIN_LAST_NAME,
          timezone: organization.timezone,
          locale: "en-US",
          isActive: true
        }
      });
      created = true;
    } else if (!user.isActive) {
      user = await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          isActive: true
        }
      });
      created = true;
    }

    let membership = await tx.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id
        }
      }
    });

    if (!membership) {
      membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          officeId: office?.id ?? null,
          userId: user.id,
          role: "office_admin",
          status: "active",
          title: BOOTSTRAP_ADMIN_TITLE,
          permissions: Prisma.JsonNull
        }
      });
      created = true;
    } else {
      const nextOfficeId = office?.id ?? null;
      const needsMembershipUpdate =
        membership.role !== "office_admin" ||
        membership.status !== "active" ||
        (membership.officeId ?? null) !== nextOfficeId ||
        membership.title !== BOOTSTRAP_ADMIN_TITLE;

      if (needsMembershipUpdate) {
        membership = await tx.membership.update({
          where: {
            id: membership.id
          },
          data: {
            officeId: nextOfficeId,
            role: "office_admin",
            status: "active",
            title: BOOTSTRAP_ADMIN_TITLE,
            permissions: Prisma.JsonNull
          }
        });
        created = true;
      }
    }

    let credential = await tx.userCredential.findUnique({
      where: {
        userId: user.id
      }
    });

    if (!credential) {
      credential = await tx.userCredential.create({
        data: {
          userId: user.id,
          passwordHash: BOOTSTRAP_ADMIN_PASSWORD_HASH,
          mustChangePassword: true,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: null,
          lastFailedLoginAt: null,
          passwordChangedAt: null
        }
      });
      created = true;
    }

    if (created) {
      await recordActivityLogEvent(tx, {
        organizationId: organization.id,
        membershipId: null,
        entityType: "user_credential",
        entityId: credential?.id ?? user.id,
        action: activityLogActions.authBootstrapAdminCreated,
        payload: {
          officeId: office?.id ?? null,
          objectLabel: `${BOOTSTRAP_ADMIN_EMAIL} · Bootstrap admin`,
          contextHref: "/office/settings/users",
          details: [
            "Bootstrap admin ensured",
            buildRoleDetail("office_admin"),
            `Office: ${office?.name ?? organization.name}`
          ]
        }
      });
    }

    return {
      created,
      organizationId: organization.id,
      membershipId: membership.id,
      userId: user.id
    };
  });
}

export async function authenticatePasswordUser(email: string, password: string): Promise<PasswordLoginResult> {
  const normalizedEmail = normalizeEmail(email);
  await ensureBootstrapAdminAccount();

  if (!normalizedEmail || !password) {
    const organization = await getPrimaryOrganization();
    await recordLoginFailedEvent({
      organizationId: organization?.id ?? null,
      email: normalizedEmail,
      reason: "invalid_credentials"
    });
    return { status: "invalid" };
  }

  const membership = await getActiveMembershipByEmail(normalizedEmail);

  if (!membership || !membership.user.credential) {
    await recordLoginFailedEvent({
      organizationId: membership?.organizationId ?? (await getPrimaryOrganization())?.id ?? null,
      membershipId: membership?.id ?? null,
      email: normalizedEmail,
      reason: "invalid_credentials"
    });
    return { status: "invalid" };
  }

  const credential = membership.user.credential;
  const now = new Date();

  if (credential.lockedUntil && credential.lockedUntil > now) {
    await recordLoginFailedEvent({
      organizationId: membership.organizationId,
      membershipId: membership.id,
      email: normalizedEmail,
      reason: "locked",
      lockedUntil: credential.lockedUntil
    });
    return {
      status: "locked",
      lockedUntil: credential.lockedUntil
    };
  }

  const isPasswordValid = await compare(password, credential.passwordHash);

  if (!isPasswordValid) {
    const nextFailedLoginCount = credential.failedLoginCount + 1;
    const nextLockedUntil = nextFailedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(now.getTime() + ACCOUNT_LOCKOUT_WINDOW_MS) : null;

    await prisma.$transaction(async (tx) => {
      await tx.userCredential.update({
        where: {
          id: credential.id
        },
        data: {
          failedLoginCount: nextFailedLoginCount,
          lastFailedLoginAt: now,
          lockedUntil: nextLockedUntil
        }
      });

      await recordActivityLogEvent(tx, {
        organizationId: membership.organizationId,
        membershipId: membership.id,
        entityType: "session",
        entityId: membership.id,
        action: activityLogActions.authLoginFailed,
        payload: {
          officeId: membership.officeId,
          objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
          details: [
            "Result: Invalid credentials",
            `Failed attempts: ${nextFailedLoginCount}`
          ]
        }
      });

      if (nextLockedUntil) {
        await recordActivityLogEvent(tx, {
          organizationId: membership.organizationId,
          membershipId: membership.id,
          entityType: "user_credential",
          entityId: credential.id,
          action: activityLogActions.authAccountLocked,
          payload: {
            officeId: membership.officeId,
            objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
            contextHref: "/office/settings/users",
            details: [`Locked until: ${nextLockedUntil.toISOString()}`]
          }
        });
      }
    });

    if (nextLockedUntil) {
      return {
        status: "locked",
        lockedUntil: nextLockedUntil
      };
    }

    return { status: "invalid" };
  }

  const authenticatedMembership = await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: {
        id: credential.id
      },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: membership.organizationId,
      membershipId: membership.id,
      entityType: "session",
      entityId: membership.id,
      action: activityLogActions.authLogin,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
        details: [buildRoleDetail(membership.role), `Office: ${membership.office?.name ?? membership.organization.name}`]
      }
    });

    return tx.membership.findUnique({
      where: {
        id: membership.id
      },
      include: {
        user: {
          include: {
            credential: true
          }
        },
        organization: true,
        office: true
      }
    });
  });

  if (!authenticatedMembership) {
    return { status: "invalid" };
  }

  return {
    status: "success",
    context: await buildMembershipContext(authenticatedMembership satisfies MembershipSessionRecord)
  };
}

export async function getInvitationSnapshot(token: string): Promise<InvitationSnapshot> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return {
      status: "not_found",
      invitationId: null,
      membershipId: null,
      email: "",
      firstName: "",
      lastName: "",
      role: null,
      organizationName: "",
      officeName: "",
      expiresAt: null,
      acceptedAt: null,
      revokedAt: null,
      requiresActivation: false
    };
  }

  const invitation = await prisma.invitation.findUnique({
    where: {
      tokenHash: hashInvitationToken(normalizedToken)
    },
    include: {
      organization: true,
      membership: {
        include: {
          user: true,
          office: true
        }
      }
    }
  });

  if (!invitation) {
    return {
      status: "not_found",
      invitationId: null,
      membershipId: null,
      email: "",
      firstName: "",
      lastName: "",
      role: null,
      organizationName: "",
      officeName: "",
      expiresAt: null,
      acceptedAt: null,
      revokedAt: null,
      requiresActivation: false
    };
  }

  const status: InvitationLookupStatus =
    invitation.acceptedAt
      ? "accepted"
      : invitation.revokedAt
        ? "revoked"
        : invitation.expiresAt.getTime() <= Date.now()
          ? "expired"
          : "ready";

  return {
    status,
    invitationId: invitation.id,
    membershipId: invitation.membershipId,
    email: invitation.email,
    firstName: invitation.membership.user.firstName,
    lastName: invitation.membership.user.lastName,
    role: invitation.membership.role,
    organizationName: invitation.organization.name,
    officeName: invitation.membership.office?.name ?? invitation.organization.name,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    requiresActivation: invitation.membership.status === "invited"
  };
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
  const snapshot = await getInvitationSnapshot(input.token);

  if (snapshot.status !== "ready" || !snapshot.invitationId || !snapshot.membershipId) {
    return {
      status: snapshot.status === "ready" ? "not_found" : snapshot.status,
      snapshot
    };
  }

  const passwordHash = await hashPasswordValue(input.password);
  const now = new Date();
  const nextFirstName = normalizeRequiredText(input.firstName ?? snapshot.firstName, "First name");
  const nextLastName = normalizeRequiredText(input.lastName ?? snapshot.lastName, "Last name");

  const acceptedMembership = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: {
        id: snapshot.invitationId!
      },
      include: {
        organization: true,
        membership: {
          include: {
            user: {
              include: {
                credential: true
              }
            },
            office: true,
            organization: true
          }
        }
      }
    });

    if (!invitation) {
      return null;
    }

    if (invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (invitation.membership.status === "disabled" || !invitation.membership.user.isActive) {
      return null;
    }

    await tx.user.update({
      where: {
        id: invitation.membership.userId
      },
      data: {
        firstName: nextFirstName,
        lastName: nextLastName,
        isActive: true
      }
    });

    await tx.userCredential.upsert({
      where: {
        userId: invitation.membership.userId
      },
      update: {
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        lastFailedLoginAt: null,
        passwordChangedAt: now
      },
      create: {
        userId: invitation.membership.userId,
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        lastFailedLoginAt: null,
        passwordChangedAt: now
      }
    });

    if (invitation.membership.status === "invited") {
      await tx.membership.update({
        where: {
          id: invitation.membership.id
        },
        data: {
          status: "active"
        }
      });
    }

    await tx.invitation.update({
      where: {
        id: invitation.id
      },
      data: {
        acceptedAt: now
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: invitation.organizationId,
      membershipId: invitation.membership.id,
      entityType: "invitation",
      entityId: invitation.id,
      action: activityLogActions.authInvitationAccepted,
      payload: {
        officeId: invitation.membership.officeId,
        objectLabel: `${nextFirstName} ${nextLastName} · ${invitation.email}`,
        contextHref: "/office/settings/users",
        details: [
          `Office: ${invitation.membership.office?.name ?? invitation.organization.name}`,
          buildRoleDetail(invitation.membership.role)
        ]
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: invitation.organizationId,
      membershipId: invitation.membership.id,
      entityType: "user_credential",
      entityId: invitation.membership.user.credential?.id ?? invitation.membership.userId,
      action: activityLogActions.authPasswordChanged,
      payload: {
        officeId: invitation.membership.officeId,
        objectLabel: `${nextFirstName} ${nextLastName} · ${invitation.email}`,
        details: ["Source: Invitation acceptance"]
      }
    });

    return tx.membership.findUnique({
      where: {
        id: invitation.membership.id
      },
      include: {
        user: {
          include: {
            credential: true
          }
        },
        organization: true,
        office: true
      }
    });
  });

  if (!acceptedMembership) {
    return {
      status: "not_found",
      snapshot: await getInvitationSnapshot(input.token)
    };
  }

  return {
    status: "success",
    context: await buildMembershipContext(acceptedMembership satisfies MembershipSessionRecord)
  };
}

export async function changeInternalPassword(input: ChangePasswordInput) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      user: {
        include: {
          credential: true
        }
      },
      organization: true,
      office: true
    }
  });

  if (!membership || !membership.user.credential) {
    throw new Error("Account credential was not found.");
  }

  if (!membership.user.credential.mustChangePassword) {
    const currentPassword = input.currentPassword ?? "";

    if (!currentPassword) {
      throw new Error("Current password is required.");
    }

    const isCurrentPasswordValid = await compare(currentPassword, membership.user.credential.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect.");
    }
  }

  const passwordHash = await hashPasswordValue(input.newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: {
        id: membership.user.credential!.id
      },
      data: {
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: now
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: membership.organizationId,
      membershipId: membership.id,
      entityType: "user_credential",
      entityId: membership.user.credential!.id,
      action: activityLogActions.authPasswordChanged,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
        contextHref: "/office/account",
        details: [
          membership.user.credential!.mustChangePassword ? "Source: Forced password change" : "Source: Account security"
        ]
      }
    });
  });
}

export async function createInvitedUser(input: CreateInvitedUserInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const firstName = normalizeRequiredText(input.firstName, "First name");
  const lastName = normalizeRequiredText(input.lastName, "Last name");
  const teamId = input.teamId?.trim() ? input.teamId.trim() : null;
  const reportsToTeamMembershipId = input.reportsToTeamMembershipId?.trim() ? input.reportsToTeamMembershipId.trim() : null;

  if (!inviteEligibleRoleCatalog.includes(input.role)) {
    throw new Error("Unsupported role for invited account creation.");
  }

  if (reportsToTeamMembershipId && !teamId) {
    throw new Error("Choose a team before selecting a direct manager.");
  }

  if (teamId && !isTeamHierarchyAssignableUserRole(input.role)) {
    throw new Error("Only Agent / Team Lead accounts can be assigned inside Team / Junior Team hierarchy. Update the account role first.");
  }

  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId
      },
      tx
    );

    assertActorCanManageUsers(actorPermissionKeys);
    assertActorCanAssignPrivilegedRole(actorPermissionKeys, input.role);

    const existingUser = await tx.user.findUnique({
      where: {
        email: normalizedEmail
      }
    });

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: existingUser.id
          }
        }
      });

      if (existingMembership) {
        throw new Error("A user with that email already exists in this organization.");
      }
    }

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          timezone: "America/New_York",
          locale: "en-US",
          isActive: true
        }
      }));

    const membership = await tx.membership.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        userId: user.id,
        role: input.role,
        status: "invited",
        title: input.title?.trim() ? input.title.trim() : null,
        permissions: Prisma.JsonNull
      },
      include: {
        office: true
      }
    });

    if (input.splitTemplateId?.trim() || input.customAgentPercent?.trim()) {
      await saveMembershipCommissionSetting(
        {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId ?? null,
          membershipId: membership.id,
          splitTemplateId: input.splitTemplateId,
          customAgentPercent: input.customAgentPercent,
          effectiveFrom: input.commissionEffectiveFrom ?? new Date().toISOString().slice(0, 10),
          actorMembershipId: input.actorMembershipId,
          contextHref: `/office/settings/users/${membership.id}`,
          recordActivity: false
        },
        tx
      );
    }

    if (teamId) {
      await materializeImplicitJuniorTeamsForManagementAction(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId ?? null,
        actorMembershipId: input.actorMembershipId
      });
      await assignMembershipToTeamTx(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId ?? null,
        actorMembershipId: input.actorMembershipId,
        teamId,
        membershipId: membership.id,
        role: "member",
        reportsToTeamMembershipId
      });
    }

    const { invitation, rawToken, expiresAt } = await createInvitationRecord(tx, {
      organizationId: input.organizationId,
      membershipId: membership.id,
      email: normalizedEmail,
      invitedByMembershipId: input.actorMembershipId
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "invitation",
      entityId: invitation.id,
      action: activityLogActions.settingsUserInvited,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${firstName} ${lastName} · ${normalizedEmail}`,
        contextHref: "/office/settings/users",
        details: [
          buildRoleDetail(membership.role),
          `Office: ${membership.office?.name ?? "All offices"}`,
          `Invitation expires: ${expiresAt.toISOString()}`
        ]
      }
    });

    return {
      membershipId: membership.id,
      userId: user.id,
      invitationId: invitation.id,
      rawToken,
      invitationPath: buildInvitationPath(rawToken),
      expiresAt
    };
  });
}

export async function issueInvitationForMembership(input: {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId
      },
      tx
    );

    assertActorCanManageUsers(actorPermissionKeys);

    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      include: {
        user: {
          include: {
            credential: true
          }
        },
        office: true,
        organization: true
      }
    });

    if (!membership) {
      throw new Error("User membership was not found.");
    }

    assertActorCanManagePrivilegedMembership(actorPermissionKeys, membership.role);

    if (membership.status === "disabled") {
      throw new Error("Disabled accounts cannot receive invitation links.");
    }

    await tx.invitation.updateMany({
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id,
        acceptedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    const { invitation, rawToken, expiresAt } = await createInvitationRecord(tx, {
      organizationId: input.organizationId,
      membershipId: membership.id,
      email: membership.user.email,
      invitedByMembershipId: input.actorMembershipId
    });

    const action =
      membership.status === "invited" ? activityLogActions.settingsUserInvited : activityLogActions.authPasswordSetupIssued;
    const contextHref = "/office/settings/users";

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: membership.status === "invited" ? "membership" : "invitation",
      entityId: membership.status === "invited" ? membership.id : invitation.id,
      action,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
        contextHref,
        details: [
          buildRoleDetail(membership.role),
          `Office: ${membership.office?.name ?? "All offices"}`,
          `Invitation expires: ${expiresAt.toISOString()}`
        ]
      }
    });

    return {
      invitationId: invitation.id,
      invitationPath: buildInvitationPath(rawToken),
      rawToken,
      expiresAt
    };
  });
}

export async function revokeInvitationForMembership(input: {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId
      },
      tx
    );

    assertActorCanManageUsers(actorPermissionKeys);

    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      include: {
        user: true,
        office: true
      }
    });

    if (!membership) {
      throw new Error("User membership was not found.");
    }

    assertActorCanManagePrivilegedMembership(actorPermissionKeys, membership.role);

    const activeInvitations = await tx.invitation.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id,
        acceptedAt: null,
        revokedAt: null
      },
      select: {
        id: true
      }
    });

    const result = await tx.invitation.updateMany({
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id,
        acceptedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    if (result.count === 0) {
      throw new Error("No active invitation was found for this user.");
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "invitation",
      entityId: activeInvitations[0]?.id ?? membership.id,
      action: activityLogActions.settingsUserInvitationRevoked,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
        contextHref: "/office/settings/users",
        details: [`Revoked ${result.count} active invitation link${result.count === 1 ? "" : "s"}`]
      }
    });
  });
}

export async function unlockInternalAccount(input: UnlockInternalAccountInput) {
  return prisma.$transaction(async (tx) => {
    const actorPermissionKeys = await getMembershipEffectivePermissionKeys(
      {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId
      },
      tx
    );

    assertActorCanManageUsers(actorPermissionKeys);

    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId
      },
      include: {
        user: {
          include: {
            credential: true
          }
        },
        office: true
      }
    });

    if (!membership || !membership.user.credential) {
      throw new Error("User credential was not found.");
    }

    assertActorCanManagePrivilegedMembership(actorPermissionKeys, membership.role);

    await tx.userCredential.update({
      where: {
        id: membership.user.credential.id
      },
      data: {
        failedLoginCount: 0,
        lockedUntil: null
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "user_credential",
      entityId: membership.user.credential.id,
      action: activityLogActions.authAccountUnlocked,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} · ${membership.user.email}`,
        contextHref: "/office/settings/users",
        details: ["Lockout cleared and failed attempts reset"]
      }
    });
  });
}

export async function findActiveMembershipContextByEmail(email: string): Promise<SessionMembershipContext | null> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const membership = await getActiveMembershipByEmail(normalizedEmail);

  if (!membership) {
    return null;
  }

  return buildMembershipContext(membership satisfies MembershipSessionRecord);
}

export async function getSessionMembershipContext(membershipId: string): Promise<SessionMembershipContext | null> {
  if (!membershipId) {
    return null;
  }

  const membership = await getMembershipSessionRecord(membershipId);

  if (!membership || membership.status !== "active" || !membership.user.isActive) {
    return null;
  }

  return buildMembershipContext(membership);
}
