import { canCommentOfficeActivity } from "@acre/auth";
import { addOfficeActivityComment } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCommentOfficeActivity(context.currentMembership)) {
    return NextResponse.json({ error: "Activity comment access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        body?: string;
        officeId?: string | null;
        scopeLabel?: string;
      }
    | null;

  const commentBody = body?.body?.trim();

  if (!commentBody) {
    return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
  }

  await addOfficeActivityComment({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    scopeLabel: body?.scopeLabel?.trim() || context.currentOffice?.name || context.currentOrganization.name,
    body: commentBody,
    contextHref: "/office/activity?view=activity&objectType=comment"
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
