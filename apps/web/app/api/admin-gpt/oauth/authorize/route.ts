import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminGpt } from "../../../../../lib/admin-gpt/access";
import {
  AdminGptOAuthError,
  createAdminGptAuthorizationCode,
  getAdminGptOAuthConfig,
  isAllowedAdminGptRedirectUri,
} from "../../../../../lib/admin-gpt/oauth";
import {
  getRequestSessionContext,
} from "../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../lib/request-origin";

export const runtime = "nodejs";

function buildCurrentPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function buildLoginPagePath(nextPath: string) {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  return `/login?${params.toString()}`;
}

function redirectWithOAuthError(input: {
  redirectUri: string;
  state: string | null;
  error: string;
  description: string;
}) {
  const url = new URL(input.redirectUri);
  url.searchParams.set("error", input.error);
  url.searchParams.set("error_description", input.description);

  if (input.state) {
    url.searchParams.set("state", input.state);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  const redirectUri = request.nextUrl.searchParams.get("redirect_uri");
  const responseType = request.nextUrl.searchParams.get("response_type");
  const scope = request.nextUrl.searchParams.get("scope");
  const state = request.nextUrl.searchParams.get("state");

  if (!redirectUri || !isAllowedAdminGptRedirectUri(redirectUri)) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Unsupported Acre Admin GPT OAuth redirect URI.",
      },
      { status: 400 },
    );
  }

  if (responseType !== "code") {
    return redirectWithOAuthError({
      description: "Acre Admin GPT OAuth only supports authorization_code flow.",
      error: "unsupported_response_type",
      redirectUri,
      state,
    });
  }

  try {
    const config = getAdminGptOAuthConfig();

    if (clientId !== config.clientId) {
      throw new AdminGptOAuthError("invalid_client", "Invalid Acre Admin GPT OAuth client.", 401);
    }

    const context = await getRequestSessionContext(request);

    if (!context) {
      const loginUrl = new URL(buildLoginPagePath(buildCurrentPath(request)), getAppBaseUrl(request));
      return NextResponse.redirect(loginUrl);
    }

    if (!canAccessAdminGpt(context.currentMembership)) {
      return redirectWithOAuthError({
        description: "Acre Admin GPT is only available to administrators with AI access.",
        error: "access_denied",
        redirectUri,
        state,
      });
    }

    const code = createAdminGptAuthorizationCode({
      clientId: clientId ?? "",
      context,
      redirectUri,
      scope,
    });
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);

    if (state) {
      callbackUrl.searchParams.set("state", state);
    }

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    return redirectWithOAuthError({
      description: error instanceof Error ? error.message : "Acre Admin GPT OAuth authorization failed.",
      error: error instanceof AdminGptOAuthError ? error.code : "invalid_request",
      redirectUri,
      state,
    });
  }
}
