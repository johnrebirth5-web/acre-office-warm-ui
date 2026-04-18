import { canViewOfficeContacts } from "@acre/auth";
import { NextRequest } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../../lib/csrf";
import {
  buildRateLimitKey,
  consumeRateLimit,
  type RateLimitConsumer,
  type RateLimitOptions,
} from "../../../../../lib/rate-limit";
import {
  handleFrontOfficeLeadIntakeAssistServerRoute,
} from "../../../../../lib/front-office-intake-assist-server";
import { withApiGuard } from "../../../../../lib/with-api-guard";

export const runtime = "nodejs";

type IntakeAssistRouteDependencies = {
  canViewOfficeContacts?: typeof canViewOfficeContacts;
  csrf?: typeof isSameOriginRequest;
  getSessionContext?: typeof getRequestSessionContext;
  handleAssist?: typeof handleFrontOfficeLeadIntakeAssistServerRoute;
  rateLimit?: RateLimitConsumer;
  rateLimitOptions?: RateLimitOptions;
  withApiGuard?: typeof withApiGuard;
};

const DEFAULT_INTAKE_ASSIST_RATE_LIMIT_OPTIONS = {
  limit: 20,
  windowMs: 5 * 60 * 1000
};

function getIntakeAssistRateLimitKey(request: NextRequest, membershipId: string) {
  return buildRateLimitKey("agent/intake-assist", request, membershipId || "anonymous");
}

export async function POST(request: NextRequest) {
  return handleIntakeAssistPost(request);
}

export async function handleIntakeAssistPost(
  request: NextRequest,
  dependencies: IntakeAssistRouteDependencies = {},
) {
  const canViewContacts =
    dependencies.canViewOfficeContacts ?? canViewOfficeContacts;
  const handleAssist =
    dependencies.handleAssist ?? handleFrontOfficeLeadIntakeAssistServerRoute;

  return (dependencies.withApiGuard ?? withApiGuard)(
    request,
    async ({ context }) =>
      handleAssist(request, context!, {
        canViewOfficeContacts: canViewContacts,
      }),
    {
      cacheControlNoStore: true,
      canAccess: canViewContacts,
      csrf: dependencies.csrf ?? isSameOriginRequest,
      forbiddenMessage: "Lead intake review access required.",
      getRequestSessionContext:
        dependencies.getSessionContext ?? getRequestSessionContext,
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: ({ context: guardContext, request: guardedRequest }) =>
          getIntakeAssistRateLimitKey(
            guardedRequest,
            guardContext!.currentMembership.id,
          ),
        message: "Too many intake assist requests. Please try again in a moment.",
        options:
          dependencies.rateLimitOptions ??
          DEFAULT_INTAKE_ASSIST_RATE_LIMIT_OPTIONS,
      },
      requireAuth: true,
      unauthorizedMessage: "Authentication required.",
    },
  );
}
