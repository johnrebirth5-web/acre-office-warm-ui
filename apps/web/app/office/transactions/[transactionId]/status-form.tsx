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

const transactionStatusLabelMap: Record<OfficeTransactionStatus, string> = {
  Opportunity: "机会",
  Active: "进行中",
  Pending: "待处理",
  Closed: "已成交",
  Cancelled: "已取消"
};

function getTransactionStatusLabel(status: OfficeTransactionStatus) {
  return transactionStatusLabelMap[status] ?? status;
}

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
        throw new Error(body?.error ?? "交易状态更新失败。");
      }

      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "交易状态更新失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-form-actions">
      <label className="office-detail-field">
        <span>状态</span>
        <select
          disabled={!canManageStatus}
          onChange={(event) => setStatus(event.target.value as OfficeTransactionStatus)}
          value={status}
        >
          {allOfficeTransactionStatusOptions.map((option) => (
            <option key={option} value={option}>
              {getTransactionStatusLabel(option)}
            </option>
          ))}
        </select>
      </label>
      {canManageStatus ? (
        <Button disabled={isSaving} onClick={handleUpdateStatus} type="button">
          {isSaving ? "保存中..." : "更新状态"}
        </Button>
      ) : (
        <p className="office-form-helper">只有管理员可以修改交易状态。</p>
      )}
      {error ? <p className="office-form-error">{error}</p> : null}
    </div>
  );
}
