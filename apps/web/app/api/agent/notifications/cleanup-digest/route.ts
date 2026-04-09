import { hasAnyPermission } from "@acre/auth";
import { buildFrontOfficeCleanupDigest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

const cleanupDigestPermissions = [
  "notifications:view",
  "events:view",
  "clients:view",
  "dashboard:view",
] as const;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!hasAnyPermission(context.currentMembership, cleanupDigestPermissions)) {
    return NextResponse.json(
      { error: "Cleanup digest access required." },
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const timeZone = searchParams.get("timeZone")?.trim() || context.currentUser.timezone;

  try {
    const digest = await buildFrontOfficeCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone,
    });

    return NextResponse.json(
      {
        ok: true,
        executionMode: "manual",
        mailThreadHref: "/api/agent/notifications/cleanup-digest/mail-thread",
        digest,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load the cleanup digest.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
