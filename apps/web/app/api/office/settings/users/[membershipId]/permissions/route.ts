import { canManageOfficeUsers } from "@acre/auth";
import { resetMembershipPermissionOverrides, saveMembershipPermissionOverrides } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

function normalizeOverrideEffect(value: string | undefined) {
  if (value === "allow" || value === "deny") {
    return value;
  }

  throw new Error("Permission override effect must be allow or deny.");
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        overrides?: Array<{
          permissionKey?: string;
          effect?: string;
        }>;
      }
    | null;

  try {
    const permissions = await saveMembershipPermissionOverrides({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      overrides:
        body?.overrides?.map((override) => ({
          permissionKey: override.permissionKey ?? "",
          effect: normalizeOverrideEffect(override.effect)
        })) ?? []
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update permission overrides." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;

  try {
    const permissions = await resetMembershipPermissionOverrides({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset permission overrides." },
      { status: 400 }
    );
  }
}
