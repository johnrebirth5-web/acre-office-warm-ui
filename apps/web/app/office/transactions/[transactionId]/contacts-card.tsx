"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmActionDialog } from "@acre/ui";
import type { OfficeTransactionContact, OfficeTransactionContactOption } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        throw new Error(body?.error ?? (isZh ? "关联联系人失败。" : "Failed to link contact."));
      }

      setSelectedContactId("");
      setMakePrimary(false);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isZh ? "关联联系人失败。" : "Failed to link contact.");
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
        throw new Error(body?.error ?? (isZh ? "更新主要联系人失败。" : "Failed to update primary contact."));
      }

      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isZh ? "更新主要联系人失败。" : "Failed to update primary contact.");
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
        throw new Error(body?.error ?? (isZh ? "解除联系人关联失败。" : "Failed to unlink contact."));
      }

      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isZh ? "解除联系人关联失败。" : "Failed to unlink contact.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card">
      <div className="office-card-head">
        <h3>{isZh ? "联系人" : "Contacts"}</h3>
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
                  {contact.isPrimary ? <span className="office-status-pill office-status-pill-primary">{isZh ? "主要联系人" : "Primary"}</span> : null}
                </div>
                <p>{contact.email || contact.phone || (isZh ? "还没有保存联系方式。" : "No contact details saved.")}</p>
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
                    {pendingAction === `primary:${contact.id}` ? (isZh ? "设置中..." : "Setting...") : isZh ? "设为主要联系人" : "Set primary"}
                  </button>
                ) : null}
                <button
                  className="office-view-toggle"
                  disabled={pendingAction === `unlink:${contact.id}`}
                  onClick={() =>
                    setConfirmDialog({
                      title: isZh ? `解除 ${contact.fullName} 的关联？` : `Unlink ${contact.fullName}?`,
                      description: isZh ? "这只会把联系人从交易中移除，不会删除联系人记录本身。" : "This removes the contact from the transaction without deleting the contact record itself.",
                      confirmLabel: isZh ? "解除关联" : "Unlink contact",
                      onConfirm: () => {
                        void handleUnlink(contact.id);
                      }
                    })
                  }
                  type="button"
                >
                  {pendingAction === `unlink:${contact.id}` ? (isZh ? "移除中..." : "Removing...") : isZh ? "解除关联" : "Unlink"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="office-detail-field">
            <span>{isZh ? "联系人" : "Contacts"}</span>
            <strong>{isZh ? "还没有关联联系人。" : "No linked contacts yet."}</strong>
          </div>
        )}
      </div>

      <div className="office-transaction-contact-toolbar">
        <select onChange={(event) => setSelectedContactId(event.target.value)} value={selectedContactId}>
          <option value="">{isZh ? "选择要关联的联系人" : "Select contact to link"}</option>
          {availableContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.label}
            </option>
          ))}
        </select>
        <label className="office-transaction-contact-checkbox">
          <input checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} type="checkbox" />
          <span>{isZh ? "设为主要联系人" : "Set as primary"}</span>
        </label>
        <button className="office-button" disabled={!selectedContactId || pendingAction === "link"} onClick={handleLinkContact} type="button">
          {pendingAction === "link" ? (isZh ? "关联中..." : "Linking...") : isZh ? "关联联系人" : "Link contact"}
        </button>
      </div>

      {actionError ? <p className="office-form-error">{actionError}</p> : null}

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留关联" : "Keep link"}
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
