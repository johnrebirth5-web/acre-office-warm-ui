"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  OfficeTransactionCommissionSnapshot,
  OfficeTransactionFinanceFeeRecord,
  OfficeTransactionFinancePrerequisiteSnapshot
} from "@acre/db";
import { Button, HorizontalScrollArea, SelectInput, StatCard } from "@acre/ui";

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
  approvalHelperText: string;
  prerequisiteHelperText: string;
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

function parseNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatEditableNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function feeRequiresApproval(feeType: FinanceFeeDraft["feeTypeValue"], rateValue: string) {
  const numericRate = parseNumber(rateValue);

  if (numericRate === null) {
    return false;
  }

  return (
    (feeType === "channel_development_fee" || feeType === "client_referral" || feeType === "rebate") &&
    numericRate > 20
  );
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
    fees: fees.map((fee) => ({
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
      notes: fee.notes,
      approvalHelperText: fee.approvalHelperText,
      prerequisiteHelperText: fee.prerequisiteHelperText
    }))
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

  function updateFee(index: number, updater: (current: FinanceFeeDraft) => FinanceFeeDraft) {
    setFormState((current) => ({
      ...current,
      fees: current.fees.map((fee, feeIndex) => (feeIndex === index ? updater(fee) : fee))
    }));
  }

  function syncFeeNumbers(index: number, field: "rate" | "amount", value: string) {
    updateFee(index, (current) => {
      const nextFee: FinanceFeeDraft = {
        ...current,
        [field]: value
      };
      const grossValue = parseNumber(formState.grossCommission);

      if (current.feeTypeValue !== "reimbursement" && grossValue && grossValue > 0) {
        if (field === "rate") {
          const numericRate = parseNumber(value);
          nextFee.amount = numericRate === null ? "" : formatEditableNumber((grossValue * numericRate) / 100);
        } else {
          const numericAmount = parseNumber(value);
          nextFee.rate = numericAmount === null ? "" : formatEditableNumber((numericAmount / grossValue) * 100);
        }
      }

      const approvalRequired = feeRequiresApproval(current.feeTypeValue, nextFee.rate);

      return {
        ...nextFee,
        approvalRequired,
        approvalStatusValue: approvalRequired ? "pending" : "not_required",
        approvalStatus: approvalRequired ? "Pending approval" : "Not required"
      };
    });
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

  return (
    <div className="bm-transaction-finance-form">
      <div className="office-kpi-grid office-commission-kpi-grid">
        <StatCard hint="current finance input" label="Gross commission" value={summary?.grossCommissionLabel ?? "$0"} />
        <StatCard hint="sum of all pre-split fees" label="Pre-Split total" value={summary?.preSplitTotalLabel ?? "$0"} />
        <StatCard hint="sum of all post-split fees" label="Post-Split total" value={summary?.postSplitTotalLabel ?? "$0"} />
        <StatCard hint="gross minus pre-split fees" label="Net commission base" value={summary?.netCommissionBaseLabel ?? "$0"} />
        <StatCard hint="current owner-agent payout" label="Final agent net" value={summary?.agentNetLabel ?? "$0"} />
        <StatCard hint="current company payout" label="Final office net" value={summary?.officeNetLabel ?? "$0"} />
        <StatCard hint="separate reimbursement credit" label="Reimbursement" value={summary?.reimbursementLabel ?? "$0"} />
        <StatCard hint="latest saved commission version" label="Current version" value={summary?.currentVersionLabel ?? "Not calculated"} />
      </div>

      <label className="office-detail-field">
        <span>Gross commission</span>
        <input disabled={readOnly} onChange={(event) => setTopLevelField("grossCommission", event.target.value)} type="text" value={formState.grossCommission} />
      </label>

      <div className="office-detail-grid">
        <label className="office-detail-field">
          <span>
            <input
              checked={formState.clientReferralFormApproved}
              disabled={readOnly}
              onChange={(event) => setPrerequisiteField("clientReferralFormApproved", event.target.checked)}
              type="checkbox"
            />{" "}
            Client referral form signed and approved
          </span>
        </label>
        <label className="office-detail-field">
          <span>
            <input
              checked={formState.rebateAgreementSigned}
              disabled={readOnly}
              onChange={(event) => setPrerequisiteField("rebateAgreementSigned", event.target.checked)}
              type="checkbox"
            />{" "}
            Rebate agreement signed
          </span>
        </label>
        <label className="office-detail-field">
          <span>
            <input
              checked={formState.rebateGoogleFormSubmitted}
              disabled={readOnly}
              onChange={(event) => setPrerequisiteField("rebateGoogleFormSubmitted", event.target.checked)}
              type="checkbox"
            />{" "}
            Rebate Google Form submitted
          </span>
        </label>
      </div>

      <HorizontalScrollArea>
        <div className="office-table">
          <div className="office-table-header office-table-row office-table-row-commission">
            <span>Fee</span>
            <span>Calculation</span>
            <span>Rate %</span>
            <span>Amount</span>
            <span>Approval</span>
            <span>Notes</span>
          </div>

          {formState.fees.map((fee, index) => (
            <div className="office-table-row office-table-row-commission" key={fee.id}>
              <div className="office-table-primary">
                <strong>{fee.feeTypeLabel}</strong>
                <p>{fee.approvalHelperText}</p>
                {fee.prerequisiteHelperText ? <p>{fee.prerequisiteHelperText}</p> : null}
              </div>
              <SelectInput
                disabled={readOnly || fee.feeTypeValue === "reimbursement"}
                onChange={(event) =>
                  updateFee(index, (current) => ({
                    ...current,
                    selectedCalculationTypeValue: event.target.value as FinanceFeeDraft["selectedCalculationTypeValue"],
                    selectedCalculationTypeLabel:
                      event.target.value === "pre_split"
                        ? "Pre-Split"
                        : event.target.value === "post_split"
                          ? "Post-Split"
                          : "Reimbursement"
                  }))
                }
                value={fee.selectedCalculationTypeValue}
              >
                <option value="pre_split">Pre-Split</option>
                <option value="post_split">Post-Split</option>
                <option value="reimbursement">Reimbursement</option>
              </SelectInput>
              <input
                disabled={readOnly || fee.feeTypeValue === "reimbursement"}
                onChange={(event) => syncFeeNumbers(index, "rate", event.target.value)}
                type="text"
                value={fee.rate}
              />
              <input disabled={readOnly} onChange={(event) => syncFeeNumbers(index, "amount", event.target.value)} type="text" value={fee.amount} />
              <SelectInput
                disabled={readOnly || !fee.approvalRequired}
                onChange={(event) =>
                  updateFee(index, (current) => ({
                    ...current,
                    approvalStatusValue: event.target.value as FinanceFeeDraft["approvalStatusValue"],
                    approvalStatus:
                      event.target.value === "approved"
                        ? "Approved"
                        : event.target.value === "pending"
                          ? "Pending approval"
                          : "Not required"
                  }))
                }
                value={fee.approvalRequired ? fee.approvalStatusValue : "not_required"}
              >
                <option value="not_required">Not required</option>
                <option value="pending">Pending approval</option>
                <option value="approved">Approved</option>
              </SelectInput>
              <textarea
                disabled={readOnly}
                onChange={(event) =>
                  updateFee(index, (current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                rows={2}
                value={fee.notes}
              />
            </div>
          ))}
        </div>
      </HorizontalScrollArea>

      <label className="office-detail-field office-detail-field-wide">
        <span>Finance notes</span>
        <textarea disabled={readOnly} onChange={(event) => setTopLevelField("financeNotes", event.target.value)} rows={3} value={formState.financeNotes} />
      </label>

      {approvalBlockers.length > 0 ? (
        <div className="office-section-card">
          <div className="office-section-body">
            <strong>Calculation blockers</strong>
            <ul>
              {approvalBlockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {readOnly ? <p className="office-form-helper">Financial details are read-only for your current access level.</p> : null}
      {!readOnly ? (
        <div className="office-form-actions">
          <Button disabled={isSaving} onClick={handleSaveFinance} type="button">
            {isSaving ? (willAutoCalculate ? "Saving & recalculating..." : "Saving...") : willAutoCalculate ? "Save finance & recalculate" : "Save finance"}
          </Button>
          {canAutoCalculateCommission ? (
            <p className="office-form-helper">Saving finance data will also run the current commission rule engine when gross commission is set.</p>
          ) : null}
          {error ? <p className="bm-transaction-submit-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
