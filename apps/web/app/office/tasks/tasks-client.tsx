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
import { KpiStrip } from "../../_components/kpi-strip";
import { useI18n } from "../../../lib/i18n/client";
import { formatOfficeDateTimeLabel, translateOfficeTaskCopy } from "../_utils/task-copy";

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
  { value: "", label: "Any due date", zhLabel: "全部到期时间" },
  { value: "past_due", label: "Past due", zhLabel: "已逾期" },
  { value: "today", label: "Today", zhLabel: "今天到期" },
  { value: "current_week", label: "Current week", zhLabel: "本周到期" },
  { value: "next_week", label: "Next week", zhLabel: "下周到期" },
  { value: "next_2_weeks", label: "Next 2 weeks", zhLabel: "未来两周" }
] as const;
const reviewStatusOptions: Array<{ value: OfficeTaskReviewFilter; label: string; zhLabel: string }> = [
  { value: "", label: "Any review state", zhLabel: "全部审核状态" },
  { value: "Pending", label: "Pending", zhLabel: "待处理" },
  { value: "Review requested", label: "Review requested", zhLabel: "等待审核" },
  { value: "Second review", label: "Second review requested", zhLabel: "等待二级审核" },
  { value: "Approved", label: "Approved", zhLabel: "已通过" },
  { value: "Rejected", label: "Rejected", zhLabel: "已退回" }
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

function optionLabel(option: { label: string; zhLabel: string }, isZh: boolean) {
  return isZh ? option.zhLabel : option.label;
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
      { label: isZh ? "已逾期" : "Overdue", value: snapshot.summary.overdueCount },
      { label: isZh ? "即将到期" : "Due soon", value: snapshot.summary.dueSoonCount },
      { label: isZh ? "审核队列" : "Review queue", value: snapshot.summary.reviewQueueCount },
      { label: isZh ? "当前已完成" : "Completed in view", value: snapshot.summary.completedCount }
    ],
    [isZh, snapshot.summary]
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
      setError(isZh ? "请选择交易并填写任务标题。" : "Transaction and task title are required.");
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
        throw new Error(body?.error ?? (isZh ? "创建任务失败。" : "Failed to create task."));
      }

      setNewTaskState(buildEmptyCreateState(newTaskState.transactionId, snapshot.assigneeOptions));
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : isZh ? "创建任务失败。" : "Failed to create task.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTask(task: OfficeTransactionTask) {
    const state = taskStates[task.id];

    if (!state?.title.trim()) {
      setError(isZh ? "请填写任务标题。" : "Task title is required.");
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
        throw new Error(body?.error ?? (isZh ? "更新任务失败。" : "Failed to update task."));
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "更新任务失败。" : "Failed to update task.");
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
          ? window.prompt(isZh ? "退回原因（可选）" : "Reason for rejection (optional)", task.rejectionReason || "")?.trim() ?? ""
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
        throw new Error(body?.error ?? (isZh ? "更新任务流程失败。" : "Failed to update task workflow."));
      }

      router.refresh();
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : isZh ? "更新任务流程失败。" : "Failed to update task workflow.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveCurrentView() {
    if (!saveViewName.trim()) {
      setError(isZh ? "请填写视图名称。" : "View name is required.");
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
        throw new Error(body?.error ?? (isZh ? "保存视图失败。" : "Failed to save view."));
      }

      const body = (await response.json()) as { view?: { id: string } };

      if (body.view?.id) {
        router.push(`/office/tasks?view=${body.view.id}`);
      } else {
        router.refresh();
      }

      setSaveViewName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "保存视图失败。" : "Failed to save view.");
    } finally {
      setIsSavingView(false);
    }
  }

  return (
    <div className="office-task-list-page">
      <FilterBar aria-label={isZh ? "任务筛选" : "Task filters"} as="form" className="office-task-filter-form office-task-filter-grid" method="get">
          <FilterField className="office-task-filter-field" label={isZh ? "当前视图" : "Current view"}>
            <SelectInput defaultValue={snapshot.selectedViewKey} name="view">
              {snapshot.viewOptions.map((view) => (
                <option key={view.id} value={view.key}>
                  {translateOfficeTaskCopy(view.name, isZh)}
                  {view.isSystem ? (isZh ? "（系统）" : " (System)") : ""}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label={isZh ? "交易状态" : "Transaction status"}>
            <SelectInput defaultValue={snapshot.filters.transactionStatus} name="transactionStatus">
              <option value="All">{translateOfficeTaskCopy("All statuses", isZh)}</option>
              <option value="Opportunity">{translateOfficeTaskCopy("Opportunity", isZh)}</option>
              <option value="Active">{translateOfficeTaskCopy("Active", isZh)}</option>
              <option value="Pending">{translateOfficeTaskCopy("Pending", isZh)}</option>
              <option value="Closed">{translateOfficeTaskCopy("Closed", isZh)}</option>
              <option value="Cancelled">{translateOfficeTaskCopy("Cancelled", isZh)}</option>
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label={isZh ? "负责人" : "Assignee"}>
            <SelectInput defaultValue={snapshot.filters.assigneeMembershipId} name="assigneeMembershipId">
              <option value="">{isZh ? "全部负责人" : "All assignees"}</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label={isZh ? "到期时间" : "Due date"}>
            <SelectInput defaultValue={snapshot.filters.dueWindow} name="dueWindow">
              {dueWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {optionLabel(option, isZh)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label={isZh ? "审核状态" : "Review status"}>
            <SelectInput defaultValue={snapshot.filters.reviewStatus} name="reviewStatus">
              {reviewStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {optionLabel(option, isZh)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field" label={isZh ? "交易" : "Transaction"}>
            <SelectInput defaultValue={snapshot.filters.transactionId} name="transactionId">
              <option value="">{isZh ? "全部交易" : "All transactions"}</option>
              {snapshot.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-task-filter-field office-task-filter-field-wide" label={isZh ? "搜索" : "Search"}>
            <TextInput defaultValue={snapshot.filters.q} name="q" placeholder={isZh ? "任务、交易、负责人..." : "Task, transaction, assignee..."} type="text" />
          </FilterField>

          <fieldset className="office-task-compliance-filter">
            <legend>{isZh ? "合规状态" : "Compliance status"}</legend>
            <div className="office-task-compliance-options">
              {complianceStatusOptions.map((status) => (
                <label key={status}>
                  <input defaultChecked={snapshot.filters.complianceStatuses.includes(status)} name="complianceStatus" type="checkbox" value={status} />
                  <span>{translateOfficeTaskCopy(status, isZh)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="office-task-boolean-filters">
            <label>
              <input defaultChecked={snapshot.filters.noDueDate} name="noDueDate" type="checkbox" value="1" />
              <span>{isZh ? "只看无到期时间" : "No due date only"}</span>
            </label>
            <label>
              <input
                defaultChecked={snapshot.filters.requiresSecondaryApproval}
                name="requiresSecondaryApproval"
                type="checkbox"
                value="1"
              />
              <span>{isZh ? "需要二级审核" : "Requires secondary approval"}</span>
            </label>
            <label>
              <input defaultChecked={snapshot.filters.includeCompleted} name="includeCompleted" type="checkbox" value="1" />
              <span>{isZh ? "包含已完成" : "Include completed"}</span>
            </label>
          </div>

          <div className="office-task-filter-actions">
            <Button type="submit">
              {isZh ? "应用筛选" : "Apply filters"}
            </Button>
            <Link className="office-button-secondary" href="/office/tasks">
              {isZh ? "重置" : "Reset"}
            </Link>
          </div>
      </FilterBar>

      <KpiStrip className="office-task-attention-strip" items={attentionSummary} />

      <SectionCard
        className="office-list-card office-task-view-save-card"
        title={isZh ? "保存的视图" : "Saved views"}
      >
        <div className="office-task-view-save-row">
          <div>
            <strong>{translateOfficeTaskCopy(snapshot.selectedViewName, isZh)}</strong>
          </div>
          <div className="office-task-view-save-controls">
            <TextInput
              onChange={(event) => setSaveViewName(event.target.value)}
              placeholder={isZh ? "将当前筛选保存为..." : "Save current view as..."}
              value={saveViewName}
            />
            <Button disabled={isSavingView} onClick={handleSaveCurrentView} type="button" variant="secondary">
              {isSavingView ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存视图" : "Save view"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card office-task-create-card"
        title={isZh ? "新建任务" : "New task"}
      >
        <div className="office-task-edit-grid">
          <FormField label={isZh ? "交易" : "Transaction"}>
            <SelectInput onChange={(event) => updateCreateField("transactionId", event.target.value)} value={newTaskState.transactionId}>
              <option value="">{isZh ? "选择交易" : "Select transaction"}</option>
              {snapshot.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label={isZh ? "清单分组" : "Checklist group"}>
            <TextInput onChange={(event) => updateCreateField("checklistGroup", event.target.value)} type="text" value={newTaskState.checklistGroup} />
          </FormField>
          <FormField className="office-form-grid-span-3" label={isZh ? "任务标题" : "Task title"}>
            <TextInput onChange={(event) => updateCreateField("title", event.target.value)} type="text" value={newTaskState.title} />
          </FormField>
          <FormField className="office-form-grid-span-3" label={isZh ? "说明" : "Description"}>
            <TextareaInput onChange={(event) => updateCreateField("description", event.target.value)} rows={3} value={newTaskState.description} />
          </FormField>
          <FormField label={isZh ? "负责人" : "Assignee"}>
            <SelectInput onChange={(event) => updateCreateField("assigneeMembershipId", event.target.value)} value={newTaskState.assigneeMembershipId}>
              <option value="">{isZh ? "未分配" : "Unassigned"}</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label={isZh ? "到期时间" : "Due date"}>
            <TextInput onChange={(event) => updateCreateField("dueAt", event.target.value)} type="date" value={newTaskState.dueAt} />
          </FormField>
          <FormField label={isZh ? "流程状态" : "Workflow status"}>
            <SelectInput onChange={(event) => updateCreateField("status", event.target.value)} value={newTaskState.status}>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {translateOfficeTaskCopy(status, isZh)}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <div className="office-task-checkbox-row office-detail-field office-detail-field-wide">
            <span>{isZh ? "合规要求" : "Compliance rules"}</span>
            <label>
              <input
                checked={newTaskState.requiresDocument}
                onChange={(event) => updateCreateField("requiresDocument", event.target.checked)}
                type="checkbox"
              />
              <span>{isZh ? "需要文档" : "Requires document"}</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresDocumentApproval}
                onChange={(event) => updateCreateField("requiresDocumentApproval", event.target.checked)}
                type="checkbox"
              />
              <span>{isZh ? "需要审核" : "Requires review"}</span>
            </label>
            <label>
              <input
                checked={newTaskState.requiresSecondaryApproval}
                onChange={(event) => updateCreateField("requiresSecondaryApproval", event.target.checked)}
                type="checkbox"
              />
              <span>{isZh ? "需要二级审核" : "Requires secondary approval"}</span>
            </label>
          </div>
        </div>

        <div className="office-task-create-actions">
          <Button disabled={pendingAction === "create"} onClick={handleCreateTask} type="button" variant="secondary">
            {pendingAction === "create" ? (isZh ? "创建中..." : "Creating...") : isZh ? "创建任务" : "Create task"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card office-task-list-card"
        subtitle={isZh ? `当前视图中有 ${snapshot.taskCount} 项任务` : `${snapshot.taskCount} task rows in the current view`}
        title={isZh ? "任务列表" : "Task list"}
      >
        {error ? <p className="office-form-error office-task-inline-error">{error}</p> : null}

        <HorizontalScrollArea viewportClassName="office-task-table-wrap">
          <table className="office-task-table">
            <thead>
              <tr>
                <th>{isZh ? "任务/标题" : "Task / title"}</th>
                <th>{isZh ? "交易" : "Transaction"}</th>
                <th>{isZh ? "清单分组" : "Checklist group"}</th>
                <th>{isZh ? "负责人" : "Assignee"}</th>
                <th>{isZh ? "到期时间" : "Due date"}</th>
                <th>{isZh ? "任务状态" : "Task Status"}</th>
                <th>{isZh ? "交易状态" : "Transaction status"}</th>
                {showOwnerColumn ? <th>{isZh ? "用户/归属人" : "User / owner"}</th> : null}
                <th>{isZh ? "操作" : "Actions"}</th>
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
                          <span className="office-task-meta-copy">{task.description || translateOfficeTaskCopy(task.reviewStatus, isZh)}</span>
                        </td>
                        <td>
                          <Link href={task.transactionHref}>{task.transactionLabel}</Link>
                        </td>
                        <td>{translateOfficeTaskCopy(task.checklistGroup, isZh)}</td>
                        <td>{task.assigneeName}</td>
                        <td>{task.dueAt || translateOfficeTaskCopy("No due date", isZh)}</td>
                        <td>
                          <StatusBadge tone={getTaskStatusTone(task.taskStatusTone)}>{translateOfficeTaskCopy(task.taskStatusLabel, isZh)}</StatusBadge>
                        </td>
                        <td>
                          <StatusBadge tone={getTransactionStatusTone(task.transactionStatus)}>{translateOfficeTaskCopy(task.transactionStatus, isZh)}</StatusBadge>
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
                                {isZh ? "完成" : "Complete"}
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
                                {isZh ? "提交审核" : "Request review"}
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
                                {task.awaitingSecondaryApproval ? (isZh ? "二级通过" : "Second approve") : isZh ? "通过" : "Approve"}
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
                                {isZh ? "退回" : "Reject"}
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
                                {isZh ? "重新打开" : "Reopen"}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="office-task-edit-row" key={`${task.id}-editor`}>
                          <td colSpan={showOwnerColumn ? 9 : 8}>
                            <div className="office-task-edit-grid">
                              <FormField label={isZh ? "清单分组" : "Checklist group"}>
                                <TextInput
                                  onChange={(event) => updateTaskField(task.id, "checklistGroup", event.target.value)}
                                  type="text"
                                  value={formState.checklistGroup}
                                />
                              </FormField>
                              <FormField className="office-form-grid-span-3" label={isZh ? "任务标题" : "Task title"}>
                                <TextInput onChange={(event) => updateTaskField(task.id, "title", event.target.value)} type="text" value={formState.title} />
                              </FormField>
                              <FormField className="office-form-grid-span-3" label={isZh ? "说明" : "Description"}>
                                <TextareaInput
                                  onChange={(event) => updateTaskField(task.id, "description", event.target.value)}
                                  rows={3}
                                  value={formState.description}
                                />
                              </FormField>
                              <FormField label={isZh ? "负责人" : "Assignee"}>
                                <SelectInput
                                  onChange={(event) => updateTaskField(task.id, "assigneeMembershipId", event.target.value)}
                                  value={formState.assigneeMembershipId}
                                >
                                  <option value="">{isZh ? "未分配" : "Unassigned"}</option>
                                  {snapshot.assigneeOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </SelectInput>
                              </FormField>
                              <FormField label={isZh ? "到期时间" : "Due date"}>
                                <TextInput onChange={(event) => updateTaskField(task.id, "dueAt", event.target.value)} type="date" value={formState.dueAt} />
                              </FormField>
                              <FormField label={isZh ? "流程状态" : "Workflow status"}>
                                <SelectInput onChange={(event) => updateTaskField(task.id, "status", event.target.value)} value={formState.status}>
                                  {taskStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {translateOfficeTaskCopy(status, isZh)}
                                    </option>
                                  ))}
                                </SelectInput>
                              </FormField>

                              <div className="office-task-checkbox-row office-detail-field office-detail-field-wide">
                                <span>{isZh ? "合规要求" : "Compliance rules"}</span>
                                <label>
                                  <input
                                    checked={formState.requiresDocument}
                                    onChange={(event) => updateTaskField(task.id, "requiresDocument", event.target.checked)}
                                    type="checkbox"
                                  />
                                  <span>{isZh ? "需要文档" : "Requires document"}</span>
                                </label>
                                <label>
                                  <input
                                    checked={formState.requiresDocumentApproval}
                                    onChange={(event) => updateTaskField(task.id, "requiresDocumentApproval", event.target.checked)}
                                    type="checkbox"
                                  />
                                  <span>{isZh ? "需要审核" : "Requires review"}</span>
                                </label>
                                <label>
                                  <input
                                    checked={formState.requiresSecondaryApproval}
                                    onChange={(event) => updateTaskField(task.id, "requiresSecondaryApproval", event.target.checked)}
                                    type="checkbox"
                                  />
                                  <span>{isZh ? "需要二级审核" : "Requires secondary approval"}</span>
                                </label>
                              </div>
                            </div>

                            <div className="office-task-detail-meta">
                              <span>
                                {isZh ? "审核状态" : "Review status"}: {translateOfficeTaskCopy(task.reviewStatus, isZh)}
                              </span>
                              <span>
                                {isZh ? "合规状态" : "Compliance status"}: {translateOfficeTaskCopy(task.complianceStatus, isZh)}
                              </span>
                              <span>
                                {isZh ? "完成时间" : "Completed at"}: {formatOfficeDateTimeLabel(task.completedAt, locale)}
                              </span>
                              <span>
                                {isZh ? "提交审核时间" : "Submitted for review"}: {formatOfficeDateTimeLabel(task.submittedForReviewAt, locale)}
                              </span>
                              <span>
                                {isZh ? "提交人" : "Submitted by"}: {task.submittedForReviewByName || "—"}
                              </span>
                              <span>
                                {isZh ? "一审人" : "First approver"}: {task.firstApprovedByName || "—"}
                              </span>
                              <span>
                                {isZh ? "二审人" : "Second approver"}: {task.secondApprovedByName || "—"}
                              </span>
                              <span>
                                {isZh ? "二级审核" : "Secondary approval"}:{" "}
                                {task.requiresSecondaryApproval ? (isZh ? "已启用" : "Enabled") : isZh ? "无需二级审核" : "Not required"}
                              </span>
                              <span>
                                {isZh ? "退回原因" : "Rejection reason"}: {task.rejectionReason || "—"}
                              </span>
                            </div>

                            {task.linkedDocuments.length ? (
                              <div className="office-task-detail-meta office-task-detail-documents">
                                {task.linkedDocuments.map((document) => (
                                  <span key={document.id}>
                                    <a href={document.href}>{document.title}</a>
                                    {` · ${translateOfficeTaskCopy(document.status, isZh)}`}
                                    {document.isSigned ? ` · ${isZh ? "已签署" : "Signed"}` : ""}
                                    {document.hasPendingSignature ? ` · ${isZh ? "等待签署" : "Signature pending"}` : ""}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="office-task-detail-meta office-task-detail-documents">
                                <span>{isZh ? "关联文档" : "Linked documents"}: —</span>
                              </div>
                            )}

                            <div className="office-task-edit-actions">
                              <Button
                                disabled={pendingAction === `save:${task.id}`}
                                onClick={() => handleSaveTask(task)}
                                variant="secondary"
                                type="button"
                              >
                                {pendingAction === `save:${task.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存任务" : "Save task"}
                              </Button>
                              <Link className="office-button-secondary office-button-sm" href={task.transactionHref}>
                                {isZh ? "打开交易" : "Open transaction"}
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
                      description={
                        isZh
                          ? "调整筛选条件，或切换保存的视图来扩大任务范围。"
                          : "Adjust the filters or switch saved views to widen the task result set."
                      }
                      title={isZh ? "当前筛选下没有匹配的任务" : "No tasks matched the current filters"}
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
