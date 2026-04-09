import { hasAnyPermission } from "@acre/auth";
import {
  buildFrontOfficeCleanupDigest,
  buildFrontOfficeCleanupDigestDeliveryDraft,
  prisma,
  recordFrontOfficeCleanupDigestRunActivity,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

const cleanupDigestPermissions = [
  "notifications:view",
  "events:view",
  "clients:view",
  "dashboard:view",
] as const;

export const runtime = "nodejs";

type CleanupDigestRouteDependencies = {
  getSessionContext: typeof getRequestSessionContext;
  canViewCleanupDigest: typeof hasAnyPermission;
  getCleanupDigest: typeof buildFrontOfficeCleanupDigest;
  buildDeliveryDraft: typeof buildFrontOfficeCleanupDigestDeliveryDraft;
  recordRunActivity: typeof recordFrontOfficeCleanupDigestRunActivity;
};

function resolveCleanupDigestTimeZone(
  request: NextRequest,
  fallbackTimeZone: string,
) {
  return (
    request.nextUrl.searchParams.get("timeZone")?.trim() || fallbackTimeZone
  );
}

function buildCleanupDigestResponse(input: {
  digest: Awaited<ReturnType<typeof buildFrontOfficeCleanupDigest>>;
  executionMode: "manual" | "manual-run";
  activityLabel?: string;
  manualOnlyDetail?: string;
}) {
  return {
    ok: true,
    executionMode: input.executionMode,
    activityLabel: input.activityLabel,
    manualOnlyDetail: input.manualOnlyDetail,
    mailThreadHref: "/api/agent/notifications/cleanup-digest/mail-thread",
    digest: input.digest,
  };
}

const cleanupDigestRouteDependencies: CleanupDigestRouteDependencies = {
  getSessionContext: getRequestSessionContext,
  canViewCleanupDigest: hasAnyPermission,
  getCleanupDigest: buildFrontOfficeCleanupDigest,
  buildDeliveryDraft: buildFrontOfficeCleanupDigestDeliveryDraft,
  recordRunActivity: recordFrontOfficeCleanupDigestRunActivity,
};

export async function handleCleanupDigestGet(
  request: NextRequest,
  dependencies: CleanupDigestRouteDependencies = cleanupDigestRouteDependencies,
) {
  const context = await dependencies.getSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    !dependencies.canViewCleanupDigest(
      context.currentMembership,
      cleanupDigestPermissions,
    )
  ) {
    return NextResponse.json(
      { error: "Cleanup digest access required." },
      { status: 403 },
    );
  }

  const timeZone = resolveCleanupDigestTimeZone(
    request,
    context.currentUser.timezone,
  );

  try {
    const digest = await dependencies.getCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone,
    });

    return NextResponse.json(
      buildCleanupDigestResponse({
        digest,
        executionMode: "manual",
      }),
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

export async function handleCleanupDigestPost(
  request: NextRequest,
  dependencies: CleanupDigestRouteDependencies = cleanupDigestRouteDependencies,
) {
  const context = await dependencies.getSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    !dependencies.canViewCleanupDigest(
      context.currentMembership,
      cleanupDigestPermissions,
    )
  ) {
    return NextResponse.json(
      { error: "Cleanup digest access required." },
      { status: 403 },
    );
  }

  const timeZone = resolveCleanupDigestTimeZone(
    request,
    context.currentUser.timezone,
  );

  try {
    const digest = await dependencies.getCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone,
    });
    const deliveryDraft = dependencies.buildDeliveryDraft(digest);

    await dependencies.recordRunActivity(prisma, {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      runSummary: deliveryDraft.runSummary,
      contextHref: "/agent/notifications",
      objectLabel: "Cleanup digest manual run",
    });

    return NextResponse.json(
      buildCleanupDigestResponse({
        digest,
        executionMode: "manual-run",
        activityLabel: "Cleanup digest run recorded",
        manualOnlyDetail: "Manual-only. No scheduler. No provider sync.",
      }),
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
            : "Failed to run the cleanup digest.",
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

export async function GET(request: NextRequest) {
  return handleCleanupDigestGet(request);
}

export async function POST(request: NextRequest) {
  return handleCleanupDigestPost(request);
}
