import {
  MembershipStatus,
  Prisma,
  TransactionContactRole,
  TransactionFieldKey,
  TransactionType,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";

const userRoleLabelMap: Record<UserRole, string> = {
  agent: "Agent",
  office_manager: "Office Manager",
  office_user: "Office User",
  office_admin: "Office Admin"
};

const officeInternalRoleCatalog: UserRole[] = ["office_admin", "office_user", "office_manager"];

const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Inactive"
};

const contactRoleLabelMap: Record<TransactionContactRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  co_buyer: "Co-buyer",
  co_seller: "Co-seller",
  tenant: "Tenant",
  landlord: "Landlord",
  other: "Other"
};

const transactionTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales listing",
  rental_leasing: "Rental leasing",
  rental_listing: "Rental listing",
  commercial_sales: "Commercial sales",
  commercial_lease: "Commercial lease",
  other: "Other"
};

const transactionFieldCatalog: Array<{ key: TransactionFieldKey; label: string }> = [
  { key: "price", label: "Price" },
  { key: "important_date", label: "Important date" },
  { key: "closing_date", label: "Closing date" },
  { key: "buyer_expiration_date", label: "Buyer expiration date" },
  { key: "acceptance_date", label: "Acceptance date" },
  { key: "company_referral", label: "Company referral" },
  { key: "company_referral_employee_name", label: "Referral employee name" }
];

const contactRoleCatalog: Array<{ role: TransactionContactRole; label: string }> = [
  { role: "buyer", label: contactRoleLabelMap.buyer },
  { role: "seller", label: contactRoleLabelMap.seller },
  { role: "co_buyer", label: contactRoleLabelMap.co_buyer },
  { role: "co_seller", label: contactRoleLabelMap.co_seller },
  { role: "tenant", label: contactRoleLabelMap.tenant },
  { role: "landlord", label: contactRoleLabelMap.landlord },
  { role: "other", label: contactRoleLabelMap.other }
];

export type OfficeSettingsSummarySnapshot = {
  summary: {
    usersCount: number;
    activeUsersCount: number;
    inactiveUsersCount: number;
    teamsCount: number;
    requiredRoleCount: number;
    checklistTemplateCount: number;
  };
};

export type OfficeAdminUserRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleValue: UserRole;
  roleEditorValue: string;
  officeAccessLabel: string;
  officeAccessValue: string;
  status: string;
  statusValue: MembershipStatus;
  title: string;
  authStatusLabel: string;
  lockStatusLabel: string;
  lockedUntilLabel: string;
  invitationStatusLabel: string;
  invitationExpiresAtLabel: string;
  hasCredential: boolean;
  hasActiveInvitation: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  href: string | null;
};

export type OfficeAdminUsersSnapshot = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    invitedUsers: number;
    disabledUsers: number;
    lockedUsers: number;
    pendingInvitationCount: number;
    allOfficeAccessCount: number;
  };
  filters: {
    q: string;
    role: string;
    status: string;
    officeId: string;
    roleOptions: Array<{ value: string; label: string }>;
    statusOptions: Array<{ value: string; label: string }>;
    officeOptions: Array<{ id: string; label: string }>;
  };
  rows: OfficeAdminUserRow[];
};

export type OfficeRequiredContactRoleRecord = {
  role: TransactionContactRole;
  label: string;
  isRequired: boolean;
};

export type OfficeTransactionFieldSettingRecord = {
  fieldKey: TransactionFieldKey;
  label: string;
  isRequired: boolean;
  isVisible: boolean;
};

export type OfficeFieldSettingsSnapshot = {
  summary: {
    requiredRoleCount: number;
    requiredFieldCount: number;
    visibleFieldCount: number;
  };
  contactRoleSettings: OfficeRequiredContactRoleRecord[];
  transactionFieldSettings: OfficeTransactionFieldSettingRecord[];
};

export type OfficeChecklistTemplateItemRecord = {
  id: string;
  checklistGroup: string;
  title: string;
  description: string;
  dueDaysOffset: string;
  sortOrder: number;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
};

export type OfficeChecklistTemplateRecord = {
  id: string;
  name: string;
  description: string;
  transactionTypeLabel: string;
  transactionTypeValue: string;
  isActive: boolean;
  itemCount: number;
  createdByName: string;
  updatedByName: string;
  items: OfficeChecklistTemplateItemRecord[];
};

export type OfficeChecklistTemplatesSnapshot = {
  summary: {
    totalTemplates: number;
    activeTemplates: number;
    totalItems: number;
  };
  transactionTypeOptions: Array<{ value: string; label: string }>;
  templates: OfficeChecklistTemplateRecord[];
};

export type GetOfficeAdminUsersInput = {
  organizationId: string;
  officeId?: string | null;
  q?: string;
  role?: string;
  status?: string;
  officeFilterId?: string;
};

export type UpdateOfficeAdminUserInput = {
  organizationId: string;
  actorMembershipId: string;
  membershipId: string;
  role?: string;
  status?: string;
  officeId?: string | null;
};

export type SaveOfficeFieldSettingsInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  contactRoleSettings: Array<{
    role: string;
    isRequired: boolean;
  }>;
  transactionFieldSettings: Array<{
    fieldKey: string;
    isRequired: boolean;
    isVisible: boolean;
  }>;
};

export type ChecklistTemplateItemInput = {
  checklistGroup?: string;
  title?: string;
  description?: string;
  dueDaysOffset?: string;
  sortOrder?: number;
  requiresDocument?: boolean;
  requiresDocumentApproval?: boolean;
  requiresSecondaryApproval?: boolean;
};

export type CreateChecklistTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  name: string;
  description?: string;
  transactionType?: string;
  isActive?: boolean;
  items: ChecklistTemplateItemInput[];
};

export type UpdateChecklistTemplateInput = CreateChecklistTemplateInput & {
  templateId: string;
};

function buildChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue ? null : { label, previousValue, nextValue };
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInteger(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`;
}

function formatMembershipStatusLabel(status: MembershipStatus) {
  return membershipStatusLabelMap[status];
}

function formatOfficeAccessLabel(office: { name: string } | null) {
  return office?.name ?? "All offices";
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isOfficeInternalRole(role: UserRole) {
  return officeInternalRoleCatalog.includes(role);
}

function mapOfficeAdminUserRow(membership: {
  id: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  title: string | null;
  officeId: string | null;
  office: { name: string } | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    credential: {
      mustChangePassword: boolean;
      lockedUntil: Date | null;
    } | null;
  };
  invitations: Array<{
    expiresAt: Date;
  }>;
}): OfficeAdminUserRow {
  const pendingInvitation = membership.invitations[0] ?? null;
  const isLocked = Boolean(membership.user.credential?.lockedUntil && membership.user.credential.lockedUntil > new Date());
  const hasCredential = Boolean(membership.user.credential);
  const name = `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
  const mustChangePassword = membership.user.credential?.mustChangePassword ?? false;

  let authStatusLabel = "Setup required";
  if (mustChangePassword) {
    authStatusLabel = "Password change required";
  } else if (hasCredential) {
    authStatusLabel = "Password set";
  } else if (membership.status === "invited") {
    authStatusLabel = "Pending password setup";
  }

  let invitationStatusLabel = "Not issued";
  if (pendingInvitation) {
    invitationStatusLabel = "Pending";
  } else if (membership.status === "invited") {
    invitationStatusLabel = "Reissue needed";
  } else if (hasCredential) {
    invitationStatusLabel = "Complete";
  } else {
    invitationStatusLabel = "Setup required";
  }

  return {
    membershipId: membership.id,
    userId: membership.userId,
    name,
    email: membership.user.email,
    role: membership.role === "office_manager" ? "Office Manager (Legacy)" : userRoleLabelMap[membership.role],
    roleValue: membership.role,
    roleEditorValue: membership.role,
    officeAccessLabel: formatOfficeAccessLabel(membership.office),
    officeAccessValue: membership.officeId ?? "__all__",
    status: formatMembershipStatusLabel(membership.status),
    statusValue: membership.status,
    title: membership.title ?? "",
    authStatusLabel,
    lockStatusLabel: isLocked ? "Locked" : "Not locked",
    lockedUntilLabel: formatDateTimeLabel(membership.user.credential?.lockedUntil),
    invitationStatusLabel,
    invitationExpiresAtLabel: formatDateTimeLabel(pendingInvitation?.expiresAt),
    hasCredential,
    hasActiveInvitation: Boolean(pendingInvitation),
    isLocked,
    mustChangePassword,
    href: null
  };
}

function normalizeUserRole(value: string | undefined): UserRole | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "agent" || value === "office_manager" || value === "office_user" || value === "office_admin") {
    return value;
  }

  throw new Error("A valid user role is required.");
}

function normalizeMembershipStatus(value: string | undefined): MembershipStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "active" || value === "invited" || value === "disabled") {
    return value;
  }

  throw new Error("A valid membership status is required.");
}

function normalizeContactRole(value: string): TransactionContactRole {
  if (
    value === "buyer" ||
    value === "seller" ||
    value === "co_buyer" ||
    value === "co_seller" ||
    value === "tenant" ||
    value === "landlord" ||
    value === "other"
  ) {
    return value;
  }

  throw new Error("A valid contact role is required.");
}

function normalizeTransactionFieldKey(value: string): TransactionFieldKey {
  if (
    value === "price" ||
    value === "important_date" ||
    value === "closing_date" ||
    value === "buyer_expiration_date" ||
    value === "acceptance_date" ||
    value === "company_referral" ||
    value === "company_referral_employee_name"
  ) {
    return value;
  }

  throw new Error("A valid transaction field key is required.");
}

function normalizeTransactionType(value: string | undefined): TransactionType | null {
  if (!value) {
    return null;
  }

  if (
    value === "sales" ||
    value === "sales_listing" ||
    value === "rental_leasing" ||
    value === "rental_listing" ||
    value === "commercial_sales" ||
    value === "commercial_lease" ||
    value === "other"
  ) {
    return value;
  }

  throw new Error("A valid checklist transaction context is required.");
}

function mapChecklistTemplateRecord(
  template: {
    id: string;
    name: string;
    description: string | null;
    transactionType: TransactionType | null;
    isActive: boolean;
    items: Array<{
      id: string;
      checklistGroup: string;
      title: string;
      description: string | null;
      dueDaysOffset: number | null;
      sortOrder: number;
      requiresDocument: boolean;
      requiresDocumentApproval: boolean;
      requiresSecondaryApproval: boolean;
    }>;
    createdByMembership: { user: { firstName: string; lastName: string } } | null;
    updatedByMembership: { user: { firstName: string; lastName: string } } | null;
  }
): OfficeChecklistTemplateRecord {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    transactionTypeLabel: template.transactionType ? transactionTypeLabelMap[template.transactionType] : "Office default",
    transactionTypeValue: template.transactionType ?? "",
    isActive: template.isActive,
    itemCount: template.items.length,
    createdByName: template.createdByMembership ? formatMembershipLabel(template.createdByMembership) : "System",
    updatedByName: template.updatedByMembership ? formatMembershipLabel(template.updatedByMembership) : "System",
    items: template.items.map((item) => ({
      id: item.id,
      checklistGroup: item.checklistGroup,
      title: item.title,
      description: item.description ?? "",
      dueDaysOffset: item.dueDaysOffset === null ? "" : String(item.dueDaysOffset),
      sortOrder: item.sortOrder,
      requiresDocument: item.requiresDocument,
      requiresDocumentApproval: item.requiresDocumentApproval,
      requiresSecondaryApproval: item.requiresSecondaryApproval
    }))
  };
}

function buildChecklistTemplateItems(items: ChecklistTemplateItemInput[]) {
  const normalizedItems = items
    .map((item, index) => ({
      checklistGroup: parseOptionalText(item.checklistGroup) ?? "General",
      title: item.title?.trim() ?? "",
      description: parseOptionalText(item.description),
      dueDaysOffset: parseOptionalInteger(item.dueDaysOffset),
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
      requiresDocument: Boolean(item.requiresDocument),
      requiresDocumentApproval: Boolean(item.requiresDocumentApproval),
      requiresSecondaryApproval: Boolean(item.requiresSecondaryApproval)
    }))
    .filter((item) => item.title.length > 0);

  if (!normalizedItems.length) {
    throw new Error("At least one checklist task row is required.");
  }

  return normalizedItems;
}

export async function getOfficeSettingsSummarySnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeSettingsSummarySnapshot> {
  const [membershipSummary, teamCount, requiredRoleCount, checklistTemplateCount] = await Promise.all([
    prisma.membership.groupBy({
      by: ["status"],
      where: {
        organizationId: input.organizationId
      },
      _count: {
        _all: true
      }
    }),
    prisma.team.count({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      }
    }),
    prisma.requiredContactRoleSetting.count({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        isRequired: true
      }
    }),
    prisma.checklistTemplate.count({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    })
  ]);

  const totalUsers = membershipSummary.reduce((sum, entry) => sum + entry._count._all, 0);
  const activeUsers = membershipSummary.find((entry) => entry.status === "active")?._count._all ?? 0;
  const inactiveUsers = totalUsers - activeUsers;

  return {
    summary: {
      usersCount: totalUsers,
      activeUsersCount: activeUsers,
      inactiveUsersCount: inactiveUsers,
      teamsCount: teamCount,
      requiredRoleCount,
      checklistTemplateCount
    }
  };
}

export async function getOfficeAdminUsersSnapshot(input: GetOfficeAdminUsersInput): Promise<OfficeAdminUsersSnapshot> {
  const officeFilterId = input.officeFilterId?.trim() ?? "";
  const roleFilter = normalizeUserRole(input.role);
  const q = input.q?.trim() ?? "";
  const statusFilter = input.status?.trim() ?? "";
  const now = new Date();

  const where: Prisma.MembershipWhereInput = {
    organizationId: input.organizationId,
    role: {
      in: officeInternalRoleCatalog
    }
  };

  if (officeFilterId === "__all__") {
    where.officeId = null;
  } else if (officeFilterId) {
    where.officeId = officeFilterId;
  }

  if (roleFilter) {
    where.role = roleFilter;
  }

  if (statusFilter === "active" || statusFilter === "invited" || statusFilter === "disabled") {
    where.status = statusFilter;
  } else if (statusFilter === "locked") {
    where.user = {
      is: {
        credential: {
          is: {
            lockedUntil: {
              gt: now
            }
          }
        }
      }
    };
  }

  if (q) {
    where.OR = [
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { title: { contains: q, mode: "insensitive" } },
      { office: { name: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [memberships, offices, summary] = await Promise.all([
    prisma.membership.findMany({
      where,
      include: {
        user: {
          include: {
            credential: true
          }
        },
        office: true,
        invitations: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: now
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        }
      },
      orderBy: [{ office: { name: "asc" } }, { user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true
      }
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: officeInternalRoleCatalog
        }
      },
      select: {
        id: true,
        status: true,
        officeId: true,
        role: true,
        title: true,
        userId: true,
        office: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            credential: {
              select: {
                mustChangePassword: true,
                lockedUntil: true
              }
            }
          }
        },
        invitations: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: now
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            expiresAt: true
          }
        }
      }
    })
  ]);

  const summaryRows = summary.map((membership) =>
    mapOfficeAdminUserRow({
      ...membership,
      title: membership.title ?? null
    })
  );
  const totalUsers = summaryRows.length;
  const activeUsers = summaryRows.filter((entry) => entry.statusValue === "active").length;
  const invitedUsers = summaryRows.filter((entry) => entry.statusValue === "invited").length;
  const disabledUsers = summaryRows.filter((entry) => entry.statusValue === "disabled").length;
  const lockedUsers = summaryRows.filter((entry) => entry.isLocked).length;
  const pendingInvitationCount = summaryRows.filter((entry) => entry.hasActiveInvitation).length;
  const allOfficeAccessCount = summaryRows.filter((entry) => entry.officeAccessValue === "__all__").length;

  const roleOptions = [
    { value: "office_admin", label: "Admin" },
    { value: "office_user", label: "User" }
  ];

  if (summaryRows.some((entry) => entry.roleValue === "office_manager")) {
    roleOptions.push({ value: "office_manager", label: "Office Manager (Legacy)" });
  }

  return {
    summary: {
      totalUsers,
      activeUsers,
      invitedUsers,
      disabledUsers,
      lockedUsers,
      pendingInvitationCount,
      allOfficeAccessCount
    },
    filters: {
      q,
      role: roleFilter ?? "",
      status: statusFilter,
      officeId: officeFilterId,
      roleOptions,
      statusOptions: [
        { value: "active", label: "Active" },
        { value: "invited", label: "Invited" },
        { value: "disabled", label: "Disabled" },
        { value: "locked", label: "Locked" }
      ],
      officeOptions: [{ id: "__all__", label: "All offices" }, ...offices.map((office) => ({ id: office.id, label: office.name }))]
    },
    rows: memberships.map((membership) =>
      mapOfficeAdminUserRow({
        ...membership,
        title: membership.title ?? null
      })
    )
  };
}

export async function updateOfficeAdminUser(input: UpdateOfficeAdminUserInput) {
  return prisma.$transaction(async (tx) => {
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

    if (!membership) {
      throw new Error("User membership was not found.");
    }

    if (!isOfficeInternalRole(membership.role)) {
      throw new Error("Agent memberships are managed outside the internal users page.");
    }

    const nextRole = normalizeUserRole(input.role) ?? membership.role;
    const nextStatus = normalizeMembershipStatus(input.status) ?? membership.status;
    let nextOfficeId = typeof input.officeId === "string" ? input.officeId : input.officeId === null ? null : membership.officeId;

    if (nextRole === "agent") {
      throw new Error("Users page only supports internal Admin and User roles.");
    }

    if (nextRole === "office_manager" && membership.role !== "office_manager") {
      throw new Error("The legacy Office Manager role cannot be assigned from this page.");
    }

    if (!membership.user.credential && nextStatus === "active") {
      throw new Error("Invited users become active after they set a password.");
    }

    if (membership.user.credential && nextStatus === "invited") {
      throw new Error("Issue a password setup link instead of moving a password account back to invited.");
    }

    if (nextOfficeId === "__all__") {
      nextOfficeId = null;
    }

    let nextOfficeName = "All offices";
    if (nextOfficeId) {
      const office = await tx.office.findFirst({
        where: {
          id: nextOfficeId,
          organizationId: input.organizationId
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!office) {
        throw new Error("Selected office was not found.");
      }

      nextOfficeName = office.name;
    }

    const previousRoleLabel = userRoleLabelMap[membership.role];
    const nextRoleLabel = userRoleLabelMap[nextRole];
    const previousStatusLabel = formatMembershipStatusLabel(membership.status);
    const nextStatusLabel = formatMembershipStatusLabel(nextStatus);
    const previousOfficeLabel = formatOfficeAccessLabel(membership.office);

    const updatedMembership = await tx.membership.update({
      where: {
        id: membership.id
      },
      data: {
        role: nextRole,
        status: nextStatus,
        officeId: nextOfficeId
      },
      include: {
        office: true
      }
    });

    const userLabel = `${membership.user.firstName} ${membership.user.lastName}`;
    const contextHref = "/office/settings/users";

    if (membership.role !== nextRole) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsUserRoleChanged,
        payload: {
          objectLabel: userLabel,
          contextHref,
          details: [],
          changes: [buildChange("Role", previousRoleLabel, nextRoleLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    if (membership.status !== nextStatus) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: nextStatus === "active" ? activityLogActions.settingsUserActivated : activityLogActions.settingsUserDeactivated,
        payload: {
          objectLabel: userLabel,
          contextHref,
          details: [],
          changes: [buildChange("Status", previousStatusLabel, nextStatusLabel)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    if ((membership.officeId ?? null) !== (nextOfficeId ?? null)) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "membership",
        entityId: membership.id,
        action: activityLogActions.settingsOfficeAccessChanged,
        payload: {
          objectLabel: userLabel,
          contextHref,
          details: [],
          changes: [buildChange("Office access", previousOfficeLabel, nextOfficeName)].filter(Boolean) as ActivityLogChange[]
        }
      });
    }

    return updatedMembership;
  });
}

export async function getOfficeFieldSettingsSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeFieldSettingsSnapshot> {
  const [requiredRoleSettings, transactionFieldSettings] = await Promise.all([
    prisma.requiredContactRoleSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    }),
    prisma.transactionFieldSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    })
  ]);

  const requiredRoleMap = new Map(requiredRoleSettings.map((entry) => [entry.role, entry.isRequired]));
  const fieldSettingsMap = new Map(
    transactionFieldSettings.map((entry) => [
      entry.fieldKey,
      {
        isRequired: entry.isRequired,
        isVisible: entry.isVisible
      }
    ])
  );

  const contactRoleRows = contactRoleCatalog.map((entry) => ({
    role: entry.role,
    label: entry.label,
    isRequired: requiredRoleMap.get(entry.role) ?? false
  }));

  const transactionFieldRows = transactionFieldCatalog.map((entry) => ({
    fieldKey: entry.key,
    label: entry.label,
    isRequired: fieldSettingsMap.get(entry.key)?.isRequired ?? false,
    isVisible: fieldSettingsMap.get(entry.key)?.isVisible ?? true
  }));

  return {
    summary: {
      requiredRoleCount: contactRoleRows.filter((entry) => entry.isRequired).length,
      requiredFieldCount: transactionFieldRows.filter((entry) => entry.isRequired).length,
      visibleFieldCount: transactionFieldRows.filter((entry) => entry.isVisible).length
    },
    contactRoleSettings: contactRoleRows,
    transactionFieldSettings: transactionFieldRows
  };
}

export async function saveOfficeFieldSettings(input: SaveOfficeFieldSettingsInput) {
  return prisma.$transaction(async (tx) => {
    const existingRoleSettings = await tx.requiredContactRoleSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const existingFieldSettings = await tx.transactionFieldSetting.findMany({
      where: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      }
    });

    const roleChanges: ActivityLogChange[] = [];
    for (const entry of input.contactRoleSettings) {
      const role = normalizeContactRole(entry.role);
      const existing = existingRoleSettings.find((setting) => setting.role === role) ?? null;
      const previousValue = existing?.isRequired ? "Required" : "Optional";
      const nextValue = entry.isRequired ? "Required" : "Optional";

      if (existing) {
        await tx.requiredContactRoleSetting.update({
          where: {
            id: existing.id
          },
          data: {
            isRequired: entry.isRequired
          }
        });
      } else {
        await tx.requiredContactRoleSetting.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            role,
            isRequired: entry.isRequired
          }
        });
      }

      const change = buildChange(contactRoleLabelMap[role], previousValue, nextValue);
      if (change) {
        roleChanges.push(change);
      }
    }

    const fieldChanges: ActivityLogChange[] = [];
    for (const entry of input.transactionFieldSettings) {
      const fieldKey = normalizeTransactionFieldKey(entry.fieldKey);
      const existing = existingFieldSettings.find((setting) => setting.fieldKey === fieldKey) ?? null;
      const previousRequired = existing?.isRequired ?? false;
      const previousVisible = existing?.isVisible ?? true;

      if (existing) {
        await tx.transactionFieldSetting.update({
          where: {
            id: existing.id
          },
          data: {
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        });
      } else {
        await tx.transactionFieldSetting.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            fieldKey,
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        });
      }

      const fieldLabel = transactionFieldCatalog.find((catalogEntry) => catalogEntry.key === fieldKey)?.label ?? fieldKey;
      const requiredChange = buildChange(`${fieldLabel} required`, previousRequired ? "Yes" : "No", entry.isRequired ? "Yes" : "No");
      const visibilityChange = buildChange(`${fieldLabel} visible`, previousVisible ? "Yes" : "No", entry.isVisible ? "Yes" : "No");

      if (requiredChange) {
        fieldChanges.push(requiredChange);
      }

      if (visibilityChange) {
        fieldChanges.push(visibilityChange);
      }
    }

    const contextHref = "/office/settings/fields";

    if (roleChanges.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "required_contact_role_setting",
        entityId: `required-roles:${input.officeId ?? "organization"}`,
        action: activityLogActions.settingsRequiredContactRolesChanged,
        payload: {
          objectLabel: "Required contact roles",
          contextHref,
          details: roleChanges.map((change) => `${change.label}: ${change.nextValue}`),
          changes: roleChanges
        }
      });
    }

    if (fieldChanges.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "transaction_field_setting",
        entityId: `transaction-fields:${input.officeId ?? "organization"}`,
        action: activityLogActions.settingsTransactionFieldSettingsChanged,
        payload: {
          objectLabel: "Transaction field settings",
          contextHref,
          details: fieldChanges.map((change) => `${change.label}: ${change.nextValue}`),
          changes: fieldChanges
        }
      });
    }

    return getOfficeFieldSettingsSnapshot({
      organizationId: input.organizationId,
      officeId: input.officeId
    });
  });
}

export async function getOfficeChecklistTemplatesSnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeChecklistTemplatesSnapshot> {
  const templates = await prisma.checklistTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null
    },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      createdByMembership: {
        include: {
          user: true
        }
      },
      updatedByMembership: {
        include: {
          user: true
        }
      }
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return {
    summary: {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((template) => template.isActive).length,
      totalItems: templates.reduce((sum, template) => sum + template.items.length, 0)
    },
    transactionTypeOptions: [{ value: "", label: "Office default" }].concat(
      Object.entries(transactionTypeLabelMap).map(([value, label]) => ({
        value,
        label
      }))
    ),
    templates: templates.map(mapChecklistTemplateRecord)
  };
}

export async function createChecklistTemplate(input: CreateChecklistTemplateInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Checklist template name is required.");
  }

  const items = buildChecklistTemplateItems(input.items);

  return prisma.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        name,
        description: parseOptionalText(input.description),
        transactionType: normalizeTransactionType(input.transactionType),
        isActive: input.isActive ?? true,
        createdByMembershipId: input.actorMembershipId,
        updatedByMembershipId: input.actorMembershipId,
        items: {
          createMany: {
            data: items.map((item) => ({
              organizationId: input.organizationId,
              officeId: input.officeId ?? null,
              checklistGroup: item.checklistGroup,
              title: item.title,
              description: item.description,
              dueDaysOffset: item.dueDaysOffset,
              sortOrder: item.sortOrder,
              requiresDocument: item.requiresDocument,
              requiresDocumentApproval: item.requiresDocumentApproval,
              requiresSecondaryApproval: item.requiresSecondaryApproval
            }))
          }
        }
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "checklist_template",
      entityId: template.id,
      action: activityLogActions.settingsChecklistTemplateCreated,
      payload: {
        objectLabel: name,
        contextHref: "/office/settings/checklists",
        details: [`${items.length} template task${items.length === 1 ? "" : "s"}`],
        changes: []
      }
    });

    return template;
  });
}

export async function updateChecklistTemplate(input: UpdateChecklistTemplateInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Checklist template name is required.");
  }

  const items = buildChecklistTemplateItems(input.items);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.checklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: input.organizationId,
        officeId: input.officeId ?? null
      },
      include: {
        items: true
      }
    });

    if (!existing) {
      throw new Error("Checklist template was not found.");
    }

    const changes: ActivityLogChange[] = [];
    const nameChange = buildChange("Name", existing.name, name);
    const descriptionChange = buildChange("Description", existing.description ?? "—", parseOptionalText(input.description) ?? "—");
    const transactionTypeChange = buildChange(
      "Context",
      existing.transactionType ? transactionTypeLabelMap[existing.transactionType] : "Office default",
      input.transactionType ? transactionTypeLabelMap[normalizeTransactionType(input.transactionType) as TransactionType] : "Office default"
    );

    if (nameChange) {
      changes.push(nameChange);
    }

    if (descriptionChange) {
      changes.push(descriptionChange);
    }

    if (transactionTypeChange) {
      changes.push(transactionTypeChange);
    }

    if (existing.items.length !== items.length) {
      changes.push({
        label: "Task rows",
        previousValue: String(existing.items.length),
        nextValue: String(items.length)
      });
    }

    const updated = await tx.checklistTemplate.update({
      where: {
        id: existing.id
      },
      data: {
        name,
        description: parseOptionalText(input.description),
        transactionType: normalizeTransactionType(input.transactionType),
        isActive: input.isActive ?? existing.isActive,
        updatedByMembershipId: input.actorMembershipId
      }
    });

    await tx.checklistTemplateItem.deleteMany({
      where: {
        checklistTemplateId: existing.id
      }
    });

    await tx.checklistTemplateItem.createMany({
      data: items.map((item) => ({
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        checklistTemplateId: existing.id,
        checklistGroup: item.checklistGroup,
        title: item.title,
        description: item.description,
        dueDaysOffset: item.dueDaysOffset,
        sortOrder: item.sortOrder,
        requiresDocument: item.requiresDocument,
        requiresDocumentApproval: item.requiresDocumentApproval,
        requiresSecondaryApproval: item.requiresSecondaryApproval
      }))
    });

    let action: typeof activityLogActions[keyof typeof activityLogActions] = activityLogActions.settingsChecklistTemplateUpdated;
    if (existing.isActive && updated.isActive === false) {
      action = activityLogActions.settingsChecklistTemplateDeactivated;
    } else if (!existing.isActive && updated.isActive === true) {
      action = activityLogActions.settingsChecklistTemplateActivated;
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "checklist_template",
      entityId: existing.id,
      action,
      payload: {
        objectLabel: updated.name,
        contextHref: "/office/settings/checklists",
        details: changes.map((change) => `${change.label}: ${change.nextValue}`),
        changes
      }
    });

    return updated;
  });
}
