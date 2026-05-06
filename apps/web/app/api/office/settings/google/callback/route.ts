import { canManageOfficeSettings } from "@acre/auth";
import { connectOrganizationGoogleIntegration } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleOAuthState } from "../../../../../../lib/google-oauth-state";
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
      const errorDescription =
        request.nextUrl.searchParams.get("error_description") ??
        request.nextUrl.searchParams.get("error");

      if (errorDescription) {
        return redirectToSettings(request, {
          google: "error",
          message: errorDescription,
        });
      }

      try {
        const state = verifyGoogleOAuthState(request.nextUrl.searchParams.get("state") ?? "");
        if (
          state.organizationId !== context.currentOrganization.id ||
          state.membershipId !== context.currentMembership.id
        ) {
          throw new Error("Google OAuth state does not match the current session.");
        }

        await connectOrganizationGoogleIntegration({
          organizationId: context.currentOrganization.id,
          actorMembershipId: context.currentMembership.id,
          code: request.nextUrl.searchParams.get("code") ?? "",
          redirectUri: getGoogleRedirectUri(request),
        });

        return redirectToSettings(request, { google: "connected" });
      } catch (error) {
        return redirectToSettings(request, {
          google: "error",
          message: error instanceof Error ? error.message : "Google connection failed.",
        });
      }
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
