import { canManageOfficeTasks } from "@acre/auth";
import { createFollowUpTask } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task management access required." }, { status: 403 });
  }

  const { contactId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }
  const title = String(body.title ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const task = await createFollowUpTask({
    organizationId: context.currentOrganization.id,
    clientId: contactId,
    assigneeMembershipId: context.currentMembership.id,
    actorMembershipId: context.currentMembership.id,
    actorOfficeId: context.currentOffice?.id,
    title,
    dueAt: String(body.dueAt ?? "")
  });

  if (!task) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ task }, { status: 201 });
}
