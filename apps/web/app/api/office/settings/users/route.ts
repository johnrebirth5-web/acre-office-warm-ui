import { canManageOfficeSettings, canManageOfficeTeams, canManageOfficeUsers } from "@acre/auth";
import { createInvitedUser, type SessionMembershipContext } from "@acre/db";
import type { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestOrigin } from "../../../../../lib/request-origin";
import { withPermission } from "../../../../../lib/with-permission";
import { createOfficeUserBodySchema } from "./route.schema";

const createableUserRoles = new Set<UserRole>(["owner", "office_admin", "accountant", "human_resources", "team_lead", "agent"]);
const privilegedCreateableUserRoles = new Set<UserRole>(["owner", "office_admin"]);

function isCreateableUserRole(value: string): value is UserRole {
  return createableUserRoles.has(value as UserRole);
}

function isPrivilegedCreateableUserRole(value: UserRole) {
  return privilegedCreateableUserRoles.has(value);
}

type OfficeUsersRouteDependencies = {
  createInvitedUser?: typeof createInvitedUser;
  getRequestOrigin?: typeof getRequestOrigin;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateOfficeUserPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeUsersRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeUserBodySchema, {
    error: "User invitation payload is invalid.",
    invalidJsonError: "User invitation request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    if (
      isPrivilegedCreateableUserRole(parsedBody.data.role as UserRole) &&
      !canManageOfficeSettings(context.currentMembership)
    ) {
      return NextResponse.json(
        { error: "Only Owner / Office Admin can assign admin-tier roles." },
        { status: 403 },
      );
    }

    if (
      (parsedBody.data.teamId?.trim() ||
        parsedBody.data.reportsToTeamMembershipId?.trim()) &&
      !canManageOfficeTeams(context.currentMembership)
    ) {
      return NextResponse.json(
        { error: "Team management permission required." },
        { status: 403 },
      );
    }

    const result = await (
      dependencies.createInvitedUser ?? createInvitedUser
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      email: parsedBody.data.email ?? "",
      firstName: parsedBody.data.firstName ?? "",
      lastName: parsedBody.data.lastName ?? "",
      role: parsedBody.data.role as UserRole,
      defaultOfficeId:
        typeof parsedBody.data.defaultOfficeId === "string" &&
        parsedBody.data.defaultOfficeId !== "__all__"
          ? parsedBody.data.defaultOfficeId
          : typeof parsedBody.data.officeId === "string" &&
              parsedBody.data.officeId !== "__all__"
            ? parsedBody.data.officeId
            : null,
      accessibleOfficeIds: parsedBody.data.accessibleOfficeIds,
      officeId:
        typeof parsedBody.data.officeId === "string" &&
        parsedBody.data.officeId !== "__all__"
          ? parsedBody.data.officeId
          : null,
      title:
        typeof parsedBody.data.title === "string"
          ? parsedBody.data.title
          : null,
      splitTemplateId:
        typeof parsedBody.data.splitTemplateId === "string"
          ? parsedBody.data.splitTemplateId
          : undefined,
      customAgentPercent:
        typeof parsedBody.data.customAgentPercent === "string"
          ? parsedBody.data.customAgentPercent
          : undefined,
      commissionEffectiveFrom:
        typeof parsedBody.data.commissionEffectiveFrom === "string"
          ? parsedBody.data.commissionEffectiveFrom
          : undefined,
      teamId:
        typeof parsedBody.data.teamId === "string"
          ? parsedBody.data.teamId
          : undefined,
      reportsToTeamMembershipId:
        typeof parsedBody.data.reportsToTeamMembershipId === "string"
          ? parsedBody.data.reportsToTeamMembershipId
          : undefined,
    });

    return NextResponse.json({
      membershipId: result.membershipId,
      userId: result.userId,
      invitationId: result.invitationId,
      invitationUrl: new URL(
        result.invitationPath,
        (dependencies.getRequestOrigin ?? getRequestOrigin)(request),
      ).toString(),
      expiresAt: result.expiresAt.toISOString(),
      email: parsedBody.data.email ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create the invited user.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeUsers,
    async (context) => handleCreateOfficeUserPost(request, context),
    {
      forbiddenMessage: "User management permission required.",
    },
  );
}
