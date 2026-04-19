import { canManageOfficeTasks } from "@acre/auth";
import { createFollowUpTask, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createContactFollowUpTaskBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

type ContactFollowUpTaskRouteDependencies = {
  createFollowUpTask?: typeof createFollowUpTask;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateContactFollowUpTaskPost(
  request: NextRequest,
  context: SessionMembershipContext,
  contactId: string,
  dependencies: ContactFollowUpTaskRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createContactFollowUpTaskBodySchema,
    {
      error: "Follow-up task payload is invalid.",
      invalidJsonError: "Follow-up task request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  const task = await (dependencies.createFollowUpTask ?? createFollowUpTask)({
    organizationId: context.currentOrganization.id,
    clientId: contactId,
    assigneeMembershipId: context.currentMembership.id,
    actorMembershipId: context.currentMembership.id,
    actorOfficeId: context.currentOffice?.id,
    title: body.title,
    dueAt: body.dueAt ?? ""
  });

  if (!task) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ task }, { status: 201 });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task management access required." }, { status: 403 });
  }

  const { contactId } = await params;

  return handleCreateContactFollowUpTaskPost(request, context, contactId);
}
