"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmActionDialog } from "@acre/ui";
import type { OfficeTransactionContact, OfficeTransactionContactOption } from "@acre/db";

type TransactionContactsCardProps = {
  transactionId: string;
  contacts: OfficeTransactionContact[];
  availableContacts: OfficeTransactionContactOption[];
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function TransactionContactsCard({
  transactionId,
  contacts,
  availableContacts
}: TransactionContactsCardProps) {
  const router = useRouter();
  const [selectedContactId, setSelectedContactId] = useState(availableContacts[0]?.id ?? "");
  const [makePrimary, setMakePrimary] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  async function handleLinkContact() {
    if (!selectedContactId) {
      return;
    }

    setPendingAction("link");
    setActionError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contactId: selectedContactId,
          isPrimary: makePrimary
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "关联联系人失败。");
      }

      setSelectedContactId("");
      setMakePrimary(false);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "关联联系人失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSetPrimary(contactLinkId: string) {
    setPendingAction(`primary:${contactLinkId}`);
    setActionError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/contacts/${contactLinkId}`, {
        method: "PATCH"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "更新主要联系人失败。");
      }

      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "更新主要联系人失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnlink(contactLinkId: string) {
    setPendingAction(`unlink:${contactLinkId}`);
    setActionError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/contacts/${contactLinkId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "解除联系人关联失败。");
      }

      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "解除联系人关联失败。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card">
      <div className="office-card-head">
        <h3>联系人</h3>
      </div>

      <div className="office-transaction-contact-list">
        {contacts.length > 0 ? (
          contacts.map((contact) => (
            <div className="office-transaction-contact-row" key={contact.id}>
              <div className="office-transaction-contact-main">
                <div className="office-transaction-contact-head">
                  <Link className="office-transaction-contact-link" href={`/office/contacts/${contact.clientId}`}>
                    {contact.fullName}
                  </Link>
                  <span className="office-status-pill">{contact.role}</span>
                  {contact.isPrimary ? <span className="office-status-pill office-status-pill-primary">主要联系人</span> : null}
                </div>
                <p>{contact.email || contact.phone || "还没有保存联系方式。"}</p>
                {contact.email && contact.phone ? <p>{contact.phone}</p> : null}
              </div>

              <div className="office-transaction-contact-actions">
                {!contact.isPrimary ? (
                  <button
                    className="office-view-toggle"
                    disabled={pendingAction === `primary:${contact.id}`}
                    onClick={() => handleSetPrimary(contact.id)}
                    type="button"
                  >
                    {pendingAction === `primary:${contact.id}` ? "设置中..." : "设为主要联系人"}
                  </button>
                ) : null}
                <button
                  className="office-view-toggle"
                  disabled={pendingAction === `unlink:${contact.id}`}
                  onClick={() =>
                    setConfirmDialog({
                      title: `解除 ${contact.fullName} 的关联？`,
                      description: "这只会把联系人从交易中移除，不会删除联系人记录本身。",
                      confirmLabel: "解除关联",
                      onConfirm: () => {
                        void handleUnlink(contact.id);
                      }
                    })
                  }
                  type="button"
                >
                  {pendingAction === `unlink:${contact.id}` ? "移除中..." : "解除关联"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="office-detail-field">
            <span>联系人</span>
            <strong>还没有关联联系人。</strong>
          </div>
        )}
      </div>

      <div className="office-transaction-contact-toolbar">
        <select onChange={(event) => setSelectedContactId(event.target.value)} value={selectedContactId}>
          <option value="">选择要关联的联系人</option>
          {availableContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.label}
            </option>
          ))}
        </select>
        <label className="office-transaction-contact-checkbox">
          <input checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} type="checkbox" />
          <span>设为主要联系人</span>
        </label>
        <button className="office-button" disabled={!selectedContactId || pendingAction === "link"} onClick={handleLinkContact} type="button">
          {pendingAction === "link" ? "关联中..." : "关联联系人"}
        </button>
      </div>

      {actionError ? <p className="office-form-error">{actionError}</p> : null}

      <ConfirmActionDialog
        cancelLabel="保留关联"
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </section>
  );
}
