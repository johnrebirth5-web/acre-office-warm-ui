import { hasAnyPermission } from "@acre/auth";
import {
  prisma,
  type UpdateFrontOfficeCleanupRunItemStatusInput,
  updateFrontOfficeCleanupRunItemStatus,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

const cleanupDigestPermissions = [
  "notifications:view",
  "events:view",
  "clients:view",
  "dashboard:view",
] as const;

const cleanupRunItemStatuses = [
  "pending",
  "completed",
  "skipped",
  "revisit",
] satisfies UpdateFrontOfficeCleanupRunItemStatusInput["status"][];

type CleanupRunItemStatus =
  UpdateFrontOfficeCleanupRunItemStatusInput["status"];

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

type CleanupDigestRunItemRouteDependencies = {
  getSessionContext: typeof getRequestSessionContext;
  canViewCleanupDigest: typeof hasAnyPermission;
  updateRunItemStatus: typeof updateFrontOfficeCleanupRunItemStatus;
};

const cleanupDigestRunItemRouteDependencies: CleanupDigestRunItemRouteDependencies =
  {
    getSessionContext: getRequestSessionContext,
    canViewCleanupDigest: hasAnyPermission,
    updateRunItemStatus: updateFrontOfficeCleanupRunItemStatus,
  };

function isCleanupRunItemStatus(
  status: unknown,
): status is CleanupRunItemStatus {
  return (
    typeof status === "string" &&
    cleanupRunItemStatuses.includes(status as CleanupRunItemStatus)
  );
}

function resolveCleanupDigestTimeZone(
  request: NextRequest,
  fallbackTimeZone: string,
) {
  return (
    request.nextUrl.searchParams.get("timeZone")?.trim() || fallbackTimeZone
  );
}

export async function handleCleanupDigestRunItemPatch(
  request: NextRequest,
  { params }: RouteContext,
  dependencies: CleanupDigestRunItemRouteDependencies = cleanupDigestRunItemRouteDependencies,
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

  const itemId = (await params).itemId?.trim() ?? "";

  if (!itemId) {
    return NextResponse.json(
      { error: "A valid cleanup run item id is required." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    note?: unknown;
    status?: unknown;
  } | null;

  if (!body || !isCleanupRunItemStatus(body.status)) {
    return NextResponse.json(
      { error: "A valid cleanup run item status is required." },
      { status: 400 },
    );
  }

  const timeZone = resolveCleanupDigestTimeZone(
    request,
    context.currentUser.timezone,
  );

  try {
    const run = await dependencies.updateRunItemStatus(prisma, {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      itemId,
      status: body.status,
      note: typeof body.note === "string" ? body.note : undefined,
      timeZone,
    });

    if (!run) {
      return NextResponse.json(
        { error: "Cleanup run item not found." },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        itemId,
        status: body.status,
        manualOnlyDetail:
          "Checklist status updated in Acre only. No scheduler or provider sync ran.",
        run,
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
            : "Could not update the cleanup run item.",
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

export async function PATCH(request: NextRequest, routeContext: RouteContext) {
  return handleCleanupDigestRunItemPatch(request, routeContext);
}
