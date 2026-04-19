import { getPublicSignatureRequestSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
  PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../../lib/public-token-rate-limit";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type PublicSignatureSnapshotRouteDependencies = {
  getPublicSignatureRequestSnapshot?: typeof getPublicSignatureRequestSnapshot;
  rateLimit?: typeof consumePublicTokenRateLimit;
};

export async function handlePublicSignatureSnapshotGet(
  request: NextRequest,
  routeContext: Awaited<RouteContext["params"]>,
  dependencies: PublicSignatureSnapshotRouteDependencies = {},
) {
  const { token } = routeContext;
  const rateLimitDecision = await (
    dependencies.rateLimit ?? consumePublicTokenRateLimit
  )({
    scope: "public/signatures/read",
    request,
    token,
    options: PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many signature view attempts. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const snapshot = await (
    dependencies.getPublicSignatureRequestSnapshot ??
    getPublicSignatureRequestSnapshot
  )(token);

  if (!snapshot) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return handlePublicSignatureSnapshotGet(request, await params);
}
