"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  OfficeTransactionCommissionSnapshot,
  OfficeTransactionFinanceFeeRecord,
  OfficeTransactionFinancePrerequisiteSnapshot
} from "@acre/db";
import { Button, FormField, StatCard, TextareaInput } from "@acre/ui";
import { useI18n } from "../../../../lib/i18n/client";
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        throw new Error(body?.error ?? (isZh ? "无法更新财务信息。" : "Failed to update finance."));
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
          throw new Error(body?.error ?? (isZh ? "自动重新计算佣金失败。" : "Automatic commission recalculation failed."));
        }
      }

      router.refresh();
    } catch (saveError) {
      const fallbackMessage =
        financeSaved && shouldAutoCalculate
          ? isZh ? "财务信息已保存，但自动重新计算佣金失败。" : "Finance saved, but automatic commission recalculation failed."
          : isZh ? "无法更新财务信息。" : "Failed to update finance.";
      const detailMessage = saveError instanceof Error ? saveError.message : fallbackMessage;

      setError(financeSaved && shouldAutoCalculate ? (isZh ? `财务信息已保存。${translateCommissionCopy(detailMessage, isZh)}` : `Finance saved. ${detailMessage}`) : translateCommissionCopy(detailMessage, isZh));
    } finally {
      setIsSaving(false);
    }
  }

  const willAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;
  const actionLabel = isSaving
    ? willAutoCalculate
      ? isZh ? "计算中..." : "Calculating..."
      : isZh ? "保存中..." : "Saving..."
    : willAutoCalculate
      ? isZh ? "计算" : "Calculate"
      : isZh ? "保存财务" : "Save finance";
  const prerequisiteCards = [
    {
      checked: formState.clientReferralFormApproved,
      description: isZh ? "内部推荐纳入佣金计算前，必须先签署并批准推荐表。" : "Must be signed and approved before Internal Referral can be included in the commission run.",
      field: "clientReferralFormApproved" as const,
      title: isZh ? "内部推荐表已批准" : "Internal referral form approved"
    },
    {
      checked: formState.rebateAgreementSigned,
      description: isZh ? "任何返佣费用计入最终佣金前，都需要先完成协议签署。" : "Required before any rebate fee is counted in final commission calculation.",
      field: "rebateAgreementSigned" as const,
      title: isZh ? "返佣协议已签署" : "Rebate agreement signed"
    },
    {
      checked: formState.rebateGoogleFormSubmitted,
      description: isZh ? "财务需要确认 Google Form 已提交，返佣才能正式计算。" : "Finance must confirm the Google Form submission before rebate can be formally calculated.",
      field: "rebateGoogleFormSubmitted" as const,
      title: isZh ? "返佣 Google Form 已提交" : "Rebate Google Form submitted"
    }
  ];

  return (
    <div className="office-transaction-finance-form">
      <div className="office-kpi-grid office-commission-kpi-grid office-transaction-finance-kpis">
        <StatCard hint={isZh ? "当前财务输入" : "current finance input"} label={isZh ? "总佣金" : "Gross commission"} value={summary?.grossCommissionLabel ?? "$0"} />
        <StatCard hint={isZh ? "全部拆分前费用" : "sum of all pre-split fees"} label={isZh ? "拆分前合计" : "Pre-Split total"} value={summary?.preSplitTotalLabel ?? "$0"} />
        <StatCard hint={isZh ? "全部拆分后费用" : "sum of all post-split fees"} label={isZh ? "拆分后合计" : "Post-Split total"} value={summary?.postSplitTotalLabel ?? "$0"} />
        <StatCard hint={isZh ? "总佣金减去拆分前费用" : "gross minus pre-split fees"} label={isZh ? "净佣金基数" : "Net commission base"} value={summary?.netCommissionBaseLabel ?? "$0"} />
        <StatCard hint={isZh ? "负责人经纪人当前最终付款" : "current final payout for the owner agent"} label={isZh ? "经纪人最终净额" : "Final agent net"} value={summary?.agentNetLabel ?? "$0"} />
        <StatCard hint={isZh ? "公司当前付款" : "current company payout"} label={isZh ? "公司最终净额" : "Final office net"} value={summary?.officeNetLabel ?? "$0"} />
        <StatCard hint={isZh ? "最近保存的佣金版本" : "latest saved commission version"} label={isZh ? "当前版本" : "Current version"} value={summary?.currentVersionLabel ? translateCommissionCopy(summary.currentVersionLabel, isZh) : isZh ? "尚未计算" : "Not calculated"} />
      </div>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-calculator-shell">
          <div className="office-transaction-finance-panel-head office-transaction-finance-calculator-intro">
            <div>
              <h4>{isZh ? "佣金计算器" : "Commission calculator"}</h4>
              <p>{isZh ? "沿用创建交易时的计算流程，每项费用都可以按金额或比例录入。" : "Use the same calculator flow as create transaction, including amount or rate inputs for each fee."}</p>
            </div>
          </div>

          <div className="office-transaction-finance-calculator-grid">
            <label className="office-detail-field office-transaction-finance-calculator-card office-transaction-finance-calculator-gross-field">
              <span>{isZh ? "总佣金" : "Gross Commission"}</span>
              <input
                disabled={readOnly}
                inputMode="decimal"
                onChange={(event) => setTopLevelField("grossCommission", event.target.value)}
                placeholder={isZh ? "必填" : "Required"}
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
                  <span>{translateCommissionCopy(field.feeTypeLabel, isZh)}</span>
                  <div className="office-transaction-finance-calculator-pair">
                    <label className="office-form-field office-transaction-finance-calculator-mini-field">
                      <span>{isZh ? "金额" : "Amount"}</span>
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
                      <span>{isZh ? "比例 %" : "Rate %"}</span>
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
              <strong>{isZh ? "计算说明" : "Calculator note"}</strong>
              <p>
                {isZh
                  ? "每项费用可填写金额或比例；填写总佣金后，另一项会自动换算。"
                  : "For each fee, you can enter either an amount or a rate. When gross commission is filled in, the paired value auto-fills."}
              </p>
            </div>

            <div className="office-kpi-card office-kpi-card-accent office-transaction-finance-calculator-result is-active">
              <span>{isZh ? "经纪人最终净额" : "Final Agent Net"}</span>
              <strong>{summary?.agentNetLabel ?? "$0"}</strong>
              <p>
                {summary
                  ? isZh
                    ? `总佣金 ${summary.grossCommissionLabel} · 拆分前 ${summary.preSplitTotalLabel} · 拆分后 ${summary.postSplitTotalLabel}`
                    : `Gross ${summary.grossCommissionLabel} · Pre-Split ${summary.preSplitTotalLabel} · Post-Split ${summary.postSplitTotalLabel}`
                  : isZh
                    ? "保存或计算后，会刷新当前佣金结果。"
                    : "Save or calculate to refresh the current commission output."}
              </p>
            </div>
          </div>
        </div>

        {summary?.reimbursementLabel && summary.reimbursementLabel !== "$0" ? (
          <p className="office-form-helper">{isZh ? "当前报销调整：" : "Current reimbursement adjustment: "}{summary.reimbursementLabel}</p>
        ) : null}

        <FormField className="office-detail-field office-detail-field-wide office-transaction-finance-note-field" label={isZh ? "备注" : "Note"}>
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
            {isZh
              ? "计算会先保存财务改动，再按此交易当前佣金规则重新计算。"
              : "Calculate will save finance changes first, then rerun the current commission rules for this transaction."}
          </p>
        ) : null}
        {readOnly ? (
          <p className="office-inline-note">{isZh ? "按你当前的访问权限，财务详情为只读。" : "Financial details are read-only for your current access level."}</p>
        ) : null}
        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <section className="office-transaction-finance-panel">
        <div className="office-transaction-finance-panel-head">
          <div>
            <h4>{isZh ? "前置条件" : "Prerequisites"}</h4>
            <p>{isZh ? "财务最终确认佣金前，内部推荐和返佣仍需通过这些检查。" : "These checks still gate Internal Referral and Rebate before finance can finalize the commission."}</p>
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
              <h4>{isZh ? "计算阻塞项" : "Calculation blockers"}</h4>
              <p>{isZh ? "这些问题需要先解决，财务才能最终确认佣金计算。" : "These issues must be resolved before finance can finalize the commission run."}</p>
            </div>
          </div>

          <ul className="office-transaction-finance-blocker-list">
            {approvalBlockers.map((blocker) => (
              <li key={blocker}>{translateCommissionCopy(blocker, isZh)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
