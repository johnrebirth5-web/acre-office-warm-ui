import { canCommentOfficeActivity } from "@acre/auth";
import { addOfficeActivityComment, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createOfficeActivityCommentBodySchema } from "./route.schema";

type OfficeActivityCommentsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  addOfficeActivityComment?: typeof addOfficeActivityComment;
};

export async function handleCreateOfficeActivityCommentPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeActivityCommentsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createOfficeActivityCommentBodySchema,
    {
      error: "Comment body is required.",
      invalidJsonError: "Comment request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  await (dependencies.addOfficeActivityComment ?? addOfficeActivityComment)({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    scopeLabel: body.scopeLabel?.trim() || context.currentOffice?.name || context.currentOrganization.name,
    body: body.body.trim(),
    contextHref: "/office/activity?view=activity&objectType=comment"
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCommentOfficeActivity(context.currentMembership)) {
    return NextResponse.json({ error: "Activity comment access required." }, { status: 403 });
  }

  return handleCreateOfficeActivityCommentPost(request, context);
}
