"use client";

import { SelectInput } from "@acre/ui";

type TransactionFinanceFeeTypeValue =
  | "rebate"
  | "client_referral"
  | "external_referral"
  | "company_referral"
  | "channel_development_fee"
  | "reimbursement";

type TransactionFinanceCalculationTypeValue = "pre_split" | "post_split" | "reimbursement";

export type TransactionFinanceCreateFeeDraft = {
  feeTypeValue: TransactionFinanceFeeTypeValue;
  feeTypeLabel: string;
  rate: string;
  amount: string;
  selectedCalculationTypeValue: TransactionFinanceCalculationTypeValue;
  notes: string;
  approvalHelperText: string;
  prerequisiteHelperText: string;
};

export type TransactionFinanceCreateDraft = {
  grossCommission: string;
  financeNotes: string;
  companyReferral: "Yes" | "No";
  companyReferralEmployeeName: string;
  fees: TransactionFinanceCreateFeeDraft[];
};

type TransactionFinanceCreateFieldsProps = {
  draft: TransactionFinanceCreateDraft;
  readOnly?: boolean;
  onChange: (nextDraft: TransactionFinanceCreateDraft) => void;
};

const defaultFinanceFeeDrafts: TransactionFinanceCreateFeeDraft[] = [
  {
    feeTypeValue: "rebate",
    feeTypeLabel: "Rebate",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "pre_split",
    notes: "",
    approvalHelperText: "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.",
    prerequisiteHelperText: "Requires signed rebate agreement and submitted rebate Google Form."
  },
  {
    feeTypeValue: "client_referral",
    feeTypeLabel: "Client Referral",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "pre_split",
    notes: "",
    approvalHelperText: "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.",
    prerequisiteHelperText: "Requires signed and approved Agent Referral Form."
  },
  {
    feeTypeValue: "external_referral",
    feeTypeLabel: "External Referral",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "post_split",
    notes: "",
    approvalHelperText: "No automatic approval threshold.",
    prerequisiteHelperText: ""
  },
  {
    feeTypeValue: "company_referral",
    feeTypeLabel: "Company Referral",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "post_split",
    notes: "",
    approvalHelperText: "No automatic approval threshold.",
    prerequisiteHelperText: ""
  },
  {
    feeTypeValue: "channel_development_fee",
    feeTypeLabel: "Channel Development Fee",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "post_split",
    notes: "",
    approvalHelperText: "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.",
    prerequisiteHelperText: ""
  },
  {
    feeTypeValue: "reimbursement",
    feeTypeLabel: "Reimbursement",
    rate: "",
    amount: "",
    selectedCalculationTypeValue: "reimbursement",
    notes: "",
    approvalHelperText: "Calculated separately from split math.",
    prerequisiteHelperText: "Company reimburses up to 50% of the amount, capped at 10% of final agent net."
  }
];

function cloneFeeDraft(fee: TransactionFinanceCreateFeeDraft): TransactionFinanceCreateFeeDraft {
  return { ...fee };
}

function clearFeeFinancialValues(fee: TransactionFinanceCreateFeeDraft): TransactionFinanceCreateFeeDraft {
  return {
    ...fee,
    rate: "",
    amount: "",
    notes: ""
  };
}

function hasConfiguredFinanceFeeValue(fee: TransactionFinanceCreateFeeDraft) {
  return [fee.rate, fee.amount, fee.notes].some((value) => value.trim().length > 0);
}

function shouldPersistFinanceFee(
  draft: TransactionFinanceCreateDraft,
  fee: TransactionFinanceCreateFeeDraft
) {
  if (fee.feeTypeValue === "company_referral" && draft.companyReferral !== "Yes") {
    return false;
  }

  return hasConfiguredFinanceFeeValue(fee);
}

export function createTransactionFinanceCreateDraft(): TransactionFinanceCreateDraft {
  return {
    grossCommission: "",
    financeNotes: "",
    companyReferral: "No",
    companyReferralEmployeeName: "",
    fees: defaultFinanceFeeDrafts.map((fee) => ({ ...fee }))
  };
}

function parseNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatEditableNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function getCalculationTypeLabel(value: TransactionFinanceCalculationTypeValue) {
  if (value === "pre_split") {
    return "Pre-Split";
  }

  if (value === "post_split") {
    return "Post-Split";
  }

  return "Reimbursement";
}

function findFeeAmount(
  draft: TransactionFinanceCreateDraft,
  feeTypeValue: TransactionFinanceCreateFeeDraft["feeTypeValue"]
) {
  return draft.fees.find((fee) => fee.feeTypeValue === feeTypeValue)?.amount.trim() ?? "";
}

export function buildLegacyFinanceFieldValuesFromDraft(draft: TransactionFinanceCreateDraft) {
  const companyReferralAmount = findFeeAmount(draft, "company_referral");
  const clientReferralAmount = findFeeAmount(draft, "client_referral");
  const externalReferralAmount = findFeeAmount(draft, "external_referral");
  const rebateAmount = findFeeAmount(draft, "rebate");
  const reimbursementAmount = findFeeAmount(draft, "reimbursement");
  const outsideReferralEnabled = (parseNumber(externalReferralAmount) ?? 0) > 0;
  const legacyReferralFee =
    draft.companyReferral === "Yes"
      ? companyReferralAmount || externalReferralAmount || ""
      : clientReferralAmount || externalReferralAmount || "";

  return {
    commissionAmount: draft.grossCommission.trim(),
    referralFee: legacyReferralFee,
    rebate: rebateAmount,
    reimbursement: reimbursementAmount,
    companyReferral: draft.companyReferral,
    companyReferralEmployeeName: draft.companyReferralEmployeeName.trim(),
    outsideReferral: outsideReferralEnabled ? "Yes" : "No",
    note: draft.financeNotes.trim()
  } satisfies Record<string, string>;
}

export function buildStructuredFinancePayloadFromDraft(draft: TransactionFinanceCreateDraft) {
  return {
    grossCommission: draft.grossCommission,
    financeNotes: draft.financeNotes,
    fees: draft.fees
      .filter((fee) => shouldPersistFinanceFee(draft, fee))
      .map((fee) => ({
        feeType: fee.feeTypeValue,
        rate: fee.rate,
        amount: fee.amount,
        selectedCalculationType: fee.selectedCalculationTypeValue,
        notes: fee.notes
      }))
  };
}

export function TransactionFinanceCreateFields({
  draft,
  readOnly = false,
  onChange
}: TransactionFinanceCreateFieldsProps) {
  function setTextField(field: "grossCommission" | "financeNotes" | "companyReferralEmployeeName", value: string) {
    onChange({
      ...draft,
      [field]: value
    });
  }

  function setCompanyReferral(value: TransactionFinanceCreateDraft["companyReferral"]) {
    onChange({
      ...draft,
      companyReferral: value,
      companyReferralEmployeeName: value === "Yes" ? draft.companyReferralEmployeeName : "",
      fees:
        value === "Yes"
          ? draft.fees.map(cloneFeeDraft)
          : draft.fees.map((fee) => (fee.feeTypeValue === "company_referral" ? clearFeeFinancialValues(fee) : cloneFeeDraft(fee)))
    });
  }

  function updateFee(
    index: number,
    updater: (current: TransactionFinanceCreateFeeDraft) => TransactionFinanceCreateFeeDraft
  ) {
    onChange({
      ...draft,
      fees: draft.fees.map((fee, feeIndex) => (feeIndex === index ? updater(fee) : fee))
    });
  }

  function syncFeeNumbers(index: number, field: "rate" | "amount", value: string) {
    const grossValue = parseNumber(draft.grossCommission);

    updateFee(index, (current) => {
      const nextFee: TransactionFinanceCreateFeeDraft = {
        ...current,
        [field]: value
      };

      if (current.feeTypeValue !== "reimbursement" && grossValue && grossValue > 0) {
        if (field === "rate") {
          const numericRate = parseNumber(value);
          nextFee.amount = numericRate === null ? "" : formatEditableNumber((grossValue * numericRate) / 100);
        } else {
          const numericAmount = parseNumber(value);
          nextFee.rate = numericAmount === null ? "" : formatEditableNumber((numericAmount / grossValue) * 100);
        }
      }

      return nextFee;
    });
  }

  return (
    <section className="office-transaction-finance-panel bm-transaction-intake-finance-panel">
      <div className="office-transaction-finance-panel-head">
        <div>
          <h4>Finance intake</h4>
          <p>These values create real transaction finance records instead of staying as disconnected custom text.</p>
        </div>
      </div>

      <div className="office-transaction-finance-fields bm-transaction-intake-finance-fields">
        <label className="office-detail-field">
          <span>Gross commission</span>
          <input
            disabled={readOnly}
            onChange={(event) => setTextField("grossCommission", event.target.value)}
            type="text"
            value={draft.grossCommission}
          />
        </label>

        <label className="office-detail-field">
          <span>Company referral</span>
          <SelectInput
            disabled={readOnly}
            onChange={(event) => setCompanyReferral(event.target.value as TransactionFinanceCreateDraft["companyReferral"])}
            value={draft.companyReferral}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </SelectInput>
        </label>

        <label className="office-detail-field">
          <span>Referral employee</span>
          <input
            disabled={readOnly || draft.companyReferral !== "Yes"}
            onChange={(event) => setTextField("companyReferralEmployeeName", event.target.value)}
            type="text"
            value={draft.companyReferralEmployeeName}
          />
        </label>

        <label className="office-detail-field office-detail-field-wide">
          <span>Finance notes</span>
          <textarea
            disabled={readOnly}
            onChange={(event) => setTextField("financeNotes", event.target.value)}
            rows={4}
            value={draft.financeNotes}
          />
        </label>
      </div>

      <div className="office-transaction-finance-ledger-list">
        {draft.fees.map((fee, index) => (
          <article className="office-transaction-finance-fee-card" key={fee.feeTypeValue}>
            <div className="office-transaction-finance-fee-head">
              <div className="office-transaction-finance-fee-copy">
                <strong>{fee.feeTypeLabel}</strong>
                <p>{fee.approvalHelperText}</p>
                {fee.prerequisiteHelperText ? <p>{fee.prerequisiteHelperText}</p> : null}
              </div>
              <div className="office-transaction-finance-fee-summary">
                <span>{getCalculationTypeLabel(fee.selectedCalculationTypeValue)}</span>
                <span>Linked on create</span>
              </div>
            </div>

            <div className="office-transaction-finance-fee-fields">
              <label className="office-detail-field">
                <span>Calculation</span>
                <SelectInput
                  disabled={readOnly || fee.feeTypeValue === "reimbursement"}
                  onChange={(event) =>
                    updateFee(index, (current) => ({
                      ...current,
                      selectedCalculationTypeValue: event.target.value as TransactionFinanceCalculationTypeValue
                    }))
                  }
                  value={fee.selectedCalculationTypeValue}
                >
                  <option value="pre_split">Pre-Split</option>
                  <option value="post_split">Post-Split</option>
                  <option value="reimbursement">Reimbursement</option>
                </SelectInput>
              </label>

              <label className="office-detail-field">
                <span>Rate %</span>
                <input
                  disabled={readOnly || fee.feeTypeValue === "reimbursement"}
                  onChange={(event) => syncFeeNumbers(index, "rate", event.target.value)}
                  type="text"
                  value={fee.rate}
                />
              </label>

              <label className="office-detail-field">
                <span>Amount</span>
                <input
                  disabled={readOnly}
                  onChange={(event) => syncFeeNumbers(index, "amount", event.target.value)}
                  type="text"
                  value={fee.amount}
                />
              </label>

              <label className="office-detail-field office-transaction-finance-fee-notes">
                <span>Notes</span>
                <textarea
                  disabled={readOnly}
                  onChange={(event) =>
                    updateFee(index, (current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  rows={3}
                  value={fee.notes}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
