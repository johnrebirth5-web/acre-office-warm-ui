"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import type { OfficeTransactionCommissionSnapshot } from "@acre/db";
import { Button, HorizontalScrollArea, SectionCard, SelectInput, StatCard, StatusBadge, TextInput } from "@acre/ui";

type TransactionCommissionCardProps = {
  transactionId: string;
  snapshot: OfficeTransactionCommissionSnapshot;
  canManageCommissions: boolean;
  canCalculateCommissions: boolean;
  canApproveCommissions: boolean;
  isOwner: boolean;
};

type OverrideDraftRow = {
  key: string;
  membershipId: string;
  recipientLabel: string;
  recipientRole: string;
  currentFinal: string;
  currentFinalLabel: string;
  amount: string;
  isManualParticipant: boolean;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function parseAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  return Number(trimmed);
}

function buildOverrideRows(snapshot: OfficeTransactionCommissionSnapshot): OverrideDraftRow[] {
  return snapshot.stakeholderBreakdown.map((row) => ({
    key: row.key,
    membershipId: row.membershipId,
    recipientLabel: row.recipientLabel,
    recipientRole: row.recipientRole,
    currentFinal: row.finalAmount,
    currentFinalLabel: row.finalAmountLabel,
    amount: row.finalAmount,
    isManualParticipant: row.isManualParticipant
  }));
}

export function TransactionCommissionCard({
  transactionId,
  snapshot,
  canManageCommissions,
  canCalculateCommissions,
  canApproveCommissions,
  isOwner
}: TransactionCommissionCardProps) {
  const router = useRouter();
  const [calculationNote, setCalculationNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideRows, setOverrideRows] = useState<OverrideDraftRow[]>(() => buildOverrideRows(snapshot));
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatusDrafts(Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue])));
    setOverrideRows(buildOverrideRows(snapshot));
  }, [snapshot]);

  const availableManualParticipantOptions = snapshot.manualParticipantOptions.filter(
    (option) => !overrideRows.some((row) => row.membershipId === option.membershipId)
  );

  useEffect(() => {
    if (availableManualParticipantOptions.some((option) => option.membershipId === selectedParticipantId)) {
      return;
    }

    setSelectedParticipantId(availableManualParticipantOptions[0]?.membershipId ?? "");
  }, [availableManualParticipantOptions, selectedParticipantId]);

  const currentTotal = overrideRows.reduce((sum, row) => sum + parseAmount(row.currentFinal), 0);
  const overrideTotal = overrideRows.reduce((sum, row) => {
    const amount = parseAmount(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const hasInvalidAmounts = overrideRows.some((row) => {
    const amount = parseAmount(row.amount);
    return !Number.isFinite(amount) || amount < 0;
  });
  const totalDifference = overrideTotal - currentTotal;
  const totalsBalanced = !hasInvalidAmounts && Math.abs(totalDifference) < 0.005;
  const canManageOverride = canManageCommissions || canApproveCommissions;
  const calculateLocked = snapshot.manualParticipantLockActive;
  const canSubmitOverride = canManageOverride && pendingAction !== "override" && totalsBalanced;

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
      startTransition(() => {
        router.refresh();
      });
    } catch (calculateError) {
      setError(calculateError instanceof Error ? calculateError.message : "Failed to calculate commissions.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleAddParticipant() {
    if (!selectedParticipantId) {
      return;
    }

    const option = snapshot.manualParticipantOptions.find((entry) => entry.membershipId === selectedParticipantId);

    if (!option) {
      return;
    }

    setOverrideRows((current) => [
      ...current,
      {
        key: option.membershipId,
        membershipId: option.membershipId,
        recipientLabel: option.recipientLabel,
        recipientRole: option.recipientRole,
        currentFinal: "0",
        currentFinalLabel: formatCurrency(0),
        amount: "0",
        isManualParticipant: true
      }
    ]);
  }

  function handleRemoveParticipant(key: string) {
    setOverrideRows((current) => current.filter((row) => row.key !== key));
  }

  async function handleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("override");
    setError("");

    try {
      if (!totalsBalanced) {
        throw new Error("Override total must stay unchanged and every amount must be zero or greater.");
      }

      const response = await fetch(`/api/office/transactions/${transactionId}/commissions/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          overrideReason,
          notes: overrideNote,
          stakeholderRows: overrideRows.map((row) => ({
            key: row.key,
            membershipId: row.membershipId,
            amount: row.amount
          }))
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to apply override.");
      }

      setOverrideReason("");
      setOverrideNote("");
      startTransition(() => {
        router.refresh();
      });
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

      startTransition(() => {
        router.refresh();
      });
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
          <StatCard hint="current owner-agent payout" label="Primary agent net" value={snapshot.summary.agentNetLabel} />
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
        {calculateLocked ? (
          <p className="office-form-helper">
            This transaction already has manual override participants. Recalculate is locked, so keep using Override for further payout changes.
          </p>
        ) : null}
        {!canCalculateCommissions ? (
          <p className="office-form-helper">
            Your current role can view commission data here, but only commission managers can run Calculate for this transaction.
          </p>
        ) : null}

        <form className="office-inline-form office-inline-form-wrap" onSubmit={handleCalculate}>
          <label className="office-detail-field office-detail-field-wide">
            <span>Calculation note</span>
            <TextInput
              disabled={!canCalculateCommissions || calculateLocked || pendingAction === "calculate"}
              onChange={(event) => setCalculationNote(event.target.value)}
              value={calculationNote}
            />
          </label>
          <div className="office-inline-form-actions">
            <Button disabled={!canCalculateCommissions || calculateLocked || pendingAction === "calculate"} type="submit">
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
                  {row.isManualParticipant ? <p>Manual override participant</p> : null}
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

        {canManageOverride && snapshot.stakeholderBreakdown.length > 0 ? (
          <form className="office-section-card" onSubmit={handleOverride}>
            <div className="office-section-body">
              <div className="office-detail-grid">
                <label className="office-detail-field office-detail-field-wide">
                  <span>Override reason</span>
                  <TextInput
                    disabled={pendingAction === "override"}
                    onChange={(event) => setOverrideReason(event.target.value)}
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
                {isOwner ? (
                  <div className="office-detail-field office-detail-field-wide">
                    <span>Add participant</span>
                    <div className="office-inline-form-actions">
                      <SelectInput
                        disabled={pendingAction === "override" || availableManualParticipantOptions.length === 0}
                        onChange={(event) => setSelectedParticipantId(event.target.value)}
                        value={selectedParticipantId}
                      >
                        <option value="">Select an active membership</option>
                        {availableManualParticipantOptions.map((option) => (
                          <option key={option.membershipId} value={option.membershipId}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                      <Button
                        disabled={pendingAction === "override" || !selectedParticipantId}
                        onClick={handleAddParticipant}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Add participant
                      </Button>
                    </div>
                    <p className="office-form-helper">
                      Only Owner can add or remove extra payout participants. New participants must be active memberships in this organization.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="office-inline-meta">
                <span>Current total: {formatCurrency(currentTotal)}</span>
                <span>Override total: {formatCurrency(overrideTotal)}</span>
                <span>Difference: {formatCurrency(totalDifference)}</span>
              </div>
              {!totalsBalanced ? (
                <p className="office-form-helper">Override total must stay unchanged before saving, and every amount must be zero or greater.</p>
              ) : null}

              <HorizontalScrollArea>
                <div className="office-table">
                  <div className="office-table-header office-table-row office-table-row-commission">
                    <span>Stakeholder</span>
                    <span>Current final</span>
                    <span>Override amount</span>
                    {isOwner ? <span>Actions</span> : null}
                  </div>

                  {overrideRows.map((row) => (
                    <div className="office-table-row office-table-row-commission" key={`override:${row.key}`}>
                      <div className="office-table-primary">
                        <strong>{row.recipientLabel}</strong>
                        <p>{row.isManualParticipant ? `${row.recipientRole} · Manual participant` : row.recipientRole}</p>
                      </div>
                      <span>{row.currentFinalLabel}</span>
                      <TextInput
                        disabled={pendingAction === "override"}
                        onChange={(event) =>
                          setOverrideRows((current) =>
                            current.map((candidate) =>
                              candidate.key === row.key
                                ? {
                                    ...candidate,
                                    amount: event.target.value
                                  }
                                : candidate
                            )
                          )
                        }
                        value={row.amount}
                      />
                      {isOwner ? (
                        <div className="bm-accounting-inline-actions">
                          {row.isManualParticipant ? (
                            <Button
                              disabled={pendingAction === "override"}
                              onClick={() => handleRemoveParticipant(row.key)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Remove
                            </Button>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </HorizontalScrollArea>

              <div className="office-inline-form-actions">
                <Button disabled={!canSubmitOverride} type="submit" variant="secondary">
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
                  {canManageOverride ? (
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
