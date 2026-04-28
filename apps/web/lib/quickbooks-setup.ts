import type { NextRequest } from "next/server";
import { getAppBaseUrl } from "./request-origin";

export const quickBooksOAuthStateCookieName = "acre_qb_oauth_state";

export const quickBooksOfficeMappings = [
  {
    officeSlug: "acre-nj-llc",
    officeLabel: "Acre NJ LLC",
    quickBooksCompanyName: "ACRE NJ LLC",
  },
  {
    officeSlug: "acre-ny-realty",
    officeLabel: "Acre NY Realty Inc",
    quickBooksCompanyName: "ACRE NY REALTY INC",
  },
  {
    officeSlug: "acre-ny-rental",
    officeLabel: "Acre NY Rentals LLC",
    quickBooksCompanyName: "Acre NY Rentals LLC",
  },
] as const;

export type QuickBooksOfficeSlug =
  (typeof quickBooksOfficeMappings)[number]["officeSlug"];

export type QuickBooksOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  credentialSource: "acre" | "legacy" | "missing";
  isConfigured: boolean;
};

export type QuickBooksProductionAppUrls = {
  hostDomain: string;
  launchUrl: string;
  connectUrl: string;
  redirectUrl: string;
  disconnectUrl: string;
  privacyUrl: string;
  termsUrl: string;
};

export function getQuickBooksOfficeMapping(officeSlug: string | null | undefined) {
  const normalizedOfficeSlug = officeSlug?.trim() ?? "";

  return (
    quickBooksOfficeMappings.find(
      (mapping) => mapping.officeSlug === normalizedOfficeSlug,
    ) ?? null
  );
}

export function getDefaultQuickBooksOfficeMapping() {
  return quickBooksOfficeMappings[0];
}

function getProductionBaseUrl() {
  const configuredBaseUrl = process.env.ACRE_BASE_URL?.trim().replace(/\/+$/, "");

  if (
    configuredBaseUrl &&
    configuredBaseUrl.startsWith("https://") &&
    !configuredBaseUrl.includes("localhost") &&
    !configuredBaseUrl.includes("127.0.0.1")
  ) {
    return configuredBaseUrl;
  }

  return "https://acresystem.us";
}

export function getQuickBooksProductionAppUrls(): QuickBooksProductionAppUrls {
  const baseUrl = getProductionBaseUrl();
  const hostDomain = new URL(baseUrl).host;

  return {
    hostDomain,
    launchUrl: `${baseUrl}/office/settings/quickbooks`,
    connectUrl: `${baseUrl}/api/office/settings/quickbooks/connect`,
    redirectUrl: `${baseUrl}/api/office/settings/quickbooks/callback`,
    disconnectUrl: `${baseUrl}/api/office/settings/quickbooks/disconnect`,
    privacyUrl: `${baseUrl}/legal/privacy`,
    termsUrl: `${baseUrl}/legal/terms`,
  };
}

export function readQuickBooksOAuthConfig(
  request?: Pick<NextRequest, "headers" | "nextUrl">,
): QuickBooksOAuthConfig {
  const acreClientId = process.env.ACRE_QUICKBOOKS_CLIENT_ID?.trim() ?? "";
  const acreClientSecret = process.env.ACRE_QUICKBOOKS_CLIENT_SECRET?.trim() ?? "";
  const legacyClientId = process.env.QUICKBOOKS_CLIENT_ID?.trim() ?? "";
  const legacyClientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? "";
  const clientId = acreClientId || legacyClientId;
  const clientSecret = acreClientSecret || legacyClientSecret;
  const configuredRedirectUri =
    process.env.ACRE_QUICKBOOKS_REDIRECT_URI?.trim() ||
    process.env.QUICKBOOKS_REDIRECT_URI?.trim() ||
    "";
  const fallbackBaseUrl = request ? getAppBaseUrl(request) : getProductionBaseUrl();
  const credentialSource =
    acreClientId && acreClientSecret
      ? "acre"
      : legacyClientId && legacyClientSecret
        ? "legacy"
        : "missing";

  return {
    clientId,
    clientSecret,
    redirectUri:
      configuredRedirectUri ||
      `${fallbackBaseUrl}/api/office/settings/quickbooks/callback`,
    credentialSource,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

export function buildQuickBooksAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const authorizationUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  authorizationUrl.searchParams.set("client_id", input.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  authorizationUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizationUrl.searchParams.set("state", input.state);

  return authorizationUrl;
}

export function parseQuickBooksOfficeConnectionStatuses() {
  const raw = process.env.ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON?.trim();
  const statuses = new Map<
    string,
    {
      hasRealmId: boolean;
      hasRefreshToken: boolean;
      hasApAccountId: boolean;
      hasAgentCommissionExpenseAccountId: boolean;
      companyName: string;
    }
  >();

  if (!raw) {
    return statuses;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }

      statuses.set(key.trim(), {
        hasRealmId: typeof value.realmId === "string" && value.realmId.trim().length > 0,
        hasRefreshToken:
          typeof value.refreshToken === "string" &&
          value.refreshToken.trim().length > 0,
        hasApAccountId:
          typeof value.apAccountId === "string" &&
          value.apAccountId.trim().length > 0,
        hasAgentCommissionExpenseAccountId:
          typeof value.agentCommissionExpenseAccountId === "string" &&
          value.agentCommissionExpenseAccountId.trim().length > 0,
        companyName:
          typeof value.companyName === "string" ? value.companyName.trim() : "",
      });
    }
  } catch {
    return statuses;
  }

  return statuses;
}
