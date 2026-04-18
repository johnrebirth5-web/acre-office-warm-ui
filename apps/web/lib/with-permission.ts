import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { getRequestSessionContext } from "./auth-session";
import { withApiGuard } from "./with-api-guard";

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

  return withApiGuard(
    request,
    async ({ context }) => handler(context as SessionMembershipContext),
    {
      canAccess,
      forbiddenMessage: options.forbiddenMessage,
      getRequestSessionContext: getSessionContext,
      requireAuth: true,
      unauthorizedMessage: options.unauthorizedMessage,
    },
  );
}
