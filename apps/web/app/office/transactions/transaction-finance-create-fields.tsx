"use client";

import { useState } from "react";
import type { OfficeCreateTransactionCommissionPreview } from "@acre/db";
import { Button, FormField, TextareaInput } from "@acre/ui";
import {
  createEmptyTransactionFinanceCalculatorValues,
  deriveTransactionFinanceCalculatorAmount,
  deriveTransactionFinanceCalculatorRate,
  isConfiguredTransactionFinanceCalculatorAmount,
  transactionFinanceCalculatorFieldDefinitions as calculatorFieldDefinitions,
  type TransactionFinanceCalculatorFieldKey
} from "./transaction-finance-calculator-config";
import { translateCommissionCopy } from "../_utils/commission-copy";

export type TransactionFinanceCreateDraft = {
  grossCommission: string;
  financeNotes: string;
  calculatorFields: Record<TransactionFinanceCalculatorFieldKey, string>;
  calculatorRates: Record<TransactionFinanceCalculatorFieldKey, string>;
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
    calculatorFields: createEmptyTransactionFinanceCalculatorValues(),
    calculatorRates: createEmptyTransactionFinanceCalculatorValues()
  };
}

function hasConfiguredCalculatorEntry(amountValue: string, rateValue: string) {
  return isConfiguredTransactionFinanceCalculatorAmount(amountValue) || isConfiguredTransactionFinanceCalculatorAmount(rateValue);
}

export function buildStructuredFinancePayloadFromDraft(draft: TransactionFinanceCreateDraft) {
  const companyReferralAmount = draft.calculatorFields.companyReferral;
  const companyReferralRate = draft.calculatorRates.companyReferral;

  return {
    grossCommission: draft.grossCommission,
    financeNotes: draft.financeNotes,
    companyReferral: hasConfiguredCalculatorEntry(companyReferralAmount, companyReferralRate) ? "Yes" : "No",
    companyReferralEmployeeName: "",
    fees: calculatorFieldDefinitions
      .filter((field) => hasConfiguredCalculatorEntry(draft.calculatorFields[field.fieldKey], draft.calculatorRates[field.fieldKey]))
      .map((field) => ({
        feeType: field.feeTypeValue,
        rate: draft.calculatorRates[field.fieldKey],
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

  function setCalculatorAmountField(field: TransactionFinanceCalculatorFieldKey, value: string) {
    updateDraft({
      ...draft,
      calculatorFields: {
        ...draft.calculatorFields,
        [field]: value
      },
      calculatorRates: {
        ...draft.calculatorRates,
        [field]: deriveTransactionFinanceCalculatorRate(draft.grossCommission, value)
      }
    });
  }

  function setCalculatorRateField(field: TransactionFinanceCalculatorFieldKey, value: string) {
    updateDraft({
      ...draft,
      calculatorFields: {
        ...draft.calculatorFields,
        [field]: deriveTransactionFinanceCalculatorAmount(draft.grossCommission, value)
      },
      calculatorRates: {
        ...draft.calculatorRates,
        [field]: value
      }
    });
  }

  async function handleCalculate() {
    setPreview(null);

    if (!draft.grossCommission.trim()) {
      setPreviewError("请先填写总佣金再计算。");
      return;
    }

    if (!ownerMembershipId?.trim()) {
      setPreviewError("请先选择负责人经纪人再计算佣金。");
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
        throw new Error(body?.error ?? "无法预览佣金。");
      }

      setPreview(body.preview);
    } catch (error) {
      setPreviewError(translateCommissionCopy(error instanceof Error ? error.message : "无法预览佣金。", true));
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <section className="office-transaction-finance-panel office-transaction-intake-finance-panel">
      <div className="office-transaction-finance-calculator-shell">
        <div className="office-transaction-finance-panel-head office-transaction-finance-calculator-intro">
          <div>
            <h4>佣金计算器</h4>
            <p>按金额或比例录入每项扣减，预览经纪人最终净额，并保留一条统一备注。</p>
          </div>
        </div>

        <div className="office-transaction-finance-calculator-grid">
          <label className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-gross-field">
            <span>总佣金</span>
            <input
              disabled={readOnly}
              inputMode="decimal"
              onChange={(event) => setTextField("grossCommission", event.target.value)}
              placeholder="必填"
              type="text"
              value={draft.grossCommission}
            />
          </label>

          {calculatorFieldDefinitions.map((field) => (
            <div
              className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-fee-field"
              key={field.fieldKey}
            >
              <span>{field.feeTypeLabel}</span>
              <div className="office-transaction-finance-calculator-pair">
                <label className="office-form-field office-transaction-finance-calculator-mini-field">
                  <span>金额</span>
                  <input
                    disabled={readOnly}
                    inputMode="decimal"
                    onChange={(event) => setCalculatorAmountField(field.fieldKey, event.target.value)}
                    placeholder="0"
                    type="text"
                    value={draft.calculatorFields[field.fieldKey]}
                  />
                </label>
                <label className="office-form-field office-transaction-finance-calculator-mini-field">
                  <span>比例 %</span>
                  <input
                    disabled={readOnly}
                    inputMode="decimal"
                    onChange={(event) => setCalculatorRateField(field.fieldKey, event.target.value)}
                    placeholder="0"
                    type="text"
                    value={draft.calculatorRates[field.fieldKey]}
                  />
                </label>
              </div>
            </div>
          ))}

          <div className="office-transaction-finance-calculator-action">
            <Button disabled={readOnly || isCalculating} onClick={handleCalculate} type="button">
              {isCalculating ? "计算中..." : "计算"}
            </Button>
          </div>
        </div>

        <div className="office-transaction-finance-calculator-footer">
          <div className="office-inline-callout">
            <strong>计算说明</strong>
            <p>
              每项费用可填写金额或比例；填写总佣金后，另一项会自动换算。
            </p>
          </div>

          <div className={`office-kpi-card office-transaction-finance-calculator-result${preview ? " office-kpi-card-accent is-active" : ""}`}>
            <span>经纪人最终净额</span>
            <strong>{preview?.finalAgentNetLabel ?? "—"}</strong>
            <p>
              {preview
                ? `总佣金 ${preview.grossCommissionLabel} · 拆分前 ${preview.preSplitTotalLabel} · 拆分后 ${preview.postSplitTotalLabel}`
                : "点击计算，可按现有费用和拆分规则预览当前佣金结果。"}
            </p>
          </div>
        </div>
      </div>

      {previewError ? <p className="office-form-error">{previewError}</p> : null}
      {preview?.blockingIssues.length ? (
        <ul className="office-transaction-finance-blocker-list">
          {preview.blockingIssues.map((issue) => (
            <li key={issue}>{translateCommissionCopy(issue, true)}</li>
          ))}
        </ul>
      ) : null}

      <FormField className="office-detail-field office-detail-field-wide office-transaction-finance-note-field" label="备注">
        <TextareaInput
          className="office-transaction-finance-note-textarea"
          disabled={readOnly}
          onChange={(event) => setTextField("financeNotes", event.target.value)}
          rows={4}
          value={draft.financeNotes}
        />
      </FormField>
    </section>
  );
}
