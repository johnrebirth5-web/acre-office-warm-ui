"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { OfficeTransactionCommissionSnapshot } from "@acre/db";
import { Button, HorizontalScrollArea, SectionCard, SelectInput, StatCard, StatusBadge, TextInput } from "@acre/ui";

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
  const [calculationNote, setCalculationNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.stakeholderBreakdown.map((row) => [row.key, row.finalAmount]))
  );
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatusDrafts(Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue])));
    setOverrideDrafts(Object.fromEntries(snapshot.stakeholderBreakdown.map((row) => [row.key, row.finalAmount])));
  }, [snapshot]);

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

  async function handleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("override");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/commissions/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          overrideReason,
          notes: overrideNote,
          stakeholderAmounts: snapshot.stakeholderBreakdown.map((row) => ({
            key: row.key,
            amount: overrideDrafts[row.key] ?? row.finalAmount
          }))
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to apply override.");
      }

      setOverrideReason("");
      setOverrideNote("");
      router.refresh();
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Failed to apply override.");
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
      <SectionCard subtitle="Structured fee logic, final stakeholder split, and calculation history for this transaction." title="Commission">
        <div className="office-kpi-grid office-commission-kpi-grid">
          <StatCard hint="finance input" label="Gross commission" value={snapshot.summary.grossCommissionLabel} />
          <StatCard hint="all pre-split fees" label="Pre-Split total" value={snapshot.summary.preSplitTotalLabel} />
          <StatCard hint="all post-split fees" label="Post-Split total" value={snapshot.summary.postSplitTotalLabel} />
          <StatCard hint="gross minus pre-split fees" label="Net commission base" value={snapshot.summary.netCommissionBaseLabel} />
          <StatCard hint="current owner-agent payout" label="Final agent net" value={snapshot.summary.agentNetLabel} />
          <StatCard hint="current company payout" label="Final office net" value={snapshot.summary.officeNetLabel} />
          <StatCard hint="separate reimbursement adjustment" label="Reimbursement" value={snapshot.summary.reimbursementLabel} />
          <StatCard hint="current effective calculation version" label="Current version" value={snapshot.summary.currentVersionLabel} />
        </div>

        <div className="office-inline-meta">
          <span>Default split: {snapshot.defaultSplitLabel || "Not configured"}</span>
          <span>Source: {snapshot.defaultSplitSourceLabel || "No default split configured"}</span>
        </div>
        {snapshot.visibilityNote ? <p className="office-form-helper">{snapshot.visibilityNote}</p> : null}
        {snapshot.approvalBlockers.length > 0 ? (
          <div className="office-section-card">
            <div className="office-section-body">
              <strong>Current blockers</strong>
              <ul>
                {snapshot.approvalBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {!canCalculateCommissions ? (
          <p className="office-form-helper">
            Your current role can view commission data here, but only commission managers can run Calculate for this transaction.
          </p>
        ) : null}

        <form className="office-inline-form office-inline-form-wrap" onSubmit={handleCalculate}>
          <label className="office-detail-field office-detail-field-wide">
            <span>Calculation note</span>
            <TextInput disabled={!canCalculateCommissions || pendingAction === "calculate"} onChange={(event) => setCalculationNote(event.target.value)} value={calculationNote} />
          </label>
          <div className="office-inline-form-actions">
            <Button disabled={!canCalculateCommissions || pendingAction === "calculate"} type="submit">
              {pendingAction === "calculate" ? "Calculating..." : snapshot.versionHistory.length > 0 ? "Recalculate" : "Calculate"}
            </Button>
          </div>
        </form>

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>Stakeholder</span>
              <span>Role</span>
              <span>Share</span>
              <span>Base</span>
              <span>Post-Split</span>
              <span>Reimbursement</span>
              <span>Final</span>
            </div>

            {snapshot.stakeholderBreakdown.map((row) => (
              <div className="office-table-row office-table-row-commission" key={row.key}>
                <div className="office-table-primary">
                  <strong>{row.recipientLabel}</strong>
                </div>
                <span>{row.recipientRole}</span>
                <span>{row.sharePercentLabel}</span>
                <span>{row.baseAmountLabel}</span>
                <span>{row.postSplitAdjustmentLabel}</span>
                <span>{row.reimbursementAdjustmentLabel}</span>
                <strong>{row.finalAmountLabel}</strong>
              </div>
            ))}

            {snapshot.stakeholderBreakdown.length === 0 ? (
              <div className="bm-accounting-empty">
                <p>Run the finance calculation to generate stakeholder breakdown rows.</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>

        {(canManageCommissions || canApproveCommissions) && snapshot.stakeholderBreakdown.length > 0 ? (
          <form className="office-section-card" onSubmit={handleOverride}>
            <div className="office-section-body">
              <div className="office-detail-grid">
                <label className="office-detail-field office-detail-field-wide">
                  <span>Override reason</span>
                  <input
                    disabled={pendingAction === "override"}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    type="text"
                    value={overrideReason}
                  />
                </label>
                <label className="office-detail-field office-detail-field-wide">
                  <span>Override note</span>
                  <textarea
                    disabled={pendingAction === "override"}
                    onChange={(event) => setOverrideNote(event.target.value)}
                    rows={2}
                    value={overrideNote}
                  />
                </label>
              </div>

              <HorizontalScrollArea>
                <div className="office-table">
                  <div className="office-table-header office-table-row office-table-row-commission">
                    <span>Stakeholder</span>
                    <span>Current final</span>
                    <span>Override amount</span>
                  </div>

                  {snapshot.stakeholderBreakdown.map((row) => (
                    <div className="office-table-row office-table-row-commission" key={`override:${row.key}`}>
                      <div className="office-table-primary">
                        <strong>{row.recipientLabel}</strong>
                        <p>{row.recipientRole}</p>
                      </div>
                      <span>{row.finalAmountLabel}</span>
                      <input
                        disabled={pendingAction === "override"}
                        onChange={(event) =>
                          setOverrideDrafts((current) => ({
                            ...current,
                            [row.key]: event.target.value
                          }))
                        }
                        type="text"
                        value={overrideDrafts[row.key] ?? row.finalAmount}
                      />
                    </div>
                  ))}
                </div>
              </HorizontalScrollArea>

              <div className="office-inline-form-actions">
                <Button disabled={pendingAction === "override"} type="submit" variant="secondary">
                  {pendingAction === "override" ? "Saving override..." : "Apply override"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>Version</span>
              <span>Type</span>
              <span>Created</span>
              <span>By</span>
              <span>Agent net</span>
              <span>Office net</span>
              <span>Notes</span>
            </div>

            {snapshot.versionHistory.map((version) => (
              <div className="office-table-row office-table-row-commission" key={version.id}>
                <div className="office-table-primary">
                  <strong>Version {version.versionNumber}</strong>
                  <p>{version.isCurrent ? "Current" : "Historical"}</p>
                </div>
                <span>{version.sourceTypeLabel}</span>
                <span>{version.createdAt || "—"}</span>
                <span>{version.createdByLabel}</span>
                <span>{version.finalAgentNetLabel}</span>
                <span>{version.finalOfficeNetLabel}</span>
                <div className="office-table-primary">
                  <strong>{version.overrideReason || version.notes || "—"}</strong>
                  <p>{version.overrideReason && version.notes ? version.notes : ""}</p>
                </div>
              </div>
            ))}

            {snapshot.versionHistory.length === 0 ? (
              <div className="bm-accounting-empty">
                <p>No finance calculation history has been saved for this transaction yet.</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>Recipient</span>
              <span>Role</span>
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
                <p>No current payout rows have been saved for this transaction yet.</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>

        {error ? <p className="office-form-error">{error}</p> : null}
      </SectionCard>
    </section>
  );
}
