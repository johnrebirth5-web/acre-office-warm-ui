import { canManageOfficeSettings } from "@acre/auth";
import {
  type PermissionOverrideValue,
  resetMembershipOfficePermissionOverrides,
  resetMembershipPermissionOverrides,
  saveMembershipOfficePermissionOverrides,
  saveMembershipPermissionOverrides,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

function normalizeOverrideEffect(value: string | undefined): PermissionOverrideValue {
  if (value === "allow" || value === "deny") {
    return value;
  }

  throw new Error("Permission override effect must be allow or deny.");
}

function normalizeScope(value: string | undefined) {
  if (value === "company") {
    return "company" as const;
  }

  return "global" as const;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return NextResponse.json({ error: "Office settings permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        overrides?: Array<{
          permissionKey?: string;
          effect?: string;
        }>;
        scope?: string;
        officeId?: string;
      }
    | null;

  try {
    const scope = normalizeScope(body?.scope);
    const overrides: Array<{
      permissionKey: string;
      effect: PermissionOverrideValue;
    }> =
      body?.overrides?.map((override) => ({
        permissionKey: override.permissionKey ?? "",
        effect: normalizeOverrideEffect(override.effect)
      })) ?? [];
    const permissions =
      scope === "company"
        ? await saveMembershipOfficePermissionOverrides({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            officeId: typeof body?.officeId === "string" ? body.officeId : "",
            overrides,
          })
        : await saveMembershipPermissionOverrides({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            overrides,
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

  if (!canManageOfficeSettings(context.currentMembership)) {
    return NextResponse.json({ error: "Office settings permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const scope = normalizeScope(request.nextUrl.searchParams.get("scope") ?? undefined);
  const officeId = request.nextUrl.searchParams.get("officeId") ?? "";

  try {
    const permissions =
      scope === "company"
        ? await resetMembershipOfficePermissionOverrides({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            officeId,
          })
        : await resetMembershipPermissionOverrides({
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
