import { canManageOfficeSettings } from "@acre/auth";
import {
  connectOrganizationQuickBooksConnection,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";
import { verifyQuickBooksOAuthState } from "../../../../../../lib/quickbooks-oauth-state";
import { withPermission } from "../../../../../../lib/with-permission";

type QuickBooksCallbackRouteDependencies = {
  connectOrganizationQuickBooksConnection?: typeof connectOrganizationQuickBooksConnection;
};

function getQuickBooksRedirectUri(request: NextRequest) {
  const configuredRedirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI?.trim() ??
    process.env.ACRE_QUICKBOOKS_REDIRECT_URI?.trim();

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

export async function handleQuickBooksCallbackGet(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: QuickBooksCallbackRouteDependencies = {},
) {
  const errorDescription =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");

  if (errorDescription) {
    return redirectToQuickBooksSettings(request, {
      quickbooks: "error",
      message: errorDescription,
    });
  }

  try {
    const state = verifyQuickBooksOAuthState(request.nextUrl.searchParams.get("state") ?? "");

    if (
      state.organizationId !== context.currentOrganization.id ||
      state.membershipId !== context.currentMembership.id
    ) {
      throw new Error("QuickBooks OAuth state does not match the current session.");
    }

    await (
      dependencies.connectOrganizationQuickBooksConnection ??
      connectOrganizationQuickBooksConnection
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      code: request.nextUrl.searchParams.get("code") ?? "",
      realmId: request.nextUrl.searchParams.get("realmId") ?? "",
      redirectUri: getQuickBooksRedirectUri(request),
    });

    return redirectToQuickBooksSettings(request, {
      quickbooks: "connected",
    });
  } catch (error) {
    return redirectToQuickBooksSettings(request, {
      quickbooks: "error",
      message:
        error instanceof Error
          ? error.message
          : "QuickBooks connection failed.",
    });
  }
}

export async function GET(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => handleQuickBooksCallbackGet(request, context),
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
