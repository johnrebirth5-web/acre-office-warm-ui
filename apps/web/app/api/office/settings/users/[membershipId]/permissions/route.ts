import { canManageOfficeSettings } from "@acre/auth";
import {
  type PermissionOverrideValue,
  type SessionMembershipContext,
  resetMembershipOfficePermissionOverrides,
  resetMembershipPermissionOverrides,
  saveMembershipOfficePermissionOverrides,
  saveMembershipPermissionOverrides,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildValidationErrorResponse,
  flattenZodFieldErrors,
  parseJsonBody,
} from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import {
  resetOfficeUserPermissionsQuerySchema,
  updateOfficeUserPermissionsBodySchema,
} from "./route.schema";

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

type OfficeUserPermissionsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveMembershipOfficePermissionOverrides?: typeof saveMembershipOfficePermissionOverrides;
  saveMembershipPermissionOverrides?: typeof saveMembershipPermissionOverrides;
  resetMembershipOfficePermissionOverrides?: typeof resetMembershipOfficePermissionOverrides;
  resetMembershipPermissionOverrides?: typeof resetMembershipPermissionOverrides;
};

function parseResetPermissionsQuery(request: NextRequest) {
  const parsed = resetOfficeUserPermissionsQuerySchema.safeParse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    officeId: request.nextUrl.searchParams.get("officeId") ?? undefined,
  });

  if (parsed.success) {
    return {
      ok: true as const,
      data: parsed.data,
    };
  }

  const fieldErrors = flattenZodFieldErrors(parsed.error);
  return {
    ok: false as const,
    response: buildValidationErrorResponse(
      fieldErrors,
      "Permission reset request is invalid.",
    ),
  };
}

export async function handleUpdateOfficeUserPermissionsPatch(
  request: NextRequest,
  membershipId: string,
  context: SessionMembershipContext,
  dependencies: OfficeUserPermissionsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeUserPermissionsBodySchema, {
    error: "Permission override payload is invalid.",
    invalidJsonError: "Permission override request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const scope = normalizeScope(parsedBody.data.scope);
    const overrides: Array<{
      permissionKey: string;
      effect: PermissionOverrideValue;
    }> = (parsedBody.data.overrides ?? []).map((override) => ({
        permissionKey: override.permissionKey ?? "",
        effect: normalizeOverrideEffect(override.effect)
      }));
    const permissions =
      scope === "company"
        ? await (
            dependencies.saveMembershipOfficePermissionOverrides ??
            saveMembershipOfficePermissionOverrides
          )({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            viewerOfficeId: context.currentOffice?.id ?? null,
            officeId: parsedBody.data.officeId ?? "",
            overrides,
          })
        : await (
            dependencies.saveMembershipPermissionOverrides ??
            saveMembershipPermissionOverrides
          )({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            viewerOfficeId: context.currentOffice?.id ?? null,
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

export async function handleResetOfficeUserPermissionsDelete(
  request: NextRequest,
  membershipId: string,
  context: SessionMembershipContext,
  dependencies: OfficeUserPermissionsRouteDependencies = {},
) {
  const parsedQuery = parseResetPermissionsQuery(request);

  if (!parsedQuery.ok) {
    return parsedQuery.response;
  }

  const scope = normalizeScope(parsedQuery.data.scope);
  const officeId = parsedQuery.data.officeId ?? "";

  try {
    const permissions =
      scope === "company"
        ? await (
            dependencies.resetMembershipOfficePermissionOverrides ??
            resetMembershipOfficePermissionOverrides
          )({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            viewerOfficeId: context.currentOffice?.id ?? null,
            officeId,
          })
        : await (
            dependencies.resetMembershipPermissionOverrides ??
            resetMembershipPermissionOverrides
          )({
            organizationId: context.currentOrganization.id,
            actorMembershipId: context.currentMembership.id,
            membershipId,
            viewerOfficeId: context.currentOffice?.id ?? null,
          });

    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset permission overrides." },
      { status: 400 }
    );
  }
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
  return handleUpdateOfficeUserPermissionsPatch(request, membershipId, context);
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
  return handleResetOfficeUserPermissionsDelete(request, membershipId, context);
}
