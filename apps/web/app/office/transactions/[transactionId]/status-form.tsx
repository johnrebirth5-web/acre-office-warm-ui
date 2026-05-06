"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@acre/ui";
import type { OfficeTransactionStatus } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";
import { allOfficeTransactionStatusOptions } from "../transaction-status-rules";

type TransactionStatusFormProps = {
  transactionId: string;
  currentStatus: OfficeTransactionStatus;
  canManageStatus: boolean;
};

const transactionStatusZhLabelMap: Record<OfficeTransactionStatus, string> = {
  Opportunity: "机会",
  Active: "进行中",
  Pending: "待处理",
  Closed: "已成交",
  Cancelled: "已取消"
};

function getTransactionStatusLabel(status: OfficeTransactionStatus, isZh: boolean) {
  return isZh ? transactionStatusZhLabelMap[status] ?? status : status;
}

export function TransactionStatusForm({ transactionId, currentStatus, canManageStatus }: TransactionStatusFormProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        throw new Error(body?.error ?? (isZh ? "交易状态更新失败。" : "Failed to update transaction status."));
      }

      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : isZh ? "交易状态更新失败。" : "Failed to update transaction status.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-form-actions">
      <label className="office-detail-field">
        <span>{isZh ? "状态" : "Status"}</span>
        <select
          disabled={!canManageStatus}
          onChange={(event) => setStatus(event.target.value as OfficeTransactionStatus)}
          value={status}
        >
          {allOfficeTransactionStatusOptions.map((option) => (
            <option key={option} value={option}>
              {getTransactionStatusLabel(option, isZh)}
            </option>
          ))}
        </select>
      </label>
      {canManageStatus ? (
        <Button disabled={isSaving} onClick={handleUpdateStatus} type="button">
          {isSaving ? (isZh ? "保存中..." : "Saving...") : isZh ? "更新状态" : "Update status"}
        </Button>
      ) : (
        <p className="office-form-helper">{isZh ? "只有管理员可以修改交易状态。" : "Only admins can change transaction status."}</p>
      )}
      {error ? <p className="office-form-error">{error}</p> : null}
    </div>
  );
}
