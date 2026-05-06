import { canManageOfficeSettings } from "@acre/auth";
import { buildGoogleAuthorizationUrl } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthState } from "../../../../../../lib/google-oauth-state";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";
import { withPermission } from "../../../../../../lib/with-permission";

function getGoogleRedirectUri(request: NextRequest) {
  return (
    process.env.ACRE_GOOGLE_OAUTH_REDIRECT_URL?.trim() ??
    `${getAppBaseUrl(request)}/api/office/settings/google/callback`
  );
}

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/office/settings", getAppBaseUrl(request));
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
        const state = createGoogleOAuthState({
          organizationId: context.currentOrganization.id,
          membershipId: context.currentMembership.id,
        });

        return NextResponse.redirect(
          buildGoogleAuthorizationUrl({
            redirectUri: getGoogleRedirectUri(request),
            state,
          }),
        );
      } catch (error) {
        return redirectToSettings(request, {
          google: "error",
          message: error instanceof Error ? error.message : "Google connection could not be started.",
        });
      }
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
