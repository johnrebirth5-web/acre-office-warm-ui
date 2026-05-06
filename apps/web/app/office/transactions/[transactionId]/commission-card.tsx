"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { OfficeTransactionCommissionSnapshot } from "@acre/db";
import { Button, HorizontalScrollArea, SectionCard, SelectInput, StatCard, StatusBadge, TextInput } from "@acre/ui";
import { useI18n } from "../../../../lib/i18n/client";
import {
  commissionStatusOptionLabel,
  commissionStatusUpdateOptions,
  getCommissionErrorMessage,
  translateCommissionCopy
} from "../../_utils/commission-copy";

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

type CommissionBreakdownDisplayRow = {
  key: string;
  recipientLabel: string;
  recipientRole: string;
  helperText: string | null;
  sharePercentLabel: string;
  baseAmountLabel: string;
  postSplitAdjustmentLabel: string;
  reimbursementAdjustmentLabel: string;
  finalAmountLabel: string;
};

type ValidationErrorPayload = {
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
};

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

function formatDisplayPercent(value: number) {
  return `${formatNumericString(value, 2)}%`;
}

function formatNumericString(value: number, digits = 4) {
  const rounded = Number(value.toFixed(digits));

  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(digits).replace(/\.?0+$/, "");
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  return Number(trimmed);
}

function omitFieldError(fieldErrors: Record<string, string>, fieldKey: string) {
  if (!fieldErrors[fieldKey]) {
    return fieldErrors;
  }

  const nextFieldErrors = {
    ...fieldErrors
  };

  delete nextFieldErrors[fieldKey];
  return nextFieldErrors;
}

function omitRowFieldErrors(fieldErrors: Record<string, string>, rowIndex: number) {
  const rowPrefix = `stakeholderRows[${rowIndex}].`;
  let changed = false;
  const nextFieldErrors: Record<string, string> = {};

  for (const [fieldKey, message] of Object.entries(fieldErrors)) {
    if (fieldKey.startsWith(rowPrefix)) {
      changed = true;
      continue;
    }

    nextFieldErrors[fieldKey] = message;
  }

  return changed ? nextFieldErrors : fieldErrors;
}

function getOverrideFieldLabel(fieldKey: string, overrideRows: OverrideDraftRow[], isZh: boolean) {
  if (fieldKey === "body") {
    return isZh ? "手动调整表单" : "the override form";
  }

  if (fieldKey === "overrideReason") {
    return isZh ? "调整原因" : "the override reason";
  }

  const rowMatch = /^stakeholderRows\[(\d+)\]\.(.+)$/.exec(fieldKey);

  if (!rowMatch) {
    return isZh ? "手动调整表单" : "the override form";
  }

  const rowIndex = Number(rowMatch[1]);
  const rowField = rowMatch[2];
  const rowLabel = overrideRows[rowIndex]?.recipientLabel ?? `stakeholder row ${rowIndex + 1}`;

  if (rowField === "amount") {
    return isZh ? `${rowLabel} 金额` : `${rowLabel} amount`;
  }

  if (rowField === "membershipId") {
    return isZh ? `${rowLabel} 参与方` : `${rowLabel} participant`;
  }

  if (rowField === "key") {
    return isZh ? `${rowLabel} 行` : `${rowLabel} row`;
  }

  return rowLabel;
}

function buildOverrideFieldErrorSummary(fieldErrors: Record<string, string>, overrideRows: OverrideDraftRow[], isZh: boolean) {
  const labels = Array.from(new Set(Object.keys(fieldErrors).map((fieldKey) => getOverrideFieldLabel(fieldKey, overrideRows, isZh))));

  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return isZh ? `请检查${labels[0]}后重试。` : `Review ${labels[0]} and try again.`;
  }

  return isZh ? `请检查这些调整字段后重试：${labels.join("、")}。` : `Review these override fields and try again: ${labels.join(", ")}.`;
}

function getOverrideRowErrorMessages(fieldErrors: Record<string, string>, rowIndex: number) {
  const rowPrefix = `stakeholderRows[${rowIndex}].`;

  return Object.entries(fieldErrors)
    .filter(([fieldKey]) => fieldKey.startsWith(rowPrefix))
    .map(([, message]) => message);
}

function buildCommissionBreakdownRows(snapshot: OfficeTransactionCommissionSnapshot): CommissionBreakdownDisplayRow[] {
  const postSplitFeeRows = snapshot.feeBreakdown
    .filter((row) => row.selectedCalculationTypeValue === "post_split")
    .map((row) => ({
      key: `fee:${row.id}`,
      recipientLabel: row.feeTypeLabel,
      recipientRole: "Referral",
      helperText: `Post-Split fee${row.approvalStatus ? ` · ${row.approvalStatus}` : ""}`,
      baseAmount: 0,
      postSplitAdjustment: parseOptionalNumber(row.amount) ?? 0,
      reimbursementAdjustment: 0,
      finalAmount: parseOptionalNumber(row.amount) ?? 0,
      isFeeRow: true
    }));
  const postSplitFeeTotal = postSplitFeeRows.reduce((sum, row) => sum + row.finalAmount, 0);
  const stakeholderRows = snapshot.stakeholderBreakdown.map((row) => {
    const isCompany = row.key === "company";
    const adjustedPostSplit = (parseOptionalNumber(row.postSplitAdjustment) ?? 0) - (isCompany ? postSplitFeeTotal : 0);
    const adjustedFinal = (parseOptionalNumber(row.finalAmount) ?? 0) - (isCompany ? postSplitFeeTotal : 0);
    const baseAmount = parseOptionalNumber(row.baseAmount) ?? 0;
    const reimbursementAdjustment = parseOptionalNumber(row.reimbursementAdjustment) ?? 0;

    return {
      key: row.key,
      recipientLabel: row.recipientLabel,
      recipientRole: row.recipientRole,
      helperText: row.isManualParticipant ? "Manual override participant" : null,
      baseAmount,
      postSplitAdjustment: adjustedPostSplit,
      reimbursementAdjustment,
      finalAmount: adjustedFinal,
      isManualParticipant: row.isManualParticipant,
      isFeeRow: false
    };
  });
  const allRows = [...stakeholderRows, ...postSplitFeeRows];
  const shareBase = allRows.reduce((sum, row) => sum + row.finalAmount, 0);

  return allRows.map((row) => {
    const sharePercent = shareBase > 0 ? (row.finalAmount / shareBase) * 100 : 0;
    const isManualParticipant = "isManualParticipant" in row ? row.isManualParticipant : false;

    return {
      key: row.key,
      recipientLabel: row.recipientLabel,
      recipientRole: row.recipientRole,
      helperText: row.helperText,
      sharePercentLabel: formatDisplayPercent(sharePercent),
      baseAmountLabel: row.isFeeRow || (isManualParticipant && row.recipientRole !== "Referral") ? "—" : formatCurrency(row.baseAmount),
      postSplitAdjustmentLabel: isManualParticipant && row.recipientRole !== "Referral" ? "—" : formatCurrency(row.postSplitAdjustment),
      reimbursementAdjustmentLabel:
        row.isFeeRow || (isManualParticipant && row.recipientRole !== "Referral") ? "—" : formatCurrency(row.reimbursementAdjustment),
      finalAmountLabel: formatCurrency(row.finalAmount)
    };
  });
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
  const [overrideError, setOverrideError] = useState("");
  const [overrideFieldErrors, setOverrideFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setStatusDrafts(Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue])));
    setOverrideRows(buildOverrideRows(snapshot));
    setSelectedParticipantId("");
    setParticipantSearchValue("");
    setIsParticipantPickerOpen(false);
    setHighlightedParticipantIndex(0);
    setOverrideError("");
    setOverrideFieldErrors({});
  }, [snapshot]);

  const availableManualParticipantOptions = snapshot.manualParticipantOptions.filter(
    (option) => !overrideRows.some((row) => row.membershipId === option.membershipId)
  );
  const normalizedParticipantSearch = participantSearchValue.trim().toLowerCase();
  const filteredManualParticipantOptions =
    normalizedParticipantSearch.length > 0
      ? availableManualParticipantOptions.filter((option) => option.label.toLowerCase().includes(normalizedParticipantSearch))
      : [];
  const commissionBreakdownRows = buildCommissionBreakdownRows(snapshot);
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
    ? isZh
      ? "每个调整金额都必须是大于或等于 0 的有效数字。"
      : "Each override amount must be a valid number that is zero or greater."
    : totalDifference > 0.005
      ? isZh
        ? `调整合计比当前付款池多 ${formatCurrency(Math.abs(totalDifference))}。请先减少一个或多个金额，再应用调整。`
        : `Override total exceeds the current payout pool by ${formatCurrency(Math.abs(totalDifference))}. Reduce one or more amounts before applying override.`
      : totalDifference < -0.005
        ? isZh
          ? `调整合计比当前付款池少 ${formatCurrency(Math.abs(totalDifference))}。请先增加一个或多个金额，再应用调整。`
          : `Override total is short by ${formatCurrency(Math.abs(totalDifference))}. Increase one or more amounts before applying override.`
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
      setError(getCommissionErrorMessage(calculateError, "Failed to calculate commissions.", isZh));
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
    setOverrideError("");
    setOverrideFieldErrors({});
  }

  function handleRemoveParticipant(key: string) {
    setOverrideRows((current) => current.filter((row) => row.key !== key));
    setOverrideError("");
    setOverrideFieldErrors({});
  }

  async function handleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("override");
    setOverrideError("");
    setOverrideFieldErrors({});

    if (!totalsBalanced) {
      setPendingAction(null);
      return;
    }

    try {
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

      const body = (await response.json().catch(() => null)) as ValidationErrorPayload | null;

      if (!response.ok) {
        if (body?.errorCode === "validation_error") {
          const fieldErrors = body.fieldErrors ?? {};
          setOverrideFieldErrors(fieldErrors);
          const summary = buildOverrideFieldErrorSummary(fieldErrors, overrideRows, isZh);
          throw new Error(summary || "Override not saved. Review the highlighted fields and try again.");
        }

        throw new Error(body?.error ?? "Failed to apply override.");
      }

      setOverrideReason("");
      setOverrideError("");
      setOverrideFieldErrors({});
      startTransition(() => {
        router.refresh();
      });
    } catch (overrideError) {
      setOverrideError(getCommissionErrorMessage(overrideError, "Failed to apply override.", isZh));
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
      setError(getCommissionErrorMessage(statusError, "Failed to update commission status.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section id="commission">
      <SectionCard
        subtitle={isZh ? "此交易的费用逻辑、最终参与方拆分和计算历史。" : "Structured fee logic, final stakeholder split, and calculation history for this transaction."}
        title={isZh ? "佣金" : "Commission"}
      >
        <div className="office-kpi-grid office-commission-kpi-grid">
          <StatCard hint={isZh ? "财务输入" : "finance input"} label={isZh ? "总佣金" : "Gross commission"} value={snapshot.summary.grossCommissionLabel} />
          <StatCard hint={isZh ? "全部拆分前费用" : "all pre-split fees"} label={isZh ? "拆分前合计" : "Pre-Split total"} value={snapshot.summary.preSplitTotalLabel} />
          <StatCard hint={isZh ? "全部拆分后费用" : "all post-split fees"} label={isZh ? "拆分后合计" : "Post-Split total"} value={snapshot.summary.postSplitTotalLabel} />
          <StatCard hint={isZh ? "总佣金减去拆分前费用" : "gross minus pre-split fees"} label={isZh ? "净佣金" : "Net commission"} value={snapshot.summary.netCommissionBaseLabel} />
          <StatCard hint={isZh ? "负责人经纪人当前最终付款" : "current final payout for the owner agent"} label={isZh ? "经纪人最终净额" : "Final agent net"} value={snapshot.summary.agentNetLabel} />
          <StatCard hint={isZh ? "公司当前付款" : "current company payout"} label={isZh ? "公司最终净额" : "Final office net"} value={snapshot.summary.officeNetLabel} />
          <StatCard hint={isZh ? "单独的报销调整" : "separate reimbursement adjustment"} label={isZh ? "报销调整" : "Reimbursement"} value={snapshot.summary.reimbursementLabel} />
          <StatCard
            hint={isZh ? "当前生效的计算版本" : "current effective calculation version"}
            label={isZh ? "当前版本" : "Current version"}
            value={translateCommissionCopy(snapshot.summary.currentVersionLabel, isZh)}
          />
        </div>

        <div className="office-inline-meta">
          <span>{isZh ? "默认拆分：" : "Default split: "}{translateCommissionCopy(snapshot.defaultSplitLabel || "Not configured", isZh)}</span>
          <span>{isZh ? "来源：" : "Source: "}{translateCommissionCopy(snapshot.defaultSplitSourceLabel || "No default split configured", isZh)}</span>
        </div>
        {snapshot.visibilityNote ? <p className="office-form-helper">{translateCommissionCopy(snapshot.visibilityNote, isZh)}</p> : null}
        {snapshot.approvalBlockers.length > 0 ? (
          <div className="office-section-card">
            <div className="office-section-body">
              <strong>{isZh ? "当前阻塞项" : "Current blockers"}</strong>
              <ul>
                {snapshot.approvalBlockers.map((blocker) => (
                  <li key={blocker}>{translateCommissionCopy(blocker, isZh)}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {calculateLocked ? (
          <p className="office-form-helper">
            {isZh
              ? "此交易已有手动调整参与方，重新计算已锁定。后续付款变更请继续使用手动调整。"
              : "This transaction already has manual override participants. Recalculate is locked, so keep using Override for further payout changes."}
          </p>
        ) : null}
        {!canCalculateCommissions ? (
          <p className="office-form-helper">
            {isZh
              ? "你当前的角色可以查看这里的佣金数据，但只有佣金管理员可以为此交易运行计算。"
              : "Your current role can view commission data here, but only commission managers can run Calculate for this transaction."}
          </p>
        ) : null}

        <form className="office-inline-form office-inline-form-wrap" onSubmit={handleCalculate}>
          <label className="office-detail-field office-detail-field-wide">
            <span>{isZh ? "计算备注" : "Calculation note"}</span>
            <TextInput
              disabled={!canCalculateCommissions || calculateLocked || pendingAction === "calculate"}
              onChange={(event) => setCalculationNote(event.target.value)}
              value={calculationNote}
            />
          </label>
          <div className="office-inline-form-actions">
            <Button disabled={!canCalculateCommissions || calculateLocked || pendingAction === "calculate"} type="submit">
              {pendingAction === "calculate"
                ? isZh
                  ? "计算中..."
                  : "Calculating..."
                : snapshot.versionHistory.length > 0
                  ? isZh
                    ? "重新计算"
                    : "Recalculate"
                  : isZh
                    ? "计算"
                    : "Calculate"}
            </Button>
          </div>
        </form>

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>{isZh ? "参与方" : "Stakeholder"}</span>
              <span>{isZh ? "角色" : "Role"}</span>
              <span>{isZh ? "份额" : "Share"}</span>
              <span>{isZh ? "基础金额" : "Base"}</span>
              <span>{isZh ? "拆分后" : "Post-Split"}</span>
              <span>{isZh ? "报销调整" : "Reimbursement"}</span>
              <span>{isZh ? "最终金额" : "Final"}</span>
            </div>

            {commissionBreakdownRows.map((row) => (
              <div className="office-table-row office-table-row-commission" key={row.key}>
                <div className="office-table-primary">
                  <strong>{row.recipientLabel}</strong>
                  {row.helperText ? <p>{translateCommissionCopy(row.helperText, isZh)}</p> : null}
                </div>
                <span>{translateCommissionCopy(row.recipientRole, isZh)}</span>
                <span>{row.sharePercentLabel}</span>
                <span>{row.baseAmountLabel}</span>
                <span>{row.postSplitAdjustmentLabel}</span>
                <span>{row.reimbursementAdjustmentLabel}</span>
                <strong>{row.finalAmountLabel}</strong>
              </div>
            ))}

            {commissionBreakdownRows.length === 0 ? (
              <div className="office-accounting-empty">
                <p>{isZh ? "运行财务计算后，会生成参与方拆分明细。" : "Run the finance calculation to generate stakeholder breakdown rows."}</p>
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
                    {isZh ? "调整原因" : "Override reason"} <strong>{isZh ? "必填" : "Required"}</strong>
                  </span>
                  <TextInput
                    aria-invalid={Boolean(overrideFieldErrors.overrideReason)}
                    disabled={pendingAction === "override"}
                    required
                    onChange={(event) => {
                      setOverrideReason(event.target.value);
                      setOverrideError("");
                      setOverrideFieldErrors((current) => omitFieldError(current, "overrideReason"));
                    }}
                    value={overrideReason}
                  />
                  {overrideFieldErrors.overrideReason ? <p className="office-form-error">{translateCommissionCopy(overrideFieldErrors.overrideReason, isZh)}</p> : null}
                </label>
                {canManageOverrideParticipants ? (
                  <div className="office-detail-field office-detail-field-wide">
                    <span>{isZh ? "添加参与方" : "Add participant"}</span>
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
                              ? isZh
                                ? "输入至少 1 个字符搜索成员"
                                : "Type at least 1 character to search members"
                              : isZh
                                ? "没有可添加的成员"
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
                                  {selectedParticipantId === option.membershipId ? <strong>{isZh ? "已选择" : "Selected"}</strong> : null}
                                </button>
                              ))
                            ) : (
                              <div className="office-autocomplete-empty">{isZh ? "没有匹配的成员。" : "No matching members."}</div>
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
                        {isZh ? "添加参与方" : "Add participant"}
                      </Button>
                    </div>
                    <p className="office-form-helper">
                      {isZh
                        ? "只有办公室管理员可以添加或移除额外付款参与方。输入至少 1 个字符即可搜索组织成员，包括已邀请但尚未激活账号的成员。"
                        : "Only Office Admin can add or remove extra payout participants. Type at least 1 character to search organization members, including invited members who have never activated their accounts."}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="office-inline-meta">
                <span>{isZh ? "当前合计：" : "Current total: "}{formatCurrency(currentTotal)}</span>
                <span>{isZh ? "调整合计：" : "Override total: "}{formatCurrency(overrideTotal)}</span>
                <span>{isZh ? "差额：" : "Difference: "}{formatCurrency(totalDifference)}</span>
              </div>
              {overrideValidationMessage ? <p className="office-form-error">{overrideValidationMessage}</p> : null}

              <HorizontalScrollArea>
                <div className="office-table">
                  <div className="office-table-header office-table-row office-table-row-commission">
                    <span>{isZh ? "参与方" : "Stakeholder"}</span>
                    <span>{isZh ? "当前最终金额" : "Current final"}</span>
                    <span>{isZh ? "调整金额" : "Override amount"}</span>
                    {canManageOverrideParticipants ? <span>{isZh ? "操作" : "Actions"}</span> : null}
                  </div>

                  {overrideRows.map((row, index) => {
                    const rowErrors = getOverrideRowErrorMessages(overrideFieldErrors, index);

                    return (
                    <div className="office-table-row office-table-row-commission" key={`override:${row.key}`}>
                      <div className="office-table-primary">
                        <strong>{row.recipientLabel}</strong>
                        <p>
                          {row.isManualParticipant
                            ? `${translateCommissionCopy(row.recipientRole, isZh)} · ${isZh ? "手动参与方" : "Manual participant"}`
                            : translateCommissionCopy(row.recipientRole, isZh)}
                        </p>
                      </div>
                      <span>{row.currentFinalLabel}</span>
                      <div className="office-table-primary">
                        <TextInput
                          aria-invalid={rowErrors.length > 0}
                          disabled={pendingAction === "override"}
                          onChange={(event) => {
                            setOverrideRows((current) =>
                              current.map((candidate) =>
                                candidate.key === row.key
                                  ? {
                                      ...candidate,
                                      amount: event.target.value
                                    }
                                  : candidate
                              )
                            );
                            setOverrideError("");
                            setOverrideFieldErrors((current) => omitRowFieldErrors(current, index));
                          }}
                          value={row.amount}
                        />
                        {rowErrors.map((message) => (
                          <p className="office-form-error" key={`${row.key}:${message}`}>
                            {translateCommissionCopy(message, isZh)}
                          </p>
                        ))}
                      </div>
                      {canManageOverrideParticipants ? (
                        <div className="office-accounting-inline-actions">
                          {row.isManualParticipant ? (
                            <Button
                              disabled={pendingAction === "override"}
                              onClick={() => handleRemoveParticipant(row.key)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {isZh ? "移除" : "Remove"}
                            </Button>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </HorizontalScrollArea>

              {overrideValidationMessage ? (
                <p className="office-form-error">
                  {isZh
                    ? "调整合计必须与当前付款合计一致，才能应用手动调整。"
                    : "Apply override is blocked until the override total matches the current payout total."}
                </p>
              ) : null}
              {overrideError ? <p className="office-form-error">{overrideError}</p> : null}
              <div className="office-inline-form-actions">
                <Button disabled={!canSubmitOverride} type="submit" variant="secondary">
                  {pendingAction === "override" ? (isZh ? "保存调整中..." : "Saving override...") : isZh ? "应用手动调整" : "Apply override"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>{isZh ? "版本" : "Version"}</span>
              <span>{isZh ? "类型" : "Type"}</span>
              <span>{isZh ? "创建时间" : "Created"}</span>
              <span>{isZh ? "创建人" : "By"}</span>
              <span>{isZh ? "经纪人净额" : "Agent net"}</span>
              <span>{isZh ? "公司净额" : "Office net"}</span>
              <span>{isZh ? "备注" : "Notes"}</span>
            </div>

            {snapshot.versionHistory.map((version) => (
              <div className="office-table-row office-table-row-commission" key={version.id}>
                <div className="office-table-primary">
                  <strong>{isZh ? `版本 ${version.versionNumber}` : `Version ${version.versionNumber}`}</strong>
                  <p>{version.isCurrent ? (isZh ? "当前" : "Current") : isZh ? "历史版本" : "Historical"}</p>
                </div>
                <span>{translateCommissionCopy(version.sourceTypeLabel, isZh)}</span>
                <span>{version.createdAt || "—"}</span>
                <span>{version.createdByLabel}</span>
                <span>{version.finalAgentNetLabel}</span>
                <span>{version.finalOfficeNetLabel}</span>
                <div className="office-table-primary">
                  <strong>{version.overrideReason || translateCommissionCopy(version.notes || "—", isZh)}</strong>
                  <p>{version.overrideReason && version.notes ? translateCommissionCopy(version.notes, isZh) : ""}</p>
                </div>
              </div>
            ))}

            {snapshot.versionHistory.length === 0 ? (
              <div className="office-accounting-empty">
                <p>{isZh ? "此交易还没有保存过财务计算历史。" : "No finance calculation history has been saved for this transaction yet."}</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>

        <HorizontalScrollArea>
          <div className="office-table">
            <div className="office-table-header office-table-row office-table-row-commission">
              <span>{isZh ? "收款方" : "Recipient"}</span>
              <span>{isZh ? "角色" : "Role"}</span>
              <span>{isZh ? "状态" : "Status"}</span>
              <span>{isZh ? "付款单" : "Statement"}</span>
              <span>{isZh ? "计算时间" : "Calculated"}</span>
              <span>{isZh ? "操作" : "Actions"}</span>
            </div>

            {snapshot.calculations.map((row) => (
              <div className="office-table-row office-table-row-commission" key={row.id}>
                <div className="office-table-primary">
                  <strong>{row.recipientLabel}</strong>
                  <p>{translateCommissionCopy(row.recipientType, isZh)}</p>
                </div>
                <span>{row.recipientRole ? translateCommissionCopy(row.recipientRole, isZh) : "—"}</span>
                <StatusBadge tone={getStatusTone(row.status)}>{translateCommissionCopy(row.status, isZh)}</StatusBadge>
                <div className="office-table-primary">
                  <strong>{row.statementAmountLabel}</strong>
                  <p>
                    {isZh ? `${row.officeNetLabel} 公司 · ${row.agentNetLabel} 经纪人` : `${row.officeNetLabel} office · ${row.agentNetLabel} agent`}
                  </p>
                </div>
                <span>{row.calculatedAt || "—"}</span>
                <div className="office-accounting-inline-actions">
                  {canManageOverride ? (
                    <>
                      <SelectInput
                        className="office-accounting-status-select office-commission-status-select"
                        disabled={pendingAction === `status:${row.id}`}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [row.id]: event.target.value
                          }))
                        }
                        value={statusDrafts[row.id] ?? row.statusValue}
                      >
                        {commissionStatusUpdateOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {commissionStatusOptionLabel(option, isZh)}
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
                        {pendingAction === `status:${row.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存" : "Save"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}

            {snapshot.calculations.length === 0 ? (
              <div className="office-accounting-empty">
                <p>{isZh ? "此交易还没有保存当前付款记录。" : "No current payout rows have been saved for this transaction yet."}</p>
              </div>
            ) : null}
          </div>
        </HorizontalScrollArea>

        {error ? <p className="office-form-error">{error}</p> : null}
      </SectionCard>
    </section>
  );
}
