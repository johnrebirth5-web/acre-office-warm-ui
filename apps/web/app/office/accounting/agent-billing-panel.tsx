"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { OfficeAgentBillingSnapshot } from "@acre/db";
import { Button, HorizontalScrollArea, ListPageFilters, ListPageSection, ListPageStatsGrid, StatCard } from "@acre/ui";

type AgentBillingPanelProps = {
  snapshot: OfficeAgentBillingSnapshot | null;
  canViewAgentBilling: boolean;
  canManageAgentBilling: boolean;
  canManagePayments: boolean;
};

type ChargeFormState = {
  membershipIds: string[];
  chargeType: string;
  description: string;
  amount: string;
  accountingDate: string;
  dueDate: string;
  relatedTransactionId: string;
  notes: string;
};

type RecurringRuleFormState = {
  recurringChargeRuleId: string;
  membershipId: string;
  name: string;
  chargeType: string;
  description: string;
  amount: string;
  frequency: string;
  customIntervalDays: string;
  startDate: string;
  nextDueDate: string;
  endDate: string;
  autoGenerateInvoice: boolean;
  isActive: boolean;
};

type PaymentMethodFormState = {
  paymentMethodId: string;
  membershipId: string;
  type: string;
  label: string;
  provider: string;
  last4: string;
  isDefault: boolean;
  autoPayEnabled: boolean;
  status: string;
};

type PaymentFormState = {
  membershipId: string;
  invoiceIds: string[];
  amount: string;
  accountingDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
};

type CreditApplicationFormState = {
  membershipId: string;
  creditMemoId: string;
  invoiceId: string;
  amount: string;
  memo: string;
};

function AgentBillingTable(props: { children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className="office-table">{props.children}</div>
    </HorizontalScrollArea>
  );
}

const billingStatusOptions = [
  { value: "all", label: "All ledger statuses" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" }
];

const recurringFrequencyOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "custom_interval", label: "Custom interval" }
];

const paymentMethodTypeOptions = [
  { value: "card_on_file", label: "Card on file" },
  { value: "bank_account", label: "Bank account" },
  { value: "check", label: "Check" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" }
];

const paymentMethodStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "invalid", label: "Invalid" },
  { value: "expired", label: "Expired" },
  { value: "removed", label: "Removed" }
];

const collectionMethodOptions = [
  { value: "check", label: "Check" },
  { value: "wire", label: "Wire" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" }
];

function buildEmptyChargeState(): ChargeFormState {
  return {
    membershipIds: [],
    chargeType: "desk_fee",
    description: "",
    amount: "",
    accountingDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    relatedTransactionId: "",
    notes: ""
  };
}

function buildEmptyRecurringRuleState(): RecurringRuleFormState {
  return {
    recurringChargeRuleId: "",
    membershipId: "",
    name: "",
    chargeType: "desk_fee",
    description: "",
    amount: "",
    frequency: "monthly",
    customIntervalDays: "",
    startDate: new Date().toISOString().slice(0, 10),
    nextDueDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    autoGenerateInvoice: true,
    isActive: true
  };
}

function buildRecurringRuleStateFromExisting(snapshot: OfficeAgentBillingSnapshot, ruleId: string): RecurringRuleFormState {
  const existing = snapshot.recurringRules.find((rule) => rule.id === ruleId);

  if (!existing) {
    return buildEmptyRecurringRuleState();
  }

  return {
    recurringChargeRuleId: existing.id,
    membershipId: existing.membershipId,
    name: existing.name,
    chargeType: existing.chargeType,
    description: existing.description,
    amount: existing.amountValue,
    frequency: existing.frequencyValue,
    customIntervalDays: existing.customIntervalDays ? String(existing.customIntervalDays) : "",
    startDate: existing.startDate,
    nextDueDate: existing.nextDueDate,
    endDate: existing.endDate,
    autoGenerateInvoice: existing.autoGenerateInvoice,
    isActive: existing.isActive
  };
}

function buildEmptyPaymentMethodState(): PaymentMethodFormState {
  return {
    paymentMethodId: "",
    membershipId: "",
    type: "card_on_file",
    label: "",
    provider: "Manual",
    last4: "",
    isDefault: true,
    autoPayEnabled: false,
    status: "active"
  };
}

function buildPaymentMethodStateFromExisting(snapshot: OfficeAgentBillingSnapshot, paymentMethodId: string): PaymentMethodFormState {
  const existing = snapshot.paymentMethods.find((method) => method.id === paymentMethodId);

  if (!existing) {
    return buildEmptyPaymentMethodState();
  }

  return {
    paymentMethodId: existing.id,
    membershipId: existing.membershipId,
    type: existing.typeValue,
    label: existing.label,
    provider: existing.provider,
    last4: existing.last4,
    isDefault: existing.isDefault,
    autoPayEnabled: existing.autoPayEnabled,
    status: existing.statusValue
  };
}

function buildEmptyPaymentState(): PaymentFormState {
  return {
    membershipId: "",
    invoiceIds: [],
    amount: "",
    accountingDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "check",
    referenceNumber: "",
    notes: ""
  };
}

function buildEmptyCreditFormState(): CreditApplicationFormState {
  return {
    membershipId: "",
    creditMemoId: "",
    invoiceId: "",
    amount: "",
    memo: ""
  };
}

export function AgentBillingPanel({
  snapshot,
  canViewAgentBilling,
  canManageAgentBilling,
  canManagePayments
}: AgentBillingPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();

  const [filterState, setFilterState] = useState(() => ({
    membershipId: snapshot?.filters.membershipId ?? "",
    status: snapshot?.filters.status ?? "all",
    startDate: snapshot?.filters.startDate ?? "",
    endDate: snapshot?.filters.endDate ?? "",
    transactionId: snapshot?.filters.transactionId ?? "",
    q: snapshot?.filters.q ?? ""
  }));
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isRecurringRuleModalOpen, setIsRecurringRuleModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [chargeFormState, setChargeFormState] = useState<ChargeFormState>(buildEmptyChargeState);
  const [recurringRuleFormState, setRecurringRuleFormState] = useState<RecurringRuleFormState>(buildEmptyRecurringRuleState);
  const [paymentMethodFormState, setPaymentMethodFormState] = useState<PaymentMethodFormState>(buildEmptyPaymentMethodState);
  const [paymentFormState, setPaymentFormState] = useState<PaymentFormState>(buildEmptyPaymentState);
  const [creditApplicationFormState, setCreditApplicationFormState] = useState<CreditApplicationFormState>(buildEmptyCreditFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const memberScopedInvoiceOptions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    if (!paymentFormState.membershipId) {
      return snapshot.openInvoiceOptions;
    }

    return snapshot.openInvoiceOptions.filter((option) => option.membershipId === paymentFormState.membershipId);
  }, [paymentFormState.membershipId, snapshot]);

  const memberScopedCreditOptions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    if (!creditApplicationFormState.membershipId) {
      return snapshot.openCreditMemoOptions;
    }

    return snapshot.openCreditMemoOptions.filter((option) => option.membershipId === creditApplicationFormState.membershipId);
  }, [creditApplicationFormState.membershipId, snapshot]);

  const memberScopedCreditInvoiceOptions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    if (!creditApplicationFormState.membershipId) {
      return snapshot.openInvoiceOptions;
    }

    return snapshot.openInvoiceOptions.filter((option) => option.membershipId === creditApplicationFormState.membershipId);
  }, [creditApplicationFormState.membershipId, snapshot]);

  if (!canViewAgentBilling || !snapshot) {
    return null;
  }

  function pushBillingFilters(overrides: Partial<typeof filterState>) {
    const params = new URLSearchParams(currentSearchParams.toString());
    const nextState = { ...filterState, ...overrides };

    if (nextState.membershipId.trim()) {
      params.set("billingMembershipId", nextState.membershipId.trim());
    } else {
      params.delete("billingMembershipId");
    }

    if (nextState.status.trim() && nextState.status !== "all") {
      params.set("billingStatus", nextState.status.trim());
    } else {
      params.delete("billingStatus");
    }

    if (nextState.startDate.trim()) {
      params.set("billingStartDate", nextState.startDate.trim());
    } else {
      params.delete("billingStartDate");
    }

    if (nextState.endDate.trim()) {
      params.set("billingEndDate", nextState.endDate.trim());
    } else {
      params.delete("billingEndDate");
    }

    if (nextState.transactionId.trim()) {
      params.set("billingTransactionId", nextState.transactionId.trim());
    } else {
      params.delete("billingTransactionId");
    }

    if (nextState.q.trim()) {
      params.set("billingQ", nextState.q.trim());
    } else {
      params.delete("billingQ");
    }

    router.push(params.toString() ? `${pathname}?${params.toString()}#agent-billing` : `${pathname}#agent-billing`);
  }

  function resetFilters() {
    setFilterState({
      membershipId: "",
      status: "all",
      startDate: "",
      endDate: "",
      transactionId: "",
      q: ""
    });
    const params = new URLSearchParams(currentSearchParams.toString());
    params.delete("billingMembershipId");
    params.delete("billingStatus");
    params.delete("billingStartDate");
    params.delete("billingEndDate");
    params.delete("billingTransactionId");
    params.delete("billingQ");
    router.push(params.toString() ? `${pathname}?${params.toString()}#agent-billing` : `${pathname}#agent-billing`);
  }

  function openChargeModal() {
    setChargeFormState(buildEmptyChargeState());
    setFormError("");
    setIsChargeModalOpen(true);
  }

  function openRecurringRuleModal(ruleId?: string) {
    setRecurringRuleFormState(ruleId ? buildRecurringRuleStateFromExisting(snapshot!, ruleId) : buildEmptyRecurringRuleState());
    setFormError("");
    setIsRecurringRuleModalOpen(true);
  }

  function openPaymentMethodModal(paymentMethodId?: string) {
    setPaymentMethodFormState(paymentMethodId ? buildPaymentMethodStateFromExisting(snapshot!, paymentMethodId) : buildEmptyPaymentMethodState());
    setFormError("");
    setIsPaymentMethodModalOpen(true);
  }

  function openPaymentModal() {
    setPaymentFormState(buildEmptyPaymentState());
    setFormError("");
    setIsPaymentModalOpen(true);
  }

  function openCreditModal() {
    setCreditApplicationFormState(buildEmptyCreditFormState());
    setFormError("");
    setIsCreditModalOpen(true);
  }

  async function handleCreateCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/office/accounting/agent-billing/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(chargeFormState)
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create billing charges.");
      }

      setIsChargeModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create billing charges.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveRecurringRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const isEditing = Boolean(recurringRuleFormState.recurringChargeRuleId);
      const response = await fetch(
        isEditing
          ? `/api/office/accounting/agent-billing/recurring-rules/${recurringRuleFormState.recurringChargeRuleId}`
          : "/api/office/accounting/agent-billing/recurring-rules",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            membershipId: recurringRuleFormState.membershipId,
            name: recurringRuleFormState.name,
            chargeType: recurringRuleFormState.chargeType,
            description: recurringRuleFormState.description,
            amount: recurringRuleFormState.amount,
            frequency: recurringRuleFormState.frequency,
            customIntervalDays: recurringRuleFormState.customIntervalDays,
            startDate: recurringRuleFormState.startDate,
            nextDueDate: recurringRuleFormState.nextDueDate,
            endDate: recurringRuleFormState.endDate,
            autoGenerateInvoice: recurringRuleFormState.autoGenerateInvoice,
            isActive: recurringRuleFormState.isActive
          })
        }
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save recurring rule.");
      }

      setIsRecurringRuleModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save recurring rule.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateRecurringCharges() {
    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/office/accounting/agent-billing/recurring-rules/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: filterState.membershipId,
          asOfDate: filterState.endDate || new Date().toISOString().slice(0, 10)
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate due recurring charges.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to generate due recurring charges.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSavePaymentMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const isEditing = Boolean(paymentMethodFormState.paymentMethodId);
      const response = await fetch(
        isEditing
          ? `/api/office/accounting/agent-billing/payment-methods/${paymentMethodFormState.paymentMethodId}`
          : "/api/office/accounting/agent-billing/payment-methods",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            membershipId: paymentMethodFormState.membershipId,
            type: paymentMethodFormState.type,
            label: paymentMethodFormState.label,
            provider: paymentMethodFormState.provider,
            last4: paymentMethodFormState.last4,
            isDefault: paymentMethodFormState.isDefault,
            autoPayEnabled: paymentMethodFormState.autoPayEnabled,
            status: paymentMethodFormState.status
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
      setIsSubmitting(false);
    }
  }

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/office/accounting/agent-billing/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paymentFormState)
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to record payment.");
      }

      setIsPaymentModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApplyCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/office/accounting/agent-billing/credit-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(creditApplicationFormState)
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to apply credit.");
      }

      setIsCreditModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to apply credit.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ListPageSection
        id="agent-billing"
        subtitle="Ledger, recurring charges, payment methods, collections, and statement context for agent-side billing."
        title="Agent billing"
      >
        <ListPageStatsGrid className="office-kpi-grid-compact">
          <StatCard hint={`${snapshot.overview.openChargesCount} open ledger item(s).`} label="Open charges" value={snapshot.overview.openChargesLabel} />
          <StatCard hint={`${snapshot.overview.pendingChargesCount} future or upcoming charges.`} label="Pending charges" value={snapshot.overview.pendingChargesLabel} />
          <StatCard hint="Applied from real accounting payment records." label="Received payments" value={snapshot.overview.receivedPaymentsLabel} />
          <StatCard hint="Open invoice balance after payments and credits." label="Current balance" value={snapshot.overview.currentBalanceLabel} />
          <StatCard hint="Active recurring rules with future due charges." label="Upcoming recurring" value={snapshot.overview.upcomingRecurringCount} />
          <StatCard hint="Configured methods in active status." label="Payment methods" value={snapshot.overview.paymentMethodsConfiguredCount} />
        </ListPageStatsGrid>

        <ListPageFilters
          as="form"
          className="office-report-filters"
          onSubmit={(event) => {
            event.preventDefault();
            pushBillingFilters({});
          }}
        >
          <label className="office-report-filter">
            <span>Agent</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, membershipId: event.target.value }))} value={filterState.membershipId}>
              <option value="">All agents</option>
              {snapshot.filters.memberOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Status</span>
            <select
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  status: event.target.value as typeof current.status
                }))
              }
              value={filterState.status}
            >
              {billingStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Related transaction</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, transactionId: event.target.value }))} value={filterState.transactionId}>
              <option value="">All transactions</option>
              {snapshot.filters.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Search</span>
            <input
              onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search charge, ref, transaction..."
              type="text"
              value={filterState.q}
            />
          </label>

          <label className="office-report-filter">
            <span>Start date</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, startDate: event.target.value }))} type="date" value={filterState.startDate} />
          </label>

          <label className="office-report-filter">
            <span>End date</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, endDate: event.target.value }))} type="date" value={filterState.endDate} />
          </label>

          <div className="office-report-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
            </Button>
          </div>

          {canManageAgentBilling ? (
            <div className="office-report-filter-actions">
              <Button className="bm-create-button" onClick={openChargeModal} type="button">
                New one-time charge
              </Button>
              <Button onClick={() => openRecurringRuleModal()} type="button" variant="secondary">
                New recurring rule
              </Button>
              <Button onClick={handleGenerateRecurringCharges} type="button" variant="secondary">
                Generate due charges
              </Button>
              <Button onClick={() => openPaymentMethodModal()} type="button" variant="secondary">
                New payment method
              </Button>
            </div>
          ) : null}

          {canManagePayments ? (
            <div className="office-report-filter-actions">
              <Button onClick={openPaymentModal} type="button" variant="secondary">
                Record payment
              </Button>
              <Button onClick={openCreditModal} type="button" variant="secondary">
                Apply credit
              </Button>
            </div>
          ) : null}
        </ListPageFilters>

        {formError ? <p className="bm-transaction-submit-error">{formError}</p> : null}

        <div className="office-dashboard-grid-wide bm-accounting-grid">
          <div className="office-side-stack">
            <ListPageSection subtitle={`${snapshot.ledgerRows.length} ledger row(s) in the current filtered window.`} title="Agent ledger">
              <AgentBillingTable>
                <div className="office-table-header office-table-row office-table-row-agent-billing-ledger">
                  <span>Date</span>
                  <span>Type</span>
                  <span>Agent / counterparty</span>
                  <span>Category</span>
                  <span>Amount</span>
                  <span>Applied</span>
                  <span>Outstanding</span>
                  <span>Status</span>
                  <span>Linked transaction</span>
                </div>

                {snapshot.ledgerRows.map((row) => (
                  <Link className="office-table-row office-table-row-agent-billing-ledger" href={row.href} key={row.id}>
                    <span>{row.accountingDate}</span>
                    <span>{row.type}</span>
                    <div className="office-table-primary">
                      <strong>{row.counterparty}</strong>
                      <p>{row.referenceNumber || row.ownerName}</p>
                    </div>
                    <span>{row.chargeCategory}</span>
                    <span>{row.amountLabel}</span>
                    <span>{row.appliedAmountLabel}</span>
                    <span>{row.outstandingAmountLabel}</span>
                    <span>{row.status}</span>
                    <div className="office-table-primary">
                      <strong>{row.linkedTransactionHref ? "Open transaction" : "—"}</strong>
                      <p>{row.linkedTransactionLabel}</p>
                    </div>
                  </Link>
                ))}

                {snapshot.ledgerRows.length === 0 ? (
                  <div className="bm-accounting-empty">
                    <p>No agent billing ledger rows match the current filters.</p>
                  </div>
                ) : null}
              </AgentBillingTable>
            </ListPageSection>

            <ListPageSection subtitle={`${snapshot.recurringRules.length} rule(s) currently loaded.`} title="Recurring billing rules">
              <AgentBillingTable>
                <div className="office-table-header office-table-row office-table-row-recurring-rules">
                  <span>Agent</span>
                  <span>Rule</span>
                  <span>Amount</span>
                  <span>Frequency</span>
                  <span>Next due</span>
                  <span>Status</span>
                </div>

                {snapshot.recurringRules.map((rule) => (
                  <div className="office-table-row office-table-row-recurring-rules" key={rule.id}>
                    <span>{rule.memberLabel}</span>
                    <div className="office-table-primary">
                      <strong>{rule.name}</strong>
                      <p>{rule.description || rule.chargeType}</p>
                    </div>
                    <span>{rule.amountLabel}</span>
                    <span>{rule.frequency}</span>
                    <span>{rule.nextDueDate}</span>
                    <div className="bm-accounting-inline-actions">
                      <span>{rule.isActive ? "Active" : "Inactive"}</span>
                      {canManageAgentBilling ? (
                        <button className="office-inline-action" onClick={() => openRecurringRuleModal(rule.id)} type="button">
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {snapshot.recurringRules.length === 0 ? (
                  <div className="bm-accounting-empty">
                    <p>No recurring rules are configured for the current scope.</p>
                  </div>
                ) : null}
              </AgentBillingTable>
            </ListPageSection>
          </div>

          <div className="office-side-stack">
            <ListPageSection subtitle={`${snapshot.paymentMethods.length} configured method(s).`} title="Payment methods">
              <AgentBillingTable>
                <div className="office-table-header office-table-row office-table-row-payment-methods">
                  <span>Agent</span>
                  <span>Method</span>
                  <span>Provider</span>
                  <span>Status</span>
                  <span>Autopay</span>
                </div>

                {snapshot.paymentMethods.map((method) => (
                  <div className="office-table-row office-table-row-payment-methods" key={method.id}>
                    <span>{method.memberLabel}</span>
                    <div className="office-table-primary">
                      <strong>{method.label}</strong>
                      <p>{method.type} · {method.maskedReference}</p>
                    </div>
                    <span>{method.provider}</span>
                    <span>{method.status}</span>
                    <div className="bm-accounting-inline-actions">
                      <span>{method.autoPayEnabled ? "Enabled" : "Manual"}</span>
                      {canManageAgentBilling ? (
                        <button className="office-inline-action" onClick={() => openPaymentMethodModal(method.id)} type="button">
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {snapshot.paymentMethods.length === 0 ? (
                  <div className="bm-accounting-empty">
                    <p>No payment methods are configured yet.</p>
                  </div>
                ) : null}
              </AgentBillingTable>
            </ListPageSection>

            <ListPageSection
              subtitle={
                snapshot.statement ? `Showing current statement context for ${snapshot.statement.agentLabel}.` : "Select an agent in the filter to view a statement summary."
              }
              title="Agent statement"
            >
              {snapshot.statement ? (
                <div className="bm-agent-statement">
                  <div className="bm-agent-statement-metrics">
                    <div>
                      <span>Open charges</span>
                      <strong>{snapshot.statement.openChargesLabel}</strong>
                    </div>
                    <div>
                      <span>Pending charges</span>
                      <strong>{snapshot.statement.pendingChargesLabel}</strong>
                    </div>
                    <div>
                      <span>Payments received</span>
                      <strong>{snapshot.statement.paymentsReceivedLabel}</strong>
                    </div>
                    <div>
                      <span>Credits applied</span>
                      <strong>{snapshot.statement.creditsAppliedLabel}</strong>
                    </div>
                    <div>
                      <span>Current balance</span>
                      <strong>{snapshot.statement.currentBalanceLabel}</strong>
                    </div>
                  </div>

                  <AgentBillingTable>
                    <div className="office-table-header office-table-row office-table-row-agent-statement">
                      <span>Date</span>
                      <span>Entry</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>

                    {snapshot.statement.recentActivity.map((line) => (
                      <Link className="office-table-row office-table-row-agent-statement" href={line.href} key={line.id}>
                        <span>{line.accountingDate}</span>
                        <span>{line.title}</span>
                        <span>{line.amountLabel}</span>
                        <span>{line.status}</span>
                      </Link>
                    ))}
                  </AgentBillingTable>
                </div>
              ) : (
                <div className="bm-accounting-empty">
                  <p>Select an agent to inspect statement-ready billing context, including open charges, pending charges, credits, and recent activity.</p>
                </div>
              )}
            </ListPageSection>
          </div>
        </div>
      </ListPageSection>

      {isChargeModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsChargeModalOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>NEW AGENT CHARGE</h3>
              <button aria-label="Close create charge modal" onClick={() => setIsChargeModalOpen(false)} type="button">
                ×
              </button>
            </header>
            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleCreateCharge}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Agents</span>
                  <select
                    multiple
                    onChange={(event) =>
                      setChargeFormState((current) => ({
                        ...current,
                        membershipIds: Array.from(event.target.selectedOptions, (option) => option.value)
                      }))
                    }
                    size={Math.min(6, Math.max(snapshot.filters.memberOptions.length, 3))}
                    value={chargeFormState.membershipIds}
                  >
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Charge type</span>
                  <input onChange={(event) => setChargeFormState((current) => ({ ...current, chargeType: event.target.value }))} type="text" value={chargeFormState.chargeType} />
                </label>

                <label className="bm-detail-field">
                  <span>Amount</span>
                  <input onChange={(event) => setChargeFormState((current) => ({ ...current, amount: event.target.value }))} type="text" value={chargeFormState.amount} />
                </label>

                <label className="bm-detail-field">
                  <span>Accounting date</span>
                  <input onChange={(event) => setChargeFormState((current) => ({ ...current, accountingDate: event.target.value }))} type="date" value={chargeFormState.accountingDate} />
                </label>

                <label className="bm-detail-field">
                  <span>Due date</span>
                  <input onChange={(event) => setChargeFormState((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={chargeFormState.dueDate} />
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Related transaction</span>
                  <select
                    onChange={(event) => setChargeFormState((current) => ({ ...current, relatedTransactionId: event.target.value }))}
                    value={chargeFormState.relatedTransactionId}
                  >
                    <option value="">No linked transaction</option>
                    {snapshot.filters.transactionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Description</span>
                  <input onChange={(event) => setChargeFormState((current) => ({ ...current, description: event.target.value }))} type="text" value={chargeFormState.description} />
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Notes</span>
                  <textarea onChange={(event) => setChargeFormState((current) => ({ ...current, notes: event.target.value }))} rows={3} value={chargeFormState.notes} />
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>One-time charges create real invoice-style accounting transactions in the agent ledger.</span>
                <button className="bm-create-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : "Create charge"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isRecurringRuleModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsRecurringRuleModalOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>{recurringRuleFormState.recurringChargeRuleId ? "EDIT RECURRING RULE" : "NEW RECURRING RULE"}</h3>
              <button aria-label="Close recurring rule modal" onClick={() => setIsRecurringRuleModalOpen(false)} type="button">
                ×
              </button>
            </header>
            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleSaveRecurringRule}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field">
                  <span>Agent</span>
                  <select
                    onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, membershipId: event.target.value }))}
                    value={recurringRuleFormState.membershipId}
                  >
                    <option value="">Select agent</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Name</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, name: event.target.value }))} type="text" value={recurringRuleFormState.name} />
                </label>

                <label className="bm-detail-field">
                  <span>Charge type</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, chargeType: event.target.value }))} type="text" value={recurringRuleFormState.chargeType} />
                </label>

                <label className="bm-detail-field">
                  <span>Amount</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, amount: event.target.value }))} type="text" value={recurringRuleFormState.amount} />
                </label>

                <label className="bm-detail-field">
                  <span>Frequency</span>
                  <select
                    onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, frequency: event.target.value }))}
                    value={recurringRuleFormState.frequency}
                  >
                    {recurringFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {recurringRuleFormState.frequency === "custom_interval" ? (
                  <label className="bm-detail-field">
                    <span>Custom interval days</span>
                    <input
                      onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, customIntervalDays: event.target.value }))}
                      type="number"
                      value={recurringRuleFormState.customIntervalDays}
                    />
                  </label>
                ) : null}

                <label className="bm-detail-field">
                  <span>Start date</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, startDate: event.target.value }))} type="date" value={recurringRuleFormState.startDate} />
                </label>

                <label className="bm-detail-field">
                  <span>Next due date</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, nextDueDate: event.target.value }))} type="date" value={recurringRuleFormState.nextDueDate} />
                </label>

                <label className="bm-detail-field">
                  <span>End date</span>
                  <input onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, endDate: event.target.value }))} type="date" value={recurringRuleFormState.endDate} />
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Description</span>
                  <textarea onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, description: event.target.value }))} rows={3} value={recurringRuleFormState.description} />
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={recurringRuleFormState.autoGenerateInvoice}
                    onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, autoGenerateInvoice: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Auto-generate invoice</span>
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={recurringRuleFormState.isActive}
                    onChange={(event) => setRecurringRuleFormState((current) => ({ ...current, isActive: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Rule is active</span>
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>Recurring rules are deterministic. Charges appear only when generated through the due-charge action.</span>
                <button className="bm-create-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : recurringRuleFormState.recurringChargeRuleId ? "Save rule" : "Create rule"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isPaymentMethodModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsPaymentMethodModalOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>{paymentMethodFormState.paymentMethodId ? "EDIT PAYMENT METHOD" : "NEW PAYMENT METHOD"}</h3>
              <button aria-label="Close payment method modal" onClick={() => setIsPaymentMethodModalOpen(false)} type="button">
                ×
              </button>
            </header>
            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleSavePaymentMethod}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field">
                  <span>Agent</span>
                  <select
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, membershipId: event.target.value }))}
                    value={paymentMethodFormState.membershipId}
                  >
                    <option value="">Select agent</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Type</span>
                  <select onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, type: event.target.value }))} value={paymentMethodFormState.type}>
                    {paymentMethodTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Label</span>
                  <input onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, label: event.target.value }))} type="text" value={paymentMethodFormState.label} />
                </label>

                <label className="bm-detail-field">
                  <span>Provider</span>
                  <input onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, provider: event.target.value }))} type="text" value={paymentMethodFormState.provider} />
                </label>

                <label className="bm-detail-field">
                  <span>Masked last4</span>
                  <input onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, last4: event.target.value }))} maxLength={4} type="text" value={paymentMethodFormState.last4} />
                </label>

                <label className="bm-detail-field">
                  <span>Status</span>
                  <select
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, status: event.target.value }))}
                    value={paymentMethodFormState.status}
                  >
                    {paymentMethodStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={paymentMethodFormState.isDefault}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, isDefault: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Default method</span>
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={paymentMethodFormState.autoPayEnabled}
                    onChange={(event) => setPaymentMethodFormState((current) => ({ ...current, autoPayEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Autopay enabled</span>
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>This MVP stores only a billing-method reference, never raw card or bank credentials.</span>
                <button className="bm-create-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : paymentMethodFormState.paymentMethodId ? "Save payment method" : "Create payment method"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isPaymentModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>RECORD AGENT PAYMENT</h3>
              <button aria-label="Close payment modal" onClick={() => setIsPaymentModalOpen(false)} type="button">
                ×
              </button>
            </header>
            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleRecordPayment}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field">
                  <span>Agent</span>
                  <select
                    onChange={(event) =>
                      setPaymentFormState((current) => ({
                        ...current,
                        membershipId: event.target.value,
                        invoiceIds: []
                      }))
                    }
                    value={paymentFormState.membershipId}
                  >
                    <option value="">Select agent</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Open invoices</span>
                  <select
                    multiple
                    onChange={(event) =>
                      setPaymentFormState((current) => ({
                        ...current,
                        invoiceIds: Array.from(event.target.selectedOptions, (option) => option.value)
                      }))
                    }
                    size={Math.min(6, Math.max(memberScopedInvoiceOptions.length, 3))}
                    value={paymentFormState.invoiceIds}
                  >
                    {memberScopedInvoiceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.outstandingAmountLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Amount</span>
                  <input onChange={(event) => setPaymentFormState((current) => ({ ...current, amount: event.target.value }))} type="text" value={paymentFormState.amount} />
                </label>

                <label className="bm-detail-field">
                  <span>Accounting date</span>
                  <input onChange={(event) => setPaymentFormState((current) => ({ ...current, accountingDate: event.target.value }))} type="date" value={paymentFormState.accountingDate} />
                </label>

                <label className="bm-detail-field">
                  <span>Payment method</span>
                  <select
                    onChange={(event) => setPaymentFormState((current) => ({ ...current, paymentMethod: event.target.value }))}
                    value={paymentFormState.paymentMethod}
                  >
                    {collectionMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Reference number</span>
                  <input
                    onChange={(event) => setPaymentFormState((current) => ({ ...current, referenceNumber: event.target.value }))}
                    type="text"
                    value={paymentFormState.referenceNumber}
                  />
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Notes</span>
                  <textarea onChange={(event) => setPaymentFormState((current) => ({ ...current, notes: event.target.value }))} rows={3} value={paymentFormState.notes} />
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>Payments are recorded internally and applied to selected invoices. No external gateway capture is implied.</span>
                <button className="bm-create-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : "Record payment"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isCreditModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsCreditModalOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>APPLY CREDIT MEMO</h3>
              <button aria-label="Close credit application modal" onClick={() => setIsCreditModalOpen(false)} type="button">
                ×
              </button>
            </header>
            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleApplyCredit}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field">
                  <span>Agent</span>
                  <select
                    onChange={(event) =>
                      setCreditApplicationFormState((current) => ({
                        ...current,
                        membershipId: event.target.value,
                        creditMemoId: "",
                        invoiceId: ""
                      }))
                    }
                    value={creditApplicationFormState.membershipId}
                  >
                    <option value="">Select agent</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Credit memo</span>
                  <select
                    onChange={(event) => setCreditApplicationFormState((current) => ({ ...current, creditMemoId: event.target.value }))}
                    value={creditApplicationFormState.creditMemoId}
                  >
                    <option value="">Select credit memo</option>
                    {memberScopedCreditOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.remainingAmountLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Invoice</span>
                  <select
                    onChange={(event) => setCreditApplicationFormState((current) => ({ ...current, invoiceId: event.target.value }))}
                    value={creditApplicationFormState.invoiceId}
                  >
                    <option value="">Select invoice</option>
                    {memberScopedCreditInvoiceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.outstandingAmountLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Amount</span>
                  <input onChange={(event) => setCreditApplicationFormState((current) => ({ ...current, amount: event.target.value }))} type="text" value={creditApplicationFormState.amount} />
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Memo</span>
                  <textarea onChange={(event) => setCreditApplicationFormState((current) => ({ ...current, memo: event.target.value }))} rows={3} value={creditApplicationFormState.memo} />
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>Credits are applied against open invoices using real accounting applications.</span>
                <button className="bm-create-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : "Apply credit"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
