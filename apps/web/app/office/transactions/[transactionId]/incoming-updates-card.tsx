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

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
      setError("Payload must be valid JSON.");
      return;
    }

    if (!newUpdate.sourceSystem.trim() || !newUpdate.sourceReference.trim() || !newUpdate.summary.trim()) {
      setError("Source system, reference, and summary are required.");
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
        throw new Error(body?.error ?? "Incoming update could not be created.");
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
      setError(createError instanceof Error ? createError.message : "Incoming update could not be created.");
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
        throw new Error(body?.error ?? "Incoming update review failed.");
      }

      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Incoming update review failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="bm-detail-card" id="transaction-incoming-updates">
      <div className="bm-card-head">
        <div>
          <h3>Incoming updates</h3>
          <span>Review future Folio-like external updates before applying safe mapped changes to the transaction.</span>
        </div>
      </div>

      <div className="bm-document-list">
        {incomingUpdates.length > 0 ? (
          incomingUpdates.map((incomingUpdate) => (
            <article className="bm-form-row" key={incomingUpdate.id}>
              <div className="bm-document-row-top">
                <div className="bm-document-row-copy">
                  <div className="bm-document-row-head">
                    <strong>{incomingUpdate.summary}</strong>
                    <StatusBadge tone={getIncomingUpdateTone(incomingUpdate.statusKey)}>{incomingUpdate.status}</StatusBadge>
                  </div>
                  <p>
                    {incomingUpdate.sourceSystem} · {incomingUpdate.sourceReference}
                  </p>
                  <p>
                    Received {formatDateLabel(incomingUpdate.receivedAt)}
                    {incomingUpdate.reviewedAt ? ` · Reviewed ${formatDateLabel(incomingUpdate.reviewedAt)}` : ""}
                    {incomingUpdate.reviewedByName ? ` · ${incomingUpdate.reviewedByName}` : ""}
                  </p>
                </div>

                {canReviewIncomingUpdates && incomingUpdate.statusKey === "pending_review" ? (
                  <div className="bm-signature-row-actions">
                    <Button
                      disabled={pendingAction === `accept:${incomingUpdate.id}`}
                      onClick={() => handleReview(incomingUpdate.id, "accept")}
                      size="sm"
                    >
                      {pendingAction === `accept:${incomingUpdate.id}` ? "Applying..." : "Accept"}
                    </Button>
                    <Button
                      disabled={pendingAction === `reject:${incomingUpdate.id}`}
                      onClick={() => handleReview(incomingUpdate.id, "reject")}
                      size="sm"
                      variant="danger"
                    >
                      {pendingAction === `reject:${incomingUpdate.id}` ? "Saving..." : "Reject"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {incomingUpdate.payloadPreview.length > 0 ? (
                <ul className="bm-incoming-update-preview">
                  {incomingUpdate.payloadPreview.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            description="Create a manual test update now so the transaction workflow can review, accept, or reject it."
            title="No incoming updates for this transaction."
          />
        )}
      </div>

      {canReviewIncomingUpdates ? (
        <div className="bm-document-upload-panel">
          <div className="bm-card-head bm-card-head-inline">
            <h3>Create incoming update</h3>
          </div>

          <div className="bm-document-upload-grid">
            <FormField label="Source system">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, sourceSystem: event.target.value }))}
                value={newUpdate.sourceSystem}
              />
            </FormField>
            <FormField label="Source reference">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, sourceReference: event.target.value }))}
                value={newUpdate.sourceReference}
              />
            </FormField>
            <FormField className="bm-detail-field-wide" label="Summary">
              <TextInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, summary: event.target.value }))}
                value={newUpdate.summary}
              />
            </FormField>
            <FormField className="bm-detail-field-wide" label="Payload JSON">
              <TextareaInput
                onChange={(event) => setNewUpdate((current) => ({ ...current, payload: event.target.value }))}
                rows={6}
                value={newUpdate.payload}
              />
            </FormField>
          </div>

          <div className="bm-document-edit-actions">
            <Button disabled={pendingAction === "create"} onClick={handleCreateIncomingUpdate}>
              {pendingAction === "create" ? "Creating..." : "Create incoming update"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="office-form-error">{error}</p> : null}
    </section>
  );
}
