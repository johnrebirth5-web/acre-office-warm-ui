import { canManageOfficeTasks } from "@acre/auth";
import { updateTransactionTask } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    taskId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  const { transactionId, taskId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        checklistGroup?: string;
        title?: string;
        description?: string;
        assigneeMembershipId?: string;
        dueAt?: string;
        status?: string;
        sortOrder?: number;
        requiresDocument?: boolean;
        requiresDocumentApproval?: boolean;
        requiresSecondaryApproval?: boolean;
      }
    | null;

  try {
    const task = await updateTransactionTask({
      organizationId: context.currentOrganization.id,
      transactionId,
      taskId,
      actorMembershipId: context.currentMembership.id,
      checklistGroup: body?.checklistGroup,
      title: body?.title,
      description: body?.description,
      assigneeMembershipId: body?.assigneeMembershipId,
      dueAt: body?.dueAt,
      status: body?.status as never,
      sortOrder: body?.sortOrder,
      requiresDocument: body?.requiresDocument,
      requiresDocumentApproval: body?.requiresDocumentApproval,
      requiresSecondaryApproval: body?.requiresSecondaryApproval
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task update failed." },
      { status: 400 }
    );
  }
}
