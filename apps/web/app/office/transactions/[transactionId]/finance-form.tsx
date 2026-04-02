"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  OfficeTransactionCommissionSnapshot,
  OfficeTransactionFinanceFeeRecord,
  OfficeTransactionFinancePrerequisiteSnapshot
} from "@acre/db";
import { Button, StatCard } from "@acre/ui";
import {
  deriveTransactionFinanceCalculatorAmount,
  deriveTransactionFinanceCalculatorRate,
  parseTransactionFinanceCalculatorNumber,
  transactionFinanceCalculatorFieldDefinitions,
  type TransactionFinanceCalculatorFieldKey
} from "../transaction-finance-calculator-config";

type FinanceFeeDraft = {
  id: string;
  feeTypeValue: OfficeTransactionFinanceFeeRecord["feeTypeValue"];
  feeTypeLabel: string;
  rate: string;
  amount: string;
  selectedCalculationTypeValue: OfficeTransactionFinanceFeeRecord["selectedCalculationTypeValue"];
  selectedCalculationTypeLabel: OfficeTransactionFinanceFeeRecord["selectedCalculationTypeLabel"];
  approvalRequired: boolean;
  approvalStatusValue: OfficeTransactionFinanceFeeRecord["approvalStatusValue"];
  approvalStatus: OfficeTransactionFinanceFeeRecord["approvalStatus"];
  notes: string;
};

type TransactionFinanceFormProps = {
  transactionId: string;
  grossCommission: string;
  financeNotes: string;
  prerequisites: OfficeTransactionFinancePrerequisiteSnapshot;
  fees: OfficeTransactionFinanceFeeRecord[];
  summary: OfficeTransactionCommissionSnapshot["summary"] | null;
  approvalBlockers: string[];
  canAutoCalculateCommission?: boolean;
  readOnly?: boolean;
};

function feeRequiresApproval(feeType: FinanceFeeDraft["feeTypeValue"], rateValue: string) {
  const numericRate = parseTransactionFinanceCalculatorNumber(rateValue);

  if (numericRate === null) {
    return false;
  }

  return (feeType === "client_referral" || feeType === "rebate") && numericRate > 20;
}

function formatApprovalStatus(value: FinanceFeeDraft["approvalStatusValue"]) {
  if (value === "approved") {
    return "Approved";
  }

  if (value === "pending") {
    return "Pending approval";
  }

  return "Not required";
}

function buildInitialFeeDrafts(fees: OfficeTransactionFinanceFeeRecord[]) {
  return fees
    .filter((fee) => fee.feeTypeValue !== "channel_development_fee")
    .map((fee) => ({
      id: fee.id,
      feeTypeValue: fee.feeTypeValue,
      feeTypeLabel: fee.feeTypeLabel,
      rate: fee.rate,
      amount: fee.amount,
      selectedCalculationTypeValue: fee.selectedCalculationTypeValue,
      selectedCalculationTypeLabel: fee.selectedCalculationTypeLabel,
      approvalRequired: fee.approvalRequired,
      approvalStatusValue: fee.approvalStatusValue,
      approvalStatus: fee.approvalStatus,
      notes: fee.notes
    }));
}

function updateCalculatorFeeDraftFromAmount(current: FinanceFeeDraft, grossCommissionValue: string, amountValue: string): FinanceFeeDraft {
  const nextRate = deriveTransactionFinanceCalculatorRate(grossCommissionValue, amountValue);
  const approvalRequired = feeRequiresApproval(current.feeTypeValue, nextRate);
  const approvalStatusValue = approvalRequired ? "pending" : "not_required";

  return {
    ...current,
    amount: amountValue,
    rate: nextRate,
    approvalRequired,
    approvalStatusValue,
    approvalStatus: formatApprovalStatus(approvalStatusValue)
  };
}

function updateCalculatorFeeDraftFromRate(current: FinanceFeeDraft, grossCommissionValue: string, rateValue: string): FinanceFeeDraft {
  const approvalRequired = feeRequiresApproval(current.feeTypeValue, rateValue);
  const approvalStatusValue = approvalRequired ? "pending" : "not_required";

  return {
    ...current,
    amount: deriveTransactionFinanceCalculatorAmount(grossCommissionValue, rateValue),
    rate: rateValue,
    approvalRequired,
    approvalStatusValue,
    approvalStatus: formatApprovalStatus(approvalStatusValue)
  };
}

export function TransactionFinanceForm({
  transactionId,
  grossCommission,
  financeNotes,
  prerequisites,
  fees,
  summary,
  approvalBlockers,
  canAutoCalculateCommission = false,
  readOnly = false
}: TransactionFinanceFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState(() => ({
    grossCommission,
    financeNotes,
    clientReferralFormApproved: prerequisites.clientReferralFormApproved,
    rebateAgreementSigned: prerequisites.rebateAgreementSigned,
    rebateGoogleFormSubmitted: prerequisites.rebateGoogleFormSubmitted,
    fees: buildInitialFeeDrafts(fees)
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function setPrerequisiteField(field: "clientReferralFormApproved" | "rebateAgreementSigned" | "rebateGoogleFormSubmitted", value: boolean) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function setTopLevelField(field: "grossCommission" | "financeNotes", value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function setCalculatorAmountField(fieldKey: TransactionFinanceCalculatorFieldKey, value: string) {
    const definition = transactionFinanceCalculatorFieldDefinitions.find((entry) => entry.fieldKey === fieldKey);

    if (!definition) {
      return;
    }

    setFormState((current) => ({
      ...current,
      fees: current.fees.map((fee) =>
        fee.feeTypeValue === definition.feeTypeValue
          ? updateCalculatorFeeDraftFromAmount(fee, current.grossCommission, value)
          : fee
      )
    }));
  }

  function setCalculatorRateField(fieldKey: TransactionFinanceCalculatorFieldKey, value: string) {
    const definition = transactionFinanceCalculatorFieldDefinitions.find((entry) => entry.fieldKey === fieldKey);

    if (!definition) {
      return;
    }

    setFormState((current) => ({
      ...current,
      fees: current.fees.map((fee) =>
        fee.feeTypeValue === definition.feeTypeValue
          ? updateCalculatorFeeDraftFromRate(fee, current.grossCommission, value)
          : fee
      )
    }));
  }

  async function handleSaveFinance() {
    setError("");
    setIsSaving(true);
    const shouldAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;
    let financeSaved = false;

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/finance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          grossCommission: formState.grossCommission,
          financeNotes: formState.financeNotes,
          clientReferralFormApproved: formState.clientReferralFormApproved,
          rebateAgreementSigned: formState.rebateAgreementSigned,
          rebateGoogleFormSubmitted: formState.rebateGoogleFormSubmitted,
          fees: formState.fees.map((fee) => ({
            feeType: fee.feeTypeValue,
            rate: fee.rate,
            amount: fee.amount,
            selectedCalculationType: fee.selectedCalculationTypeValue,
            approvalStatus: fee.approvalStatusValue,
            notes: fee.notes
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update finance.");
      }

      financeSaved = true;

      if (shouldAutoCalculate) {
        const calculateResponse = await fetch(`/api/office/transactions/${transactionId}/commissions/calculate`, {
          method: "POST"
        });

        if (!calculateResponse.ok) {
          const body = (await calculateResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Automatic commission recalculation failed.");
        }
      }

      router.refresh();
    } catch (saveError) {
      const fallbackMessage =
        financeSaved && shouldAutoCalculate
          ? "Finance saved, but automatic commission recalculation failed."
          : "Failed to update finance.";
      const detailMessage = saveError instanceof Error ? saveError.message : fallbackMessage;

      setError(financeSaved && shouldAutoCalculate ? `Finance saved. ${detailMessage}` : detailMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const willAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;
  const actionLabel = isSaving
    ? willAutoCalculate
      ? "Calculating..."
      : "Saving..."
    : willAutoCalculate
      ? "Calculate"
      : "Save finance";
  const prerequisiteCards = [
    {
      checked: formState.clientReferralFormApproved,
      description: "Must be signed and approved before Internal Referral can be included in the commission run.",
      field: "clientReferralFormApproved" as const,
      title: "Internal referral form approved"
    },
    {
      checked: formState.rebateAgreementSigned,
      description: "Required before any rebate fee is counted in final commission calculation.",
      field: "rebateAgreementSigned" as const,
      title: "Rebate agreement signed"
    },
    {
      checked: formState.rebateGoogleFormSubmitted,
      description: "Finance must confirm the Google Form submission before rebate can be formally calculated.",
      field: "rebateGoogleFormSubmitted" as const,
      title: "Rebate Google Form submitted"
    }
  ];

  return (
    <div className="office-transaction-finance-form">
      <div className="office-kpi-grid office-commission-kpi-grid office-transaction-finance-kpis">
        <StatCard hint="current finance input" label="Gross commission" value={summary?.grossCommissionLabel ?? "$0"} />
        <StatCard hint="sum of all pre-split fees" label="Pre-Split total" value={summary?.preSplitTotalLabel ?? "$0"} />
        <StatCard hint="sum of all post-split fees" label="Post-Split total" value={summary?.postSplitTotalLabel ?? "$0"} />
        <StatCard hint="gross minus pre-split fees" label="Net commission base" value={summary?.netCommissionBaseLabel ?? "$0"} />
        <StatCard hint="current final payout for the owner agent" label="Final agent net" value={summary?.agentNetLabel ?? "$0"} />
        <StatCard hint="current company payout" label="Final office net" value={summary?.officeNetLabel ?? "$0"} />
        <StatCard hint="latest saved commission version" label="Current version" value={summary?.currentVersionLabel ?? "Not calculated"} />
      </div>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-calculator-shell">
          <div className="office-transaction-finance-panel-head office-transaction-finance-calculator-intro">
            <div>
              <h4>Commission calculator</h4>
              <p>Use the same calculator flow as create transaction, including amount or rate inputs for each fee.</p>
            </div>
          </div>

          <div className="office-transaction-finance-calculator-grid">
            <label className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-gross-field">
              <span>Gross Commission</span>
              <input
                disabled={readOnly}
                inputMode="decimal"
                onChange={(event) => setTopLevelField("grossCommission", event.target.value)}
                placeholder="Required"
                type="text"
                value={formState.grossCommission}
              />
            </label>

            {transactionFinanceCalculatorFieldDefinitions.map((field) => {
              const fee = formState.fees.find((entry) => entry.feeTypeValue === field.feeTypeValue);

              return (
                <div
                  className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-fee-field"
                  key={field.fieldKey}
                >
                  <span>{field.feeTypeLabel}</span>
                  <div className="office-transaction-finance-calculator-pair">
                    <label className="office-form-field office-transaction-finance-calculator-mini-field">
                      <span>Amount</span>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(event) => setCalculatorAmountField(field.fieldKey, event.target.value)}
                        placeholder="0"
                        type="text"
                        value={fee?.amount ?? ""}
                      />
                    </label>
                    <label className="office-form-field office-transaction-finance-calculator-mini-field">
                      <span>Rate %</span>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(event) => setCalculatorRateField(field.fieldKey, event.target.value)}
                        placeholder="0"
                        type="text"
                        value={fee?.rate ?? ""}
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {!readOnly ? (
              <div className="office-transaction-finance-calculator-action">
                <Button disabled={isSaving} onClick={handleSaveFinance} type="button">
                  {actionLabel}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="office-transaction-finance-calculator-footer">
            <p className="office-form-helper office-transaction-finance-calculator-helper">
              For each fee, you can enter either an amount or a rate. When gross commission is filled in, the paired value auto-fills.
            </p>

            <div className="office-transaction-finance-calculator-result is-active">
              <span>Final Agent Net</span>
              <strong>{summary?.agentNetLabel ?? "$0"}</strong>
              <p>
                {summary
                  ? `Gross ${summary.grossCommissionLabel} · Pre-Split ${summary.preSplitTotalLabel} · Post-Split ${summary.postSplitTotalLabel}`
                  : "Save or calculate to refresh the current commission output."}
              </p>
            </div>
          </div>
        </div>

        {summary?.reimbursementLabel && summary.reimbursementLabel !== "$0" ? (
          <p className="office-form-helper">Current reimbursement adjustment: {summary.reimbursementLabel}</p>
        ) : null}

        <label className="office-detail-field office-detail-field-wide">
          <span>Note</span>
          <textarea
            disabled={readOnly}
            onChange={(event) => setTopLevelField("financeNotes", event.target.value)}
            rows={4}
            value={formState.financeNotes}
          />
        </label>

        {!readOnly && canAutoCalculateCommission ? (
          <p className="office-form-helper">Calculate will save finance changes first, then rerun the current commission rules for this transaction.</p>
        ) : null}
        {readOnly ? <p className="office-form-helper">Financial details are read-only for your current access level.</p> : null}
        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-panel-head">
          <div>
            <h4>Prerequisites</h4>
            <p>These checks still gate Internal Referral and Rebate before finance can finalize the commission.</p>
          </div>
        </div>

        <div className="office-transaction-finance-prereq-grid">
          {prerequisiteCards.map((card) => (
            <label
              className={`office-transaction-finance-prereq-card${card.checked ? " is-checked" : ""}${readOnly ? " is-readonly" : ""}`}
              key={card.field}
            >
              <input
                checked={card.checked}
                disabled={readOnly}
                onChange={(event) => setPrerequisiteField(card.field, event.target.checked)}
                type="checkbox"
              />
              <div className="office-transaction-finance-prereq-copy">
                <strong>{card.title}</strong>
                <p>{card.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {approvalBlockers.length > 0 ? (
        <section className="office-transaction-finance-panel office-transaction-finance-blockers-panel">
          <div className="office-transaction-finance-panel-head">
            <div>
              <h4>Calculation blockers</h4>
              <p>These issues must be resolved before finance can finalize the commission run.</p>
            </div>
          </div>

          <ul className="office-transaction-finance-blocker-list">
            {approvalBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
