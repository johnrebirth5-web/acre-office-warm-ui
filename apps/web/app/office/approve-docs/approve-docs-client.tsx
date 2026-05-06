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
import { useI18n } from "../../../lib/i18n/client";

type OfficeApproveDocsClientProps = {
  snapshot: OfficeDocumentApprovalQueueSnapshot;
  currentMembershipId: string;
  canApproveDocuments: boolean;
  canReviewTasks: boolean;
  canSecondaryReviewTasks: boolean;
};

const queueViewOptions: Array<{ key: OfficeDocumentApprovalQueueView; label: string; zhLabel: string }> = [
  { key: "all_open_review_items", label: "All open review items", zhLabel: "全部待处理审批" },
  { key: "awaiting_my_review", label: "Awaiting my review", zhLabel: "等待我审核" },
  { key: "awaiting_second_review", label: "Awaiting second review", zhLabel: "等待二级审核" },
  { key: "rejected", label: "Rejected", zhLabel: "已退回" },
  { key: "waiting_for_signatures", label: "Waiting for signatures", zhLabel: "等待签署" },
  { key: "missing_required_document", label: "Missing required document", zhLabel: "缺少必交文件" }
];

const dueWindowOptions = [
  { value: "", label: "Any due date", zhLabel: "全部到期时间" },
  { value: "past_due", label: "Past due", zhLabel: "已逾期" },
  { value: "today", label: "Today", zhLabel: "今天到期" },
  { value: "current_week", label: "Current week", zhLabel: "本周到期" },
  { value: "next_week", label: "Next week", zhLabel: "下周到期" },
  { value: "next_2_weeks", label: "Next 2 weeks", zhLabel: "未来两周" }
] as const;

function formatDateLabel(value: string, locale: string) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(value: string, locale: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(locale, {
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

function optionLabel(option: { label: string; zhLabel: string }, isZh: boolean) {
  return isZh ? option.zhLabel : option.label;
}

function translateApprovalStatus(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const statusMap: Record<string, string> = {
    Approved: "已通过",
    Rejected: "已退回",
    "Review requested": "等待审核",
    "Second review": "二级审核中",
    "First approved": "一级已通过",
    Pending: "待处理",
    "In review": "审核中",
    Complete: "已完成",
    Reopened: "已重新打开",
    "Pending upload": "待上传",
    "Waiting for signatures": "等待签署",
    "Fully signed": "已全部签署",
    "Uploaded / not submitted": "已上传 / 未提交",
    "In progress": "进行中"
  };

  return statusMap[value] ?? value;
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleWorkflowAction(task: OfficeTransactionTask, action: "complete" | "reopen" | "approve" | "reject") {
    setPendingAction(`${action}:${task.id}`);
    setError("");

    try {
      const rejectionReason =
        action === "reject"
          ? window.prompt(isZh ? "请输入退回原因（可选）" : "Enter a rejection reason (optional)", task.rejectionReason || "")?.trim() ?? ""
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
        throw new Error(body?.error ?? (isZh ? "无法完成审批队列操作。" : "Unable to complete the approval queue action."));
      }

      router.refresh();
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : isZh ? "无法完成审批队列操作。" : "Unable to complete the approval queue action.");
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
            <span>{optionLabel(option, isZh)}</span>
            <strong>{snapshot.summary[option.key]}</strong>
          </Link>
        ))}
      </section>

      <SectionCard
        subtitle={
          isZh
            ? "按审批状态、负责人和到期时间收窄文档审核队列。“等待我审核”只显示当前审核人可处理的动作。"
            : "Focus the document review queue by approval state, assignee, and due window. Awaiting my review reflects actions available to the current reviewer."
        }
        title={isZh ? "队列筛选" : "Queue filters"}
      >
        <FilterBar as="form" className="office-approval-filter-bar" method="get">
          <FilterField label={isZh ? "队列视图" : "Queue view"}>
            <SelectInput defaultValue={snapshot.filters.queue} name="queue">
              {queueViewOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {optionLabel(option, isZh)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label={isZh ? "负责人" : "Assignee"}>
            <SelectInput defaultValue={snapshot.filters.assigneeMembershipId} name="assigneeMembershipId">
              <option value="">{isZh ? "全部负责人" : "All assignees"}</option>
              {snapshot.assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label={isZh ? "到期时间" : "Due date"}>
            <SelectInput defaultValue={snapshot.filters.dueWindow} name="dueWindow">
              {dueWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {optionLabel(option, isZh)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-approval-filter-field-wide" label={isZh ? "交易 / 任务 / 文档" : "Transaction / task / document"}>
            <TextInput
              defaultValue={snapshot.filters.q}
              name="q"
              placeholder={isZh ? "搜索交易、任务、文档、表单或负责人..." : "Search transaction, task, document, form, or owner..."}
            />
          </FilterField>

          <div className="office-approval-filter-actions">
            <Button type="submit">{isZh ? "应用筛选" : "Apply filters"}</Button>
            <Link className="office-button-secondary" href="/office/approve-docs">
              {isZh ? "重置" : "Reset"}
            </Link>
          </div>
        </FilterBar>
      </SectionCard>

      <SectionCard
        subtitle={isZh ? `当前审核队列有 ${snapshot.itemCount} 条记录` : `${snapshot.itemCount} rows in the current review queue`}
        title={isZh ? "文档审核队列" : "Document review queue"}
      >
        {error ? <p className="office-approval-inline-error">{error}</p> : null}

        {snapshot.items.length ? (
          <HorizontalScrollArea viewportClassName="office-approval-table-wrap">
            <table className="office-approval-table">
              <thead>
                <tr>
                  <th>{isZh ? "任务" : "Task"}</th>
                  <th>{isZh ? "交易" : "Transaction"}</th>
                  <th>{isZh ? "文档 / 表单" : "Document / Form"}</th>
                  <th>{isZh ? "负责人 / 所有人" : "Assignee / owner"}</th>
                  <th>{isZh ? "审核状态" : "Review status"}</th>
                  <th>{isZh ? "合规状态" : "Compliance status"}</th>
                  <th>{isZh ? "需要二级审核" : "Requires secondary approval"}</th>
                  <th>{isZh ? "提交人" : "Submitted by"}</th>
                  <th>{isZh ? "提交时间" : "Submitted at"}</th>
                  <th>{isZh ? "到期时间" : "Due date"}</th>
                  <th>{isZh ? "最近更新" : "Last updated"}</th>
                  <th>{isZh ? "操作" : "Actions"}</th>
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
                          <StatusBadge tone={getQueueTone(item.queueState)}>{translateApprovalStatus(item.queueStateLabel, isZh)}</StatusBadge>
                          <StatusBadge tone={getTaskStatusTone(item.task.taskStatusTone)}>{translateApprovalStatus(item.task.taskStatusLabel, isZh)}</StatusBadge>
                        </div>
                        <div className="office-approval-meta-copy">{item.task.checklistGroup}</div>
                        {item.task.rejectionReason ? (
                          <div className="office-approval-meta-copy">{isZh ? "退回原因：" : "Rejection reason: "}{item.task.rejectionReason}</div>
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
                          <div className="office-approval-meta-copy">{isZh ? "表单：" : "Form: "}{translateApprovalStatus(item.formStatusLabel, isZh)}</div>
                        ) : null}
                        {item.signatureStatusLabel ? (
                          <div className="office-approval-meta-copy">{isZh ? "签署：" : "Signature: "}{translateApprovalStatus(item.signatureStatusLabel, isZh)}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="office-approval-cell-title">{item.task.assigneeName}</div>
                        <div className="office-approval-meta-copy">{isZh ? "所有人：" : "Owner: "}{item.task.ownerName}</div>
                      </td>
                      <td>
                        <StatusBadge tone={getReviewTone(item.task.reviewStatus)}>{translateApprovalStatus(item.task.reviewStatus, isZh)}</StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={getComplianceTone(item.task.complianceStatus)}>{translateApprovalStatus(item.task.complianceStatus, isZh)}</StatusBadge>
                      </td>
                      <td>{item.task.requiresSecondaryApproval ? (isZh ? "是" : "Yes") : (isZh ? "否" : "No")}</td>
                      <td>{item.task.submittedForReviewByName || "—"}</td>
                      <td>{formatDateTimeLabel(item.task.submittedForReviewAt, locale)}</td>
                      <td>{formatDateLabel(item.task.dueAt, locale)}</td>
                      <td>{formatDateTimeLabel(item.task.updatedAt, locale)}</td>
                      <td className="office-approval-actions-cell">
                        <div className="office-approval-action-stack">
                          <div className="office-approval-action-row office-approval-action-row-links">
                            <Link
                              className="office-button-secondary office-inline-action-sm"
                              href={item.task.transactionHref}
                            >
                              {isZh ? "打开交易" : "Open transaction"}
                            </Link>
                            {item.openDocumentHref ? (
                              <Link
                                className="office-button-secondary office-inline-action-sm"
                                href={item.openDocumentHref}
                                target="_blank"
                              >
                                {isZh ? "打开关联文档" : "Open linked document"}
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
                                  ? isZh ? "保存中..." : "Saving..."
                                  : item.task.awaitingSecondaryApproval
                                    ? isZh ? "二级通过" : "Second approve"
                                    : isZh ? "通过" : "Approve"}
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
                                {pendingAction === `reject:${item.task.id}` ? (isZh ? "保存中..." : "Saving...") : (isZh ? "退回" : "Reject")}
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
                                {pendingAction === `reopen:${item.task.id}` ? (isZh ? "保存中..." : "Saving...") : (isZh ? "重新打开" : "Reopen")}
                              </Button>
                            ) : null}
                            {item.task.canCompleteDirectly ? (
                              <Button
                                className="office-inline-action-sm"
                                disabled={pendingAction === `complete:${item.task.id}`}
                                onClick={() => handleWorkflowAction(item.task, "complete")}
                                size="sm"
                              >
                                {pendingAction === `complete:${item.task.id}` ? (isZh ? "保存中..." : "Saving...") : (isZh ? "标记完成" : "Complete")}
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
            description={isZh ? "当前筛选范围内没有需要进入文档审批队列的任务。" : "No tasks in the current filter scope need to enter the document approval queue."}
            title={isZh ? "暂无文档审核事项" : "No document review items"}
          />
        )}
      </SectionCard>
    </div>
  );
}
