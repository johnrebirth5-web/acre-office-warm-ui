import { canManageOfficeSettings, canManageOfficeUsers } from "@acre/auth";
import { updateOfficeAdminUser, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateOfficeUserBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

type OfficeUserRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateOfficeAdminUser?: typeof updateOfficeAdminUser;
};

export async function handleUpdateOfficeUserPatch(
  request: NextRequest,
  membershipId: string,
  context: SessionMembershipContext,
  dependencies: OfficeUserRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeUserBodySchema, {
    error: "User access payload is invalid.",
    invalidJsonError: "User access request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    if (
      (parsedBody.data.role === "owner" ||
        parsedBody.data.role === "office_admin") &&
      !canManageOfficeSettings(context.currentMembership)
    ) {
      return NextResponse.json(
        { error: "Only Owner / Office Admin can assign admin-tier roles." },
        { status: 403 },
      );
    }

    const membership = await (
      dependencies.updateOfficeAdminUser ?? updateOfficeAdminUser
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      viewerOfficeId: context.currentOffice?.id ?? null,
      firstName: parsedBody.data.firstName,
      lastName: parsedBody.data.lastName,
      email: parsedBody.data.email,
      role: parsedBody.data.role,
      status: parsedBody.data.status,
      defaultOfficeId:
        typeof parsedBody.data.defaultOfficeId === "string" &&
        parsedBody.data.defaultOfficeId !== "__all__"
          ? parsedBody.data.defaultOfficeId
          : parsedBody.data.defaultOfficeId === null
            ? null
            : undefined,
      accessibleOfficeIds: parsedBody.data.accessibleOfficeIds,
      officeId:
        typeof parsedBody.data.officeId === "string"
          ? parsedBody.data.officeId
          : parsedBody.data.officeId === null
            ? null
            : undefined,
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update user access.",
      },
      { status: 400 },
    );
  }
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
  return handleUpdateOfficeUserPatch(request, membershipId, context);
}
