"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OfficeTransactionTask, OfficeTransactionTaskAssigneeOption, OfficeTransactionTaskStatus } from "@acre/db";

type TransactionTasksCardProps = {
  transactionId: string;
  tasks: OfficeTransactionTask[];
  assigneeOptions: OfficeTransactionTaskAssigneeOption[];
  currentMembershipId: string;
  canReviewTasks: boolean;
  canSecondaryReviewTasks: boolean;
  canApproveDocuments: boolean;
};

type TaskFormState = {
  checklistGroup: string;
  title: string;
  description: string;
  assigneeMembershipId: string;
  dueAt: string;
  status: OfficeTransactionTaskStatus;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
};

const taskStatusOptions: OfficeTransactionTaskStatus[] = ["Todo", "In progress", "Review requested", "Completed", "Reopened"];

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

function buildTaskState(task: OfficeTransactionTask): TaskFormState {
  return {
    checklistGroup: task.checklistGroup,
    title: task.title,
    description: task.description,
    assigneeMembershipId: task.assigneeMembershipId ?? "",
    dueAt: task.dueAt,
    status: task.status,
    requiresDocument: task.requiresDocument,
    requiresDocumentApproval: task.requiresDocumentApproval,
    requiresSecondaryApproval: task.requiresSecondaryApproval
  };
}

export function TransactionTasksCard({
  transactionId,
  tasks,
  assigneeOptions,
  currentMembershipId,
  canReviewTasks,
  canSecondaryReviewTasks,
  canApproveDocuments
}: TransactionTasksCardProps) {
  const router = useRouter();
  const [taskStates, setTaskStates] = useState<Record<string, TaskFormState>>(
    Object.fromEntries(tasks.map((task) => [task.id, buildTaskState(task)]))
  );
  const [newTaskState, setNewTaskState] = useState<TaskFormState>({
    checklistGroup: "General",
    title: "",
    description: "",
    assigneeMembershipId: assigneeOptions[0]?.id ?? "",
    dueAt: "",
    status: "Todo",
    requiresDocument: false,
    requiresDocumentApproval: false,
    requiresSecondaryApproval: false
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groupedTasks = tasks.reduce<Record<string, OfficeTransactionTask[]>>((groups, task) => {
    const groupName = task.checklistGroup || "General";

    if (!groups[groupName]) {
      groups[groupName] = [];
    }

    groups[groupName].push(task);
    return groups;
  }, {});

  function updateTaskField(taskId: string, field: keyof TaskFormState, value: string | boolean) {
    setTaskStates((current) => ({
      ...current,
      [taskId]: {
        ...(current[taskId] ?? buildTaskState(tasks.find((task) => task.id === taskId)!)),
        [field]: value
      }
    }));
  }

  function updateNewTaskField(field: keyof TaskFormState, value: string | boolean) {
    setNewTaskState((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleCreateTask() {
    if (!newTaskState.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setPendingAction("create");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newTaskState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create task.");
      }

      setNewTaskState({
        checklistGroup: "General",
        title: "",
        description: "",
        assigneeMembershipId: assigneeOptions[0]?.id ?? "",
        dueAt: "",
        status: "Todo",
        requiresDocument: false,
        requiresDocumentApproval: false,
        requiresSecondaryApproval: false
      });
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create task.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTask(taskId: string) {
    const taskState = taskStates[taskId];

    if (!taskState?.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setPendingAction(`save:${taskId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(taskState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update task.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleWorkflowAction(
    task: OfficeTransactionTask,
    action: "complete" | "reopen" | "request_review" | "approve" | "reject"
  ) {
    const taskId = task.id;
    setPendingAction(`${action}:${taskId}`);
    setError("");

    try {
      const rejectionReason =
        action === "reject"
          ? window.prompt("Reason for rejection (optional)", task.rejectionReason || "")?.trim() ?? ""
          : "";
      const response = await fetch(`/api/office/transactions/${transactionId}/tasks/${taskId}/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, rejectionReason })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update task workflow.");
      }

      router.refresh();
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Failed to update task workflow.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card" id="transaction-tasks">
      <div className="office-card-head">
        <h3>Checklist / Tasks</h3>
        <Link className="office-toggle-link" href={`/office/tasks?transactionId=${transactionId}`}>
          Open Task List
        </Link>
      </div>

      <div className="office-transaction-task-groups">
        {Object.entries(groupedTasks).length > 0 ? (
          Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
            <section className="office-transaction-task-group" key={groupName}>
              <div className="office-transaction-task-group-head">
                <strong>{groupName}</strong>
                <span>{groupTasks.length} task{groupTasks.length === 1 ? "" : "s"}</span>
              </div>

              <div className="office-transaction-task-list">
                {groupTasks.map((task) => {
                  const formState = taskStates[task.id] ?? buildTaskState(task);
                  const canCurrentUserSecondApprove =
                    !task.awaitingSecondaryApproval || task.firstApprovedByMembershipId !== currentMembershipId;

                  return (
                    <article className="office-transaction-task-row" id={`transaction-task-${task.id}`} key={task.id}>
                      <div className="office-transaction-task-top">
                        <div className="office-transaction-task-status">
                          <span className={`office-status-pill office-task-status-${task.taskStatusTone}`}>{task.taskStatusLabel}</span>
                          <strong>{task.assigneeName}</strong>
                          <span>{task.complianceStatus}</span>
                        </div>
                        <div className="office-transaction-task-actions">
                          {task.requiresDocument || task.requiresDocumentApproval ? (
                            <Link className="office-toggle-link" href={`/office/transactions/${transactionId}#transaction-forms-signatures`}>
                              Use forms
                            </Link>
                          ) : null}
                          {task.canCompleteDirectly ? (
                            <button
                              className="office-toggle-link"
                              disabled={pendingAction === `complete:${task.id}`}
                              onClick={() => handleWorkflowAction(task, "complete")}
                              type="button"
                            >
                              {pendingAction === `complete:${task.id}` ? "Saving..." : "Complete"}
                            </button>
                          ) : null}
                          {task.canRequestReview ? (
                            <button
                              className="office-toggle-link"
                              disabled={pendingAction === `request_review:${task.id}`}
                              onClick={() => handleWorkflowAction(task, "request_review")}
                              type="button"
                            >
                              {pendingAction === `request_review:${task.id}` ? "Saving..." : "Request review"}
                            </button>
                          ) : null}
                          {task.canApprove &&
                          canApproveDocuments &&
                          ((task.awaitingSecondaryApproval && canSecondaryReviewTasks && canCurrentUserSecondApprove) ||
                            (!task.awaitingSecondaryApproval && canReviewTasks)) ? (
                            <button
                              className="office-toggle-link"
                              disabled={pendingAction === `approve:${task.id}`}
                              onClick={() => handleWorkflowAction(task, "approve")}
                              type="button"
                            >
                              {pendingAction === `approve:${task.id}`
                                ? "Saving..."
                                : task.awaitingSecondaryApproval
                                  ? "Second approve"
                                  : "Approve"}
                            </button>
                          ) : null}
                          {task.canReject && canReviewTasks && canApproveDocuments ? (
                            <button
                              className="office-toggle-link"
                              disabled={pendingAction === `reject:${task.id}`}
                              onClick={() => handleWorkflowAction(task, "reject")}
                              type="button"
                            >
                              {pendingAction === `reject:${task.id}` ? "Saving..." : "Reject"}
                            </button>
                          ) : null}
                          {task.canReopen ? (
                            <button
                              className="office-toggle-link"
                              disabled={pendingAction === `reopen:${task.id}`}
                              onClick={() => handleWorkflowAction(task, "reopen")}
                              type="button"
                            >
                              {pendingAction === `reopen:${task.id}` ? "Saving..." : "Reopen"}
                            </button>
                          ) : null}
                          <button
                            className="office-button"
                            disabled={pendingAction === `save:${task.id}`}
                            onClick={() => handleSaveTask(task.id)}
                            type="button"
                          >
                            {pendingAction === `save:${task.id}` ? "Saving..." : "Save task"}
                          </button>
                        </div>
                      </div>

                      <div className="office-transaction-task-grid">
                        <label className="office-detail-field">
                          <span>Checklist group</span>
                          <input
                            onChange={(event) => updateTaskField(task.id, "checklistGroup", event.target.value)}
                            type="text"
                            value={formState.checklistGroup}
                          />
                        </label>
                        <label className="office-detail-field">
                          <span>Task title</span>
                          <input onChange={(event) => updateTaskField(task.id, "title", event.target.value)} type="text" value={formState.title} />
                        </label>
                        <label className="office-detail-field">
                          <span>Assignee</span>
                          <select
                            onChange={(event) => updateTaskField(task.id, "assigneeMembershipId", event.target.value)}
                            value={formState.assigneeMembershipId}
                          >
                            <option value="">Unassigned</option>
                            {assigneeOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="office-detail-field">
                          <span>Due date</span>
                          <input onChange={(event) => updateTaskField(task.id, "dueAt", event.target.value)} type="date" value={formState.dueAt} />
                        </label>
                        <label className="office-detail-field">
                          <span>Workflow status</span>
                          <select onChange={(event) => updateTaskField(task.id, "status", event.target.value)} value={formState.status}>
                            {taskStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="office-detail-field">
                          <span>Review state</span>
                          <strong>
                            {task.reviewStatus} / {task.complianceStatus}
                          </strong>
                        </div>
                        <label className="office-detail-field office-detail-field-wide">
                          <span>Description</span>
                          <textarea
                            onChange={(event) => updateTaskField(task.id, "description", event.target.value)}
                            rows={3}
                            value={formState.description}
                          />
                        </label>
                        <div className="office-detail-field office-detail-field-wide office-task-checkbox-row">
                          <span>Compliance rules</span>
                          <label>
                            <input
                              checked={formState.requiresDocument}
                              onChange={(event) => updateTaskField(task.id, "requiresDocument", event.target.checked)}
                              type="checkbox"
                            />
                            <span>Requires document</span>
                          </label>
                          <label>
                            <input
                              checked={formState.requiresDocumentApproval}
                              onChange={(event) => updateTaskField(task.id, "requiresDocumentApproval", event.target.checked)}
                              type="checkbox"
                            />
                            <span>Requires review</span>
                          </label>
                          <label>
                            <input
                              checked={formState.requiresSecondaryApproval}
                              onChange={(event) => updateTaskField(task.id, "requiresSecondaryApproval", event.target.checked)}
                              type="checkbox"
                            />
                            <span>Requires secondary approval</span>
                          </label>
                        </div>
                      </div>

                      <div className="office-transaction-task-evidence">
                        <div className="office-transaction-task-evidence-grid">
                          <span>Submitted by: {task.submittedForReviewByName || "—"}</span>
                          <span>Submitted at: {task.submittedForReviewAt ? formatDateTimeLabel(task.submittedForReviewAt) : "—"}</span>
                          <span>First approver: {task.firstApprovedByName || "—"}</span>
                          <span>Second approver: {task.secondApprovedByName || "—"}</span>
                          <span>Rejected by: {task.rejectedByName || "—"}</span>
                          <span>Rejection reason: {task.rejectionReason || "—"}</span>
                          <span>Secondary approval: {task.requiresSecondaryApproval ? "Enabled" : "Not required"}</span>
                          <span>Awaiting second review: {task.awaitingSecondaryApproval ? "Yes" : "No"}</span>
                        </div>

                        {task.linkedDocuments.length ? (
                          <div className="office-transaction-task-linked-documents">
                            {task.linkedDocuments.map((document) => (
                              <a className="office-task-linked-document" href={document.href} key={document.id}>
                                <strong>{document.title}</strong>
                                <span>{document.status}</span>
                                {document.isSigned ? <span>Signed</span> : null}
                                {document.hasPendingSignature ? <span>Signature pending</span> : null}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="office-transaction-task-linked-documents is-empty">No linked documents yet.</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="office-detail-field">
            <span>Tasks</span>
            <strong>No checklist tasks yet.</strong>
          </div>
        )}
      </div>

      <div className="office-transaction-task-create">
        <div className="office-card-head office-card-head-inline">
          <h3>New task</h3>
        </div>

        <div className="office-transaction-task-grid">
          <label className="office-detail-field">
            <span>Checklist group</span>
            <input onChange={(event) => updateNewTaskField("checklistGroup", event.target.value)} type="text" value={newTaskState.checklistGroup} />
          </label>
          <label className="office-detail-field">
            <span>Task title</span>
            <input onChange={(event) => updateNewTaskField("title", event.target.value)} type="text" value={newTaskState.title} />
          </label>
          <label className="office-detail-field">
            <span>Assignee</span>
            <select onChange={(event) => updateNewTaskField("assigneeMembershipId", event.target.value)} value={newTaskState.assigneeMembershipId}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="office-detail-field">
            <span>Due date</span>
            <input onChange={(event) => updateNewTaskField("dueAt", event.target.value)} type="date" value={newTaskState.dueAt} />
          </label>
          <label className="office-detail-field">
            <span>Workflow status</span>
            <select onChange={(event) => updateNewTaskField("status", event.target.value)} value={newTaskState.status}>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="office-detail-field office-detail-field-wide">
            <span>Description</span>
            <textarea onChange={(event) => updateNewTaskField("description", event.target.value)} rows={3} value={newTaskState.description} />
          </label>
          <div className="office-detail-field office-detail-field-wide office-task-checkbox-row">
            <span>Compliance rules</span>
            <label>
              <input
                checked={newTaskState.requiresDocument}
                onChange={(event) => updateNewTaskField("requiresDocument", event.target.checked)}
                type="checkbox"
              />
              <span>Requires document</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresDocumentApproval}
                onChange={(event) => updateNewTaskField("requiresDocumentApproval", event.target.checked)}
                type="checkbox"
              />
              <span>Requires review</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresSecondaryApproval}
                onChange={(event) => updateNewTaskField("requiresSecondaryApproval", event.target.checked)}
                type="checkbox"
              />
              <span>Requires secondary approval</span>
            </label>
          </div>
        </div>

        {error ? <p className="office-form-error">{error}</p> : null}

        <div className="office-transaction-task-actions">
          <button className="office-button" disabled={pendingAction === "create"} onClick={handleCreateTask} type="button">
            {pendingAction === "create" ? "Creating..." : "Create task"}
          </button>
        </div>
      </div>
    </section>
  );
}
