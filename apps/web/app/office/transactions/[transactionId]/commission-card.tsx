"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { OfficeTransactionCommissionSnapshot } from "@acre/db";
import { Button, HorizontalScrollArea, SectionCard, SelectInput, StatCard, StatusBadge, TextInput } from "@acre/ui";

type TransactionCommissionCardProps = {
  transactionId: string;
  snapshot: OfficeTransactionCommissionSnapshot;
  canManageCommissions: boolean;
  canCalculateCommissions: boolean;
  canApproveCommissions: boolean;
  canManageOverrideParticipants: boolean;
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

function formatDisplayAmount(value: string) {
  if (!value.trim()) {
    return "$0";
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatCurrency(numeric) : value;
}

function formatDisplayRate(value: string) {
  if (!value.trim()) {
    return "—";
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${value}%` : value;
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
  canManageOverrideParticipants
}: TransactionCommissionCardProps) {
  const router = useRouter();
  const participantPickerRef = useRef<HTMLDivElement | null>(null);
  const participantListboxId = useId();
  const [calculationNote, setCalculationNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideRows, setOverrideRows] = useState<OverrideDraftRow[]>(() => buildOverrideRows(snapshot));
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [participantSearchValue, setParticipantSearchValue] = useState("");
  const [isParticipantPickerOpen, setIsParticipantPickerOpen] = useState(false);
  const [highlightedParticipantIndex, setHighlightedParticipantIndex] = useState(0);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatusDrafts(Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue])));
    setOverrideRows(buildOverrideRows(snapshot));
    setSelectedParticipantId("");
    setParticipantSearchValue("");
    setIsParticipantPickerOpen(false);
    setHighlightedParticipantIndex(0);
  }, [snapshot]);

  const availableManualParticipantOptions = snapshot.manualParticipantOptions.filter(
    (option) => !overrideRows.some((row) => row.membershipId === option.membershipId)
  );
  const normalizedParticipantSearch = participantSearchValue.trim().toLowerCase();
  const filteredManualParticipantOptions =
    normalizedParticipantSearch.length > 0
      ? availableManualParticipantOptions.filter((option) => option.label.toLowerCase().includes(normalizedParticipantSearch))
      : [];
  const postSplitFeeRows = snapshot.feeBreakdown.filter((row) => row.selectedCalculationTypeValue === "post_split");
  const activeDescendantId =
    isParticipantPickerOpen && filteredManualParticipantOptions[highlightedParticipantIndex]
      ? `${participantListboxId}-${filteredManualParticipantOptions[highlightedParticipantIndex]?.membershipId}`
      : undefined;

  useEffect(() => {
    if (filteredManualParticipantOptions.length === 0) {
      setHighlightedParticipantIndex(0);
      return;
    }

    setHighlightedParticipantIndex((current) => Math.min(current, filteredManualParticipantOptions.length - 1));
  }, [filteredManualParticipantOptions]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!participantPickerRef.current?.contains(event.target as Node)) {
        setIsParticipantPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

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
  const canSubmitOverride = canManageOverride && pendingAction !== "override";
  const overrideValidationMessage = hasInvalidAmounts
    ? "Each override amount must be a valid number that is zero or greater."
    : totalDifference > 0.005
      ? `Override total exceeds the current payout pool by ${formatCurrency(Math.abs(totalDifference))}. Reduce one or more amounts before applying override.`
      : totalDifference < -0.005
        ? `Override total is short by ${formatCurrency(Math.abs(totalDifference))}. Increase one or more amounts before applying override.`
        : "";

  function selectParticipantOption(option: OfficeTransactionCommissionSnapshot["manualParticipantOptions"][number]) {
    setSelectedParticipantId(option.membershipId);
    setParticipantSearchValue(option.label);
    setIsParticipantPickerOpen(false);
  }

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

    const option = availableManualParticipantOptions.find((entry) => entry.membershipId === selectedParticipantId);

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
    setSelectedParticipantId("");
    setParticipantSearchValue("");
    setIsParticipantPickerOpen(false);
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
        throw new Error(overrideValidationMessage || "Override total must stay unchanged and every amount must be zero or greater.");
      }

      const response = await fetch(`/api/office/transactions/${transactionId}/commissions/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          overrideReason,
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
          <StatCard hint="gross minus pre-split fees" label="Net commission" value={snapshot.summary.netCommissionBaseLabel} />
          <StatCard hint="current final payout for the owner agent" label="Final agent net" value={snapshot.summary.agentNetLabel} />
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
              <span>Post-split fee</span>
              <span>Rate</span>
              <span>Amount</span>
              <span>Approval</span>
            </div>

            {postSplitFeeRows.map((row) => (
              <div className="office-table-row office-table-row-commission" key={row.id}>
                <div className="office-table-primary">
                  <strong>{row.feeTypeLabel}</strong>
                  <p>{row.selectedCalculationTypeLabel}</p>
                </div>
                <span>{formatDisplayRate(row.rate)}</span>
                <strong>{formatDisplayAmount(row.amount)}</strong>
                <span>{row.approvalStatus}</span>
              </div>
            ))}
          </div>
        </HorizontalScrollArea>

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
                  <span>
                    Override reason <strong>Required</strong>
                  </span>
                  <TextInput
                    disabled={pendingAction === "override"}
                    required
                    onChange={(event) => setOverrideReason(event.target.value)}
                    value={overrideReason}
                  />
                </label>
                {canManageOverrideParticipants ? (
                  <div className="office-detail-field office-detail-field-wide">
                    <span>Add participant</span>
                    <div className="office-inline-form-actions">
                      <div className="office-autocomplete" ref={participantPickerRef}>
                        <TextInput
                          aria-activedescendant={activeDescendantId}
                          aria-autocomplete="list"
                          aria-controls={participantListboxId}
                          aria-expanded={isParticipantPickerOpen && normalizedParticipantSearch.length > 0}
                          autoComplete="off"
                          disabled={pendingAction === "override" || availableManualParticipantOptions.length === 0}
                          onChange={(event) => {
                            setParticipantSearchValue(event.target.value);
                            setSelectedParticipantId("");
                            setIsParticipantPickerOpen(true);
                            setHighlightedParticipantIndex(0);
                          }}
                          onFocus={() => {
                            if (participantSearchValue.trim().length > 0) {
                              setIsParticipantPickerOpen(true);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              if (normalizedParticipantSearch.length === 0) {
                                return;
                              }

                              setIsParticipantPickerOpen(true);
                              setHighlightedParticipantIndex((current) =>
                                filteredManualParticipantOptions.length === 0
                                  ? 0
                                  : Math.min(current + 1, filteredManualParticipantOptions.length - 1)
                              );
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              if (normalizedParticipantSearch.length === 0) {
                                return;
                              }

                              setIsParticipantPickerOpen(true);
                              setHighlightedParticipantIndex((current) => Math.max(current - 1, 0));
                              return;
                            }

                            if (event.key === "Enter" && isParticipantPickerOpen && filteredManualParticipantOptions[highlightedParticipantIndex]) {
                              event.preventDefault();
                              selectParticipantOption(filteredManualParticipantOptions[highlightedParticipantIndex]!);
                              return;
                            }

                            if (event.key === "Escape") {
                              setIsParticipantPickerOpen(false);
                            }
                          }}
                          placeholder={
                            availableManualParticipantOptions.length > 0
                              ? "Type at least 1 character to search members"
                              : "No additional members available"
                          }
                          role="combobox"
                          type="search"
                          value={participantSearchValue}
                        />

                        {isParticipantPickerOpen && normalizedParticipantSearch.length > 0 ? (
                          <div className="office-autocomplete-panel" id={participantListboxId} role="listbox">
                            {filteredManualParticipantOptions.length > 0 ? (
                              filteredManualParticipantOptions.map((option, index) => (
                                <button
                                  aria-selected={selectedParticipantId === option.membershipId}
                                  className={[
                                    "office-autocomplete-option",
                                    highlightedParticipantIndex === index ? "is-active" : "",
                                    selectedParticipantId === option.membershipId ? "is-selected" : ""
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  id={`${participantListboxId}-${option.membershipId}`}
                                  key={option.membershipId}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectParticipantOption(option);
                                  }}
                                  role="option"
                                  type="button"
                                >
                                  <span>{option.label}</span>
                                  {selectedParticipantId === option.membershipId ? <strong>Selected</strong> : null}
                                </button>
                              ))
                            ) : (
                              <div className="office-autocomplete-empty">No matching members.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
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
                      Only Office Admin can add or remove extra payout participants. Type at least 1 character to search organization members, including invited members who have never activated their accounts.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="office-inline-meta">
                <span>Current total: {formatCurrency(currentTotal)}</span>
                <span>Override total: {formatCurrency(overrideTotal)}</span>
                <span>Difference: {formatCurrency(totalDifference)}</span>
              </div>
              {overrideValidationMessage ? <p className="office-form-error">{overrideValidationMessage}</p> : null}

              <HorizontalScrollArea>
                <div className="office-table">
                  <div className="office-table-header office-table-row office-table-row-commission">
                    <span>Stakeholder</span>
                    <span>Current final</span>
                    <span>Override amount</span>
                    {canManageOverrideParticipants ? <span>Actions</span> : null}
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
                      {canManageOverrideParticipants ? (
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

              {overrideValidationMessage ? (
                <p className="office-form-error">Apply override is blocked until the override total matches the current payout total.</p>
              ) : null}
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
