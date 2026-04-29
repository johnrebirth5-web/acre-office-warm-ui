export type AdminGptFeatureStatus =
  | "available"
  | "partial"
  | "not_available";

export type AdminGptFeatureCatalogEntry = {
  id: string;
  title: string;
  route: string | null;
  status: AdminGptFeatureStatus;
  audience: string;
  summary: string;
  howToUse: string[];
  requiredAccess: string;
  limitations: string[];
  bugSignals: string[];
  keywords: string[];
};

export const ADMIN_GPT_SCOPE_BOUNDARY = [
  "Answer only Acre website usage, administrator training, feature availability, workflow troubleshooting, and bug-triage questions.",
  "Do not provide code changes, database changes, destructive operations, deployment steps, credential handling, or unrelated conversation.",
  "When a feature is not available or the evidence is unclear, tell the administrator to contact the system programmer with page, steps, expected result, actual result, error text, and screenshot summary.",
].join(" ");

export const ADMIN_GPT_FEATURE_CATALOG: AdminGptFeatureCatalogEntry[] = [
  {
    id: "dashboard",
    title: "Back Office Dashboard",
    route: "/office/dashboard",
    status: "available",
    audience: "Back Office users",
    summary:
      "Operational landing page for current pressure, recent transactions, reminders, and quick entry into core Back Office work.",
    howToUse: [
      "Open Back Office, then choose Dashboard from the Overview group.",
      "Use summary cards and queues to decide which transaction, payout, task, or overdue item needs attention first.",
    ],
    requiredAccess: "Office role with dashboard access.",
    limitations: [
      "The dashboard is an MVP and does not replace detailed reports or accounting review.",
    ],
    bugSignals: [
      "A queue is empty when the matching detail page shows active work.",
      "A dashboard link opens the wrong module or a permission error for an admin.",
    ],
    keywords: ["dashboard", "home", "overview", "仪表盘", "首页", "总览"],
  },
  {
    id: "transactions",
    title: "Transactions",
    route: "/office/transactions",
    status: "available",
    audience: "Back Office transaction operators and admins",
    summary:
      "The main transaction list, search workspace, transaction creation entry, and transaction detail hub.",
    howToUse: [
      "To create or 登单 a transaction, open /office/transactions and use New transaction, or go directly to /office/transactions/new.",
      "Fill the configured transaction fields such as agent, type, status, client/contact context, address, dates, pricing, and finance fields that your office has marked visible or required.",
      "Open a transaction detail page to manage contacts, documents, forms, offers, tasks, commissions, and status.",
    ],
    requiredAccess:
      "transactions:view to open the list; transactions:create to create; transactions:edit for most detail edits.",
    limitations: [
      "Create status is limited to Pending, Closed, and Cancelled; non-admin creators are forced to Pending.",
      "Field names, visibility, required state, and dropdown labels are controlled from Settings > Fields.",
    ],
    bugSignals: [
      "Required fields do not match Settings > Fields.",
      "A non-admin can set restricted statuses during create.",
      "A saved transaction disappears from reports or the transaction list.",
    ],
    keywords: [
      "transaction",
      "transactions",
      "deal",
      "intake",
      "create transaction",
      "new transaction",
      "登单",
      "录单",
      "交易",
      "新建交易",
    ],
  },
  {
    id: "fields",
    title: "Settings > Fields",
    route: "/office/settings/fields",
    status: "available",
    audience: "Office administrators",
    summary:
      "Central place for office-scoped transaction and contact field labels, visibility, required state, order, and dropdown options.",
    howToUse: [
      "Open Settings > Fields.",
      "Admins can rename supported built-in fields, manage custom fields, change required state, and reorder visible fields.",
      "Transaction create, transaction detail intake, reports, and search use this same field schema.",
    ],
    requiredAccess: "fields:view to inspect; fields:manage to change schema.",
    limitations: [
      "Protected or already-used fields may not be deletable.",
      "Changing labels does not change the underlying stable system value.",
    ],
    bugSignals: [
      "A field hidden in Settings still appears in create or search.",
      "A dropdown label override is inconsistent between create, reports, and filters.",
    ],
    keywords: ["field", "fields", "required field", "dropdown", "字段", "必填", "下拉", "设置字段"],
  },
  {
    id: "contacts",
    title: "Contacts",
    route: "/office/contacts",
    status: "available",
    audience: "Back Office users managing transaction parties and follow-up context",
    summary:
      "Internal contact and party management tied to transaction workflows and follow-up tasks.",
    howToUse: [
      "Open Contacts from the Overview group.",
      "Create or edit contact basics, custom fields, transaction links, and follow-up context.",
    ],
    requiredAccess: "contacts:view to inspect; contacts:create or contacts:edit for changes.",
    limitations: [
      "The module is CRM-like but still an MVP; richer relationship automation is future work.",
    ],
    bugSignals: [
      "Contact custom fields do not match Settings > Fields.",
      "A linked contact does not appear in the expected transaction detail card.",
    ],
    keywords: ["contact", "contacts", "party", "client", "联系人", "客户", "客户资料"],
  },
  {
    id: "tasks",
    title: "Tasks and Approve Docs",
    route: "/office/tasks",
    status: "available",
    audience: "Back Office task owners and reviewers",
    summary:
      "Operational task list, transaction tasks, checklist workflow, review/compliance states, and the Approve Docs reviewer queue.",
    howToUse: [
      "Open Task list for active operational tasks.",
      "Open Approve docs when you need the reviewer queue for document/task review.",
      "Use transaction detail to manage tasks tied to one transaction.",
    ],
    requiredAccess:
      "tasks:view for task visibility; tasks:manage or tasks:review for management/review work; documents:approve for document approvals.",
    limitations: [
      "Reviewer assignment and SLA handling are still permission-based rather than a dedicated assignment model.",
    ],
    bugSignals: [
      "A task requiring review does not appear in Approve Docs for a reviewer.",
      "Secondary review appears for a user without secondary review access.",
    ],
    keywords: ["task", "tasks", "approve docs", "review", "approval", "任务", "审批", "审核", "文档审批"],
  },
  {
    id: "documents-signatures",
    title: "Documents, Forms, and Signatures",
    route: "/office/signatures",
    status: "available",
    audience: "Back Office document and signature operators",
    summary:
      "Document upload, library-backed files, transaction forms, signature requests, template management, and signing review surfaces.",
    howToUse: [
      "Use transaction detail to upload transaction documents and prepare forms/signature requests.",
      "Use Signatures for signature tracking and templates.",
      "Use Library for company documents that are not tied to one transaction.",
    ],
    requiredAccess:
      "documents:view/manage, forms:use, signatures:view/manage, and signature template/report permissions depending on the action.",
    limitations: [
      "External eSignature integrations are not faked; the current product only shows states Acre really records.",
    ],
    bugSignals: [
      "A file upload succeeds but the file cannot be previewed or downloaded.",
      "A signature request state claims signed/completed without a recorded completion.",
    ],
    keywords: ["document", "documents", "signature", "forms", "sign", "资料", "文件", "签名", "签署", "表格"],
  },
  {
    id: "accounting",
    title: "Accounting, Commissions, Billing, and 1099",
    route: "/office/accounting",
    status: "available",
    audience: "Office administrators and accounting operators",
    summary:
      "Admin-controlled accounting workspace for agent statements, commission setup, billing references, payments, and 1099 support.",
    howToUse: [
      "Office admins open Accounting for agent statement workflows.",
      "Open 1099 Tracker for annual payout backup and internal 1099 support documents.",
      "Use Settings > Commission plans for commission configuration where available.",
    ],
    requiredAccess:
      "office_admin for admin accounting workspace; accounting and commission permissions for related surfaces.",
    limitations: [
      "Payment methods are masked internal references and do not imply live card or ACH processing.",
      "QuickBooks posting depends on configured integration settings.",
    ],
    bugSignals: [
      "A payout statement is marked ready but missing expected invoice candidates.",
      "QuickBooks validation fails after settings appear connected.",
      "A financial total differs between reports and accounting for the same filtered record set.",
    ],
    keywords: ["accounting", "commission", "billing", "1099", "payout", "invoice", "财务", "佣金", "账单", "付款"],
  },
  {
    id: "reports-performance",
    title: "Reports and Performance",
    route: "/office/reports",
    status: "available",
    audience: "Managers, admins, team leads, and scoped agents",
    summary:
      "Transaction reporting, CSV export, financial rollups, and role-scoped performance tracking.",
    howToUse: [
      "Open Reports for filtered transaction rollups and CSV export.",
      "Open Performance for role-scoped production summaries, rankings, and period tables.",
    ],
    requiredAccess:
      "reports:view:personal/team/company depending on scope; financial visibility is role-scoped.",
    limitations: [
      "Excel export is not implemented yet.",
      "Performance values use the fixed formula Gross Commission - Rebate - Referral Fee - Reimbursement.",
    ],
    bugSignals: [
      "A report filter returns rows outside the current office or permission scope.",
      "A CSV column label does not match Settings > Fields.",
    ],
    keywords: ["report", "reports", "performance", "csv", "export", "报表", "业绩", "导出"],
  },
  {
    id: "resources-library",
    title: "Resources and Library",
    route: "/office/resources",
    status: "available",
    audience: "Office admins and resource viewers",
    summary:
      "Resources collect published documents, vendors, and training materials; Library is the internal company document library.",
    howToUse: [
      "Open Resources for admin-managed documents, vendors, and training materials.",
      "Open Library for folder-based company documents and PDF-first preview.",
    ],
    requiredAccess:
      "resources:view/manage for Resources; library:view/manage for Library.",
    limitations: [
      "Resources is an office-admin workspace in the Back Office navigation.",
      "Object storage replacement is future work; current stored files use the existing document storage foundation.",
    ],
    bugSignals: [
      "A published resource is visible to the wrong role.",
      "A Library PDF cannot render after upload.",
    ],
    keywords: ["resource", "resources", "library", "training", "vendor", "资源", "培训", "资料库", "供应商"],
  },
  {
    id: "users-teams-roles",
    title: "Users, Teams, and Roles",
    route: "/office/settings/users",
    status: "available",
    audience: "Office administrators and managers with user/team access",
    summary:
      "Internal account, invitation, role, permission, team, and reporting-line administration.",
    howToUse: [
      "Open Settings > Users for user lifecycle and permission management.",
      "Open Settings > Roles to inspect role permission templates.",
      "Open Settings > Teams to manage office team structure.",
    ],
    requiredAccess:
      "users:view/manage, teams:view/manage, settings:view/manage depending on the page.",
    limitations: [
      "Email, role, office access, and team assignment are admin-managed; users cannot self-change these from My Profile.",
      "Forgot-password self-service is not implemented; admins issue setup/reset invitations.",
    ],
    bugSignals: [
      "A disabled user can still access Office.",
      "A role template grants a page that the sidebar hides for the same user.",
    ],
    keywords: ["user", "users", "team", "teams", "roles", "permission", "用户", "团队", "角色", "权限"],
  },
  {
    id: "mail-notifications-activity",
    title: "Mail, Notifications, and Activity Log",
    route: "/office/mail",
    status: "available",
    audience: "Signed-in Back Office users",
    summary:
      "Internal mail threads, personal workflow notifications, and auditable activity history.",
    howToUse: [
      "Open Mail for user-scoped internal threads and attachments.",
      "Open Notifications for actionable reminders and unread state.",
      "Open Activity for account activity and operational alerts.",
    ],
    requiredAccess:
      "mail:view/send/audit, notifications:view, and activity:view depending on the surface.",
    limitations: [
      "Mail bodies are not copied into Activity Log; Activity stores only metadata events.",
      "Notification archive/dismiss beyond read state is future work.",
    ],
    bugSignals: [
      "Mail unread count does not match the mailbox.",
      "A notification deep link opens a missing or forbidden page for the intended recipient.",
    ],
    keywords: ["mail", "notification", "activity", "inbox", "站内信", "通知", "动态", "活动"],
  },
  {
    id: "front-office-boundary",
    title: "Front Office Boundary",
    route: "/agent/dashboard",
    status: "partial",
    audience: "Agents and Front Office users",
    summary:
      "Front Office handles client execution, outreach, calendar, listing output, and active follow-up; Back Office remains the formal home for transactions, accounting, commissions, signatures, and archival workflows.",
    howToUse: [
      "Use /agent for client-facing execution workflows.",
      "Move into Back Office when the work becomes a formal transaction, accounting, signature, or archived brokerage workflow.",
    ],
    requiredAccess: "Front Office module permissions such as clients:view, events:view, listing_studio:view, and ai:use where applicable.",
    limitations: [
      "Several Front Office routes are intentionally slimmer than older roadmap descriptions.",
      "Do not assume placeholder /agent behavior is final product direction.",
    ],
    bugSignals: [
      "A Front Office action claims to create a formal Back Office transaction when it only creates a draft or handoff.",
    ],
    keywords: ["front office", "agent", "handoff", "client", "前台", "经纪人", "交接"],
  },
  {
    id: "unsupported-code-db",
    title: "Code, database, and production changes",
    route: null,
    status: "not_available",
    audience: "Acre administrators",
    summary:
      "The admin assistant is read-only. It must not change code, delete data, run migrations, deploy production, or bypass permissions.",
    howToUse: [
      "For code, database, or deployment changes, prepare a programmer handoff with page, steps, expected result, actual result, screenshots, and business impact.",
    ],
    requiredAccess: "Not available through the admin assistant.",
    limitations: [
      "No write operations are exposed through the assistant.",
      "Secrets and credentials should never be pasted into chat or support tickets.",
    ],
    bugSignals: [
      "The assistant asks for credentials, proposes SQL, or claims it changed production. Treat that as out of scope.",
    ],
    keywords: ["code", "database", "sql", "delete", "deploy", "migration", "代码", "数据库", "删除", "部署"],
  },
];

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
}

function getEntrySearchText(entry: AdminGptFeatureCatalogEntry) {
  return normalizeSearchText(
    [
      entry.title,
      entry.route,
      entry.summary,
      entry.requiredAccess,
      ...entry.howToUse,
      ...entry.limitations,
      ...entry.keywords,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function countOccurrences(value: string, search: string) {
  if (!search) {
    return 0;
  }

  let count = 0;
  let startIndex = 0;

  while (startIndex < value.length) {
    const foundIndex = value.indexOf(search, startIndex);

    if (foundIndex < 0) {
      break;
    }

    count += 1;
    startIndex = foundIndex + search.length;
  }

  return count;
}

export function searchAdminGptFeatureCatalog(query: string, limit = 5) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!queryTerms.length) {
    return ADMIN_GPT_FEATURE_CATALOG.slice(0, limit);
  }

  return ADMIN_GPT_FEATURE_CATALOG
    .map((entry) => {
      const haystack = getEntrySearchText(entry);
      const keywordScore = entry.keywords.reduce(
        (score, keyword) => score + countOccurrences(normalizedQuery, normalizeSearchText(keyword)) * 12,
        0,
      );
      const termScore = queryTerms.reduce(
        (score, term) => score + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return {
        entry,
        score: keywordScore + termScore,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title))
    .slice(0, limit)
    .map((result) => result.entry);
}

export function getAdminGptFeatureCatalogSummary() {
  const counts = ADMIN_GPT_FEATURE_CATALOG.reduce(
    (summary, entry) => ({
      ...summary,
      [entry.status]: summary[entry.status] + 1,
    }),
    {
      available: 0,
      not_available: 0,
      partial: 0,
    },
  );

  return {
    counts,
    scopeBoundary: ADMIN_GPT_SCOPE_BOUNDARY,
    total: ADMIN_GPT_FEATURE_CATALOG.length,
  };
}
