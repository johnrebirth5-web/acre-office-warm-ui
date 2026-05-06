"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  OfficeTransactionCommissionSnapshot,
  OfficeTransactionFinanceFeeRecord,
  OfficeTransactionFinancePrerequisiteSnapshot
} from "@acre/db";
import { Button, FormField, StatCard, TextareaInput } from "@acre/ui";
import {
  deriveTransactionFinanceCalculatorAmount,
  deriveTransactionFinanceCalculatorRate,
  parseTransactionFinanceCalculatorNumber,
  transactionFinanceCalculatorFieldDefinitions,
  type TransactionFinanceCalculatorFieldKey
} from "../transaction-finance-calculator-config";
import { translateCommissionCopy } from "../../_utils/commission-copy";

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
        throw new Error(body?.error ?? "无法更新财务信息。");
      }

      financeSaved = true;

      if (shouldAutoCalculate) {
        const calculateResponse = await fetch(`/api/office/transactions/${transactionId}/commissions/calculate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });

        if (!calculateResponse.ok) {
          const body = (await calculateResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "自动重新计算佣金失败。");
        }
      }

      router.refresh();
    } catch (saveError) {
      const fallbackMessage =
        financeSaved && shouldAutoCalculate
          ? "财务信息已保存，但自动重新计算佣金失败。"
          : "无法更新财务信息。";
      const detailMessage = saveError instanceof Error ? saveError.message : fallbackMessage;

      setError(financeSaved && shouldAutoCalculate ? `财务信息已保存。${translateCommissionCopy(detailMessage, true)}` : translateCommissionCopy(detailMessage, true));
    } finally {
      setIsSaving(false);
    }
  }

  const willAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;
  const actionLabel = isSaving
    ? willAutoCalculate
      ? "计算中..."
      : "保存中..."
    : willAutoCalculate
      ? "计算"
      : "保存财务";
  const prerequisiteCards = [
    {
      checked: formState.clientReferralFormApproved,
      description: "内部推荐纳入佣金计算前，必须先签署并批准推荐表。",
      field: "clientReferralFormApproved" as const,
      title: "内部推荐表已批准"
    },
    {
      checked: formState.rebateAgreementSigned,
      description: "任何返佣费用计入最终佣金前，都需要先完成协议签署。",
      field: "rebateAgreementSigned" as const,
      title: "返佣协议已签署"
    },
    {
      checked: formState.rebateGoogleFormSubmitted,
      description: "财务需要确认 Google Form 已提交，返佣才能正式计算。",
      field: "rebateGoogleFormSubmitted" as const,
      title: "返佣 Google Form 已提交"
    }
  ];

  return (
    <div className="office-transaction-finance-form">
      <div className="office-kpi-grid office-commission-kpi-grid office-transaction-finance-kpis">
        <StatCard hint="当前财务输入" label="总佣金" value={summary?.grossCommissionLabel ?? "$0"} />
        <StatCard hint="全部拆分前费用" label="拆分前合计" value={summary?.preSplitTotalLabel ?? "$0"} />
        <StatCard hint="全部拆分后费用" label="拆分后合计" value={summary?.postSplitTotalLabel ?? "$0"} />
        <StatCard hint="总佣金减去拆分前费用" label="净佣金基数" value={summary?.netCommissionBaseLabel ?? "$0"} />
        <StatCard hint="负责人经纪人当前最终付款" label="经纪人最终净额" value={summary?.agentNetLabel ?? "$0"} />
        <StatCard hint="公司当前付款" label="公司最终净额" value={summary?.officeNetLabel ?? "$0"} />
        <StatCard hint="最近保存的佣金版本" label="当前版本" value={summary?.currentVersionLabel ? translateCommissionCopy(summary.currentVersionLabel, true) : "尚未计算"} />
      </div>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-calculator-shell">
          <div className="office-transaction-finance-panel-head office-transaction-finance-calculator-intro">
            <div>
              <h4>佣金计算器</h4>
              <p>沿用创建交易时的计算流程，每项费用都可以按金额或比例录入。</p>
            </div>
          </div>

          <div className="office-transaction-finance-calculator-grid">
            <label className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-gross-field">
              <span>总佣金</span>
              <input
                disabled={readOnly}
                inputMode="decimal"
                onChange={(event) => setTopLevelField("grossCommission", event.target.value)}
                placeholder="必填"
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
                      <span>金额</span>
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
                      <span>比例 %</span>
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
            <div className="office-inline-callout">
              <strong>计算说明</strong>
              <p>
                每项费用可填写金额或比例；填写总佣金后，另一项会自动换算。
              </p>
            </div>

            <div className="office-kpi-card office-kpi-card-accent office-transaction-finance-calculator-result is-active">
              <span>经纪人最终净额</span>
              <strong>{summary?.agentNetLabel ?? "$0"}</strong>
              <p>
                {summary
                  ? `总佣金 ${summary.grossCommissionLabel} · 拆分前 ${summary.preSplitTotalLabel} · 拆分后 ${summary.postSplitTotalLabel}`
                  : "保存或计算后，会刷新当前佣金结果。"}
              </p>
            </div>
          </div>
        </div>

        {summary?.reimbursementLabel && summary.reimbursementLabel !== "$0" ? (
          <p className="office-form-helper">当前报销调整：{summary.reimbursementLabel}</p>
        ) : null}

        <FormField className="office-detail-field office-detail-field-wide office-transaction-finance-note-field" label="备注">
          <TextareaInput
            className="office-transaction-finance-note-textarea"
            disabled={readOnly}
            onChange={(event) => setTopLevelField("financeNotes", event.target.value)}
            rows={4}
            value={formState.financeNotes}
          />
        </FormField>

        {!readOnly && canAutoCalculateCommission ? (
          <p className="office-inline-note">
            计算会先保存财务改动，再按此交易当前佣金规则重新计算。
          </p>
        ) : null}
        {readOnly ? (
          <p className="office-inline-note">按你当前的访问权限，财务详情为只读。</p>
        ) : null}
        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-panel-head">
          <div>
            <h4>前置条件</h4>
            <p>财务最终确认佣金前，内部推荐和返佣仍需通过这些检查。</p>
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
              <h4>计算阻塞项</h4>
              <p>这些问题需要先解决，财务才能最终确认佣金计算。</p>
            </div>
          </div>

          <ul className="office-transaction-finance-blocker-list">
            {approvalBlockers.map((blocker) => (
              <li key={blocker}>{translateCommissionCopy(blocker, true)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
