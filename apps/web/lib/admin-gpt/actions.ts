import type { SessionMembershipContext } from "@acre/db";
import {
  ADMIN_GPT_FEATURE_CATALOG,
  ADMIN_GPT_SCOPE_BOUNDARY,
  getAdminGptFeatureCatalogSummary,
  searchAdminGptFeatureCatalog,
  type AdminGptFeatureCatalogEntry,
} from "./catalog";

export type AdminGptLookupInput = {
  question?: string;
  currentPage?: string;
};

export type AdminGptTriageInput = {
  question?: string;
  currentPage?: string;
  visibleErrorText?: string;
  screenshotSummary?: string;
};

export type AdminGptTriageClassification =
  | "operator_guidance"
  | "permission_or_access"
  | "configuration"
  | "likely_system_bug"
  | "feature_not_available"
  | "outside_scope"
  | "unclear";

const OFF_SCOPE_PATTERNS = [
  /\bcode\b/i,
  /\bcommit\b/i,
  /\bdatabase\b/i,
  /\bsql\b/i,
  /\bmigration\b/i,
  /\bdeploy\b/i,
  /\bproduction\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bdelete\s+data\b/i,
  /代码/,
  /数据库/,
  /删库/,
  /删除数据/,
  /部署/,
  /生产/,
  /密码/,
  /密钥/,
];

const PERMISSION_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /\bforbidden\b/i,
  /\bunauthorized\b/i,
  /\bpermission\b/i,
  /\baccess required\b/i,
  /无权限/,
  /没有权限/,
  /未授权/,
  /禁止访问/,
];

const CONFIG_PATTERNS = [
  /\bnot configured\b/i,
  /\bconfiguration\b/i,
  /\benvironment\b/i,
  /\bquickbooks\b/i,
  /\bsmtp\b/i,
  /\bsignature drive\b/i,
  /未配置/,
  /配置/,
  /环境变量/,
  /连接失败/,
];

const BUG_PATTERNS = [
  /\b500\b/,
  /\btypeerror\b/i,
  /\breferenceerror\b/i,
  /\bprisma\b/i,
  /\bexception\b/i,
  /\bstack\b/i,
  /\bfailed to fetch\b/i,
  /\bunexpected\b/i,
  /\bnull\b/i,
  /报错/,
  /白屏/,
  /崩溃/,
  /无法保存/,
  /没有反应/,
];

function normalizeInput(value: string | undefined) {
  return value?.trim() ?? "";
}

function isOutsideAdminGptScope(text: string) {
  return OFF_SCOPE_PATTERNS.some((pattern) => pattern.test(text));
}

function pickBugReportFeature(entries: AdminGptFeatureCatalogEntry[]) {
  return entries[0]?.title ?? "Unknown Acre page";
}

function buildProgrammerHandoff(input: {
  classification: AdminGptTriageClassification;
  currentPage: string;
  featureTitle: string;
  question: string;
  screenshotSummary: string;
  visibleErrorText: string;
}) {
  return [
    `Classification: ${input.classification}`,
    `Page: ${input.currentPage || "unknown"}`,
    `Feature: ${input.featureTitle}`,
    `Question / goal: ${input.question || "not provided"}`,
    `Visible error: ${input.visibleErrorText || "none provided"}`,
    `Screenshot summary: ${input.screenshotSummary || "none provided"}`,
    "Expected result: describe what the administrator expected Acre to do.",
    "Actual result: describe what Acre did instead.",
    "Reproduction steps: list the exact clicks, filters, and form values before the issue.",
  ].join("\n");
}

export function buildAdminGptContextResponse(context: SessionMembershipContext) {
  const permissions = new Set(context.currentMembership.permissions);
  const visibleCatalog = ADMIN_GPT_FEATURE_CATALOG.filter((entry) => {
    if (entry.status === "not_available") {
      return true;
    }

    if (context.currentMembership.role === "owner" || context.currentMembership.role === "office_admin") {
      return true;
    }

    return entry.keywords.some((keyword) => permissions.has(keyword as never));
  });

  return {
    assistantName: "Acre Admin Help",
    privacy:
      "Acre does not persist GPT chat history, uploaded screenshots, or model answers through this Action service.",
    scopeBoundary: ADMIN_GPT_SCOPE_BOUNDARY,
    currentAdmin: {
      membershipId: context.currentMembership.id,
      role: context.currentMembership.role,
      title: context.currentMembership.title,
    },
    currentOrganization: {
      id: context.currentOrganization.id,
      name: context.currentOrganization.name,
      slug: context.currentOrganization.slug,
    },
    currentOffice: context.currentOffice
      ? {
          id: context.currentOffice.id,
          name: context.currentOffice.name,
          slug: context.currentOffice.slug,
          market: context.currentOffice.market,
        }
      : null,
    accessibleOffices: context.accessibleOffices.map((office) => ({
      id: office.id,
      name: office.name,
      slug: office.slug,
      market: office.market,
    })),
    catalog: {
      ...getAdminGptFeatureCatalogSummary(),
      entries: visibleCatalog.map((entry) => ({
        id: entry.id,
        route: entry.route,
        status: entry.status,
        title: entry.title,
      })),
    },
  };
}

export function lookupAdminGptHelp(input: AdminGptLookupInput) {
  const question = normalizeInput(input.question);
  const currentPage = normalizeInput(input.currentPage);
  const combined = [question, currentPage].filter(Boolean).join(" ");

  if (isOutsideAdminGptScope(combined)) {
    return {
      scopeBoundary: ADMIN_GPT_SCOPE_BOUNDARY,
      status: "outside_scope" as const,
      answerGuidance:
        "This request is outside the Acre admin help assistant scope. The assistant may explain that code, database, deployment, credential, and destructive data changes must go to the programmer workflow instead.",
      matches: searchAdminGptFeatureCatalog("code database deploy delete", 1),
    };
  }

  const matches = searchAdminGptFeatureCatalog(combined || "dashboard transactions settings", 5);

  return {
    scopeBoundary: ADMIN_GPT_SCOPE_BOUNDARY,
    status: matches.length ? "matched" as const : "unclear" as const,
    answerGuidance:
      "Use these curated Acre facts to answer. Do not claim a feature exists unless a matched entry says it is available or partial.",
    matches,
    fallback:
      matches.length > 0
        ? null
        : "No curated Acre module matched clearly. Ask the administrator for the exact page URL, visible button/field name, and screenshot summary.",
  };
}

export function triageAdminGptIssue(input: AdminGptTriageInput) {
  const question = normalizeInput(input.question);
  const currentPage = normalizeInput(input.currentPage);
  const visibleErrorText = normalizeInput(input.visibleErrorText);
  const screenshotSummary = normalizeInput(input.screenshotSummary);
  const combined = [question, currentPage, visibleErrorText, screenshotSummary].filter(Boolean).join(" ");
  const matches = searchAdminGptFeatureCatalog(combined, 3);
  const featureTitle = pickBugReportFeature(matches);
  let classification: AdminGptTriageClassification = "unclear";
  const nextSteps: string[] = [];

  if (isOutsideAdminGptScope(combined)) {
    classification = "outside_scope";
    nextSteps.push(
      "Refuse code, database, deployment, credential, or destructive-data instructions and route the administrator to the programmer handoff.",
    );
  } else if (matches.some((entry) => entry.status === "not_available")) {
    classification = "feature_not_available";
    nextSteps.push("Explain that this capability is not available through the current Acre admin help surface.");
  } else if (PERMISSION_PATTERNS.some((pattern) => pattern.test(combined))) {
    classification = "permission_or_access";
    nextSteps.push("Confirm the signed-in account is owner or office_admin and has ai:use plus the module-specific permission.");
    nextSteps.push("Ask the admin to try the same route from the Office sidebar so stale direct links are ruled out.");
  } else if (CONFIG_PATTERNS.some((pattern) => pattern.test(combined))) {
    classification = "configuration";
    nextSteps.push("Check the relevant Settings page first, especially integration connection status and visible validation messages.");
    nextSteps.push("Do not ask for secrets; ask for the exact non-secret error text and page path.");
  } else if (BUG_PATTERNS.some((pattern) => pattern.test(combined))) {
    classification = "likely_system_bug";
    nextSteps.push("Ask the admin to retry once after a refresh and preserve the exact route, form values, and error text.");
    nextSteps.push("If the issue repeats, send the programmer handoff template with screenshot summary and reproduction steps.");
  } else if (question || currentPage) {
    classification = "operator_guidance";
    nextSteps.push("Answer from the matched feature entries and point to the route, permissions, required fields, and known limitations.");
  } else {
    nextSteps.push("Ask for the current page URL, action attempted, visible error text, and screenshot summary.");
  }

  return {
    classification,
    confidence: classification === "unclear" ? "low" : "medium",
    scopeBoundary: ADMIN_GPT_SCOPE_BOUNDARY,
    matchedFeatures: matches,
    nextSteps,
    programmerHandoff: buildProgrammerHandoff({
      classification,
      currentPage,
      featureTitle,
      question,
      screenshotSummary,
      visibleErrorText,
    }),
  };
}
