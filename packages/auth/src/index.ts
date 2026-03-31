export type UserRole =
  | "owner"
  | "office_admin"
  | "accountant"
  | "human_resources"
  | "team_lead"
  | "agent"
  | "office_manager"
  | "office_user";

export type PermissionKey =
  | "dashboard:view"
  | "activity:view"
  | "activity:comment"
  | "settings:view"
  | "settings:manage"
  | "users:view"
  | "users:manage"
  | "agents:view"
  | "agents:view:team"
  | "agents:view:company"
  | "agents:manage"
  | "onboarding:view"
  | "onboarding:manage"
  | "goals:view"
  | "goals:manage"
  | "teams:view"
  | "teams:manage"
  | "reports:view:personal"
  | "reports:view:team"
  | "reports:view:company"
  | "transactions:view"
  | "transactions:view:team"
  | "transactions:view:company"
  | "transactions:create"
  | "transactions:edit"
  | "transactions:delete"
  | "transactions:cancel"
  | "transactions:close"
  | "transactions:reopen"
  | "transactions:move"
  | "transactions:share"
  | "transactions:finance"
  | "transactions:checklists:add"
  | "transactions:checklists:remove"
  | "transactions:tasks:manage"
  | "transactions:earnest_money:edit"
  | "contacts:view"
  | "contacts:view:team"
  | "contacts:view:company"
  | "contacts:create"
  | "contacts:edit"
  | "contacts:link"
  | "contacts:private:view"
  | "contacts:private:manage"
  | "documents:view"
  | "documents:manage"
  | "documents:approve"
  | "documents:approve:secondary"
  | "documents:submit:transaction"
  | "documents:submit:individual"
  | "forms:use"
  | "signatures:view"
  | "signatures:manage"
  | "signatures:template_manage"
  | "signatures:report_view"
  | "signatures:report_export"
  | "incoming_updates:review"
  | "library:view"
  | "library:manage"
  | "library:private:view"
  | "accounting:view"
  | "accounting:manage"
  | "accounting:billing:view"
  | "accounting:billing:manage"
  | "accounting:payments:manage"
  | "accounting:recurring_charges:manage"
  | "commissions:view"
  | "commissions:view:team"
  | "commissions:view:company"
  | "commissions:manage"
  | "commissions:calculate"
  | "commissions:approve"
  | "offers:view"
  | "offers:view:company"
  | "offers:create"
  | "offers:edit"
  | "offers:delete"
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
  | "notifications:view"
  | "fields:view"
  | "fields:manage"
  | "checklists:view"
  | "checklists:manage"
  | "integrations:manage"
  | "ai:use";

export type AppPermission = PermissionKey;
export type PermissionGroupKey =
  | "dashboard"
  | "activity"
  | "settings"
  | "users"
  | "agents"
  | "onboarding"
  | "goals"
  | "teams"
  | "reports"
  | "transactions"
  | "contacts"
  | "documents"
  | "library"
  | "accounting"
  | "commissions"
  | "offers"
  | "tasks"
  | "listings"
  | "clients"
  | "events"
  | "resources"
  | "notifications"
  | "fields"
  | "checklists"
  | "integrations"
  | "ai";

export type PermissionScopeBehavior = "base" | "self" | "team" | "company" | "private";

export type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroupKey;
  parentKey?: PermissionKey;
  sortOrder: number;
  scopeBehavior: PermissionScopeBehavior;
  dependsOn?: PermissionKey[];
};

export type PermissionTreeNode = PermissionDefinition & {
  children: PermissionTreeNode[];
};

export type PermissionSubject =
  | UserRole
  | {
      role: UserRole;
      permissions?: readonly PermissionKey[] | null;
    };

export type RoleSummary = {
  role: UserRole;
  label: string;
  description: string;
};

export type AccessSummary = RoleSummary & {
  permissionCount: number;
  permissions: PermissionKey[];
};

const officeRoles: UserRole[] = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_manager",
  "office_user"
];

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

const permissionCatalog: PermissionDefinition[] = [
  {
    key: "dashboard:view",
    label: "Can view dashboard",
    description: "Open the Back Office dashboard.",
    group: "dashboard",
    sortOrder: 10,
    scopeBehavior: "base"
  },
  {
    key: "activity:view",
    label: "Can access account activity",
    description: "View activity log and alerts.",
    group: "activity",
    sortOrder: 20,
    scopeBehavior: "base"
  },
  {
    key: "activity:comment",
    label: "Can comment on activity",
    description: "Post comments into the activity stream.",
    group: "activity",
    parentKey: "activity:view",
    sortOrder: 21,
    scopeBehavior: "base"
  },
  {
    key: "settings:view",
    label: "Can access settings",
    description: "Open the Back Office settings workspace.",
    group: "settings",
    sortOrder: 30,
    scopeBehavior: "base"
  },
  {
    key: "settings:manage",
    label: "Can manage company settings",
    description: "Manage settings pages and shared configuration.",
    group: "settings",
    parentKey: "settings:view",
    sortOrder: 31,
    scopeBehavior: "base"
  },
  {
    key: "users:view",
    label: "Can view users",
    description: "View internal user roster and profiles.",
    group: "users",
    sortOrder: 40,
    scopeBehavior: "company"
  },
  {
    key: "users:manage",
    label: "Can manage users",
    description: "Manage user roles, status, invitations, and permissions.",
    group: "users",
    parentKey: "users:view",
    sortOrder: 41,
    scopeBehavior: "company"
  },
  {
    key: "agents:view",
    label: "Can view agents",
    description: "View agent roster and profiles.",
    group: "agents",
    sortOrder: 50,
    scopeBehavior: "self"
  },
  {
    key: "agents:view:team",
    label: "Can see subordinate agents",
    description: "View agents in the current team hierarchy.",
    group: "agents",
    parentKey: "agents:view",
    sortOrder: 51,
    scopeBehavior: "team"
  },
  {
    key: "agents:view:company",
    label: "Can access all company agents",
    description: "View agent records across the organization.",
    group: "agents",
    parentKey: "agents:view",
    sortOrder: 52,
    scopeBehavior: "company"
  },
  {
    key: "agents:manage",
    label: "Can manage agents",
    description: "Manage agent profiles and operational setup.",
    group: "agents",
    parentKey: "agents:view",
    sortOrder: 53,
    scopeBehavior: "company"
  },
  {
    key: "onboarding:view",
    label: "Can view onboarding",
    description: "View agent onboarding items and templates.",
    group: "onboarding",
    sortOrder: 60,
    scopeBehavior: "company"
  },
  {
    key: "onboarding:manage",
    label: "Can manage onboarding",
    description: "Assign and update agent onboarding workflows.",
    group: "onboarding",
    parentKey: "onboarding:view",
    sortOrder: 61,
    scopeBehavior: "company"
  },
  {
    key: "goals:view",
    label: "Can view goals",
    description: "View agent goals and progress.",
    group: "goals",
    sortOrder: 70,
    scopeBehavior: "company"
  },
  {
    key: "goals:manage",
    label: "Can manage goals",
    description: "Create and update agent goals.",
    group: "goals",
    parentKey: "goals:view",
    sortOrder: 71,
    scopeBehavior: "company"
  },
  {
    key: "teams:view",
    label: "Can view teams",
    description: "View team structure and memberships.",
    group: "teams",
    sortOrder: 80,
    scopeBehavior: "company"
  },
  {
    key: "teams:manage",
    label: "Can manage teams",
    description: "Create and update teams and memberships.",
    group: "teams",
    parentKey: "teams:view",
    sortOrder: 81,
    scopeBehavior: "company"
  },
  {
    key: "reports:view:personal",
    label: "Can access personal reports",
    description: "View personal production and reporting.",
    group: "reports",
    sortOrder: 90,
    scopeBehavior: "self"
  },
  {
    key: "reports:view:team",
    label: "Can access team reports",
    description: "View subordinate team performance and reporting.",
    group: "reports",
    parentKey: "reports:view:personal",
    sortOrder: 91,
    scopeBehavior: "team"
  },
  {
    key: "reports:view:company",
    label: "Can access company reports",
    description: "View organization-wide reports and financial performance.",
    group: "reports",
    parentKey: "reports:view:personal",
    sortOrder: 92,
    scopeBehavior: "company"
  },
  {
    key: "transactions:view",
    label: "Can access transactions",
    description: "Open the transaction workspace.",
    group: "transactions",
    sortOrder: 100,
    scopeBehavior: "self"
  },
  {
    key: "transactions:view:team",
    label: "Can see team pipeline",
    description: "View transactions for the current subordinate hierarchy.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 101,
    scopeBehavior: "team"
  },
  {
    key: "transactions:view:company",
    label: "Can access all company transactions",
    description: "View all transactions in the organization.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 102,
    scopeBehavior: "company"
  },
  {
    key: "transactions:create",
    label: "Can create transactions",
    description: "Create new transactions.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 103,
    scopeBehavior: "self"
  },
  {
    key: "transactions:edit",
    label: "Can edit transactions",
    description: "Edit transaction intake and operational details.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 104,
    scopeBehavior: "self"
  },
  {
    key: "transactions:delete",
    label: "Can delete transactions",
    description: "Delete transactions from the workspace.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 105,
    scopeBehavior: "company"
  },
  {
    key: "transactions:cancel",
    label: "Can cancel transactions",
    description: "Cancel transactions in workflow.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 106,
    scopeBehavior: "self"
  },
  {
    key: "transactions:close",
    label: "Can close transactions",
    description: "Mark transactions as closed.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 107,
    scopeBehavior: "self"
  },
  {
    key: "transactions:reopen",
    label: "Can re-open transactions",
    description: "Re-open previously closed or cancelled transactions.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 108,
    scopeBehavior: "self"
  },
  {
    key: "transactions:move",
    label: "Can move transactions",
    description: "Move transaction ownership or routing.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 109,
    scopeBehavior: "company"
  },
  {
    key: "transactions:share",
    label: "Can share transactions",
    description: "Share transactions with other memberships or teams.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 110,
    scopeBehavior: "company"
  },
  {
    key: "transactions:finance",
    label: "Can edit transaction finance",
    description: "Edit gross, referral, office net, and agent net values.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 111,
    scopeBehavior: "company"
  },
  {
    key: "transactions:checklists:add",
    label: "Can add checklists to transactions",
    description: "Attach checklist templates to transactions.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 112,
    scopeBehavior: "self"
  },
  {
    key: "transactions:checklists:remove",
    label: "Can remove checklists from transactions",
    description: "Remove checklist templates from transactions.",
    group: "transactions",
    parentKey: "transactions:checklists:add",
    sortOrder: 113,
    scopeBehavior: "self"
  },
  {
    key: "transactions:tasks:manage",
    label: "Can manage transaction checklist tasks",
    description: "Create and manage checklist task rows within transactions.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 114,
    scopeBehavior: "self"
  },
  {
    key: "transactions:earnest_money:edit",
    label: "Can edit earnest money deposit",
    description: "Manage earnest money records tied to transactions.",
    group: "transactions",
    parentKey: "transactions:view",
    sortOrder: 115,
    scopeBehavior: "company"
  },
  {
    key: "contacts:view",
    label: "Can access contacts",
    description: "Open the contacts workspace.",
    group: "contacts",
    sortOrder: 120,
    scopeBehavior: "self"
  },
  {
    key: "contacts:view:team",
    label: "Can access team contacts",
    description: "View contacts for the current team hierarchy.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 121,
    scopeBehavior: "team"
  },
  {
    key: "contacts:view:company",
    label: "Can access company contacts",
    description: "View contacts across the organization.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 122,
    scopeBehavior: "company"
  },
  {
    key: "contacts:create",
    label: "Can create contacts",
    description: "Create new contacts.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 123,
    scopeBehavior: "self"
  },
  {
    key: "contacts:edit",
    label: "Can edit contacts",
    description: "Update contact details.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 124,
    scopeBehavior: "self"
  },
  {
    key: "contacts:link",
    label: "Can link contacts",
    description: "Link contacts to transactions.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 125,
    scopeBehavior: "self"
  },
  {
    key: "contacts:private:view",
    label: "Can access private contacts",
    description: "View private contacts owned by other users when allowed.",
    group: "contacts",
    parentKey: "contacts:view",
    sortOrder: 126,
    scopeBehavior: "private"
  },
  {
    key: "contacts:private:manage",
    label: "Can manage private contacts",
    description: "Create or edit private contacts across the organization.",
    group: "contacts",
    parentKey: "contacts:private:view",
    sortOrder: 127,
    scopeBehavior: "private"
  },
  {
    key: "documents:view",
    label: "Can access documents",
    description: "View transaction documents and related assets.",
    group: "documents",
    sortOrder: 130,
    scopeBehavior: "self"
  },
  {
    key: "documents:manage",
    label: "Can manage documents",
    description: "Upload and update transaction documents.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 131,
    scopeBehavior: "self"
  },
  {
    key: "documents:approve",
    label: "Can approve documents",
    description: "Approve documents in the review queue.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 132,
    scopeBehavior: "company"
  },
  {
    key: "documents:approve:secondary",
    label: "Can second level approve documents",
    description: "Perform secondary approval for documents when required.",
    group: "documents",
    parentKey: "documents:approve",
    sortOrder: 133,
    scopeBehavior: "company"
  },
  {
    key: "documents:submit:transaction",
    label: "Can submit transactions for approval",
    description: "Submit transaction document packages for approval.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 134,
    scopeBehavior: "self"
  },
  {
    key: "documents:submit:individual",
    label: "Can submit individual documents",
    description: "Submit individual documents into approval workflow.",
    group: "documents",
    parentKey: "documents:submit:transaction",
    sortOrder: 135,
    scopeBehavior: "self"
  },
  {
    key: "forms:use",
    label: "Can use forms",
    description: "Prepare and send transaction forms.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 136,
    scopeBehavior: "self"
  },
  {
    key: "signatures:view",
    label: "Can view signatures",
    description: "Open the signature center and view signature requests that are in scope.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 137,
    scopeBehavior: "self"
  },
  {
    key: "signatures:manage",
    label: "Can manage signatures",
    description: "Create, send, resend, and update signature requests.",
    group: "documents",
    parentKey: "signatures:view",
    sortOrder: 138,
    scopeBehavior: "self"
  },
  {
    key: "signatures:template_manage",
    label: "Can manage signature templates",
    description: "Create, edit, activate, and deactivate reusable signature templates.",
    group: "documents",
    parentKey: "signatures:view",
    sortOrder: 139,
    scopeBehavior: "company"
  },
  {
    key: "signatures:report_view",
    label: "Can view signature reports",
    description: "View signature center reporting and status summaries.",
    group: "documents",
    parentKey: "signatures:view",
    sortOrder: 140,
    scopeBehavior: "company"
  },
  {
    key: "signatures:report_export",
    label: "Can export signature reports",
    description: "Export signature center reports to CSV.",
    group: "documents",
    parentKey: "signatures:report_view",
    sortOrder: 141,
    scopeBehavior: "company"
  },
  {
    key: "incoming_updates:review",
    label: "Can review incoming updates",
    description: "Review incoming updates and synced content.",
    group: "documents",
    parentKey: "documents:view",
    sortOrder: 142,
    scopeBehavior: "company"
  },
  {
    key: "library:view",
    label: "Can access library",
    description: "View library folders and documents.",
    group: "library",
    sortOrder: 140,
    scopeBehavior: "base"
  },
  {
    key: "library:manage",
    label: "Can manage library",
    description: "Create and update library folders and documents.",
    group: "library",
    parentKey: "library:view",
    sortOrder: 141,
    scopeBehavior: "company"
  },
  {
    key: "library:private:view",
    label: "Can access all private folders",
    description: "View private library folders and documents beyond the current owner.",
    group: "library",
    parentKey: "library:view",
    sortOrder: 142,
    scopeBehavior: "private"
  },
  {
    key: "accounting:view",
    label: "Can access accounting",
    description: "Open accounting and financial workspaces.",
    group: "accounting",
    sortOrder: 150,
    scopeBehavior: "company"
  },
  {
    key: "accounting:manage",
    label: "Can manage accounting",
    description: "Create and update accounting transactions.",
    group: "accounting",
    parentKey: "accounting:view",
    sortOrder: 151,
    scopeBehavior: "company"
  },
  {
    key: "accounting:billing:view",
    label: "Can view agent billing",
    description: "View agent billing and payment methods.",
    group: "accounting",
    sortOrder: 152,
    scopeBehavior: "company"
  },
  {
    key: "accounting:billing:manage",
    label: "Can manage agent billing",
    description: "Manage agent billing charges and recurring rules.",
    group: "accounting",
    parentKey: "accounting:billing:view",
    sortOrder: 153,
    scopeBehavior: "company"
  },
  {
    key: "accounting:payments:manage",
    label: "Can manage payments",
    description: "Apply credits and record payments.",
    group: "accounting",
    parentKey: "accounting:view",
    sortOrder: 154,
    scopeBehavior: "company"
  },
  {
    key: "accounting:recurring_charges:manage",
    label: "Can manage recurring charges",
    description: "Manage organization recurring charge rules.",
    group: "accounting",
    parentKey: "accounting:billing:view",
    sortOrder: 155,
    scopeBehavior: "company"
  },
  {
    key: "commissions:view",
    label: "Can view transaction commissions",
    description: "View transaction commission records.",
    group: "commissions",
    sortOrder: 160,
    scopeBehavior: "self"
  },
  {
    key: "commissions:view:team",
    label: "Can view team commissions",
    description: "View team-scope commission records.",
    group: "commissions",
    parentKey: "commissions:view",
    sortOrder: 161,
    scopeBehavior: "team"
  },
  {
    key: "commissions:view:company",
    label: "Can view all transaction commissions",
    description: "View commission records across the organization.",
    group: "commissions",
    parentKey: "commissions:view",
    sortOrder: 162,
    scopeBehavior: "company"
  },
  {
    key: "commissions:manage",
    label: "Can manage commissions",
    description: "Manage commission plans and assignments.",
    group: "commissions",
    parentKey: "commissions:view",
    sortOrder: 163,
    scopeBehavior: "company"
  },
  {
    key: "commissions:calculate",
    label: "Can calculate commissions",
    description: "Run commission calculation and recalculation.",
    group: "commissions",
    parentKey: "commissions:view",
    sortOrder: 164,
    scopeBehavior: "company"
  },
  {
    key: "commissions:approve",
    label: "Can approve commissions",
    description: "Advance commission statements and payout readiness.",
    group: "commissions",
    parentKey: "commissions:view",
    sortOrder: 165,
    scopeBehavior: "company"
  },
  {
    key: "offers:view",
    label: "Can access buyer offers",
    description: "View offers on transactions.",
    group: "offers",
    sortOrder: 170,
    scopeBehavior: "self"
  },
  {
    key: "offers:view:company",
    label: "Can access all company buyer offers",
    description: "View offers organization-wide.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 171,
    scopeBehavior: "company"
  },
  {
    key: "offers:create",
    label: "Can create buyer offers",
    description: "Create offers within transactions.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 172,
    scopeBehavior: "self"
  },
  {
    key: "offers:edit",
    label: "Can edit buyer offers",
    description: "Edit existing offers.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 173,
    scopeBehavior: "self"
  },
  {
    key: "offers:delete",
    label: "Can delete buyer offers",
    description: "Delete offers from transactions.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 174,
    scopeBehavior: "self"
  },
  {
    key: "offers:review",
    label: "Can review buyer offers",
    description: "Review submitted offers in workflow.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 175,
    scopeBehavior: "company"
  },
  {
    key: "offers:accept",
    label: "Can accept buyer offers",
    description: "Accept offers as part of review workflow.",
    group: "offers",
    parentKey: "offers:review",
    sortOrder: 176,
    scopeBehavior: "company"
  },
  {
    key: "offers:comment",
    label: "Can comment on buyer offers",
    description: "Comment on offers and offer workflow.",
    group: "offers",
    parentKey: "offers:view",
    sortOrder: 177,
    scopeBehavior: "self"
  },
  {
    key: "tasks:view",
    label: "Can access tasks",
    description: "View task lists and workflow status.",
    group: "tasks",
    sortOrder: 180,
    scopeBehavior: "self"
  },
  {
    key: "tasks:manage",
    label: "Can manage tasks",
    description: "Create and update tasks.",
    group: "tasks",
    parentKey: "tasks:view",
    sortOrder: 181,
    scopeBehavior: "self"
  },
  {
    key: "tasks:review",
    label: "Can review tasks",
    description: "Review task workflow and approvals.",
    group: "tasks",
    parentKey: "tasks:view",
    sortOrder: 182,
    scopeBehavior: "company"
  },
  {
    key: "tasks:review:secondary",
    label: "Can second level review tasks",
    description: "Perform secondary review for tasks when required.",
    group: "tasks",
    parentKey: "tasks:review",
    sortOrder: 183,
    scopeBehavior: "company"
  },
  {
    key: "listings:view",
    label: "Can view listings",
    description: "View listings workspace.",
    group: "listings",
    sortOrder: 190,
    scopeBehavior: "company"
  },
  {
    key: "listings:manage",
    label: "Can manage listings",
    description: "Manage listing records.",
    group: "listings",
    parentKey: "listings:view",
    sortOrder: 191,
    scopeBehavior: "company"
  },
  {
    key: "listings:publish",
    label: "Can publish listings",
    description: "Publish listings into distribution channels.",
    group: "listings",
    parentKey: "listings:manage",
    sortOrder: 192,
    scopeBehavior: "company"
  },
  {
    key: "clients:view",
    label: "Can view clients",
    description: "View client records.",
    group: "clients",
    sortOrder: 200,
    scopeBehavior: "company"
  },
  {
    key: "clients:manage",
    label: "Can manage clients",
    description: "Manage client records.",
    group: "clients",
    parentKey: "clients:view",
    sortOrder: 201,
    scopeBehavior: "company"
  },
  {
    key: "events:view",
    label: "Can view events",
    description: "View office events and RSVPs.",
    group: "events",
    sortOrder: 210,
    scopeBehavior: "company"
  },
  {
    key: "events:manage",
    label: "Can manage events",
    description: "Create and manage office events.",
    group: "events",
    parentKey: "events:view",
    sortOrder: 211,
    scopeBehavior: "company"
  },
  {
    key: "resources:view",
    label: "Can view resources",
    description: "View resources and playbooks.",
    group: "resources",
    sortOrder: 220,
    scopeBehavior: "company"
  },
  {
    key: "resources:manage",
    label: "Can manage resources",
    description: "Manage resources and playbooks.",
    group: "resources",
    parentKey: "resources:view",
    sortOrder: 221,
    scopeBehavior: "company"
  },
  {
    key: "notifications:view",
    label: "Can access notifications",
    description: "View the notification inbox.",
    group: "notifications",
    sortOrder: 230,
    scopeBehavior: "base"
  },
  {
    key: "fields:view",
    label: "Can view field settings",
    description: "View required roles and transaction field settings.",
    group: "fields",
    sortOrder: 240,
    scopeBehavior: "company"
  },
  {
    key: "fields:manage",
    label: "Can manage field settings",
    description: "Manage required roles and transaction field settings.",
    group: "fields",
    parentKey: "fields:view",
    sortOrder: 241,
    scopeBehavior: "company"
  },
  {
    key: "checklists:view",
    label: "Can view checklist templates",
    description: "View checklist templates.",
    group: "checklists",
    sortOrder: 250,
    scopeBehavior: "company"
  },
  {
    key: "checklists:manage",
    label: "Can manage checklist templates",
    description: "Manage checklist templates.",
    group: "checklists",
    parentKey: "checklists:view",
    sortOrder: 251,
    scopeBehavior: "company"
  },
  {
    key: "integrations:manage",
    label: "Can manage integrations",
    description: "Manage external integrations and configuration.",
    group: "integrations",
    sortOrder: 260,
    scopeBehavior: "company"
  },
  {
    key: "ai:use",
    label: "Can use AI tools",
    description: "Access AI-assisted capabilities in the workspace.",
    group: "ai",
    sortOrder: 270,
    scopeBehavior: "base"
  }
];

const permissionDefinitionMap = new Map<PermissionKey, PermissionDefinition>(
  permissionCatalog.map((definition) => [definition.key, definition])
);

const systemRoleTemplatePermissions: Record<UserRole, PermissionKey[]> = {
  owner: permissionCatalog.map((definition) => definition.key),
  office_admin: permissionCatalog
    .filter((definition) => definition.key !== "documents:approve:secondary")
    .map((definition) => definition.key),
  accountant: [
    "dashboard:view",
    "settings:view",
    "users:view",
    "users:manage",
    "agents:view",
    "agents:view:company",
    "teams:view",
    "reports:view:personal",
    "reports:view:company",
    "transactions:view",
    "transactions:view:company",
    "contacts:view",
    "contacts:view:company",
    "documents:view",
    "signatures:view",
    "signatures:manage",
    "signatures:report_view",
    "signatures:report_export",
    "library:view",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "accounting:recurring_charges:manage",
    "commissions:view",
    "commissions:view:company",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "offers:view:company",
    "tasks:view",
    "notifications:view",
    "ai:use"
  ],
  human_resources: [
    "dashboard:view",
    "settings:view",
    "users:view",
    "users:manage",
    "agents:view",
    "agents:view:company",
    "teams:view",
    "reports:view:personal",
    "reports:view:company",
    "transactions:view",
    "transactions:view:company",
    "contacts:view",
    "contacts:view:company",
    "documents:view",
    "signatures:view",
    "signatures:manage",
    "signatures:report_view",
    "signatures:report_export",
    "library:view",
    "accounting:view",
    "accounting:billing:view",
    "commissions:view",
    "commissions:view:company",
    "offers:view",
    "offers:view:company",
    "tasks:view",
    "notifications:view",
    "ai:use"
  ],
  team_lead: [
    "dashboard:view",
    "agents:view",
    "agents:view:team",
    "reports:view:personal",
    "reports:view:team",
    "transactions:view",
    "transactions:view:team",
    "transactions:create",
    "transactions:edit",
    "contacts:view",
    "contacts:view:team",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "signatures:view",
    "offers:view",
    "tasks:view",
    "accounting:billing:view",
    "commissions:view",
    "commissions:view:team",
    "notifications:view",
    "ai:use"
  ],
  agent: [
    "dashboard:view",
    "agents:view",
    "reports:view:personal",
    "transactions:view",
    "transactions:create",
    "transactions:edit",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "signatures:view",
    "offers:view",
    "tasks:view",
    "accounting:billing:view",
    "commissions:view",
    "notifications:view",
    "ai:use"
  ],
  office_manager: [
    "dashboard:view",
    "activity:view",
    "activity:comment",
    "settings:view",
    "agents:view",
    "agents:view:company",
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
    "transactions:view:company",
    "transactions:create",
    "transactions:edit",
    "transactions:finance",
    "contacts:view",
    "contacts:view:company",
    "contacts:create",
    "contacts:edit",
    "contacts:link",
    "documents:view",
    "documents:manage",
    "documents:approve",
    "forms:use",
    "signatures:view",
    "signatures:manage",
    "signatures:template_manage",
    "signatures:report_view",
    "signatures:report_export",
    "incoming_updates:review",
    "accounting:view",
    "accounting:manage",
    "accounting:billing:view",
    "accounting:billing:manage",
    "accounting:payments:manage",
    "accounting:recurring_charges:manage",
    "commissions:view",
    "commissions:view:company",
    "commissions:manage",
    "commissions:calculate",
    "commissions:approve",
    "offers:view",
    "offers:view:company",
    "offers:create",
    "offers:edit",
    "offers:delete",
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
    "notifications:view",
    "fields:view",
    "fields:manage",
    "checklists:view",
    "checklists:manage",
    "reports:view:personal",
    "reports:view:company",
    "ai:use"
  ],
  office_user: [
    "dashboard:view",
    "activity:view",
    "library:view",
    "transactions:view",
    "transactions:view:company",
    "contacts:view",
    "contacts:view:company",
    "documents:view",
    "signatures:view",
    "offers:view",
    "offers:view:company",
    "tasks:view",
    "accounting:view",
    "accounting:billing:view",
    "notifications:view",
    "ai:use"
  ]
};

const requiredRoleBaselinePermissions: Partial<Record<UserRole, PermissionKey[]>> = {
  agent: ["commissions:view"],
  team_lead: ["commissions:view", "commissions:view:team"]
};

function applyRequiredRoleBaselinePermissions(role: UserRole, permissions: readonly PermissionKey[]) {
  return prunePermissionsByDependencies([...(permissions ?? []), ...(requiredRoleBaselinePermissions[role] ?? [])]);
}

function getSubjectRole(subject: PermissionSubject): UserRole {
  return typeof subject === "string" ? subject : subject.role;
}

function isPermissionKey(value: string): value is PermissionKey {
  return permissionDefinitionMap.has(value as PermissionKey);
}

function dedupePermissions(permissions: readonly PermissionKey[]) {
  return [...new Set(permissions)];
}

function getPermissionDependencies(key: PermissionKey) {
  const definition = permissionDefinitionMap.get(key);

  if (!definition) {
    return [];
  }

  return [...new Set([...(definition.parentKey ? [definition.parentKey] : []), ...(definition.dependsOn ?? [])])];
}

function prunePermissionsByDependencies(permissions: readonly PermissionKey[]) {
  const resolved = new Set(dedupePermissions(permissions));
  let mutated = true;

  while (mutated) {
    mutated = false;

    for (const key of [...resolved]) {
      const dependencies = getPermissionDependencies(key);
      if (dependencies.some((dependency) => !resolved.has(dependency))) {
        resolved.delete(key);
        mutated = true;
      }
    }
  }

  return sortPermissions([...resolved]);
}

function sortPermissions(permissions: readonly PermissionKey[]) {
  return [...permissions].sort((left, right) => {
    const leftOrder = permissionDefinitionMap.get(left)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = permissionDefinitionMap.get(right)?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
}

function sanitizePermissions(permissions: readonly string[]) {
  return prunePermissionsByDependencies(permissions.filter(isPermissionKey));
}

export function getPermissionCatalog(): PermissionDefinition[] {
  return permissionCatalog.map((definition) => ({ ...definition }));
}

export function getPermissionDefinition(permission: PermissionKey): PermissionDefinition {
  const definition = permissionDefinitionMap.get(permission);

  if (!definition) {
    throw new Error(`Unknown permission key: ${permission}`);
  }

  return { ...definition };
}

export function getPermissionTree(): PermissionTreeNode[] {
  const childrenByParent = new Map<PermissionKey, PermissionDefinition[]>();
  const roots: PermissionDefinition[] = [];

  for (const definition of permissionCatalog) {
    if (definition.parentKey) {
      const siblings = childrenByParent.get(definition.parentKey) ?? [];
      siblings.push(definition);
      childrenByParent.set(definition.parentKey, siblings);
      continue;
    }

    roots.push(definition);
  }

  const buildNode = (definition: PermissionDefinition): PermissionTreeNode => ({
    ...definition,
    children: (childrenByParent.get(definition.key) ?? [])
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
      .map((child) => buildNode(child))
  });

  return roots.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)).map((root) => buildNode(root));
}

export function getRoleSummary(subject: PermissionSubject): RoleSummary {
  return roleSummaries[getSubjectRole(subject)];
}

export function getPermissionsForRole(role: UserRole): PermissionKey[] {
  return applyRequiredRoleBaselinePermissions(role, systemRoleTemplatePermissions[role] ?? []);
}

export function getSystemRoleTemplatePermissions(role: UserRole): PermissionKey[] {
  return getPermissionsForRole(role);
}

export function resolveEffectivePermissions(subject: PermissionSubject): PermissionKey[] {
  if (typeof subject === "string") {
    return getPermissionsForRole(subject);
  }

  if (!subject.permissions) {
    return getPermissionsForRole(subject.role);
  }

  return applyRequiredRoleBaselinePermissions(subject.role, sanitizePermissions(subject.permissions));
}

export function can(subject: PermissionSubject, permission: PermissionKey): boolean {
  return resolveEffectivePermissions(subject).includes(permission);
}

export function hasPermission(subject: PermissionSubject, permission: PermissionKey): boolean {
  return can(subject, permission);
}

export function hasAnyPermission(subject: PermissionSubject, permissions: readonly PermissionKey[]): boolean {
  const resolved = new Set(resolveEffectivePermissions(subject));
  return permissions.some((permission) => resolved.has(permission));
}

export function isOfficeRole(subject: PermissionSubject): boolean {
  return officeRoles.includes(getSubjectRole(subject));
}

export function canViewOfficeReports(subject: PermissionSubject): boolean {
  return hasAnyPermission(subject, ["reports:view:personal", "reports:view:team", "reports:view:company"]);
}

export function canAccessAccountActivity(subject: PermissionSubject): boolean {
  return can(subject, "activity:view");
}

export function canCommentOfficeActivity(subject: PermissionSubject): boolean {
  return can(subject, "activity:comment");
}

export function canAccessOfficeNotifications(subject: PermissionSubject): boolean {
  return can(subject, "notifications:view");
}

export function canAccessOfficeSettings(subject: PermissionSubject): boolean {
  return can(subject, "settings:view");
}

export function canManageOfficeSettings(subject: PermissionSubject): boolean {
  return can(subject, "settings:manage");
}

export function canViewOfficeAgents(subject: PermissionSubject): boolean {
  return can(subject, "agents:view");
}

export function canManageOfficeAgents(subject: PermissionSubject): boolean {
  return can(subject, "agents:manage");
}

export function canViewOfficeOnboarding(subject: PermissionSubject): boolean {
  return can(subject, "onboarding:view");
}

export function canManageOfficeOnboarding(subject: PermissionSubject): boolean {
  return can(subject, "onboarding:manage");
}

export function canViewOfficeGoals(subject: PermissionSubject): boolean {
  return can(subject, "goals:view");
}

export function canManageOfficeGoals(subject: PermissionSubject): boolean {
  return can(subject, "goals:manage");
}

export function canViewOfficeTeams(subject: PermissionSubject): boolean {
  return can(subject, "teams:view");
}

export function canManageOfficeTeams(subject: PermissionSubject): boolean {
  return can(subject, "teams:manage");
}

export function canViewOfficeUsers(subject: PermissionSubject): boolean {
  return can(subject, "users:view");
}

export function canManageOfficeUsers(subject: PermissionSubject): boolean {
  return can(subject, "users:manage");
}

export function canViewOfficeFields(subject: PermissionSubject): boolean {
  return can(subject, "fields:view");
}

export function canManageOfficeFields(subject: PermissionSubject): boolean {
  return can(subject, "fields:manage");
}

export function canViewOfficeChecklists(subject: PermissionSubject): boolean {
  return can(subject, "checklists:view");
}

export function canManageOfficeChecklists(subject: PermissionSubject): boolean {
  return can(subject, "checklists:manage");
}

export function canViewOfficeDocuments(subject: PermissionSubject): boolean {
  return can(subject, "documents:view");
}

export function canManageOfficeDocuments(subject: PermissionSubject): boolean {
  return can(subject, "documents:manage");
}

export function canViewOfficeLibrary(subject: PermissionSubject): boolean {
  return can(subject, "library:view");
}

export function canManageOfficeLibrary(subject: PermissionSubject): boolean {
  return can(subject, "library:manage");
}

export function canViewOfficeTransactions(subject: PermissionSubject): boolean {
  return can(subject, "transactions:view");
}

export function canCreateOfficeTransactions(subject: PermissionSubject): boolean {
  return can(subject, "transactions:create");
}

export function canEditOfficeTransactions(subject: PermissionSubject): boolean {
  return can(subject, "transactions:edit");
}

export function canManageOfficeTransactionStatus(subject: PermissionSubject): boolean {
  const role = getSubjectRole(subject);

  return (role === "owner" || role === "office_admin") && canEditOfficeTransactions(subject);
}

export function canManageOfficeTransactionFinance(subject: PermissionSubject): boolean {
  return can(subject, "transactions:finance");
}

export function canViewOfficeContacts(subject: PermissionSubject): boolean {
  return can(subject, "contacts:view");
}

export function canCreateOfficeContacts(subject: PermissionSubject): boolean {
  return can(subject, "contacts:create");
}

export function canEditOfficeContacts(subject: PermissionSubject): boolean {
  return can(subject, "contacts:edit");
}

export function canLinkOfficeContacts(subject: PermissionSubject): boolean {
  return can(subject, "contacts:link");
}

export function canApproveOfficeDocuments(subject: PermissionSubject): boolean {
  return can(subject, "documents:approve");
}

export function canAccessOfficeDocumentApprovals(subject: PermissionSubject): boolean {
  return canApproveOfficeDocuments(subject) && canReviewOfficeTasks(subject);
}

export function canUseOfficeForms(subject: PermissionSubject): boolean {
  return can(subject, "forms:use");
}

export function canViewOfficeSignatures(subject: PermissionSubject): boolean {
  return can(subject, "signatures:view") || can(subject, "signatures:manage");
}

export function canManageOfficeSignatures(subject: PermissionSubject): boolean {
  return can(subject, "signatures:manage");
}

export function canManageOfficeSignatureTemplates(subject: PermissionSubject): boolean {
  return can(subject, "signatures:template_manage");
}

export function canViewOfficeSignatureReports(subject: PermissionSubject): boolean {
  return can(subject, "signatures:report_view") || canManageOfficeSignatures(subject);
}

export function canExportOfficeSignatureReports(subject: PermissionSubject): boolean {
  return can(subject, "signatures:report_export");
}

export function canReviewOfficeIncomingUpdates(subject: PermissionSubject): boolean {
  return can(subject, "incoming_updates:review");
}

export function canAccessOfficeAccounting(subject: PermissionSubject): boolean {
  return can(subject, "accounting:view");
}

export function canAccessOfficeAdminAccountingWorkspace(subject: PermissionSubject): boolean {
  return getSubjectRole(subject) === "office_admin";
}

export function canAccessOffice1099Tracker(subject: PermissionSubject): boolean {
  return getSubjectRole(subject) === "office_admin";
}

export function canManageOfficeAccounting(subject: PermissionSubject): boolean {
  return can(subject, "accounting:manage");
}

export function canViewOfficeAgentBilling(subject: PermissionSubject): boolean {
  return can(subject, "accounting:billing:view");
}

export function canManageOfficeAgentBilling(subject: PermissionSubject): boolean {
  return can(subject, "accounting:billing:manage");
}

export function canManageOfficePayments(subject: PermissionSubject): boolean {
  return can(subject, "accounting:payments:manage");
}

export function canViewOfficeCommissions(subject: PermissionSubject): boolean {
  return can(subject, "commissions:view");
}

export function canViewOfficeCommissionSelfServiceSummary(subject: PermissionSubject): boolean {
  return can(subject, "dashboard:view");
}

export function canViewOfficeOffers(subject: PermissionSubject): boolean {
  return can(subject, "offers:view");
}

export function canManageOfficeOffers(subject: PermissionSubject): boolean {
  return hasAnyPermission(subject, ["offers:create", "offers:edit", "offers:delete"]);
}

export function canReviewOfficeOffers(subject: PermissionSubject): boolean {
  return can(subject, "offers:review");
}

export function canAcceptOfficeOffers(subject: PermissionSubject): boolean {
  return can(subject, "offers:accept");
}

export function canCommentOfficeOffers(subject: PermissionSubject): boolean {
  return can(subject, "offers:comment");
}

export function canManageOfficeCommissions(subject: PermissionSubject): boolean {
  return can(subject, "commissions:manage");
}

export function canCalculateOfficeCommissions(subject: PermissionSubject): boolean {
  return can(subject, "commissions:calculate");
}

export function canApproveOfficeCommissions(subject: PermissionSubject): boolean {
  return can(subject, "commissions:approve");
}

export function canManageOfficeCommissionOverrideParticipants(subject: PermissionSubject): boolean {
  const resolved = typeof subject === "string" ? subject : subject.role;
  return resolved === "office_admin";
}

export function canAccessOfficeCommissionWorkspace(subject: PermissionSubject): boolean {
  return (
    canAccessOfficeSettings(subject) ||
    canManageOfficeCommissions(subject) ||
    canCalculateOfficeCommissions(subject) ||
    canApproveOfficeCommissions(subject)
  );
}

export function canAccessOfficeTasks(subject: PermissionSubject): boolean {
  return can(subject, "tasks:view");
}

export function canManageOfficeTasks(subject: PermissionSubject): boolean {
  return can(subject, "tasks:manage");
}

export function canReviewOfficeTasks(subject: PermissionSubject): boolean {
  return can(subject, "tasks:review");
}

export function canSecondaryReviewOfficeTasks(subject: PermissionSubject): boolean {
  return hasAnyPermission(subject, ["tasks:review:secondary", "documents:approve:secondary"]);
}

export function getDefaultAppPath(subject: PermissionSubject): string {
  return isOfficeRole(subject) ? "/office/dashboard" : "/agent/dashboard";
}

export function summarizeAccess(subject: PermissionSubject): AccessSummary {
  const permissions = resolveEffectivePermissions(subject);
  const summary = getRoleSummary(subject);

  return {
    ...summary,
    permissionCount: permissions.length,
    permissions
  };
}
