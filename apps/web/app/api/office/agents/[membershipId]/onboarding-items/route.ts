import { canManageOfficeOnboarding } from "@acre/auth";
import { createAgentOnboardingItem } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { createAgentOnboardingItemBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function handleCreateAgentOnboardingItemPost(
  request: NextRequest,
  membershipId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    createAgentOnboardingItem?: typeof createAgentOnboardingItem;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, createAgentOnboardingItemBodySchema, {
    error: "Agent onboarding payload is invalid.",
    invalidJsonError: "Agent onboarding payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const item = await (dependencies.createAgentOnboardingItem ?? createAgentOnboardingItem)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      title: body.title,
      description: body.description,
      category: body.category,
      dueAt: body.dueAt
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create onboarding item." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOnboarding(context.currentMembership)) {
    return NextResponse.json({ error: "Onboarding management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  return handleCreateAgentOnboardingItemPost(request, membershipId, context);
}
