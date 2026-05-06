"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Button, ConfirmActionDialog } from "@acre/ui";

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
        throw new Error(body?.error ?? "交易删除失败。");
      }

      setConfirmOpen(false);
      startTransition(() => {
        router.replace("/office/transactions");
        router.refresh();
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "交易删除失败。");
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
        删除交易
      </Button>

      <ConfirmActionDialog
        cancelLabel="保留交易"
        confirmLabel={pendingDelete ? "删除中..." : "删除交易"}
        description="这会从 Acre 中永久移除这个交易工作区。"
        isOpen={confirmOpen}
        onCancel={() => {
          if (!pendingDelete) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={handleDelete}
        title={`删除 ${transactionTitle}？`}
      >
        <p>
          直接关联到这笔交易的文档、表单、报价、签名、任务、佣金行和定金记录都会被移除。
        </p>
        <p>
          仅引用这笔交易的现有会计行会保留在会计模块中，但会清除它们的交易关联。
        </p>
        {error ? <p className="office-inline-error">{error}</p> : null}
      </ConfirmActionDialog>
    </>
  );
}
