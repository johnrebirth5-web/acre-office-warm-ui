import type { SessionMembershipContext } from "@acre/db";
import { NextResponse } from "next/server";
import { canAccessAdminGpt } from "./access";
import {
  AdminGptOAuthError,
  decodeAdminGptOAuthToken,
  parseBearerToken,
} from "./oauth";

type RequestWithHeaders = {
  headers: Pick<Headers, "get">;
};

type GetSessionMembershipContext = typeof import("@acre/db").getSessionMembershipContext;

type ResolveAdminGptContextDependencies = {
  getSessionMembershipContext?: GetSessionMembershipContext;
};

export async function resolveAdminGptActionContext(
  request: RequestWithHeaders,
  dependencies: ResolveAdminGptContextDependencies = {},
): Promise<SessionMembershipContext> {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));

  if (!bearerToken) {
    throw new AdminGptOAuthError("invalid_request", "Bearer token required.", 401);
  }

  const tokenPayload = decodeAdminGptOAuthToken(bearerToken, "access");
  const loadSessionMembershipContext =
    dependencies.getSessionMembershipContext ??
    (await import("@acre/db")).getSessionMembershipContext;
  const context = await loadSessionMembershipContext(tokenPayload.membershipId, {
    activeOfficeId: tokenPayload.activeOfficeId,
  });

  if (!context) {
    throw new AdminGptOAuthError("invalid_grant", "Acre Admin GPT access token no longer resolves to an active account.", 401);
  }

  if (
    context.currentMembership.id !== tokenPayload.membershipId ||
    context.currentOrganization.id !== tokenPayload.organizationId ||
    !canAccessAdminGpt(context.currentMembership)
  ) {
    throw new AdminGptOAuthError("access_denied", "Acre Admin GPT access denied.", 403);
  }

  return context;
}

export function buildAdminGptErrorResponse(error: unknown) {
  const status = error instanceof AdminGptOAuthError ? error.status : 400;
  const message = error instanceof Error ? error.message : "Acre Admin GPT request failed.";
  const code = error instanceof AdminGptOAuthError ? error.code : "invalid_request";

  return NextResponse.json(
    {
      error: code,
      error_description: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
