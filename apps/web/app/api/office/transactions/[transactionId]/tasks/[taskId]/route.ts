import { canManageOfficeTasks } from "@acre/auth";
import {
  updateTransactionTask,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateOfficeTransactionTaskBodySchema } from "../route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    taskId: string;
  }>;
};

type OfficeTransactionTaskRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateTransactionTask?: typeof updateTransactionTask;
};

export async function handleUpdateOfficeTransactionTaskPatch(
  request: NextRequest,
  transactionId: string,
  taskId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionTaskRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeTransactionTaskBodySchema,
    {
      error: "Transaction task update payload is invalid.",
      invalidJsonError: "Transaction task update request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const task = await (
      dependencies.updateTransactionTask ?? updateTransactionTask
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      taskId,
      actorMembershipId: context.currentMembership.id,
      checklistGroup: parsedBody.data.checklistGroup,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      assigneeMembershipId: parsedBody.data.assigneeMembershipId,
      dueAt: parsedBody.data.dueAt,
      status: parsedBody.data.status as never,
      sortOrder: parsedBody.data.sortOrder,
      requiresDocument: parsedBody.data.requiresDocument,
      requiresDocumentApproval: parsedBody.data.requiresDocumentApproval,
      requiresSecondaryApproval: parsedBody.data.requiresSecondaryApproval
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  const { transactionId, taskId } = await params;
  return handleUpdateOfficeTransactionTaskPatch(request, transactionId, taskId, context);
}
