import { canManageOfficeTasks } from "@acre/auth";
import {
  createTransactionTask,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createOfficeTransactionTaskBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type OfficeTransactionTasksRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createTransactionTask?: typeof createTransactionTask;
};

export async function handleCreateOfficeTransactionTaskPost(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionTasksRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createOfficeTransactionTaskBodySchema,
    {
      error: "Transaction task payload is invalid.",
      invalidJsonError: "Transaction task request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const task = await (dependencies.createTransactionTask ?? createTransactionTask)({
      organizationId: context.currentOrganization.id,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      checklistGroup: parsedBody.data.checklistGroup ?? "",
      title: parsedBody.data.title,
      description: parsedBody.data.description ?? "",
      assigneeMembershipId: parsedBody.data.assigneeMembershipId ?? "",
      dueAt: parsedBody.data.dueAt ?? "",
      status: parsedBody.data.status as never,
      requiresDocument: parsedBody.data.requiresDocument,
      requiresDocumentApproval: parsedBody.data.requiresDocumentApproval,
      requiresSecondaryApproval: parsedBody.data.requiresSecondaryApproval
    });

    if (!task) {
      return NextResponse.json({ error: "Transaction not found or task could not be created." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task could not be created." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleCreateOfficeTransactionTaskPost(request, transactionId, context);
}
