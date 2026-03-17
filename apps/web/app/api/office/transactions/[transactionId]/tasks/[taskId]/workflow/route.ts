import {
  canAccessOfficeDocumentApprovals,
  canApproveOfficeDocuments,
  canManageOfficeTasks,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import { approveTransactionTask, completeTransactionTask, rejectTransactionTask, reopenTransactionTask, requestTransactionTaskReview } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    taskId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { transactionId, taskId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { action?: string; rejectionReason?: string; source?: string }
    | null;
  const action = body?.action?.trim();
  const rejectionReason = body?.rejectionReason?.trim();
  const activitySource = body?.source === "approve_docs_queue" ? body.source : undefined;
  const subject = context.currentMembership;
  const canManageTasks = canManageOfficeTasks(subject);
  const canReviewTasks = canReviewOfficeTasks(subject);
  const canApproveDocuments = canApproveOfficeDocuments(subject);
  const canSecondaryReviewTasks = canSecondaryReviewOfficeTasks(subject);
  const canAccessDocumentApprovals = canAccessOfficeDocumentApprovals(subject);

  if (!action) {
    return NextResponse.json({ error: "Workflow action is required." }, { status: 400 });
  }

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
        ? await completeTransactionTask({
            organizationId: context.currentOrganization.id,
            transactionId,
            taskId,
            actorMembershipId: context.currentMembership.id,
            activitySource
          })
        : action === "reopen"
          ? await reopenTransactionTask({
              organizationId: context.currentOrganization.id,
              transactionId,
              taskId,
              actorMembershipId: context.currentMembership.id,
              activitySource
            })
          : action === "request_review"
            ? await requestTransactionTaskReview({
                organizationId: context.currentOrganization.id,
                transactionId,
                taskId,
                actorMembershipId: context.currentMembership.id,
                activitySource
              })
            : action === "approve"
              ? canReviewTasks &&
                canApproveDocuments
                ? await approveTransactionTask({
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
                  ? await rejectTransactionTask({
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
