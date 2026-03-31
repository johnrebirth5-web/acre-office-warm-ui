"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Button, EmptyState, FilterBar, FilterField, FormField, HorizontalScrollArea, SectionCard, SelectInput, StatusBadge, TextInput, TextareaInput } from "@acre/ui";
import type {
  OfficeTaskListSnapshot,
  OfficeTaskReviewFilter,
  OfficeTransactionTask,
  OfficeTransactionTaskAssigneeOption,
  OfficeTransactionTaskComplianceStatus,
  OfficeTransactionTaskStatus
} from "@acre/db";

type OfficeTasksClientProps = {
  snapshot: OfficeTaskListSnapshot;
  currentMembershipId: string;
  canApproveDocuments: boolean;
  canReviewTasks: boolean;
  canSecondaryReviewTasks: boolean;
};

type TaskEditState = {
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

type CreateTaskState = TaskEditState & {
  transactionId: string;
};

const taskStatusOptions: OfficeTransactionTaskStatus[] = ["Todo", "In progress", "Review requested", "Completed", "Reopened"];
const dueWindowOptions = [
  { value: "", label: "Any due date" },
  { value: "past_due", label: "Past due" },
  { value: "today", label: "Today" },
  { value: "current_week", label: "Current week" },
  { value: "next_week", label: "Next week" },
  { value: "next_2_weeks", label: "Next 2 weeks" }
] as const;
const reviewStatusOptions: Array<{ value: OfficeTaskReviewFilter; label: string }> = [
  { value: "", label: "Any review state" },
  { value: "Pending", label: "Pending" },
  { value: "Review requested", label: "Review requested" },
  { value: "Second review", label: "Second review requested" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" }
];
const complianceStatusOptions: OfficeTransactionTaskComplianceStatus[] = ["Pending", "In review", "Approved", "Rejected", "Not applicable"];

function buildTaskEditState(task: OfficeTransactionTask): TaskEditState {
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

function buildEmptyCreateState(
  transactionId: string,
  assigneeOptions: OfficeTransactionTaskAssigneeOption[]
): CreateTaskState {
  return {
    transactionId,
    checklistGroup: "General",
    title: "",
    description: "",
    assigneeMembershipId: assigneeOptions[0]?.id ?? "",
    dueAt: "",
    status: "Todo",
    requiresDocument: false,
    requiresDocumentApproval: false,
    requiresSecondaryApproval: false
  };
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

function getTransactionStatusTone(status: string) {
  if (status === "Closed") {
    return "success" as const;
  }

  if (status === "Cancelled") {
    return "danger" as const;
  }

  if (status === "Pending") {
    return "warning" as const;
  }

  if (status === "Active") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function OfficeTasksClient({
  snapshot,
  currentMembershipId,
  canApproveDocuments,
  canReviewTasks,
  canSecondaryReviewTasks
}: OfficeTasksClientProps) {
  const router = useRouter();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskStates, setTaskStates] = useState<Record<string, TaskEditState>>(
    Object.fromEntries(snapshot.tasks.map((task) => [task.id, buildTaskEditState(task)]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saveViewName, setSaveViewName] = useState("");
  const [isSavingView, setIsSavingView] = useState(false);
  const initialTransactionId = snapshot.filters.transactionId || snapshot.transactionOptions[0]?.id || "";
  const [newTaskState, setNewTaskState] = useState<CreateTaskState>(buildEmptyCreateState(initialTransactionId, snapshot.assigneeOptions));
  const showOwnerColumn = snapshot.visibleColumns.includes("owner");
  const attentionSummary = useMemo(
    () => [
      { label: "Overdue", value: snapshot.summary.overdueCount },
      { label: "Due soon", value: snapshot.summary.dueSoonCount },
      { label: "Review queue", value: snapshot.summary.reviewQueueCount },
      { label: "Completed in view", value: snapshot.summary.completedCount }
    ],
    [snapshot.summary]
  );

  function updateTaskField(taskId: string, field: keyof TaskEditState, value: string | boolean) {
    setTaskStates((current) => ({
      ...current,
      [taskId]: {
        ...(current[taskId] ?? buildTaskEditState(snapshot.tasks.find((task) => task.id === taskId)!)),
        [field]: value
      }
    }));
  }

  function updateCreateField(field: keyof CreateTaskState, value: string | boolean) {
    setNewTaskState((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleCreateTask() {
    if (!newTaskState.transactionId || !newTaskState.title.trim()) {
      setError("Transaction and task title are required.");
      return;
    }

    setPendingAction("create");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${newTaskState.transactionId}/tasks`, {
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

      setNewTaskState(buildEmptyCreateState(newTaskState.transactionId, snapshot.assigneeOptions));
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create task.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTask(task: OfficeTransactionTask) {
    const state = taskStates[task.id];

    if (!state?.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setPendingAction(`save:${task.id}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${task.transactionId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(state)
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

  async function handleWorkflowAction(task: OfficeTransactionTask, action: "complete" | "reopen" | "request_review" | "approve" | "reject") {
    setPendingAction(`${action}:${task.id}`);
    setError("");

    try {
      const rejectionReason =
        action === "reject"
          ? window.prompt("Reason for rejection (optional)", task.rejectionReason || "")?.trim() ?? ""
          : "";
      const response = await fetch(`/api/office/transactions/${task.transactionId}/tasks/${task.id}/workflow`, {
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

  async function handleSaveCurrentView() {
    if (!saveViewName.trim()) {
      setError("View name is required.");
      return;
    }

    setIsSavingView(true);
    setError("");

    try {
      const response = await fetch("/api/office/tasks/views", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: saveViewName,
          filters: snapshot.filters,
          visibleColumns: snapshot.visibleColumns,
          sort: snapshot.sort
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save view.");
      }

      const body = (await response.json()) as { view?: { id: string } };

      if (body.view?.id) {
        router.push(`/office/tasks?view=${body.view.id}`);
      } else {
        router.refresh();
      }

      setSaveViewName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save view.");
    } finally {
      setIsSavingView(false);
    }
  }

  return (
    <div className="office-task-list-page">
      <SectionCard
        className="office-list-card office-task-filter-form"
        subtitle="Filter task operations by saved view, assignee, compliance, and transaction context."
        title="Filters"
      >
        <FilterBar as="form" className="office-task-filter-grid" method="get">
          <FilterField className="office-task-filter-field" label="Current view">
            <SelectInput defaultValue={snapshot.selectedViewKey} name="view">
              {snapshot.viewOptions.map((view) => (
                <option key={view.id} value={view.key}>
                  {view.name}
                  {view.isSystem ? " (System)" : ""}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label="Transaction status">
            <SelectInput defaultValue={snapshot.filters.transactionStatus} name="transactionStatus">
              <option value="All">All statuses</option>
              <option value="Opportunity">Opportunity</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label="Assignee">
            <SelectInput defaultValue={snapshot.filters.assigneeMembershipId} name="assigneeMembershipId">
              <option value="">All assignees</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label="Due date">
            <SelectInput defaultValue={snapshot.filters.dueWindow} name="dueWindow">
              {dueWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label="Review status">
            <SelectInput defaultValue={snapshot.filters.reviewStatus} name="reviewStatus">
              {reviewStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label="Transaction">
            <SelectInput defaultValue={snapshot.filters.transactionId} name="transactionId">
              <option value="">All transactions</option>
              {snapshot.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field office-task-filter-field-wide" label="Search">
            <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="Task, transaction, assignee..." type="text" />
          </FilterField>

          <fieldset className="office-task-compliance-filter">
            <legend>Compliance status</legend>
            <div className="office-task-compliance-options">
              {complianceStatusOptions.map((status) => (
                <label key={status}>
                  <input defaultChecked={snapshot.filters.complianceStatuses.includes(status)} name="complianceStatus" type="checkbox" value={status} />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="office-task-boolean-filters">
            <label>
              <input defaultChecked={snapshot.filters.noDueDate} name="noDueDate" type="checkbox" value="1" />
              <span>No due date only</span>
            </label>
            <label>
              <input
                defaultChecked={snapshot.filters.requiresSecondaryApproval}
                name="requiresSecondaryApproval"
                type="checkbox"
                value="1"
              />
              <span>Requires secondary approval</span>
            </label>
            <label>
              <input defaultChecked={snapshot.filters.includeCompleted} name="includeCompleted" type="checkbox" value="1" />
              <span>Include completed</span>
            </label>
          </div>

          <div className="office-task-filter-actions">
            <Button type="submit">
              Apply filters
            </Button>
            <Link className="office-button-secondary" href="/office/tasks">
              Reset
            </Link>
          </div>
        </FilterBar>
      </SectionCard>

      <section className="office-kpi-grid office-kpi-grid-compact">
        {attentionSummary.map((item) => (
          <article className="office-kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <SectionCard
        className="office-list-card office-task-view-save-card"
        subtitle="Built-in views stay fixed. Save the current filter set as a personal custom view."
        title="Saved views"
      >
        <div className="office-task-view-save-row">
          <div>
            <strong>{snapshot.selectedViewName}</strong>
            <p>Use the current filters and visible columns as the starting point for a saved personal view.</p>
          </div>
          <div className="office-task-view-save-controls">
            <TextInput onChange={(event) => setSaveViewName(event.target.value)} placeholder="Save current view as..." value={saveViewName} />
            <Button disabled={isSavingView} onClick={handleSaveCurrentView} type="button" variant="secondary">
              {isSavingView ? "Saving..." : "Save view"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card office-task-create-card"
        subtitle="Create a task directly into the office task list."
        title="New task"
      >
        <div className="office-task-edit-grid">
          <FormField label="Transaction">
            <SelectInput onChange={(event) => updateCreateField("transactionId", event.target.value)} value={newTaskState.transactionId}>
              <option value="">Select transaction</option>
              {snapshot.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Checklist group">
            <TextInput onChange={(event) => updateCreateField("checklistGroup", event.target.value)} type="text" value={newTaskState.checklistGroup} />
          </FormField>
          <FormField className="office-form-grid-span-3" label="Task title">
            <TextInput onChange={(event) => updateCreateField("title", event.target.value)} type="text" value={newTaskState.title} />
          </FormField>
          <FormField className="office-form-grid-span-3" label="Description">
            <TextareaInput onChange={(event) => updateCreateField("description", event.target.value)} rows={3} value={newTaskState.description} />
          </FormField>
          <FormField label="Assignee">
            <SelectInput onChange={(event) => updateCreateField("assigneeMembershipId", event.target.value)} value={newTaskState.assigneeMembershipId}>
              <option value="">Unassigned</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Due date">
            <TextInput onChange={(event) => updateCreateField("dueAt", event.target.value)} type="date" value={newTaskState.dueAt} />
          </FormField>
          <FormField label="Workflow status">
            <SelectInput onChange={(event) => updateCreateField("status", event.target.value)} value={newTaskState.status}>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <div className="office-task-checkbox-row office-detail-field office-detail-field-wide">
            <span>Compliance rules</span>
            <label>
              <input
                checked={newTaskState.requiresDocument}
                onChange={(event) => updateCreateField("requiresDocument", event.target.checked)}
                type="checkbox"
              />
              <span>Requires document</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresDocumentApproval}
                onChange={(event) => updateCreateField("requiresDocumentApproval", event.target.checked)}
                type="checkbox"
              />
              <span>Requires review</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresSecondaryApproval}
                onChange={(event) => updateCreateField("requiresSecondaryApproval", event.target.checked)}
                type="checkbox"
              />
              <span>Requires secondary approval</span>
            </label>
          </div>
        </div>

        <div className="office-task-create-actions">
          <Button disabled={pendingAction === "create"} onClick={handleCreateTask} type="button" variant="secondary">
            {pendingAction === "create" ? "Creating..." : "Create task"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card office-task-list-card"
        subtitle={`${snapshot.taskCount} task rows in the current view`}
        title="Task list"
      >
        {error ? <p className="office-form-error office-task-inline-error">{error}</p> : null}

        <HorizontalScrollArea viewportClassName="office-task-table-wrap">
          <table className="office-task-table">
            <thead>
              <tr>
                <th>Task / title</th>
                <th>Transaction</th>
                <th>Checklist group</th>
                <th>Assignee</th>
                <th>Due date</th>
                <th>Task Status</th>
                <th>Transaction status</th>
                {showOwnerColumn ? <th>User / owner</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tasks.length ? (
                snapshot.tasks.map((task) => {
                  const formState = taskStates[task.id] ?? buildTaskEditState(task);
                  const isExpanded = expandedTaskId === task.id;
                  const canCurrentUserSecondApprove =
                    !task.awaitingSecondaryApproval || task.firstApprovedByMembershipId !== currentMembershipId;

                  return (
                    <Fragment key={task.id}>
                      <tr key={task.id}>
                        <td>
                          <button
                            className="office-task-title-button"
                            onClick={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                            type="button"
                          >
                            {task.title}
                          </button>
                          <span className="office-task-meta-copy">{task.description || task.reviewStatus}</span>
                        </td>
                        <td>
                          <Link href={task.transactionHref}>{task.transactionLabel}</Link>
                        </td>
                        <td>{task.checklistGroup}</td>
                        <td>{task.assigneeName}</td>
                        <td>{task.dueAt || "No due date"}</td>
                        <td>
                          <StatusBadge tone={getTaskStatusTone(task.taskStatusTone)}>{task.taskStatusLabel}</StatusBadge>
                        </td>
                        <td>
                          <StatusBadge tone={getTransactionStatusTone(task.transactionStatus)}>{task.transactionStatus}</StatusBadge>
                        </td>
                        {showOwnerColumn ? <td>{task.ownerName}</td> : null}
                        <td>
                          <div className="office-task-action-strip">
                            {task.canCompleteDirectly ? (
                              <Button
                                disabled={pendingAction === `complete:${task.id}`}
                                onClick={() => handleWorkflowAction(task, "complete")}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Complete
                              </Button>
                            ) : null}
                            {task.canRequestReview ? (
                              <Button
                                disabled={pendingAction === `request_review:${task.id}`}
                                onClick={() => handleWorkflowAction(task, "request_review")}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Request review
                              </Button>
                            ) : null}
                            {task.canApprove &&
                            canApproveDocuments &&
                            ((task.awaitingSecondaryApproval && canSecondaryReviewTasks && canCurrentUserSecondApprove) ||
                              (!task.awaitingSecondaryApproval && canReviewTasks)) ? (
                              <Button
                                disabled={pendingAction === `approve:${task.id}`}
                                onClick={() => handleWorkflowAction(task, "approve")}
                                size="sm"
                                type="button"
                              >
                                {task.awaitingSecondaryApproval ? "Second approve" : "Approve"}
                              </Button>
                            ) : null}
                            {task.canReject && canReviewTasks && canApproveDocuments ? (
                              <Button
                                disabled={pendingAction === `reject:${task.id}`}
                                onClick={() => handleWorkflowAction(task, "reject")}
                                size="sm"
                                type="button"
                                variant="danger"
                              >
                                Reject
                              </Button>
                            ) : null}
                            {task.canReopen ? (
                              <Button
                                disabled={pendingAction === `reopen:${task.id}`}
                                onClick={() => handleWorkflowAction(task, "reopen")}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Reopen
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="office-task-edit-row" key={`${task.id}-editor`}>
                          <td colSpan={showOwnerColumn ? 9 : 8}>
                            <div className="office-task-edit-grid">
                              <FormField label="Checklist group">
                                <TextInput
                                  onChange={(event) => updateTaskField(task.id, "checklistGroup", event.target.value)}
                                  type="text"
                                  value={formState.checklistGroup}
                                />
                              </FormField>
                              <FormField className="office-form-grid-span-3" label="Task title">
                                <TextInput onChange={(event) => updateTaskField(task.id, "title", event.target.value)} type="text" value={formState.title} />
                              </FormField>
                              <FormField className="office-form-grid-span-3" label="Description">
                                <TextareaInput
                                  onChange={(event) => updateTaskField(task.id, "description", event.target.value)}
                                  rows={3}
                                  value={formState.description}
                                />
                              </FormField>
                              <FormField label="Assignee">
                                <SelectInput
                                  onChange={(event) => updateTaskField(task.id, "assigneeMembershipId", event.target.value)}
                                  value={formState.assigneeMembershipId}
                                >
                                  <option value="">Unassigned</option>
                                  {snapshot.assigneeOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </SelectInput>
                              </FormField>
                              <FormField label="Due date">
                                <TextInput onChange={(event) => updateTaskField(task.id, "dueAt", event.target.value)} type="date" value={formState.dueAt} />
                              </FormField>
                              <FormField label="Workflow status">
                                <SelectInput onChange={(event) => updateTaskField(task.id, "status", event.target.value)} value={formState.status}>
                                  {taskStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </SelectInput>
                              </FormField>

                              <div className="office-task-checkbox-row office-detail-field office-detail-field-wide">
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

                            <div className="office-task-detail-meta">
                              <span>Review status: {task.reviewStatus}</span>
                              <span>Compliance status: {task.complianceStatus}</span>
                              <span>Completed at: {formatDateTimeLabel(task.completedAt)}</span>
                              <span>Submitted for review: {formatDateTimeLabel(task.submittedForReviewAt)}</span>
                              <span>Submitted by: {task.submittedForReviewByName || "—"}</span>
                              <span>First approver: {task.firstApprovedByName || "—"}</span>
                              <span>Second approver: {task.secondApprovedByName || "—"}</span>
                              <span>Secondary approval: {task.requiresSecondaryApproval ? "Enabled" : "Not required"}</span>
                              <span>Rejection reason: {task.rejectionReason || "—"}</span>
                            </div>

                            {task.linkedDocuments.length ? (
                              <div className="office-task-detail-meta office-task-detail-documents">
                                {task.linkedDocuments.map((document) => (
                                  <span key={document.id}>
                                    <a href={document.href}>{document.title}</a>
                                    {` · ${document.status}`}
                                    {document.isSigned ? " · Signed" : ""}
                                    {document.hasPendingSignature ? " · Signature pending" : ""}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="office-task-detail-meta office-task-detail-documents">
                                <span>Linked documents: —</span>
                              </div>
                            )}

                            <div className="office-task-edit-actions">
                              <Button
                                disabled={pendingAction === `save:${task.id}`}
                                onClick={() => handleSaveTask(task)}
                                variant="secondary"
                                type="button"
                              >
                                {pendingAction === `save:${task.id}` ? "Saving..." : "Save task"}
                              </Button>
                              <Link className="office-button-secondary office-button-sm" href={task.transactionHref}>
                                Open transaction
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={showOwnerColumn ? 9 : 8}>
                    <EmptyState
                      description="Adjust the filters or switch saved views to widen the task result set."
                      title="No tasks matched the current filters"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </HorizontalScrollArea>
      </SectionCard>
    </div>
  );
}
