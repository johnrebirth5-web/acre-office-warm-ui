import { canViewOfficeContacts } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../../lib/csrf";
import { buildRateLimitKey, consumeRateLimit, type RateLimitOptions } from "../../../../../lib/rate-limit";
import {
  handleFrontOfficeLeadIntakeAssistServerRoute,
} from "../../../../../lib/front-office-intake-assist-server";

export const runtime = "nodejs";

type IntakeAssistRouteDependencies = {
  canViewOfficeContacts?: typeof canViewOfficeContacts;
  csrf?: typeof isSameOriginRequest;
  getSessionContext?: typeof getRequestSessionContext;
  handleAssist?: typeof handleFrontOfficeLeadIntakeAssistServerRoute;
  rateLimit?: typeof consumeRateLimit;
  rateLimitOptions?: RateLimitOptions;
};

const DEFAULT_INTAKE_ASSIST_RATE_LIMIT_OPTIONS = {
  limit: 20,
  windowMs: 5 * 60 * 1000
};

function buildIntakeAssistErrorResponse(error: string, status: 401 | 403 | 429, retryAfterSeconds?: number) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "no-store");

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

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
  const csrfCheck = dependencies.csrf ?? isSameOriginRequest;

  if (!csrfCheck(request)) {
    return buildIntakeAssistErrorResponse("CSRF validation failed.", 403);
  }

  const getSessionContext = dependencies.getSessionContext ?? getRequestSessionContext;
  const context = await getSessionContext(request);

  if (!context) {
    return buildIntakeAssistErrorResponse("Authentication required.", 401);
  }

  const canViewContacts = dependencies.canViewOfficeContacts ?? canViewOfficeContacts;

  if (!canViewContacts(context.currentMembership)) {
    return buildIntakeAssistErrorResponse("Lead intake review access required.", 403);
  }

  const rateLimitDecision = (dependencies.rateLimit ?? consumeRateLimit)(
    getIntakeAssistRateLimitKey(request, context.currentMembership.id),
    dependencies.rateLimitOptions ?? DEFAULT_INTAKE_ASSIST_RATE_LIMIT_OPTIONS,
  );

  if (!rateLimitDecision.allowed) {
    return buildIntakeAssistErrorResponse(
      "Too many intake assist requests. Please try again in a moment.",
      429,
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const handleAssist = dependencies.handleAssist ?? handleFrontOfficeLeadIntakeAssistServerRoute;

  return handleAssist(request, context, {
    canViewOfficeContacts: canViewContacts,
  });
}
