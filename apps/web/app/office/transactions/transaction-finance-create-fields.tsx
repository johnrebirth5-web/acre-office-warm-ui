"use client";

import { useState } from "react";
import type { OfficeCreateTransactionCommissionPreview } from "@acre/db";
import { Button } from "@acre/ui";
import {
  createEmptyTransactionFinanceCalculatorValues,
  isConfiguredTransactionFinanceCalculatorAmount,
  transactionFinanceCalculatorFieldDefinitions as calculatorFieldDefinitions,
  type TransactionFinanceCalculatorFieldKey
} from "./transaction-finance-calculator-config";

export type TransactionFinanceCreateDraft = {
  grossCommission: string;
  financeNotes: string;
  calculatorFields: Record<TransactionFinanceCalculatorFieldKey, string>;
};

type TransactionFinanceCreateFieldsProps = {
  draft: TransactionFinanceCreateDraft;
  ownerMembershipId?: string;
  readOnly?: boolean;
  onChange: (nextDraft: TransactionFinanceCreateDraft) => void;
};

export function createTransactionFinanceCreateDraft(): TransactionFinanceCreateDraft {
  return {
    grossCommission: "",
    financeNotes: "",
    calculatorFields: createEmptyTransactionFinanceCalculatorValues()
  };
}

export function buildStructuredFinancePayloadFromDraft(draft: TransactionFinanceCreateDraft) {
  const companyReferralAmount = draft.calculatorFields.companyReferral;

  return {
    grossCommission: draft.grossCommission,
    financeNotes: draft.financeNotes,
    companyReferral: isConfiguredTransactionFinanceCalculatorAmount(companyReferralAmount) ? "Yes" : "No",
    companyReferralEmployeeName: "",
    fees: calculatorFieldDefinitions
      .filter((field) => isConfiguredTransactionFinanceCalculatorAmount(draft.calculatorFields[field.fieldKey]))
      .map((field) => ({
        feeType: field.feeTypeValue,
        rate: "",
        amount: draft.calculatorFields[field.fieldKey],
        selectedCalculationType: field.selectedCalculationTypeValue,
        notes: ""
      }))
  };
}

export function TransactionFinanceCreateFields({
  draft,
  ownerMembershipId,
  readOnly = false,
  onChange
}: TransactionFinanceCreateFieldsProps) {
  const [preview, setPreview] = useState<OfficeCreateTransactionCommissionPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  function updateDraft(nextDraft: TransactionFinanceCreateDraft) {
    setPreview(null);
    setPreviewError("");
    onChange(nextDraft);
  }

  function setTextField(field: "grossCommission" | "financeNotes", value: string) {
    updateDraft({
      ...draft,
      [field]: value
    });
  }

  function setCalculatorField(field: TransactionFinanceCalculatorFieldKey, value: string) {
    updateDraft({
      ...draft,
      calculatorFields: {
        ...draft.calculatorFields,
        [field]: value
      }
    });
  }

  async function handleCalculate() {
    setPreview(null);

    if (!draft.grossCommission.trim()) {
      setPreviewError("Gross Commission is required before calculation.");
      return;
    }

    if (!ownerMembershipId?.trim()) {
      setPreviewError("Select an agent owner before calculating commission.");
      return;
    }

    setPreviewError("");
    setIsCalculating(true);

    try {
      const financePayload = buildStructuredFinancePayloadFromDraft(draft);
      const response = await fetch("/api/office/transactions/commission-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ownerMembershipId,
          grossCommission: financePayload.grossCommission,
          fees: financePayload.fees
        })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            preview?: OfficeCreateTransactionCommissionPreview;
          }
        | null;

      if (!response.ok || !body?.preview) {
        throw new Error(body?.error ?? "Failed to preview commission.");
      }

      setPreview(body.preview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Failed to preview commission.");
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <section className="office-transaction-finance-panel bm-transaction-intake-finance-panel">
      <div className="office-transaction-finance-panel-head">
        <div>
          <h4>Commission calculator</h4>
          <p>Enter the applicable deductions from left to right, calculate the net result, and keep one unified note for context.</p>
        </div>
      </div>

      <div className="office-transaction-finance-calculator-grid">
        <label className="office-detail-field">
          <span>Gross Commission</span>
          <input
            disabled={readOnly}
            inputMode="decimal"
            onChange={(event) => setTextField("grossCommission", event.target.value)}
            placeholder="Required"
            type="text"
            value={draft.grossCommission}
          />
        </label>

        {calculatorFieldDefinitions.map((field) => (
          <label className="office-detail-field" key={field.fieldKey}>
            <span>{field.feeTypeLabel}</span>
            <input
              disabled={readOnly}
              inputMode="decimal"
              onChange={(event) => setCalculatorField(field.fieldKey, event.target.value)}
              placeholder="0"
              type="text"
              value={draft.calculatorFields[field.fieldKey]}
            />
          </label>
        ))}

        <div className="office-transaction-finance-calculator-action">
          <Button disabled={readOnly || isCalculating} onClick={handleCalculate} type="button">
            {isCalculating ? "Calculating..." : "Calculate"}
          </Button>
        </div>
      </div>

      <div className={`office-transaction-finance-calculator-result${preview ? " is-active" : ""}`}>
        <span>Net Commission</span>
        <strong>{preview?.finalAgentNetLabel ?? "—"}</strong>
        <p>
          {preview
            ? `Gross ${preview.grossCommissionLabel} · Pre-Split ${preview.preSplitTotalLabel} · Post-Split ${preview.postSplitTotalLabel}`
            : "Click Calculate to preview the current commission result using the existing fee and split rules."}
        </p>
      </div>

      {previewError ? <p className="office-form-error">{previewError}</p> : null}
      {preview?.blockingIssues.length ? (
        <ul className="office-transaction-finance-blocker-list">
          {preview.blockingIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <label className="office-detail-field office-detail-field-wide">
        <span>Note</span>
        <textarea
          disabled={readOnly}
          onChange={(event) => setTextField("financeNotes", event.target.value)}
          rows={4}
          value={draft.financeNotes}
        />
      </label>
    </section>
  );
}
