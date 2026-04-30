import { canManageProjectSigning, saveSalesProjectArchiveSinkEmails } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const archiveSinkBodySchema = z.object({
  archiveSinkEmails: z.array(z.string().trim()),
});

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function PATCH(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing manage access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, archiveSinkBodySchema, {
    error: "Archive sink payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { projectId } = await routeContext.params;

  try {
    const project = await saveSalesProjectArchiveSinkEmails({
      ...buildProjectSigningContext(context),
      projectId,
      archiveSinkEmails: parsedBody.data.archiveSinkEmails,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Archive recipients could not be updated." },
      { status: 400 },
    );
  }
}

