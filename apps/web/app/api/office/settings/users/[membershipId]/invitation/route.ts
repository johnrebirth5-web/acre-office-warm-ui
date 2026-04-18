import { canManageOfficeUsers } from "@acre/auth";
import {
  issueInvitationForMembership,
  revokeInvitationForMembership,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../../../lib/request-origin";
import { updateOfficeUserInvitationBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

type OfficeUserInvitationRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  issueInvitationForMembership?: typeof issueInvitationForMembership;
  revokeInvitationForMembership?: typeof revokeInvitationForMembership;
  getRequestOrigin?: typeof getRequestOrigin;
};

export async function handleOfficeUserInvitationPost(
  request: NextRequest,
  membershipId: string,
  context: SessionMembershipContext,
  dependencies: OfficeUserInvitationRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeUserInvitationBodySchema, {
    error: "Invitation request payload is invalid.",
    invalidJsonError: "Invitation request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    if (parsedBody.data.action === "revoke") {
      await (
        dependencies.revokeInvitationForMembership ??
        revokeInvitationForMembership
      )({
        organizationId: context.currentOrganization.id,
        actorMembershipId: context.currentMembership.id,
        membershipId
      });

      return NextResponse.json({ membershipId, revoked: true });
    }

    const result = await (
      dependencies.issueInvitationForMembership ?? issueInvitationForMembership
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId
    });

    return NextResponse.json({
      membershipId,
      invitationId: result.invitationId,
      invitationUrl: new URL(
        result.invitationPath,
        (dependencies.getRequestOrigin ?? getRequestOrigin)(request),
      ).toString(),
      expiresAt: result.expiresAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update the invitation." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  return handleOfficeUserInvitationPost(request, membershipId, context);
}
