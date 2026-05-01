import { canCreateProjectSigning, startProjectSigningHandoff } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../../../lib/request-origin";

type RouteContext = {
  params: Promise<{
    sessionId: string;
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

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const { sessionId } = await routeContext.params;

  try {
    const handoff = await startProjectSigningHandoff({
      ...buildProjectSigningContext(context),
      sessionId,
      expiresInMinutes: 30,
    });

    return NextResponse.json({
      expiresAt: handoff.expiresAt,
      handoffUrl: `${getAppBaseUrl(request)}/sign/handoff/${encodeURIComponent(handoff.rawToken)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Handoff could not be started." },
      { status: 400 },
    );
  }
}
