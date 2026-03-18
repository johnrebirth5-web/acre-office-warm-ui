"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { OfficeTransactionCommissionSnapshot } from "@acre/db";
import { Button, FormField, HorizontalScrollArea, SectionCard, SelectInput, StatCard, StatusBadge, TextInput } from "@acre/ui";

type TransactionCommissionCardProps = {
  transactionId: string;
  snapshot: OfficeTransactionCommissionSnapshot;
  canManageCommissions: boolean;
  canCalculateCommissions: boolean;
  canApproveCommissions: boolean;
};

const calculationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "calculated", label: "Calculated" },
  { value: "reviewed", label: "Reviewed" },
  { value: "statement_ready", label: "Statement ready" },
  { value: "payable", label: "Payable" },
  { value: "paid", label: "Paid" }
];

function getStatusTone(status: string) {
  if (status === "Paid" || status === "Payable") {
    return "success" as const;
  }

  if (status === "Statement ready" || status === "Reviewed") {
    return "accent" as const;
  }

  if (status === "Draft") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function TransactionCommissionCard({
  transactionId,
  snapshot,
  canManageCommissions,
  canCalculateCommissions,
  canApproveCommissions
}: TransactionCommissionCardProps) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState(snapshot.mode === "legacy_plan" ? snapshot.planId : "");
  const [calculationNote, setCalculationNote] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedPlanId(snapshot.mode === "legacy_plan" ? snapshot.planId : "");
  }, [snapshot.mode, snapshot.planId]);

  async function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("calculate");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/commissions/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          commissionPlanId: selectedPlanId,
          notes: calculationNote
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to calculate commissions.");
      }

      setCalculationNote("");
      router.refresh();
    } catch (calculateError) {
      setError(calculateError instanceof Error ? calculateError.message : "Failed to calculate commissions.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStatusUpdate(calculationId: string) {
    setPendingAction(`status:${calculationId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/accounting/commissions/calculations/${calculationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: statusDrafts[calculationId] ?? "draft"
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update commission status.");
      }

      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update commission status.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section id="commission">
      <SectionCard
        subtitle="Default split chain, optional advanced plan override, and persisted commission rows for this transaction."
        title="Commission"
      >
        <div className="office-kpi-grid office-commission-kpi-grid">
          <StatCard hint="transaction finance input" label="Gross commission" value={snapshot.summary.grossCommissionLabel} />
          <StatCard hint="transaction-level referral deduction" label="Referral fee" value={snapshot.summary.referralFeeLabel} />
          <StatCard hint="plan-driven deductions" label="Calculated fees" value={snapshot.summary.feesLabel} />
          <StatCard hint="current transaction finance office share" label="Office net" value={snapshot.summary.officeNetLabel} />
          <StatCard hint="current transaction finance agent share" label="Agent net" value={snapshot.summary.agentNetLabel} />
          <StatCard hint="rows in statement-ready status" label="Statement ready" value={snapshot.summary.statementReadyLabel} />
          <StatCard hint="rows already marked payable" label="Payable" value={snapshot.summary.payableLabel} />
        </div>

        <div className="office-inline-meta">
          <span>Default split: {snapshot.defaultSplitLabel || "Not configured"}</span>
          <span>Source: {snapshot.defaultSplitSourceLabel || "No default split configured"}</span>
        </div>
        {snapshot.visibilityNote ? <p className="office-form-helper">{snapshot.visibilityNote}</p> : null}
        {!canCalculateCommissions ? (
          <p className="office-form-helper">
            Your current role can view commission data here, but only commission managers can run Calculate for this transaction.
          </p>
        ) : null}

        <form className="office-inline-form office-inline-form-wrap" onSubmit={handleCalculate}>
          <FormField className="office-inline-form-field-wide" label="Calculation note">
            <TextInput disabled={!canCalculateCommissions || pendingAction === "calculate"} onChange={(event) => setCalculationNote(event.target.value)} value={calculationNote} />
          </FormField>

          <div className="office-inline-form-actions">
            <Button disabled={!canCalculateCommissions || pendingAction === "calculate"} type="submit">
              {pendingAction === "calculate" ? "Calculating..." : snapshot.calculations.length > 0 ? "Recalculate" : "Calculate"}
            </Button>
          </div>
        </form>
        {error ? <p className="office-form-error">{error}</p> : null}

        <div className="office-inline-meta">
          <span>Latest mode: {snapshot.mode === "default_split_chain" ? "Default split chain" : "Legacy advanced plan"}</span>
          <span>Advanced reference: {snapshot.planLabel}</span>
        </div>
        <details className="office-section-card">
          <summary>Advanced settings</summary>
          <div className="office-section-body">
            <div className="office-inline-meta">
              <span>Plan source: {snapshot.planSourceLabel}</span>
              <span>Used reference: {snapshot.planLabel}</span>
            </div>
            <form className="office-inline-form office-inline-form-wrap" onSubmit={handleCalculate}>
              <FormField label="Advanced plan override">
                <SelectInput disabled={!canCalculateCommissions || pendingAction === "calculate"} onChange={(event) => setSelectedPlanId(event.target.value)} value={selectedPlanId}>
                  <option value="">Use default split chain</option>
                  {snapshot.availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <div className="office-inline-form-actions">
                <Button disabled={!canCalculateCommissions || pendingAction === "calculate"} type="submit" variant="secondary">
                  {pendingAction === "calculate" ? "Saving..." : "Recalculate with selected mode"}
                </Button>
              </div>
            </form>
          </div>
        </details>

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>Recipient</span>
              <span>Role</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Statement</span>
              <span>Calculated</span>
              <span>Actions</span>
            </div>

            {snapshot.calculations.map((row) => (
              <div className="office-table-row office-table-row-commission" key={row.id}>
                <div className="office-table-primary">
                  <strong>{row.recipientLabel}</strong>
                  <p>{row.recipientType}</p>
                </div>
                <span>{row.recipientRole || "—"}</span>
                <div className="office-table-primary">
                  <strong>{row.commissionPlanLabel}</strong>
                  <p>{row.grossCommissionLabel} gross</p>
                </div>
                <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>
                <div className="office-table-primary">
                  <strong>{row.statementAmountLabel}</strong>
                  <p>
                    {row.officeNetLabel} office · {row.agentNetLabel} agent
                  </p>
                </div>
                <span>{row.calculatedAt || "—"}</span>
                <div className="bm-accounting-inline-actions">
                  {(canManageCommissions || canApproveCommissions) ? (
                    <>
                      <SelectInput
                        disabled={pendingAction === `status:${row.id}`}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [row.id]: event.target.value
                          }))
                        }
                        value={statusDrafts[row.id] ?? row.statusValue}
                      >
                        {calculationStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                      <Button
                        disabled={pendingAction === `status:${row.id}`}
                        onClick={() => void handleStatusUpdate(row.id)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {pendingAction === `status:${row.id}` ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}

            {snapshot.calculations.length === 0 ? (
              <div className="bm-accounting-empty">
                <p>No commission calculations have been saved for this transaction yet.</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>
      </SectionCard>
    </section>
  );
}
