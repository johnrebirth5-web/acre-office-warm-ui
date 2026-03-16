export type UserRole =
  | "owner"
  | "office_admin"
  | "accountant"
  | "human_resources"
  | "team_lead"
  | "agent"
  | "office_manager"
  | "office_user";

export type AppPermission =
  | "dashboard:view"
  | "activity:view"
  | "activity:comment"
  | "settings:view"
  | "settings:manage"
  | "agents:view"
  | "agents:manage"
  | "onboarding:view"
  | "onboarding:manage"
  | "goals:view"
  | "goals:manage"
  | "teams:view"
  | "teams:manage"
  | "users:view"
  | "library:view"
  | "library:manage"
  | "transactions:view"
  | "transactions:create"
  | "transactions:edit"
  | "transactions:finance"
  | "contacts:view"
  | "contacts:create"
  | "contacts:edit"
  | "contacts:link"
  | "documents:view"
  | "documents:manage"
  | "documents:approve"
  | "forms:use"
  | "signatures:manage"
  | "incoming_updates:review"
  | "accounting:view"
  | "accounting:manage"
  | "accounting:billing:view"
  | "accounting:billing:manage"
  | "accounting:payments:manage"
  | "commissions:view"
  | "commissions:manage"
  | "commissions:calculate"
  | "commissions:approve"
  | "offers:view"
  | "offers:manage"
  | "offers:review"
  | "offers:accept"
  | "offers:comment"
  | "tasks:view"
  | "tasks:manage"
  | "tasks:review"
  | "tasks:review:secondary"
  | "listings:view"
  | "listings:manage"
  | "listings:publish"
  | "clients:view"
  | "clients:manage"
  | "events:view"
  | "events:manage"
  | "resources:view"
  | "resources:manage"
  | "analytics:view"
  | "notifications:view"
  | "fields:view"
  | "fields:manage"
  | "checklists:view"
  | "checklists:manage"
  | "users:manage"
  | "integrations:manage"
  | "ai:use";

export type RoleSummary = {
  role: UserRole;
  label: string;
  description: string;
};

const roleSummaries: Record<UserRole, RoleSummary> = {
  owner: {
    role: "owner",
    label: "Owner",
    description: "Top-level administrative owner with full Back Office access."
  },
  office_admin: {
    role: "office_admin",
    label: "Office Admin",
    description: "Administrative owner with permissions across users, publishing, integrations, and settings."
  },
  accountant: {
    role: "accountant",
    label: "Accountant",
    description: "Finance and reporting operator with broad visibility across transactions, accounting, and user lifecycle actions."
  },
  human_resources: {
    role: "human_resources",
    label: "Human Resources",
    description: "People operations user with account lifecycle visibility and organization-wide workflow/report access."
  },
  team_lead: {
    role: "team_lead",
    label: "Team Lead",
    description: "Team leader with scoped access to subordinate members, their production, and team performance."
  },
  agent: {
    role: "agent",
    label: "Agent",
    description: "Back Office agent or support user with self-scoped production visibility and transaction intake access."
  },
  office_manager: {
    role: "office_manager",
    label: "Office Manager",
    description: "Operations user focused on listings intake, events, resources, and analytics."
  },
  office_user: {
    role: "office_user",
    label: "Office User",
    description: "Internal office user with broad workspace visibility but without admin-level system controls."
  }
};

const permissionMap: Record<UserRole, AppPermission[]> = {
  owner: [
    "dashboard:view",
    "activity:view",
    "activity:comment",
    "settings:view",
    "settings:manage",
    "agents:view",
    "agents:manage",
    "onboarding:view",
    "onboarding:manage",
    "goals:view",
    "goals:manage",
    "teams:view",
    "teams:manage",
    "users:view",
    "users:manage",
    "library:view",
    "library:manage",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "transactions:finance",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "documents:manage",
    "documents:approve",
    "forms:use",
    "signatures:manage",
    "incoming_updates:review",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "commissions:view",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "offers:manage",
    "offers:review",
    "offers:accept",
    "offers:comment",
    "tasks:view",
    "tasks:manage",
    "tasks:review",
    "tasks:review:secondary",
    "listings:view",
    "listings:manage",
    "listings:publish",
    "clients:view",
    "clients:manage",
    "events:view",
    "events:manage",
    "resources:view",
    "resources:manage",
    "analytics:view",
    "notifications:view",
    "fields:view",
    "fields:manage",
    "checklists:view",
    "checklists:manage",
    "integrations:manage",
    "ai:use"
  ],
  office_admin: [
    "dashboard:view",
    "activity:view",
    "activity:comment",
    "settings:view",
    "settings:manage",
    "agents:view",
    "agents:manage",
    "onboarding:view",
    "onboarding:manage",
    "goals:view",
    "goals:manage",
    "teams:view",
    "teams:manage",
    "users:view",
    "users:manage",
    "library:view",
    "library:manage",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "transactions:finance",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "documents:manage",
    "documents:approve",
    "forms:use",
    "signatures:manage",
    "incoming_updates:review",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "commissions:view",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "offers:manage",
    "offers:review",
    "offers:accept",
    "offers:comment",
    "tasks:view",
    "tasks:manage",
    "tasks:review",
    "tasks:review:secondary",
    "listings:view",
    "listings:manage",
    "listings:publish",
    "clients:view",
    "clients:manage",
    "events:view",
    "events:manage",
    "resources:view",
    "resources:manage",
    "analytics:view",
    "notifications:view",
    "fields:view",
    "fields:manage",
    "checklists:view",
    "checklists:manage",
    "users:manage",
    "integrations:manage",
    "ai:use"
  ],
  accountant: [
    "dashboard:view",
    "settings:view",
    "agents:view",
    "teams:view",
    "users:view",
    "users:manage",
    "library:view",
    "transactions:view",
    "contacts:view",
    "documents:view",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "commissions:view",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "tasks:view",
    "analytics:view",
    "notifications:view",
    "ai:use"
  ],
  human_resources: [
    "dashboard:view",
    "settings:view",
    "agents:view",
    "teams:view",
    "users:view",
    "users:manage",
    "library:view",
    "transactions:view",
    "contacts:view",
    "documents:view",
    "accounting:view",
    "accounting:billing:view",
    "commissions:view",
    "offers:view",
    "tasks:view",
    "analytics:view",
    "notifications:view",
    "ai:use"
  ],
  team_lead: [
    "dashboard:view",
    "agents:view",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "offers:view",
    "tasks:view",
    "accounting:billing:view",
    "analytics:view",
    "notifications:view",
    "ai:use"
  ],
  agent: [
    "dashboard:view",
    "agents:view",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "offers:view",
    "tasks:view",
    "accounting:billing:view",
    "notifications:view",
    "ai:use"
  ],
  office_manager: [
    "dashboard:view",
    "activity:view",
    "activity:comment",
    "settings:view",
    "agents:view",
    "agents:manage",
    "onboarding:view",
    "onboarding:manage",
    "goals:view",
    "goals:manage",
    "teams:view",
    "teams:manage",
    "users:view",
    "library:view",
    "library:manage",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "transactions:finance",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "documents:manage",
    "documents:approve",
    "forms:use",
    "signatures:manage",
    "incoming_updates:review",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "commissions:view",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "offers:manage",
    "offers:review",
    "offers:accept",
    "offers:comment",
    "tasks:view",
    "tasks:manage",
    "tasks:review",
    "listings:view",
    "listings:manage",
    "listings:publish",
    "events:view",
    "events:manage",
    "resources:view",
    "resources:manage",
    "analytics:view",
    "notifications:view",
    "fields:view",
    "fields:manage",
    "checklists:view",
    "checklists:manage",
    "ai:use"
  ],
  office_user: [
    "dashboard:view",
    "activity:view",
    "library:view",
    "transactions:view",
    "contacts:view",
    "documents:view",
    "offers:view",
    "tasks:view",
    "accounting:billing:view",
    "notifications:view",
    "ai:use"
  ]
};

export function getRoleSummary(role: UserRole): RoleSummary {
  return roleSummaries[role];
}

export function getPermissionsForRole(role: UserRole): AppPermission[] {
  return permissionMap[role];
}

export function can(role: UserRole, permission: AppPermission): boolean {
  return permissionMap[role].includes(permission);
}

export function isOfficeRole(role: UserRole): boolean {
  return [
    "owner",
    "office_admin",
    "accountant",
    "human_resources",
    "team_lead",
    "agent",
    "office_manager",
    "office_user"
  ].includes(role);
}

export function canViewOfficeReports(role: UserRole): boolean {
  return can(role, "analytics:view");
}

export function canAccessAccountActivity(role: UserRole): boolean {
  return can(role, "activity:view");
}

export function canCommentOfficeActivity(role: UserRole): boolean {
  return can(role, "activity:comment");
}

export function canAccessOfficeNotifications(role: UserRole): boolean {
  return can(role, "notifications:view");
}

export function canAccessOfficeSettings(role: UserRole): boolean {
  return can(role, "settings:view");
}

export function canManageOfficeSettings(role: UserRole): boolean {
  return can(role, "settings:manage");
}

export function canViewOfficeAgents(role: UserRole): boolean {
  return can(role, "agents:view");
}

export function canManageOfficeAgents(role: UserRole): boolean {
  return can(role, "agents:manage");
}

export function canViewOfficeOnboarding(role: UserRole): boolean {
  return can(role, "onboarding:view");
}

export function canManageOfficeOnboarding(role: UserRole): boolean {
  return can(role, "onboarding:manage");
}

export function canViewOfficeGoals(role: UserRole): boolean {
  return can(role, "goals:view");
}

export function canManageOfficeGoals(role: UserRole): boolean {
  return can(role, "goals:manage");
}

export function canViewOfficeTeams(role: UserRole): boolean {
  return can(role, "teams:view");
}

export function canManageOfficeTeams(role: UserRole): boolean {
  return can(role, "teams:manage");
}

export function canViewOfficeUsers(role: UserRole): boolean {
  return can(role, "users:view");
}

export function canManageOfficeUsers(role: UserRole): boolean {
  return can(role, "users:manage");
}

export function canViewOfficeFields(role: UserRole): boolean {
  return can(role, "fields:view");
}

export function canManageOfficeFields(role: UserRole): boolean {
  return can(role, "fields:manage");
}

export function canViewOfficeChecklists(role: UserRole): boolean {
  return can(role, "checklists:view");
}

export function canManageOfficeChecklists(role: UserRole): boolean {
  return can(role, "checklists:manage");
}

export function canViewOfficeDocuments(role: UserRole): boolean {
  return can(role, "documents:view");
}

export function canManageOfficeDocuments(role: UserRole): boolean {
  return can(role, "documents:manage");
}

export function canViewOfficeLibrary(role: UserRole): boolean {
  return can(role, "library:view");
}

export function canManageOfficeLibrary(role: UserRole): boolean {
  return can(role, "library:manage");
}

export function canViewOfficeTransactions(role: UserRole): boolean {
  return can(role, "transactions:view");
}

export function canCreateOfficeTransactions(role: UserRole): boolean {
  return can(role, "transactions:create");
}

export function canEditOfficeTransactions(role: UserRole): boolean {
  return can(role, "transactions:edit");
}

export function canManageOfficeTransactionFinance(role: UserRole): boolean {
  return can(role, "transactions:finance");
}

export function canViewOfficeContacts(role: UserRole): boolean {
  return can(role, "contacts:view");
}

export function canCreateOfficeContacts(role: UserRole): boolean {
  return can(role, "contacts:create");
}

export function canEditOfficeContacts(role: UserRole): boolean {
  return can(role, "contacts:edit");
}

export function canLinkOfficeContacts(role: UserRole): boolean {
  return can(role, "contacts:link");
}

export function canApproveOfficeDocuments(role: UserRole): boolean {
  return can(role, "documents:approve");
}

export function canAccessOfficeDocumentApprovals(role: UserRole): boolean {
  return canApproveOfficeDocuments(role) && canReviewOfficeTasks(role);
}

export function canUseOfficeForms(role: UserRole): boolean {
  return can(role, "forms:use");
}

export function canManageOfficeSignatures(role: UserRole): boolean {
  return can(role, "signatures:manage");
}

export function canReviewOfficeIncomingUpdates(role: UserRole): boolean {
  return can(role, "incoming_updates:review");
}

export function canAccessOfficeAccounting(role: UserRole): boolean {
  return can(role, "accounting:view");
}

export function canManageOfficeAccounting(role: UserRole): boolean {
  return can(role, "accounting:manage");
}

export function canViewOfficeAgentBilling(role: UserRole): boolean {
  return can(role, "accounting:billing:view");
}

export function canManageOfficeAgentBilling(role: UserRole): boolean {
  return can(role, "accounting:billing:manage");
}

export function canManageOfficePayments(role: UserRole): boolean {
  return can(role, "accounting:payments:manage");
}

export function canViewOfficeCommissions(role: UserRole): boolean {
  return can(role, "commissions:view");
}

export function canViewOfficeOffers(role: UserRole): boolean {
  return can(role, "offers:view");
}

export function canManageOfficeOffers(role: UserRole): boolean {
  return can(role, "offers:manage");
}

export function canReviewOfficeOffers(role: UserRole): boolean {
  return can(role, "offers:review");
}

export function canAcceptOfficeOffers(role: UserRole): boolean {
  return can(role, "offers:accept");
}

export function canCommentOfficeOffers(role: UserRole): boolean {
  return can(role, "offers:comment");
}

export function canManageOfficeCommissions(role: UserRole): boolean {
  return can(role, "commissions:manage");
}

export function canCalculateOfficeCommissions(role: UserRole): boolean {
  return can(role, "commissions:calculate");
}

export function canApproveOfficeCommissions(role: UserRole): boolean {
  return can(role, "commissions:approve");
}

export function canAccessOfficeTasks(role: UserRole): boolean {
  return can(role, "tasks:view");
}

export function canManageOfficeTasks(role: UserRole): boolean {
  return can(role, "tasks:manage");
}

export function canReviewOfficeTasks(role: UserRole): boolean {
  return can(role, "tasks:review");
}

export function canSecondaryReviewOfficeTasks(role: UserRole): boolean {
  return can(role, "tasks:review:secondary");
}

export function getDefaultAppPath(role: UserRole): string {
  return isOfficeRole(role) ? "/office/dashboard" : "/agent/dashboard";
}

export function summarizeAccess(role: UserRole) {
  const permissions = getPermissionsForRole(role);

  return {
    ...getRoleSummary(role),
    permissionCount: permissions.length,
    permissions
  };
}
