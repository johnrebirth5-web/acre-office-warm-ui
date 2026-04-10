import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestSessionContext } from "./auth-session";

export type WithPermissionOptions = {
  unauthorizedMessage?: string;
  forbiddenMessage: string;
  getRequestSessionContext?: typeof getRequestSessionContext;
};

export async function withPermission(
  request: NextRequest,
  canAccess: (membership: SessionMembershipContext["currentMembership"]) => boolean,
  handler: (context: SessionMembershipContext) => Promise<Response> | Response,
  options: WithPermissionOptions,
) {
  const getSessionContext =
    options.getRequestSessionContext ?? getRequestSessionContext;
  const context = await getSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: options.unauthorizedMessage ?? "Authentication required." },
      { status: 401 },
    );
  }

  if (!canAccess(context.currentMembership)) {
    return NextResponse.json(
      { error: options.forbiddenMessage },
      { status: 403 },
    );
  }

  return handler(context);
}
