import {
  archiveSalesProject,
  canManageProjectSigning,
  unarchiveSalesProject,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";

type RouteContext = {
  params: Promise<{ projectId: string }>;
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

const patchBodySchema = z.object({
  status: z.enum(["active", "archived"]),
});

export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing manage access required." }, { status: 403 });
  }

  const { projectId } = await routeContext.params;

  try {
    const project = await archiveSalesProject({
      ...buildProjectSigningContext(context),
      projectId,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project could not be archived." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing manage access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, patchBodySchema, {
    error: "Project status payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { projectId } = await routeContext.params;
  const projectContext = buildProjectSigningContext(context);

  try {
    const project =
      parsedBody.data.status === "archived"
        ? await archiveSalesProject({ ...projectContext, projectId })
        : await unarchiveSalesProject({ ...projectContext, projectId });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project status could not be updated." },
      { status: 400 },
    );
  }
}
