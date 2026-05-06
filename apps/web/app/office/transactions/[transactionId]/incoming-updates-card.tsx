"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, FormField, StatusBadge, TextareaInput, TextInput } from "@acre/ui";
import type { OfficeIncomingUpdate } from "@acre/db";

type TransactionIncomingUpdatesCardProps = {
  transactionId: string;
  incomingUpdates: OfficeIncomingUpdate[];
  canReviewIncomingUpdates: boolean;
};

type NewIncomingUpdateState = {
  sourceSystem: string;
  sourceReference: string;
  summary: string;
  payload: string;
};

function getIncomingUpdateTone(statusKey: OfficeIncomingUpdate["statusKey"]) {
  if (statusKey === "applied" || statusKey === "accepted") {
    return "success" as const;
  }

  if (statusKey === "rejected") {
    return "danger" as const;
  }

  return "warning" as const;
}

const incomingUpdateStatusLabelMap: Partial<Record<OfficeIncomingUpdate["statusKey"], string>> = {
  accepted: "已接受",
  applied: "已应用",
  pending_review: "待审核",
  rejected: "已拒绝"
};

const incomingUpdateCopyMap: Record<string, string> = {
  "Incoming update could not be created.": "无法创建传入更新。",
  "Incoming update not found.": "找不到传入更新。",
  "Incoming update payload is invalid.": "传入更新内容无效。",
  "Incoming update request body must be valid JSON.": "传入更新请求正文必须是有效 JSON。",
  "Incoming update review failed.": "传入更新审核失败。",
  "Incoming update review payload is invalid.": "传入更新审核内容无效。",
  "Incoming update review request body must be valid JSON.": "传入更新审核请求正文必须是有效 JSON。",
  "Incoming updates access required.": "需要传入更新权限。",
  "Payload must be valid JSON.": "Payload 必须是有效 JSON。",
  "Source system, reference, and summary are required.": "请填写来源系统、来源编号和摘要。"
};

function translateIncomingUpdateCopy(value: string) {
  return incomingUpdateCopyMap[value] ?? value;
}

function getIncomingUpdateErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return translateIncomingUpdateCopy(message);
}

function getIncomingUpdateStatusLabel(incomingUpdate: OfficeIncomingUpdate) {
  return incomingUpdateStatusLabelMap[incomingUpdate.statusKey] ?? incomingUpdate.status;
}

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionIncomingUpdatesCard({
  transactionId,
  incomingUpdates,
  canReviewIncomingUpdates
}: TransactionIncomingUpdatesCardProps) {
  const router = useRouter();
  const [newUpdate, setNewUpdate] = useState<NewIncomingUpdateState>({
    sourceSystem: "Manual test feed",
    sourceReference: "",
    summary: "",
    payload: JSON.stringify(
      {
        closingDate: "2026-03-25",
        status: "pending"
      },
      null,
      2
    )
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreateIncomingUpdate() {
    let parsedPayload: Record<string, unknown>;

    try {
      parsedPayload = JSON.parse(newUpdate.payload || "{}") as Record<string, unknown>;
    } catch {
      setError(translateIncomingUpdateCopy("Payload must be valid JSON."));
      return;
    }

    if (!newUpdate.sourceSystem.trim() || !newUpdate.sourceReference.trim() || !newUpdate.summary.trim()) {
      setError(translateIncomingUpdateCopy("Source system, reference, and summary are required."));
      return;
    }

    setPendingAction("create");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/incoming-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceSystem: newUpdate.sourceSystem,
          sourceReference: newUpdate.sourceReference,
          summary: newUpdate.summary,
          payload: parsedPayload
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(translateIncomingUpdateCopy(body?.error ?? "Incoming update could not be created."));
      }

      setNewUpdate({
        sourceSystem: "Manual test feed",
        sourceReference: "",
        summary: "",
        payload: JSON.stringify(
          {
            closingDate: "2026-03-25",
            status: "pending"
          },
          null,
          2
        )
      });
      router.refresh();
    } catch (createError) {
      setError(getIncomingUpdateErrorMessage(createError, "Incoming update could not be created."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReview(incomingUpdateId: string, action: "accept" | "reject") {
    setPendingAction(`${action}:${incomingUpdateId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/incoming-updates/${incomingUpdateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(translateIncomingUpdateCopy(body?.error ?? "Incoming update review failed."));
      }

      router.refresh();
    } catch (reviewError) {
      setError(getIncomingUpdateErrorMessage(reviewError, "Incoming update review failed."));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card" id="transaction-incoming-updates">
      <div className="office-card-head">
        <div>
          <h3>传入更新</h3>
          <span>先审核未来 Folio 类外部更新，再把安全映射的变更应用到交易。</span>
        </div>
      </div>

      <div className="office-document-list">
        {incomingUpdates.length > 0 ? (
          incomingUpdates.map((incomingUpdate) => (
            <article className="office-form-row" key={incomingUpdate.id}>
              <div className="office-document-row-top">
                <div className="office-document-row-copy">
                  <div className="office-document-row-head">
                    <strong>{incomingUpdate.summary}</strong>
                    <StatusBadge tone={getIncomingUpdateTone(incomingUpdate.statusKey)}>
                      {getIncomingUpdateStatusLabel(incomingUpdate)}
                    </StatusBadge>
                  </div>
                  <p>
                    {incomingUpdate.sourceSystem} · {incomingUpdate.sourceReference}
                  </p>
                  <p>
                    收到 {formatDateLabel(incomingUpdate.receivedAt)}
                    {incomingUpdate.reviewedAt ? ` · 已审核 ${formatDateLabel(incomingUpdate.reviewedAt)}` : ""}
                    {incomingUpdate.reviewedByName ? ` · ${incomingUpdate.reviewedByName}` : ""}
                  </p>
                </div>

                {canReviewIncomingUpdates && incomingUpdate.statusKey === "pending_review" ? (
                  <div className="office-signature-row-actions">
                    <Button
                      disabled={pendingAction === `accept:${incomingUpdate.id}`}
                      onClick={() => handleReview(incomingUpdate.id, "accept")}
                      size="sm"
                    >
                      {pendingAction === `accept:${incomingUpdate.id}` ? "应用中..." : "接受"}
                    </Button>
                    <Button
                      disabled={pendingAction === `reject:${incomingUpdate.id}`}
                      onClick={() => handleReview(incomingUpdate.id, "reject")}
                      size="sm"
                      variant="danger"
                    >
                      {pendingAction === `reject:${incomingUpdate.id}` ? "保存中..." : "拒绝"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {incomingUpdate.payloadPreview.length > 0 ? (
                <ul className="office-incoming-update-preview">
                  {incomingUpdate.payloadPreview.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            description="现在可以创建一条手动测试更新，让交易流程审核、接受或拒绝。"
            title="此交易暂无传入更新。"
          />
        )}
      </div>

      {canReviewIncomingUpdates ? (
        <div className="office-document-upload-panel">
          <div className="office-card-head office-card-head-inline">
            <h3>创建传入更新</h3>
          </div>

          <div className="office-document-upload-grid">
            <FormField label="来源系统">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, sourceSystem: event.target.value }))}
                value={newUpdate.sourceSystem}
              />
            </FormField>
            <FormField label="来源编号">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, sourceReference: event.target.value }))}
                value={newUpdate.sourceReference}
              />
            </FormField>
            <FormField className="office-detail-field-wide" label="摘要">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, summary: event.target.value }))}
                value={newUpdate.summary}
              />
            </FormField>
            <FormField className="office-detail-field-wide" label="Payload JSON">
              <TextareaInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, payload: event.target.value }))}
                rows={6}
                value={newUpdate.payload}
              />
            </FormField>
          </div>

          <div className="office-document-edit-actions">
            <Button disabled={pendingAction === "create"} onClick={handleCreateIncomingUpdate}>
              {pendingAction === "create" ? "创建中..." : "创建传入更新"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="office-form-error">{error}</p> : null}
    </section>
  );
}
