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
        throw new Error(body?.error ?? "Transaction delete failed.");
      }

      setConfirmOpen(false);
      startTransition(() => {
        router.replace("/office/transactions");
        router.refresh();
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Transaction delete failed.");
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
        Delete transaction
      </Button>

      <ConfirmActionDialog
        cancelLabel="Keep transaction"
        confirmLabel={pendingDelete ? "Deleting..." : "Delete transaction"}
        description="This permanently removes the transaction workspace from Acre."
        isOpen={confirmOpen}
        onCancel={() => {
          if (!pendingDelete) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={handleDelete}
        title={`Delete ${transactionTitle}?`}
      >
        <p>
          Linked transaction documents, forms, offers, signatures, tasks, commission rows, and earnest money records tied
          directly to this transaction will be removed.
        </p>
        <p>
          Existing accounting rows that only reference this transaction will stay in accounting, but their transaction link
          will be cleared.
        </p>
        {error ? <p className="office-inline-error">{error}</p> : null}
      </ConfirmActionDialog>
    </>
  );
}
