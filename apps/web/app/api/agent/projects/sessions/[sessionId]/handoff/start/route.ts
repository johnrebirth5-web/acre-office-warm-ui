import { canCreateProjectSigning, startProjectSigningHandoff } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { getAppBaseUrl } from "../../../../../../../../lib/request-origin";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const handoffBodySchema = z.object({
  pin: z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits."),
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

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, handoffBodySchema, {
    error: "Handoff payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { sessionId } = await routeContext.params;

  try {
    const handoff = await startProjectSigningHandoff({
      ...buildProjectSigningContext(context),
      sessionId,
      pin: parsedBody.data.pin,
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

