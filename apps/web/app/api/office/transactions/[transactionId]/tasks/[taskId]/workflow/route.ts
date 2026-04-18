import {
  canAccessOfficeDocumentApprovals,
  canApproveOfficeDocuments,
  canManageOfficeTasks,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import {
  approveTransactionTask,
  completeTransactionTask,
  rejectTransactionTask,
  reopenTransactionTask,
  requestTransactionTaskReview,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { runOfficeTransactionTaskWorkflowBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    taskId: string;
  }>;
};

type OfficeTransactionTaskWorkflowRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  completeTransactionTask?: typeof completeTransactionTask;
  reopenTransactionTask?: typeof reopenTransactionTask;
  requestTransactionTaskReview?: typeof requestTransactionTaskReview;
  approveTransactionTask?: typeof approveTransactionTask;
  rejectTransactionTask?: typeof rejectTransactionTask;
};

export async function handleRunOfficeTransactionTaskWorkflowPost(
  request: NextRequest,
  transactionId: string,
  taskId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionTaskWorkflowRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    runOfficeTransactionTaskWorkflowBodySchema,
    {
      error: "Transaction task workflow payload is invalid.",
      invalidJsonError:
        "Transaction task workflow request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const action = parsedBody.data.action;
  const rejectionReason = parsedBody.data.rejectionReason;
  const activitySource =
    parsedBody.data.source === "approve_docs_queue"
      ? parsedBody.data.source
      : undefined;
  const subject = context.currentMembership;
  const canManageTasks = canManageOfficeTasks(subject);
  const canReviewTasks = canReviewOfficeTasks(subject);
  const canApproveDocuments = canApproveOfficeDocuments(subject);
  const canSecondaryReviewTasks = canSecondaryReviewOfficeTasks(subject);
  const canAccessDocumentApprovals = canAccessOfficeDocumentApprovals(subject);

  if (action === "request_review" && !canManageTasks) {
    return NextResponse.json({ error: "Task management permission required." }, { status: 403 });
  }

  if ((action === "approve" || action === "reject") && (!canReviewTasks || !canApproveDocuments)) {
    return NextResponse.json({ error: "Document review permission required." }, { status: 403 });
  }

  if ((action === "complete" || action === "reopen") && !canManageTasks && !canAccessDocumentApprovals) {
    return NextResponse.json({ error: "Document approval queue access required." }, { status: 403 });
  }

  try {
    const task =
      action === "complete"
        ? await (
            dependencies.completeTransactionTask ?? completeTransactionTask
          )({
            organizationId: context.currentOrganization.id,
            transactionId,
            taskId,
            actorMembershipId: context.currentMembership.id,
            activitySource
          })
        : action === "reopen"
          ? await (
              dependencies.reopenTransactionTask ?? reopenTransactionTask
            )({
              organizationId: context.currentOrganization.id,
              transactionId,
              taskId,
              actorMembershipId: context.currentMembership.id,
              activitySource
            })
          : action === "request_review"
            ? await (
                dependencies.requestTransactionTaskReview ??
                requestTransactionTaskReview
              )({
                organizationId: context.currentOrganization.id,
                transactionId,
                taskId,
                actorMembershipId: context.currentMembership.id,
                activitySource
              })
            : action === "approve"
              ? canReviewTasks &&
                canApproveDocuments
                ? await (
                    dependencies.approveTransactionTask ??
                    approveTransactionTask
                  )({
                    organizationId: context.currentOrganization.id,
                    transactionId,
                    taskId,
                    actorMembershipId: context.currentMembership.id,
                    allowSecondaryApproval: canSecondaryReviewTasks,
                    activitySource
                  })
                : null
              : action === "reject"
                ? canReviewTasks &&
                  canApproveDocuments
                  ? await (
                      dependencies.rejectTransactionTask ??
                      rejectTransactionTask
                    )({
                      organizationId: context.currentOrganization.id,
                      transactionId,
                      taskId,
                      actorMembershipId: context.currentMembership.id,
                      rejectionReason,
                      activitySource
                    })
                  : null
                : null;

    if (!task) {
      return NextResponse.json({ error: "Task not found or workflow action failed." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow action failed." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { transactionId, taskId } = await params;
  return handleRunOfficeTransactionTaskWorkflowPost(
    request,
    transactionId,
    taskId,
    context,
  );
}
