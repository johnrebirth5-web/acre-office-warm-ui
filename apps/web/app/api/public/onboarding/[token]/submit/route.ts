import { submitHrOnboardingCase } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
} from "../../../../../../lib/public-token-rate-limit";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const PUBLIC_ONBOARDING_SUBMIT_RATE_LIMIT_OPTIONS = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
};

const submitSchema = z.object({
  submittedByEmail: z.string().trim().email().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/onboarding/submit",
    request,
    token,
    options: PUBLIC_ONBOARDING_SUBMIT_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many onboarding submit attempts. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const parsed = await parseJsonBody(request, submitSchema, {
    error: "Onboarding submit payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const onboardingCase = await submitHrOnboardingCase({
    token,
    submittedByEmail: parsed.data.submittedByEmail,
  });

  if (!onboardingCase) {
    return NextResponse.json({ error: "Onboarding token is invalid or expired." }, { status: 404 });
  }

  return NextResponse.json({ case: onboardingCase });
}
