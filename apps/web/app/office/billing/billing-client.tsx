"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  CheckboxField,
  ConfirmActionDialog,
  EmptyState,
  FormField,
  HorizontalScrollArea,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeBillingSnapshot } from "@acre/db";

type OfficeBillingClientProps = {
  snapshot: OfficeBillingSnapshot;
};

type PaymentMethodFormState = {
  paymentMethodId: string;
  type: string;
  label: string;
  provider: string;
  last4: string;
  isDefault: boolean;
  autoPayEnabled: boolean;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function BillingTable(props: { children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className="office-table">{props.children}</div>
    </HorizontalScrollArea>
  );
}

const paymentMethodTypeOptions = [
  { value: "card_on_file", label: "Card on file" },
  { value: "bank_account", label: "Bank account" },
  { value: "check", label: "Check" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" }
] as const;

function buildEmptyPaymentMethodState(): PaymentMethodFormState {
  return {
    paymentMethodId: "",
    type: "card_on_file",
    label: "",
    provider: "Manual",
    last4: "",
    isDefault: false,
    autoPayEnabled: false
  };
}

function buildPaymentMethodStateFromExisting(snapshot: OfficeBillingClientProps["snapshot"], paymentMethodId: string): PaymentMethodFormState {
  const existing = snapshot.paymentMethods.find((method) => method.id === paymentMethodId);

  if (!existing) {
    return buildEmptyPaymentMethodState();
  }

  return {
    paymentMethodId: existing.id,
    type: existing.typeValue,
    label: existing.label,
    provider: existing.provider,
    last4: existing.last4,
    isDefault: existing.isDefault,
    autoPayEnabled: existing.autoPayEnabled
  };
}

function getStatusTone(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "paid / applied":
    case "scheduled":
      return "success" as const;
    case "invalid":
    case "expired":
    case "void":
      return "danger" as const;
    case "pending":
    case "open":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function OfficeBillingClient({ snapshot }: OfficeBillingClientProps) {
  const router = useRouter();
  const visiblePaymentMethods = snapshot.paymentMethods.filter((method) => method.statusValue !== "removed");
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [paymentMethodFormState, setPaymentMethodFormState] = useState<PaymentMethodFormState>(buildEmptyPaymentMethodState);
  const [pendingAction, setPendingAction] = useState<"" | "save-payment-method" | "remove-payment-method">("");
  const [formError, setFormError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  function openPaymentMethodCreate() {
    setFormError("");
    setPaymentMethodFormState(buildEmptyPaymentMethodState());
    setIsPaymentMethodModalOpen(true);
  }

  function openPaymentMethodEdit(paymentMethodId: string) {
    setFormError("");
    setPaymentMethodFormState(buildPaymentMethodStateFromExisting(snapshot, paymentMethodId));
    setIsPaymentMethodModalOpen(true);
  }

  async function handleSavePaymentMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setPendingAction("save-payment-method");

    try {
      const isEditing = Boolean(paymentMethodFormState.paymentMethodId);
      const response = await fetch(
        isEditing ? `/api/office/billing/payment-methods/${paymentMethodFormState.paymentMethodId}` : "/api/office/billing/payment-methods",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: paymentMethodFormState.type,
            label: paymentMethodFormState.label,
            provider: paymentMethodFormState.provider,
            last4: paymentMethodFormState.last4,
            isDefault: paymentMethodFormState.isDefault,
            autoPayEnabled: paymentMethodFormState.autoPayEnabled
          })
        }
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save payment method.");
      }

      setIsPaymentMethodModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save payment method.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleRemovePaymentMethod(paymentMethodId: string) {
    setFormError("");
    setPendingAction("remove-payment-method");

    try {
      const response = await fetch(`/api/office/billing/payment-methods/${paymentMethodId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "remove"
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to remove payment method.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to remove payment method.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <>
      <section className="office-billing-summary-grid">
        <StatCard
          hint={`${snapshot.summary.openChargesCount} open charge(s)`}
          label="Outstanding balance"
          tone={snapshot.summary.openChargesCount ? "accent" : "default"}
          value={snapshot.summary.outstandingBalanceLabel}
        />
        <StatCard
          hint={`${snapshot.summary.pendingChargesCount} pending or scheduled item(s)`}
          label="Pending charges"
          value={snapshot.summary.pendingChargesLabel}
        />
        <StatCard
          hint={snapshot.summary.recentPaymentsWindowLabel}
          label="Recent payments"
          value={snapshot.summary.recentPaymentsLabel}
        />
        <StatCard
          hint={`${snapshot.summary.creditBalanceCount} credit balance item(s)`}
          label="Credit balance"
          value={snapshot.summary.creditBalanceLabel}
        />
        <StatCard
          hint={snapshot.summary.latestStatementGeneratedAtLabel}
          label={snapshot.summary.latestStatementPeriodLabel}
          value={snapshot.summary.latestStatementBalanceLabel}
        />
        <StatCard
          hint="Invalid or expired methods"
          label="Payment method issues"
          value={snapshot.summary.paymentMethodIssueCount}
        />
      </section>

      {snapshot.notices.length ? (
        <section className="office-billing-notice-stack">
          {snapshot.notices.map((notice) => (
            <article className={`office-billing-notice office-billing-notice-${notice.tone}`} key={`${notice.title}-${notice.description}`}>
              <strong>{notice.title}</strong>
              <p>{notice.description}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="office-billing-layout">
        <div className="office-billing-main-column">
          <SectionCard
            actions={
              <Link className="office-button-secondary office-button-sm" href="/office/activity?objectType=accounting">
                Open accounting activity
              </Link>
            }
            subtitle="Open invoice balances and future-dated charges for your current membership. Payments are still recorded by office accounting, not by a live gateway."
            title="Outstanding balance"
          >
            {snapshot.outstandingChargeRows.length || snapshot.upcomingChargeRows.length ? (
              <div className="office-billing-section-stack">
                <div className="office-billing-subsection">
                  <div className="office-billing-subhead">
                    <strong>Open charges</strong>
                    <span>{snapshot.outstandingChargeRows.length} current open item(s)</span>
                  </div>

                  {snapshot.outstandingChargeRows.length ? (
                    <BillingTable>
                      <div className="office-table-header office-table-row office-table-row-billing-open">
                        <span>Date</span>
                        <span>Due</span>
                        <span>Charge</span>
                        <span>Amount</span>
                        <span>Outstanding</span>
                        <span>Status</span>
                        <span>Linked transaction</span>
                      </div>

                      {snapshot.outstandingChargeRows.map((row) => (
                        <div className="office-table-row office-table-row-billing-open" key={row.id}>
                          <span>{row.accountingDate}</span>
                          <span>{row.dueDate || "—"}</span>
                          <div className="office-table-primary">
                            <strong>{row.type}</strong>
                            <p>{row.referenceNumber || row.chargeCategory || row.counterparty}</p>
                          </div>
                          <span>{row.amountLabel}</span>
                          <span>{row.outstandingAmountLabel}</span>
                          <span>{row.status}</span>
                          <div className="office-table-primary">
                            {row.linkedTransactionHref ? (
                              <Link className="office-inline-link" href={row.linkedTransactionHref}>
                                Open transaction
                              </Link>
                            ) : (
                              <strong>—</strong>
                            )}
                            <p>{row.linkedTransactionLabel}</p>
                          </div>
                        </div>
                      ))}
                    </BillingTable>
                  ) : (
                    <p className="office-billing-inline-note">No open charges are recorded right now.</p>
                  )}
                </div>

                <div className="office-billing-subsection">
                  <div className="office-billing-subhead">
                    <strong>Pending / upcoming charges</strong>
                    <span>{snapshot.upcomingChargeRows.length} future or scheduled item(s)</span>
                  </div>

                  {snapshot.upcomingChargeRows.length ? (
                    <BillingTable>
                      <div className="office-table-header office-table-row office-table-row-billing-upcoming">
                        <span>Due</span>
                        <span>Source</span>
                        <span>Description</span>
                        <span>Amount</span>
                        <span>Status</span>
                        <span>Linked transaction</span>
                      </div>

                      {snapshot.upcomingChargeRows.map((row) => (
                        <div className="office-table-row office-table-row-billing-upcoming" key={row.id}>
                          <span>{row.dueDate}</span>
                          <span>{row.sourceType}</span>
                          <div className="office-table-primary">
                            <strong>{row.description}</strong>
                            <p>{row.linkedTransactionLabel}</p>
                          </div>
                          <span>{row.amountLabel}</span>
                          <span>{row.status}</span>
                          <span>{row.linkedTransactionHref ? "Linked" : "—"}</span>
                        </div>
                      ))}
                    </BillingTable>
                  ) : (
                    <p className="office-billing-inline-note">No pending or scheduled charges are currently queued.</p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                description="No open or pending charges are recorded for your current membership."
                title="Nothing due right now"
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle="Real accounting-backed billing records only. Charges, payments, credits, and applied balances stay distinct through type and status."
            title="Billing ledger"
          >
            {snapshot.ledgerRows.length ? (
              <BillingTable>
                <div className="office-table-header office-table-row office-table-row-agent-billing-ledger">
                  <span>Date</span>
                  <span>Type</span>
                  <span>Description</span>
                  <span>Category</span>
                  <span>Amount</span>
                  <span>Applied</span>
                  <span>Outstanding</span>
                  <span>Status</span>
                  <span>Linked transaction</span>
                </div>

                {snapshot.ledgerRows.map((row) => (
                  <div className="office-table-row office-table-row-agent-billing-ledger" key={row.id}>
                    <span>{row.accountingDate}</span>
                    <span>{row.type}</span>
                    <div className="office-table-primary">
                      <strong>{row.referenceNumber || row.counterparty}</strong>
                      <p>{row.counterparty}</p>
                    </div>
                    <span>{row.chargeCategory || "—"}</span>
                    <span>{row.amountLabel}</span>
                    <span>{row.appliedAmountLabel}</span>
                    <span>{row.outstandingAmountLabel}</span>
                    <span>{row.status}</span>
                    <div className="office-table-primary">
                      {row.linkedTransactionHref ? (
                        <Link className="office-inline-link" href={row.linkedTransactionHref}>
                          Open transaction
                        </Link>
                      ) : (
                        <strong>—</strong>
                      )}
                      <p>{row.linkedTransactionLabel}</p>
                    </div>
                  </div>
                ))}
              </BillingTable>
            ) : (
              <EmptyState
                description="Billing ledger entries will appear here when charges, payments, or credit memos exist for your membership."
                title="No ledger records"
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle="Live monthly statement summaries generated at view time from the current ledger. PDF downloads export the current live summary and do not create archived statement snapshots."
            title="Statements"
          >
            {snapshot.statements.length ? (
              <BillingTable>
                <div className="office-table-header office-table-row office-table-row-billing-statements">
                  <span>Period</span>
                  <span>Generated</span>
                  <span>Charges</span>
                  <span>Payments</span>
                  <span>Credits</span>
                  <span>Current balance</span>
                </div>

                {snapshot.statements.map((statement) => (
                  <div className="office-table-row office-table-row-billing-statements" key={statement.id}>
                    <div className="office-table-primary">
                      <strong>{statement.periodLabel}</strong>
                      <p>{statement.entryCount} ledger item(s)</p>
                      <p>
                        <a
                          aria-label={`Download ${statement.periodLabel} billing statement PDF`}
                          className="office-inline-link"
                          href={`/api/office/billing/statements/${statement.id}/pdf`}
                        >
                          Download PDF
                        </a>
                      </p>
                    </div>
                    <span>{statement.generatedAtLabel}</span>
                    <span>{statement.totalChargesLabel}</span>
                    <span>{statement.totalPaymentsLabel}</span>
                    <span>{statement.creditsLabel}</span>
                    <span>{statement.currentBalanceLabel}</span>
                  </div>
                ))}
              </BillingTable>
            ) : (
              <EmptyState
                description="Monthly statement summaries will appear here after billing ledger records exist for your membership."
                title="No statements yet"
              />
            )}
          </SectionCard>
        </div>

        <div className="office-billing-side-column">
          <SectionCard subtitle="Most recent received-payment records applied to your billing ledger." title="Recent payments">
            {snapshot.recentPaymentRows.length ? (
              <div className="office-billing-list">
                {snapshot.recentPaymentRows.map((row) => (
                  <article className="office-billing-list-row" key={row.id}>
                    <div className="office-billing-list-copy">
                      <strong>{row.referenceNumber || row.type}</strong>
                      <p>{row.accountingDate} · {row.amountLabel}</p>
                      <p>{row.paymentMethod !== "—" ? `${row.paymentMethod} · ${row.status}` : row.status}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="No received-payment records have been applied to this billing profile yet."
                title="No payments recorded"
              />
            )}
          </SectionCard>

          <SectionCard subtitle="Credit memos and other balance-reducing adjustments remain visible separately from payments." title="Credits / adjustments">
            {snapshot.creditRows.length ? (
              <div className="office-billing-list">
                {snapshot.creditRows.map((row) => (
                  <article className="office-billing-list-row" key={row.id}>
                    <div className="office-billing-list-copy">
                      <strong>{row.referenceNumber || row.type}</strong>
                      <p>{row.accountingDate} · {row.amountLabel}</p>
                      <p>{row.outstandingAmountLabel} remaining · {row.status}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="No credits or adjustments are currently stored for this billing profile."
                title="No credits recorded"
              />
            )}
          </SectionCard>

          <SectionCard
            actions={
              <Button onClick={openPaymentMethodCreate} size="sm" variant="secondary">
                Add method
              </Button>
            }
            subtitle="Masked billing-method references only. This page does not connect to a live payment gateway or store raw credentials."
            title="Payment methods"
          >
            {formError ? <p className="office-form-error">{formError}</p> : null}

            {visiblePaymentMethods.length ? (
              <div className="office-billing-method-list">
                {visiblePaymentMethods.map((method) => (
                  <article className="office-billing-method-row" key={method.id}>
                    <div className="office-billing-method-copy">
                      <strong>{method.label}</strong>
                      <p>{method.type} · {method.maskedReference}</p>
                      <p>{method.provider}</p>
                    </div>

                    <div className="office-billing-method-meta">
                      <div className="office-billing-method-flags">
                        {method.isDefault ? <StatusBadge tone="accent">Default</StatusBadge> : null}
                        <StatusBadge tone={getStatusTone(method.statusValue)}>{method.status}</StatusBadge>
                        <StatusBadge tone={method.autoPayEnabled ? "success" : "neutral"}>
                          {method.autoPayEnabled ? "Auto-pay on" : "Manual pay"}
                        </StatusBadge>
                      </div>

                      <div className="office-billing-method-actions">
                        <Button onClick={() => openPaymentMethodEdit(method.id)} size="sm" variant="secondary">
                          Edit
                        </Button>
                        {method.statusValue !== "removed" ? (
                          <Button
                            disabled={pendingAction === "remove-payment-method"}
                            onClick={() =>
                              setConfirmDialog({
                                title: `Remove ${method.label}?`,
                                description:
                                  "This removes the payment-method reference from your billing profile. It does not charge or refund anything.",
                                confirmLabel: "Remove method",
                                onConfirm: () => {
                                  void handleRemovePaymentMethod(method.id);
                                }
                              })
                            }
                            size="sm"
                            variant="secondary"
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <Button onClick={openPaymentMethodCreate} size="sm" variant="secondary">
                    Add method
                  </Button>
                }
                description="Store a masked card or bank reference if the office uses it for billing coordination. No live charge capture is connected."
                title="No payment methods on file"
              />
            )}
          </SectionCard>

          <SectionCard
            actions={
              <Link className="office-button-secondary office-button-sm" href="/office/activity?objectType=accounting">
                Open activity
              </Link>
            }
            subtitle="Recent billing-related audit events touching your charges, payments, credits, or payment-method changes."
            title="Billing activity"
          >
            {snapshot.recentActivity.length ? (
              <div className="office-billing-activity-list">
                {snapshot.recentActivity.map((item) => (
                  <article className="office-billing-activity-row" key={item.id}>
                    <div className="office-billing-activity-copy">
                      <strong>{item.summary}</strong>
                      <p>{item.actorDisplayName} · {item.timestampLabel}</p>
                      <p>{item.objectLabel}</p>
                      {item.detailSummary.length ? <p>{item.detailSummary.join(" · ")}</p> : null}
                    </div>
                    {item.href ? (
                      <Link className="office-inline-link" href={item.href}>
                        Open
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Billing-related audit events will appear here once charges, payments, credits, or payment-method changes are logged for your membership."
                title="No recent billing activity"
              />
            )}
          </SectionCard>

          <SectionCard subtitle="Current scope and limitations for self-service billing in this MVP." title="Current limitations">
            <ul className="office-billing-limitations">
              {snapshot.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </section>

      {isPaymentMethodModalOpen ? (
        <div className="office-modal-overlay" onClick={() => setIsPaymentMethodModalOpen(false)}>
          <section className="office-modal office-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="office-modal-header">
              <h3>{paymentMethodFormState.paymentMethodId ? "EDIT PAYMENT METHOD" : "ADD PAYMENT METHOD"}</h3>
              <button aria-label="Close payment method modal" onClick={() => setIsPaymentMethodModalOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="office-modal-body office-accounting-modal-body" onSubmit={handleSavePaymentMethod}>
              <div className="office-form-grid">
                <FormField label="Type">
                  <SelectInput
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, type: event.target.value }))}
                    value={paymentMethodFormState.type}
                  >
                    {paymentMethodTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>

                <FormField label="Masked last4">
                  <TextInput
                    maxLength={4}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, last4: event.target.value }))}
                    placeholder="4242"
                    value={paymentMethodFormState.last4}
                  />
                </FormField>

                <FormField className="office-form-grid-span-2" label="Label">
                  <TextInput
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, label: event.target.value }))}
                    placeholder="Visa ending 4242"
                    required
                    value={paymentMethodFormState.label}
                  />
                </FormField>

                <FormField className="office-form-grid-span-2" label="Provider">
                  <TextInput
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, provider: event.target.value }))}
                    placeholder="Manual"
                    value={paymentMethodFormState.provider}
                  />
                </FormField>

                <CheckboxField className="office-form-grid-span-2" label="Set as default method">
                  <input
                    checked={paymentMethodFormState.isDefault}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, isDefault: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>

                <CheckboxField className="office-form-grid-span-2" label="Mark auto-pay enabled">
                  <input
                    checked={paymentMethodFormState.autoPayEnabled}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, autoPayEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>
              </div>

              {formError ? <p className="office-form-error">{formError}</p> : null}

              <footer className="office-modal-footer">
                <span>This stores only a masked billing-method reference. No live processor token or raw credential is captured here.</span>
                <Button disabled={pendingAction === "save-payment-method"} type="submit">
                  {pendingAction === "save-payment-method" ? "Saving..." : paymentMethodFormState.paymentMethodId ? "Save method" : "Add method"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel="Keep method"
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
    </>
  );
}
