import { can } from "@acre/auth";
import { updateFollowUpTask } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    clientId: string;
    taskId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "clients:manage")) {
    return NextResponse.json(
      { error: "Client management access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const { clientId, taskId } = await params;

  try {
    const task = await updateFollowUpTask({
      organizationId: context.currentOrganization.id,
      clientId,
      taskId,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id ?? null,
      title: typeof body.title === "string" ? body.title : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      dueAt:
        typeof body.dueAt === "string"
          ? body.dueAt
          : body.dueAt === null
            ? null
            : undefined,
    });

    if (!task) {
      return NextResponse.json(
        { error: "Follow-up task not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the follow-up task.",
      },
      { status: 400 },
    );
  }
}
