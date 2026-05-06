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
import { useI18n } from "../../../lib/i18n/client";

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

function getPaymentMethodTypeOptions(isZh: boolean) {
  return [
    { value: "card_on_file", label: isZh ? "已备案银行卡" : "Card on file" },
    { value: "bank_account", label: isZh ? "银行账户" : "Bank account" },
    { value: "check", label: isZh ? "支票" : "Check" },
    { value: "manual", label: isZh ? "手动记录" : "Manual" },
    { value: "other", label: isZh ? "其他" : "Other" }
  ] as const;
}

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

function formatCount(count: number, singular: string, plural: string, zhUnit: string, isZh: boolean) {
  return isZh ? `${count} ${zhUnit}` : `${count} ${count === 1 ? singular : plural}`;
}

function translateBillingStatus(status: string, isZh: boolean) {
  if (!isZh) {
    return status;
  }

  const normalized = status.toLowerCase();
  const statusMap: Record<string, string> = {
    active: "启用",
    "paid / applied": "已支付 / 已应用",
    scheduled: "已排期",
    invalid: "无效",
    expired: "已过期",
    void: "已作废",
    pending: "待处理",
    open: "未结",
    removed: "已移除"
  };

  return statusMap[normalized] ?? status;
}

function translateBillingType(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const normalized = value.toLowerCase();
  const typeMap: Record<string, string> = {
    charge: "费用",
    payment: "付款",
    credit: "抵扣",
    "credit memo": "抵扣单",
    invoice: "发票",
    adjustment: "调整",
    manual: "手动记录",
    card: "银行卡",
    "card on file": "已备案银行卡",
    "bank account": "银行账户",
    check: "支票",
    other: "其他"
  };

  return typeMap[normalized] ?? value;
}

export function OfficeBillingClient({ snapshot }: OfficeBillingClientProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const paymentMethodTypeOptions = getPaymentMethodTypeOptions(isZh);
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
        throw new Error(body?.error ?? (isZh ? "保存付款方式失败。" : "Failed to save payment method."));
      }

      setIsPaymentMethodModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : isZh ? "保存付款方式失败。" : "Failed to save payment method.");
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
        throw new Error(body?.error ?? (isZh ? "移除付款方式失败。" : "Failed to remove payment method."));
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : isZh ? "移除付款方式失败。" : "Failed to remove payment method.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <>
      <section className="office-billing-summary-grid">
        <StatCard
          hint={formatCount(snapshot.summary.openChargesCount, "open charge", "open charges", "笔未结费用", isZh)}
          label={isZh ? "未结余额" : "Outstanding balance"}
          tone={snapshot.summary.openChargesCount ? "accent" : "default"}
          value={snapshot.summary.outstandingBalanceLabel}
        />
        <StatCard
          hint={formatCount(snapshot.summary.pendingChargesCount, "pending or scheduled item", "pending or scheduled items", "笔待处理或已排期费用", isZh)}
          label={isZh ? "待处理费用" : "Pending charges"}
          value={snapshot.summary.pendingChargesLabel}
        />
        <StatCard
          hint={snapshot.summary.recentPaymentsWindowLabel}
          label={isZh ? "近期付款" : "Recent payments"}
          value={snapshot.summary.recentPaymentsLabel}
        />
        <StatCard
          hint={formatCount(snapshot.summary.creditBalanceCount, "credit balance item", "credit balance items", "笔可用抵扣", isZh)}
          label={isZh ? "抵扣余额" : "Credit balance"}
          value={snapshot.summary.creditBalanceLabel}
        />
        <StatCard
          hint={snapshot.summary.latestStatementGeneratedAtLabel}
          label={snapshot.summary.latestStatementPeriodLabel}
          value={snapshot.summary.latestStatementBalanceLabel}
        />
        <StatCard
          hint={isZh ? "无效或已过期的方式" : "Invalid or expired methods"}
          label={isZh ? "付款方式问题" : "Payment method issues"}
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
                {isZh ? "打开财务记录" : "Open accounting activity"}
              </Link>
            }
            subtitle={
              isZh
                ? "显示你当前成员身份下的未结发票余额和未来费用。付款仍由办公室财务记录，不会在这里实时扣款。"
                : "Open invoice balances and future-dated charges for your current membership. Payments are still recorded by office accounting, not by a live gateway."
            }
            title={isZh ? "未结余额" : "Outstanding balance"}
          >
            {snapshot.outstandingChargeRows.length || snapshot.upcomingChargeRows.length ? (
              <div className="office-billing-section-stack">
                <div className="office-billing-subsection">
                  <div className="office-billing-subhead">
                    <strong>{isZh ? "未结费用" : "Open charges"}</strong>
                    <span>{formatCount(snapshot.outstandingChargeRows.length, "current open item", "current open items", "笔当前未结项目", isZh)}</span>
                  </div>

                  {snapshot.outstandingChargeRows.length ? (
                    <BillingTable>
                      <div className="office-table-header office-table-row office-table-row-billing-open">
                        <span>{isZh ? "日期" : "Date"}</span>
                        <span>{isZh ? "到期" : "Due"}</span>
                        <span>{isZh ? "费用" : "Charge"}</span>
                        <span>{isZh ? "金额" : "Amount"}</span>
                        <span>{isZh ? "未结" : "Outstanding"}</span>
                        <span>{isZh ? "状态" : "Status"}</span>
                        <span>{isZh ? "关联交易" : "Linked transaction"}</span>
                      </div>

                      {snapshot.outstandingChargeRows.map((row) => (
                        <div className="office-table-row office-table-row-billing-open" key={row.id}>
                          <span>{row.accountingDate}</span>
                          <span>{row.dueDate || "—"}</span>
                          <div className="office-table-primary">
                            <strong>{translateBillingType(row.type, isZh)}</strong>
                            <p>{row.referenceNumber || row.chargeCategory || row.counterparty}</p>
                          </div>
                          <span>{row.amountLabel}</span>
                          <span>{row.outstandingAmountLabel}</span>
                          <span>{translateBillingStatus(row.status, isZh)}</span>
                          <div className="office-table-primary">
                            {row.linkedTransactionHref ? (
                              <Link className="office-inline-link" href={row.linkedTransactionHref}>
                                {isZh ? "打开交易" : "Open transaction"}
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
                    <p className="office-billing-inline-note">{isZh ? "当前没有未结费用。" : "No open charges are recorded right now."}</p>
                  )}
                </div>

                <div className="office-billing-subsection">
                  <div className="office-billing-subhead">
                    <strong>{isZh ? "待处理 / 未来费用" : "Pending / upcoming charges"}</strong>
                    <span>{formatCount(snapshot.upcomingChargeRows.length, "future or scheduled item", "future or scheduled items", "笔未来或已排期项目", isZh)}</span>
                  </div>

                  {snapshot.upcomingChargeRows.length ? (
                    <BillingTable>
                      <div className="office-table-header office-table-row office-table-row-billing-upcoming">
                        <span>{isZh ? "到期" : "Due"}</span>
                        <span>{isZh ? "来源" : "Source"}</span>
                        <span>{isZh ? "说明" : "Description"}</span>
                        <span>{isZh ? "金额" : "Amount"}</span>
                        <span>{isZh ? "状态" : "Status"}</span>
                        <span>{isZh ? "关联交易" : "Linked transaction"}</span>
                      </div>

                      {snapshot.upcomingChargeRows.map((row) => (
                        <div className="office-table-row office-table-row-billing-upcoming" key={row.id}>
                          <span>{row.dueDate}</span>
                          <span>{translateBillingType(row.sourceType, isZh)}</span>
                          <div className="office-table-primary">
                            <strong>{row.description}</strong>
                            <p>{row.linkedTransactionLabel}</p>
                          </div>
                          <span>{row.amountLabel}</span>
                          <span>{translateBillingStatus(row.status, isZh)}</span>
                          <span>{row.linkedTransactionHref ? (isZh ? "已关联" : "Linked") : "—"}</span>
                        </div>
                      ))}
                    </BillingTable>
                  ) : (
                    <p className="office-billing-inline-note">{isZh ? "当前没有待处理或已排期费用。" : "No pending or scheduled charges are currently queued."}</p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                description={isZh ? "当前成员身份下没有未结或待处理费用。" : "No open or pending charges are recorded for your current membership."}
                title={isZh ? "现在没有应付项目" : "Nothing due right now"}
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle={
              isZh
                ? "这里只显示真实财务记录；费用、付款、抵扣和已应用余额会通过类型和状态区分。"
                : "Real accounting-backed billing records only. Charges, payments, credits, and applied balances stay distinct through type and status."
            }
            title={isZh ? "账单流水" : "Billing ledger"}
          >
            {snapshot.ledgerRows.length ? (
              <BillingTable>
                <div className="office-table-header office-table-row office-table-row-agent-billing-ledger">
                  <span>{isZh ? "日期" : "Date"}</span>
                  <span>{isZh ? "类型" : "Type"}</span>
                  <span>{isZh ? "说明" : "Description"}</span>
                  <span>{isZh ? "分类" : "Category"}</span>
                  <span>{isZh ? "金额" : "Amount"}</span>
                  <span>{isZh ? "已应用" : "Applied"}</span>
                  <span>{isZh ? "未结" : "Outstanding"}</span>
                  <span>{isZh ? "状态" : "Status"}</span>
                  <span>{isZh ? "关联交易" : "Linked transaction"}</span>
                </div>

                {snapshot.ledgerRows.map((row) => (
                  <div className="office-table-row office-table-row-agent-billing-ledger" key={row.id}>
                    <span>{row.accountingDate}</span>
                    <span>{translateBillingType(row.type, isZh)}</span>
                    <div className="office-table-primary">
                      <strong>{row.referenceNumber || row.counterparty}</strong>
                      <p>{row.counterparty}</p>
                    </div>
                    <span>{row.chargeCategory || "—"}</span>
                    <span>{row.amountLabel}</span>
                    <span>{row.appliedAmountLabel}</span>
                    <span>{row.outstandingAmountLabel}</span>
                    <span>{translateBillingStatus(row.status, isZh)}</span>
                    <div className="office-table-primary">
                      {row.linkedTransactionHref ? (
                        <Link className="office-inline-link" href={row.linkedTransactionHref}>
                          {isZh ? "打开交易" : "Open transaction"}
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
                description={isZh ? "当你的成员身份下出现费用、付款或抵扣单后，账单流水会显示在这里。" : "Billing ledger entries will appear here when charges, payments, or credit memos exist for your membership."}
                title={isZh ? "暂无账单流水" : "No ledger records"}
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle={
              isZh
                ? "月度账单摘要会根据当前流水实时生成。下载 PDF 只导出当前摘要，不会创建归档快照。"
                : "Live monthly statement summaries generated at view time from the current ledger. PDF downloads export the current live summary and do not create archived statement snapshots."
            }
            title={isZh ? "月度账单" : "Statements"}
          >
            {snapshot.statements.length ? (
              <BillingTable>
                <div className="office-table-header office-table-row office-table-row-billing-statements">
                  <span>{isZh ? "周期" : "Period"}</span>
                  <span>{isZh ? "生成时间" : "Generated"}</span>
                  <span>{isZh ? "费用" : "Charges"}</span>
                  <span>{isZh ? "付款" : "Payments"}</span>
                  <span>{isZh ? "抵扣" : "Credits"}</span>
                  <span>{isZh ? "当前余额" : "Current balance"}</span>
                </div>

                {snapshot.statements.map((statement) => (
                  <div className="office-table-row office-table-row-billing-statements" key={statement.id}>
                    <div className="office-table-primary">
                      <strong>{statement.periodLabel}</strong>
                      <p>{formatCount(statement.entryCount, "ledger item", "ledger items", "条流水", isZh)}</p>
                      <p>
                        <a
                          aria-label={isZh ? `下载 ${statement.periodLabel} 账单 PDF` : `Download ${statement.periodLabel} billing statement PDF`}
                          className="office-inline-link"
                          href={`/api/office/billing/statements/${statement.id}/pdf`}
                        >
                          {isZh ? "下载 PDF" : "Download PDF"}
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
                description={isZh ? "当你的成员身份下出现账单流水后，月度账单摘要会显示在这里。" : "Monthly statement summaries will appear here after billing ledger records exist for your membership."}
                title={isZh ? "暂无月度账单" : "No statements yet"}
              />
            )}
          </SectionCard>
        </div>

        <div className="office-billing-side-column">
          <SectionCard
            subtitle={isZh ? "最近已经应用到你账单流水上的收款记录。" : "Most recent received-payment records applied to your billing ledger."}
            title={isZh ? "近期付款" : "Recent payments"}
          >
            {snapshot.recentPaymentRows.length ? (
              <div className="office-billing-list">
                {snapshot.recentPaymentRows.map((row) => (
                  <article className="office-billing-list-row" key={row.id}>
                    <div className="office-billing-list-copy">
                      <strong>{row.referenceNumber || translateBillingType(row.type, isZh)}</strong>
                      <p>{row.accountingDate} · {row.amountLabel}</p>
                      <p>{row.paymentMethod !== "—" ? `${row.paymentMethod} · ${translateBillingStatus(row.status, isZh)}` : translateBillingStatus(row.status, isZh)}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{translateBillingStatus(row.status, isZh)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description={isZh ? "这个账单档案还没有应用过收款记录。" : "No received-payment records have been applied to this billing profile yet."}
                title={isZh ? "暂无付款记录" : "No payments recorded"}
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle={isZh ? "抵扣单和其他减少余额的调整会与付款分开显示。" : "Credit memos and other balance-reducing adjustments remain visible separately from payments."}
            title={isZh ? "抵扣 / 调整" : "Credits / adjustments"}
          >
            {snapshot.creditRows.length ? (
              <div className="office-billing-list">
                {snapshot.creditRows.map((row) => (
                  <article className="office-billing-list-row" key={row.id}>
                    <div className="office-billing-list-copy">
                      <strong>{row.referenceNumber || translateBillingType(row.type, isZh)}</strong>
                      <p>{row.accountingDate} · {row.amountLabel}</p>
                      <p>
                        {isZh
                          ? `剩余 ${row.outstandingAmountLabel} · ${translateBillingStatus(row.status, isZh)}`
                          : `${row.outstandingAmountLabel} remaining · ${row.status}`}
                      </p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{translateBillingStatus(row.status, isZh)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description={isZh ? "这个账单档案当前没有抵扣或调整记录。" : "No credits or adjustments are currently stored for this billing profile."}
                title={isZh ? "暂无抵扣记录" : "No credits recorded"}
              />
            )}
          </SectionCard>

          <SectionCard
            actions={
              <Button onClick={openPaymentMethodCreate} size="sm" variant="secondary">
                {isZh ? "新增方式" : "Add method"}
              </Button>
            }
            subtitle={
              isZh
                ? "这里只保存脱敏后的付款方式引用，不连接实时支付网关，也不保存原始凭据。"
                : "Masked billing-method references only. This page does not connect to a live payment gateway or store raw credentials."
            }
            title={isZh ? "付款方式" : "Payment methods"}
          >
            {formError ? <p className="office-form-error">{formError}</p> : null}

            {visiblePaymentMethods.length ? (
              <div className="office-billing-method-list">
                {visiblePaymentMethods.map((method) => (
                  <article className="office-billing-method-row" key={method.id}>
                    <div className="office-billing-method-copy">
                      <strong>{method.label}</strong>
                      <p>{translateBillingType(method.type, isZh)} · {method.maskedReference}</p>
                      <p>{method.provider}</p>
                    </div>

                    <div className="office-billing-method-meta">
                      <div className="office-billing-method-flags">
                        {method.isDefault ? <StatusBadge tone="accent">{isZh ? "默认" : "Default"}</StatusBadge> : null}
                        <StatusBadge tone={getStatusTone(method.statusValue)}>{translateBillingStatus(method.status, isZh)}</StatusBadge>
                        <StatusBadge tone={method.autoPayEnabled ? "success" : "neutral"}>
                          {method.autoPayEnabled ? (isZh ? "自动付款已开" : "Auto-pay on") : (isZh ? "手动付款" : "Manual pay")}
                        </StatusBadge>
                      </div>

                      <div className="office-billing-method-actions">
                        <Button onClick={() => openPaymentMethodEdit(method.id)} size="sm" variant="secondary">
                          {isZh ? "编辑" : "Edit"}
                        </Button>
                        {method.statusValue !== "removed" ? (
                          <Button
                            disabled={pendingAction === "remove-payment-method"}
                            onClick={() =>
                              setConfirmDialog({
                                title: isZh ? `移除 ${method.label}？` : `Remove ${method.label}?`,
                                description:
                                  isZh
                                    ? "这只会从账单档案中移除该付款方式引用，不会发起扣款或退款。"
                                    : "This removes the payment-method reference from your billing profile. It does not charge or refund anything.",
                                confirmLabel: isZh ? "移除付款方式" : "Remove method",
                                onConfirm: () => {
                                  void handleRemovePaymentMethod(method.id);
                                }
                              })
                            }
                            size="sm"
                            variant="secondary"
                          >
                            {isZh ? "移除" : "Remove"}
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
                    {isZh ? "新增方式" : "Add method"}
                  </Button>
                }
                description={isZh ? "如果办公室需要用付款方式做账单协同，可以保存脱敏后的银行卡或银行账户引用。这里不会实时扣款。" : "Store a masked card or bank reference if the office uses it for billing coordination. No live charge capture is connected."}
                title={isZh ? "还没有付款方式" : "No payment methods on file"}
              />
            )}
          </SectionCard>

          <SectionCard
            actions={
              <Link className="office-button-secondary office-button-sm" href="/office/activity?objectType=accounting">
                {isZh ? "打开记录" : "Open activity"}
              </Link>
            }
            subtitle={isZh ? "近期与你的费用、付款、抵扣或付款方式变更有关的审计记录。" : "Recent billing-related audit events touching your charges, payments, credits, or payment-method changes."}
            title={isZh ? "账单动态" : "Billing activity"}
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
                        {isZh ? "打开" : "Open"}
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description={isZh ? "当你的成员身份下记录了费用、付款、抵扣或付款方式变更后，相关审计动态会显示在这里。" : "Billing-related audit events will appear here once charges, payments, credits, or payment-method changes are logged for your membership."}
                title={isZh ? "暂无近期账单动态" : "No recent billing activity"}
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle={isZh ? "当前自助账单功能的范围和限制。" : "Current scope and limitations for self-service billing in this MVP."}
            title={isZh ? "当前限制" : "Current limitations"}
          >
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
              <h3>{paymentMethodFormState.paymentMethodId ? (isZh ? "编辑付款方式" : "EDIT PAYMENT METHOD") : (isZh ? "新增付款方式" : "ADD PAYMENT METHOD")}</h3>
              <button aria-label={isZh ? "关闭付款方式弹窗" : "Close payment method modal"} onClick={() => setIsPaymentMethodModalOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="office-modal-body office-accounting-modal-body" onSubmit={handleSavePaymentMethod}>
              <div className="office-form-grid">
                <FormField label={isZh ? "类型" : "Type"}>
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

                <FormField label={isZh ? "脱敏尾号" : "Masked last4"}>
                  <TextInput
                    maxLength={4}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, last4: event.target.value }))}
                    placeholder="4242"
                    value={paymentMethodFormState.last4}
                  />
                </FormField>

                <FormField className="office-form-grid-span-2" label={isZh ? "名称" : "Label"}>
                  <TextInput
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, label: event.target.value }))}
                    placeholder={isZh ? "Visa 尾号 4242" : "Visa ending 4242"}
                    required
                    value={paymentMethodFormState.label}
                  />
                </FormField>

                <FormField className="office-form-grid-span-2" label={isZh ? "来源 / 提供方" : "Provider"}>
                  <TextInput
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, provider: event.target.value }))}
                    placeholder={isZh ? "手动记录" : "Manual"}
                    value={paymentMethodFormState.provider}
                  />
                </FormField>

                <CheckboxField className="office-form-grid-span-2" label={isZh ? "设为默认付款方式" : "Set as default method"}>
                  <input
                    checked={paymentMethodFormState.isDefault}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, isDefault: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>

                <CheckboxField className="office-form-grid-span-2" label={isZh ? "标记为已启用自动付款" : "Mark auto-pay enabled"}>
                  <input
                    checked={paymentMethodFormState.autoPayEnabled}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, autoPayEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>
              </div>

              {formError ? <p className="office-form-error">{formError}</p> : null}

              <footer className="office-modal-footer">
                <span>{isZh ? "这里只保存脱敏后的付款方式引用，不会保存支付处理商 token 或原始凭据。" : "This stores only a masked billing-method reference. No live processor token or raw credential is captured here."}</span>
                <Button disabled={pendingAction === "save-payment-method"} type="submit">
                  {pendingAction === "save-payment-method"
                    ? isZh ? "保存中..." : "Saving..."
                    : paymentMethodFormState.paymentMethodId
                      ? isZh ? "保存方式" : "Save method"
                      : isZh ? "新增方式" : "Add method"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留方式" : "Keep method"}
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
