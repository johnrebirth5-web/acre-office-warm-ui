"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@acre/ui";
import type { OfficeTransactionStatus } from "@acre/db";
import { allOfficeTransactionStatusOptions } from "../transaction-status-rules";

type TransactionStatusFormProps = {
  transactionId: string;
  currentStatus: OfficeTransactionStatus;
  canManageStatus: boolean;
};

export function TransactionStatusForm({ transactionId, currentStatus, canManageStatus }: TransactionStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OfficeTransactionStatus>(currentStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  async function handleUpdateStatus() {
    if (!canManageStatus) {
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update transaction status.");
      }

      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update transaction status.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-form-actions">
      <label className="office-detail-field">
        <span>Status</span>
        <select
          disabled={!canManageStatus}
          onChange={(event) => setStatus(event.target.value as OfficeTransactionStatus)}
          value={status}
        >
          {allOfficeTransactionStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {canManageStatus ? (
        <Button disabled={isSaving} onClick={handleUpdateStatus} type="button">
          {isSaving ? "Saving..." : "Update status"}
        </Button>
      ) : (
        <p className="office-form-helper">Only admins can change transaction status.</p>
      )}
      {error ? <p className="office-form-error">{error}</p> : null}
    </div>
  );
}
