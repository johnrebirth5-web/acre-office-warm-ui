"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Button, ConfirmActionDialog } from "@acre/ui";
import { useI18n } from "../../../../lib/i18n/client";

type TransactionDeleteActionProps = {
  canDelete: boolean;
  transactionId: string;
  transactionTitle: string;
};

export function TransactionDeleteAction({
  canDelete,
  transactionId,
  transactionTitle
}: TransactionDeleteActionProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [error, setError] = useState("");

  if (!canDelete) {
    return null;
  }

  async function handleDelete() {
    if (pendingDelete) {
      return;
    }

    setPendingDelete(true);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "交易删除失败。" : "Failed to delete transaction."));
      }

      setConfirmOpen(false);
      startTransition(() => {
        router.replace("/office/transactions");
        router.refresh();
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : isZh ? "交易删除失败。" : "Failed to delete transaction.");
    } finally {
      setPendingDelete(false);
    }
  }

  return (
    <>
      <Button
        disabled={pendingDelete}
        onClick={() => {
          setError("");
          setConfirmOpen(true);
        }}
        size="sm"
        variant="danger"
      >
        {isZh ? "删除交易" : "Delete transaction"}
      </Button>

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留交易" : "Keep transaction"}
        confirmLabel={pendingDelete ? (isZh ? "删除中..." : "Deleting...") : isZh ? "删除交易" : "Delete transaction"}
        description={isZh ? "这会从 Acre 中永久移除这个交易工作区。" : "This permanently removes this transaction workspace from Acre."}
        isOpen={confirmOpen}
        onCancel={() => {
          if (!pendingDelete) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={handleDelete}
        title={isZh ? `删除 ${transactionTitle}？` : `Delete ${transactionTitle}?`}
      >
        <p>
          {isZh
            ? "直接关联到这笔交易的文档、表单、报价、签名、任务、佣金行和定金记录都会被移除。"
            : "Documents, forms, offers, signatures, tasks, commission rows, and earnest money records directly linked to this transaction will be removed."}
        </p>
        <p>
          {isZh
            ? "仅引用这笔交易的现有会计行会保留在会计模块中，但会清除它们的交易关联。"
            : "Existing accounting rows that only reference this transaction remain in Accounting, but their transaction link will be cleared."}
        </p>
        {error ? <p className="office-inline-error">{error}</p> : null}
      </ConfirmActionDialog>
    </>
  );
}
