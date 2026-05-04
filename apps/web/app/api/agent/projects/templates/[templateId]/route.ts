import {
  canCreateProjectSigning,
  deactivateProjectSigningTemplate,
  deleteUnusedProjectSigningTemplate,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const { templateId } = await routeContext.params;

  try {
    const template = await deleteUnusedProjectSigningTemplate({
      ...buildProjectSigningContext(context),
      templateId,
    });

    return NextResponse.json({ template, deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project signing template could not be deleted." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const { templateId } = await routeContext.params;

  try {
    const template = await deactivateProjectSigningTemplate({
      ...buildProjectSigningContext(context),
      templateId,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project signing template could not be deactivated." },
      { status: 400 },
    );
  }
}
