import { canManageOfficeSettings } from "@acre/auth";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getRequestSessionContext,
  getSessionCookieSettings,
} from "../../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../../lib/request-origin";
import {
  buildQuickBooksAuthorizationUrl,
  getDefaultQuickBooksOfficeMapping,
  getQuickBooksOfficeMapping,
  quickBooksOAuthStateCookieName,
  readQuickBooksOAuthConfig,
} from "../../../../../../lib/quickbooks-setup";

function redirectToQuickBooksSettings(request: NextRequest, error?: string) {
  const url = new URL("/office/settings/quickbooks", getRequestOrigin(request));

  if (error) {
    url.searchParams.set("quickbooksError", error);
  }

  return NextResponse.redirect(url, 303);
}

function createOAuthState(officeSlug: string) {
  return `${officeSlug}.${randomBytes(24).toString("base64url")}`;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.redirect(new URL("/login", getRequestOrigin(request)), 303);
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return redirectToQuickBooksSettings(request, "settings_permission_required");
  }

  const requestedOfficeSlug = request.nextUrl.searchParams.get("office");
  const officeMapping =
    getQuickBooksOfficeMapping(requestedOfficeSlug) ??
    getDefaultQuickBooksOfficeMapping();
  const oauthConfig = readQuickBooksOAuthConfig(request);

  if (!oauthConfig.isConfigured) {
    return redirectToQuickBooksSettings(request, "missing_quickbooks_oauth_credentials");
  }

  const state = createOAuthState(officeMapping.officeSlug);
  const authorizationUrl = buildQuickBooksAuthorizationUrl({
    clientId: oauthConfig.clientId,
    redirectUri: oauthConfig.redirectUri,
    state,
  });
  const response = NextResponse.redirect(authorizationUrl, 303);

  response.cookies.set(quickBooksOAuthStateCookieName, state, {
    ...getSessionCookieSettings(),
    maxAge: 10 * 60,
    path: "/api/office/settings/quickbooks",
  });

  return response;
}
