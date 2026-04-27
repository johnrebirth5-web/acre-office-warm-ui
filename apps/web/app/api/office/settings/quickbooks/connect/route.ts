import { canManageOfficeSettings } from "@acre/auth";
import { buildQuickBooksAuthorizationUrl } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createQuickBooksOAuthState } from "../../../../../../lib/quickbooks-oauth-state";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";
import { withPermission } from "../../../../../../lib/with-permission";

function getQuickBooksRedirectUri(request: NextRequest) {
  const configuredRedirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return `${getAppBaseUrl(request)}/api/office/settings/quickbooks/callback`;
}

function redirectToQuickBooksSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/office/settings/quickbooks", getAppBaseUrl(request));

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => {
      try {
        const state = createQuickBooksOAuthState({
          organizationId: context.currentOrganization.id,
          membershipId: context.currentMembership.id,
        });
        const authorizationUrl = buildQuickBooksAuthorizationUrl({
          redirectUri: getQuickBooksRedirectUri(request),
          state,
        });

        return NextResponse.redirect(authorizationUrl);
      } catch (error) {
        return redirectToQuickBooksSettings(request, {
          quickbooks: "error",
          message:
            error instanceof Error
              ? error.message
              : "QuickBooks connection could not be started.",
        });
      }
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
