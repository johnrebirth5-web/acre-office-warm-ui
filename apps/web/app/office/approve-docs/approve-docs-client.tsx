"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  EmptyState,
  FilterBar,
  FilterField,
  HorizontalScrollArea,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type {
  OfficeDocumentApprovalQueueSnapshot,
  OfficeDocumentApprovalQueueView,
  OfficeTransactionTask,
  OfficeTransactionTaskComplianceStatus,
  OfficeTransactionTaskReviewStatus
} from "@acre/db";

type OfficeApproveDocsClientProps = {
  snapshot: OfficeDocumentApprovalQueueSnapshot;
  currentMembershipId: string;
  canApproveDocuments: boolean;
  canReviewTasks: boolean;
  canSecondaryReviewTasks: boolean;
};

const queueViewOptions: Array<{ key: OfficeDocumentApprovalQueueView; label: string }> = [
  { key: "all_open_review_items", label: "All open review items" },
  { key: "awaiting_my_review", label: "Awaiting my review" },
  { key: "awaiting_second_review", label: "Awaiting second review" },
  { key: "rejected", label: "Rejected" },
  { key: "waiting_for_signatures", label: "Waiting for signatures" },
  { key: "missing_required_document", label: "Missing required document" }
];

const dueWindowOptions = [
  { value: "", label: "Any due date" },
  { value: "past_due", label: "Past due" },
  { value: "today", label: "Today" },
  { value: "current_week", label: "Current week" },
  { value: "next_week", label: "Next week" },
  { value: "next_2_weeks", label: "Next 2 weeks" }
] as const;

function formatDateLabel(value: string) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(value: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getQueueTone(view: OfficeDocumentApprovalQueueView) {
  if (view === "awaiting_my_review" || view === "awaiting_second_review") {
    return "accent" as const;
  }

  if (view === "rejected" || view === "missing_required_document") {
    return "danger" as const;
  }

  if (view === "waiting_for_signatures") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getReviewTone(status: OfficeTransactionTaskReviewStatus) {
  if (status === "Approved") {
    return "success" as const;
  }

  if (status === "Rejected") {
    return "danger" as const;
  }

  if (status === "Review requested" || status === "Second review" || status === "First approved") {
    return "accent" as const;
  }

  if (status === "Pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getComplianceTone(status: OfficeTransactionTaskComplianceStatus) {
  if (status === "Approved") {
    return "success" as const;
  }

  if (status === "Rejected") {
    return "danger" as const;
  }

  if (status === "In review") {
    return "accent" as const;
  }

  if (status === "Pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getTaskStatusTone(tone: OfficeTransactionTask["taskStatusTone"]) {
  if (tone === "approved" || tone === "completed") {
    return "success" as const;
  }

  if (tone === "rejected") {
    return "danger" as const;
  }

  if (tone === "pending" || tone === "signature") {
    return "warning" as const;
  }

  if (tone === "progress" || tone === "review" || tone === "reopened") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function buildQueueHref(snapshot: OfficeDocumentApprovalQueueSnapshot, queue: OfficeDocumentApprovalQueueView) {
  const params = new URLSearchParams();

  if (queue !== "all_open_review_items") {
    params.set("queue", queue);
  }

  if (snapshot.filters.assigneeMembershipId) {
    params.set("assigneeMembershipId", snapshot.filters.assigneeMembershipId);
  }

  if (snapshot.filters.dueWindow) {
    params.set("dueWindow", snapshot.filters.dueWindow);
  }

  if (snapshot.filters.q.trim()) {
    params.set("q", snapshot.filters.q.trim());
  }

  const query = params.toString();
  return query ? `/office/approve-docs?${query}` : "/office/approve-docs";
}

export function OfficeApproveDocsClient({
  snapshot,
  currentMembershipId,
  canApproveDocuments,
  canReviewTasks,
  canSecondaryReviewTasks
}: OfficeApproveDocsClientProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleWorkflowAction(task: OfficeTransactionTask, action: "complete" | "reopen" | "approve" | "reject") {
    setPendingAction(`${action}:${task.id}`);
    setError("");

    try {
      const rejectionReason =
        action === "reject"
          ? window.prompt("Enter a rejection reason (optional)", task.rejectionReason || "")?.trim() ?? ""
          : "";
      const response = await fetch(`/api/office/transactions/${task.transactionId}/tasks/${task.id}/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          rejectionReason,
          source: "approve_docs_queue"
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to complete the approval queue action.");
      }

      router.refresh();
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to complete the approval queue action.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="office-approval-queue-page">
      <section className="office-approval-view-strip">
        {queueViewOptions.map((option) => (
          <Link
            className={`office-approval-view-link${snapshot.filters.queue === option.key ? " is-active" : ""}`}
            href={buildQueueHref(snapshot, option.key)}
            key={option.key}
          >
            <span>{option.label}</span>
            <strong>{snapshot.summary[option.key]}</strong>
          </Link>
        ))}
      </section>

      <SectionCard
        subtitle="Focus the document review queue by approval state, assignee, and due window. Awaiting my review reflects actions available to the current reviewer."
        title="Queue filters"
      >
        <FilterBar as="form" className="office-approval-filter-bar" method="get">
          <FilterField label="Queue view">
            <SelectInput defaultValue={snapshot.filters.queue} name="queue">
              {queueViewOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Assignee">
            <SelectInput defaultValue={snapshot.filters.assigneeMembershipId} name="assigneeMembershipId">
              <option value="">All assignees</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Due date">
            <SelectInput defaultValue={snapshot.filters.dueWindow} name="dueWindow">
              {dueWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-approval-filter-field-wide" label="Transaction / task / document">
            <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="Search transaction, task, document, form, or owner..." />
          </FilterField>

          <div className="office-approval-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Link className="office-button office-button-secondary" href="/office/approve-docs">
              Reset
            </Link>
          </div>
        </FilterBar>
      </SectionCard>

      <SectionCard
        subtitle={`${snapshot.itemCount} rows in the current review queue`}
        title="Document review queue"
      >
        {error ? <p className="office-approval-inline-error">{error}</p> : null}

        {snapshot.items.length ? (
          <HorizontalScrollArea viewportClassName="office-approval-table-wrap">
            <table className="office-approval-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Transaction</th>
                  <th>Document / Form</th>
                  <th>Assignee / owner</th>
                  <th>Review status</th>
                  <th>Compliance status</th>
                  <th>Requires secondary approval</th>
                  <th>Submitted by</th>
                  <th>Submitted at</th>
                  <th>Due date</th>
                  <th>Last updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.items.map((item) => {
                  const canCurrentUserSecondApprove =
                    !item.task.awaitingSecondaryApproval || item.task.firstApprovedByMembershipId !== currentMembershipId;
                  const canApproveTask =
                    item.task.canApprove &&
                    canApproveDocuments &&
                    ((item.task.awaitingSecondaryApproval && canSecondaryReviewTasks && canCurrentUserSecondApprove) ||
                      (!item.task.awaitingSecondaryApproval && canReviewTasks));
                  const canRejectTask = item.task.canReject && canReviewTasks && canApproveDocuments;

                  return (
                    <tr id={`approve-docs-task-${item.task.id}`} key={item.task.id}>
                      <td>
                        <div className="office-approval-cell-title">{item.task.title}</div>
                        <div className="office-approval-badge-row">
                          <StatusBadge tone={getQueueTone(item.queueState)}>{item.queueStateLabel}</StatusBadge>
                          <StatusBadge tone={getTaskStatusTone(item.task.taskStatusTone)}>{item.task.taskStatusLabel}</StatusBadge>
                        </div>
                        <div className="office-approval-meta-copy">{item.task.checklistGroup}</div>
                        {item.task.rejectionReason ? (
                          <div className="office-approval-meta-copy">Rejection reason: {item.task.rejectionReason}</div>
                        ) : null}
                      </td>
                      <td>
                        <Link href={item.task.transactionHref}>{item.task.transactionLabel}</Link>
                        <div className="office-approval-meta-copy">{item.task.transactionStatus}</div>
                      </td>
                      <td>
                        <div className="office-approval-cell-title">{item.primaryArtifactTitle}</div>
                        {item.secondaryArtifactTitle ? (
                          <div className="office-approval-meta-copy">{item.secondaryArtifactTitle}</div>
                        ) : null}
                        {item.artifactCountLabel ? (
                          <div className="office-approval-meta-copy">{item.artifactCountLabel}</div>
                        ) : null}
                        {item.formStatusLabel ? (
                          <div className="office-approval-meta-copy">Form: {item.formStatusLabel}</div>
                        ) : null}
                        {item.signatureStatusLabel ? (
                          <div className="office-approval-meta-copy">Signature: {item.signatureStatusLabel}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="office-approval-cell-title">{item.task.assigneeName}</div>
                        <div className="office-approval-meta-copy">Owner: {item.task.ownerName}</div>
                      </td>
                      <td>
                        <StatusBadge tone={getReviewTone(item.task.reviewStatus)}>{item.task.reviewStatus}</StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={getComplianceTone(item.task.complianceStatus)}>{item.task.complianceStatus}</StatusBadge>
                      </td>
                      <td>{item.task.requiresSecondaryApproval ? "Yes" : "No"}</td>
                      <td>{item.task.submittedForReviewByName || "—"}</td>
                      <td>{formatDateTimeLabel(item.task.submittedForReviewAt)}</td>
                      <td>{formatDateLabel(item.task.dueAt)}</td>
                      <td>{formatDateTimeLabel(item.task.updatedAt)}</td>
                      <td className="office-approval-actions-cell">
                        <div className="office-approval-action-stack">
                          <div className="office-approval-action-row office-approval-action-row-links">
                            <Link
                              className="office-button office-button-secondary office-button-sm office-inline-action-sm"
                              href={item.task.transactionHref}
                            >
                              Open transaction
                            </Link>
                            {item.openDocumentHref ? (
                              <Link
                                className="office-button office-button-secondary office-button-sm office-inline-action-sm"
                                href={item.openDocumentHref}
                                target="_blank"
                              >
                                Open linked document
                              </Link>
                            ) : null}
                          </div>
                          <div className="office-approval-action-row office-approval-action-row-workflow">
                            {canApproveTask ? (
                              <Button
                                className="office-inline-action-sm"
                                disabled={pendingAction === `approve:${item.task.id}`}
                                onClick={() => handleWorkflowAction(item.task, "approve")}
                                size="sm"
                              >
                                {pendingAction === `approve:${item.task.id}`
                                  ? "Saving..."
                                  : item.task.awaitingSecondaryApproval
                                    ? "Second approve"
                                    : "Approve"}
                              </Button>
                            ) : null}
                            {canRejectTask ? (
                              <Button
                                className="office-inline-action-sm"
                                disabled={pendingAction === `reject:${item.task.id}`}
                                onClick={() => handleWorkflowAction(item.task, "reject")}
                                size="sm"
                                variant="danger"
                              >
                                {pendingAction === `reject:${item.task.id}` ? "Saving..." : "Reject"}
                              </Button>
                            ) : null}
                            {item.task.canReopen ? (
                              <Button
                                className="office-inline-action-sm"
                                disabled={pendingAction === `reopen:${item.task.id}`}
                                onClick={() => handleWorkflowAction(item.task, "reopen")}
                                size="sm"
                                variant="secondary"
                              >
                                {pendingAction === `reopen:${item.task.id}` ? "Saving..." : "Reopen"}
                              </Button>
                            ) : null}
                            {item.task.canCompleteDirectly ? (
                              <Button
                                className="office-inline-action-sm"
                                disabled={pendingAction === `complete:${item.task.id}`}
                                onClick={() => handleWorkflowAction(item.task, "complete")}
                                size="sm"
                              >
                                {pendingAction === `complete:${item.task.id}` ? "Saving..." : "Complete"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </HorizontalScrollArea>
        ) : (
          <EmptyState
            description="No tasks in the current filter scope need to enter the document approval queue."
            title="No document review items"
          />
        )}
      </SectionCard>
    </div>
  );
}
