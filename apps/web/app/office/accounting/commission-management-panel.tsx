"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { OfficeCommissionManagementSnapshot } from "@acre/db";
import styles from "./commission-management-panel.module.css";
import {
  Button,
  ConfirmActionDialog,
  EmptyState,
  FormField,
  HorizontalScrollArea,
  ListPageFilters,
  ListPageSection,
  ListPageStatsGrid,
  QueueItem,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";
import {
  commissionStatusOptionLabel,
  commissionStatusOptions,
  commissionStatusUpdateOptions,
  formatCommissionCount,
  getCommissionErrorMessage,
  translateCommissionCopy
} from "../_utils/commission-copy";

type CommissionManagementPanelProps = {
  snapshot: OfficeCommissionManagementSnapshot | null;
  canViewCommissions: boolean;
  canManageCommissions: boolean;
  canCalculateCommissions: boolean;
  canApproveCommissions: boolean;
};

type CommissionFilterState = {
  membershipId: string;
  teamId: string;
  commissionPlanId: string;
  status: string;
  transactionId: string;
  startDate: string;
  endDate: string;
};

type CommissionPlanFormState = {
  commissionPlanId: string;
  name: string;
  description: string;
  calculationMode: string;
  baseSplitPercent: string;
  brokerageFeeType: string;
  brokerageFeeAmount: string;
  referralFeeType: string;
  referralFeeAmount: string;
  flatFeeDeduction: string;
  slidingScalePercent: string;
  slidingScaleThresholdStart: string;
  slidingScaleThresholdEnd: string;
};

type CommissionAssignmentFormState = {
  targetType: "agent" | "team";
  membershipId: string;
  teamId: string;
  commissionPlanId: string;
  effectiveFrom: string;
  effectiveTo: string;
};

type SplitTemplateFormState = {
  splitTemplateId: string;
  name: string;
  agentPercent: string;
  isActive: string;
};

type MemberDefaultSourceFilter = "all" | "template" | "custom";

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function CommissionTable(props: { children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className="office-table">{props.children}</div>
    </HorizontalScrollArea>
  );
}

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

function getBooleanStatusTone(value: boolean) {
  return value ? ("success" as const) : ("neutral" as const);
}

function buildFilterHref(pathname: string, filters: CommissionFilterState) {
  const params = new URLSearchParams();

  if (filters.membershipId.trim()) {
    params.set("commissionMembershipId", filters.membershipId.trim());
  }

  if (filters.teamId.trim()) {
    params.set("commissionTeamId", filters.teamId.trim());
  }

  if (filters.commissionPlanId.trim()) {
    params.set("commissionPlanId", filters.commissionPlanId.trim());
  }

  if (filters.status.trim()) {
    params.set("commissionStatus", filters.status.trim());
  }

  if (filters.transactionId.trim()) {
    params.set("commissionTransactionId", filters.transactionId.trim());
  }

  if (filters.startDate.trim()) {
    params.set("commissionStartDate", filters.startDate.trim());
  }

  if (filters.endDate.trim()) {
    params.set("commissionEndDate", filters.endDate.trim());
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildPlanStateFromSnapshot(snapshot: OfficeCommissionManagementSnapshot): CommissionPlanFormState {
  const firstPlan = snapshot.plans[0];

  return {
    commissionPlanId: "",
    name: "",
    description: "",
    calculationMode: "split_and_fees",
    baseSplitPercent: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "base_split")?.splitPercent ?? "70",
    brokerageFeeType: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "brokerage_fee")?.feeTypeValue ?? "flat",
    brokerageFeeAmount: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "brokerage_fee")?.feeAmount ?? "",
    referralFeeType: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "referral_fee")?.feeTypeValue ?? "percentage",
    referralFeeAmount: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "referral_fee")?.feeAmount ?? "",
    flatFeeDeduction: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "flat_fee_deduction")?.flatAmount ?? "",
    slidingScalePercent: firstPlan?.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.splitPercent ?? "",
    slidingScaleThresholdStart:
      firstPlan?.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.thresholdStart ?? "",
    slidingScaleThresholdEnd:
      firstPlan?.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.thresholdEnd ?? ""
  };
}

function buildPlanStateFromPlan(snapshot: OfficeCommissionManagementSnapshot, commissionPlanId: string): CommissionPlanFormState {
  const plan = snapshot.plans.find((entry) => entry.id === commissionPlanId);

  if (!plan) {
    return buildPlanStateFromSnapshot(snapshot);
  }

  return {
    commissionPlanId: plan.id,
    name: plan.name,
    description: plan.description,
    calculationMode: plan.calculationModeValue,
    baseSplitPercent: plan.rules.find((rule) => rule.ruleTypeValue === "base_split")?.splitPercent ?? "",
    brokerageFeeType: plan.rules.find((rule) => rule.ruleTypeValue === "brokerage_fee")?.feeTypeValue ?? "flat",
    brokerageFeeAmount: plan.rules.find((rule) => rule.ruleTypeValue === "brokerage_fee")?.feeAmount ?? "",
    referralFeeType: plan.rules.find((rule) => rule.ruleTypeValue === "referral_fee")?.feeTypeValue ?? "percentage",
    referralFeeAmount: plan.rules.find((rule) => rule.ruleTypeValue === "referral_fee")?.feeAmount ?? "",
    flatFeeDeduction: plan.rules.find((rule) => rule.ruleTypeValue === "flat_fee_deduction")?.flatAmount ?? "",
    slidingScalePercent: plan.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.splitPercent ?? "",
    slidingScaleThresholdStart: plan.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.thresholdStart ?? "",
    slidingScaleThresholdEnd: plan.rules.find((rule) => rule.ruleTypeValue === "sliding_scale")?.thresholdEnd ?? ""
  };
}

function buildSplitTemplateFormState(): SplitTemplateFormState {
  return {
    splitTemplateId: "",
    name: "",
    agentPercent: "",
    isActive: "true"
  };
}

function buildSplitTemplateFormStateFromTemplate(
  snapshot: OfficeCommissionManagementSnapshot,
  splitTemplateId: string
): SplitTemplateFormState {
  const template = snapshot.splitTemplates.find((entry) => entry.id === splitTemplateId);

  if (!template) {
    return buildSplitTemplateFormState();
  }

  return {
    splitTemplateId: template.id,
    name: template.name,
    agentPercent: template.agentPercent,
    isActive: template.isActive ? "true" : "false"
  };
}

export function CommissionManagementPanel({
  snapshot,
  canViewCommissions,
  canManageCommissions,
  canCalculateCommissions,
  canApproveCommissions
}: CommissionManagementPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  const [filterState, setFilterState] = useState<CommissionFilterState>(() => ({
    membershipId: snapshot?.filters.membershipId ?? "",
    teamId: snapshot?.filters.teamId ?? "",
    commissionPlanId: snapshot?.filters.commissionPlanId ?? "",
    status: snapshot?.filters.status ?? "",
    transactionId: snapshot?.filters.transactionId ?? "",
    startDate: snapshot?.filters.startDate ?? "",
    endDate: snapshot?.filters.endDate ?? ""
  }));
  const [planFormState, setPlanFormState] = useState<CommissionPlanFormState>(() =>
    snapshot ? buildPlanStateFromSnapshot(snapshot) : buildPlanStateFromSnapshot({
      overview: {
        activeSplitTemplatesCount: 0,
        membersWithDefaultSplitCount: 0,
        activePlansCount: 0,
        activeAssignmentsCount: 0,
        calculatedRowsCount: 0,
        statementReadyLabel: "$0",
        payableLabel: "$0",
        paidLabel: "$0"
      },
      filters: {
        membershipId: "",
        teamId: "",
        commissionPlanId: "",
        status: "",
        transactionId: "",
        startDate: "",
        endDate: "",
        memberOptions: [],
        teamOptions: [],
        commissionPlanOptions: [],
        transactionOptions: []
      },
      splitTemplates: [],
      memberDefaults: [],
      advancedReviewItems: [],
      plans: [],
      assignments: [],
      calculations: [],
      statement: null
    })
  );
  const [assignmentFormState, setAssignmentFormState] = useState<CommissionAssignmentFormState>({
    targetType: "agent",
    membershipId: snapshot?.filters.memberOptions[0]?.id ?? "",
    teamId: snapshot?.filters.teamOptions[0]?.id ?? "",
    commissionPlanId: snapshot?.plans[0]?.id ?? "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: ""
  });
  const [splitTemplateFormState, setSplitTemplateFormState] = useState<SplitTemplateFormState>(() => buildSplitTemplateFormState());
  const [selectedStatementMembershipId, setSelectedStatementMembershipId] = useState(snapshot?.filters.membershipId ?? "");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries((snapshot?.calculations ?? []).map((row) => [row.id, row.statusValue]))
  );
  const [memberDefaultQuery, setMemberDefaultQuery] = useState("");
  const [memberDefaultSourceFilter, setMemberDefaultSourceFilter] = useState<MemberDefaultSourceFilter>("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const filteredPlanOptions = useMemo(
    () => snapshot?.plans.map((plan) => ({ id: plan.id, label: plan.name })) ?? [],
    [snapshot]
  );

  const filteredMemberDefaults = useMemo(() => {
    const query = memberDefaultQuery.trim().toLowerCase();

    return (snapshot?.memberDefaults ?? []).filter((setting) => {
      if (memberDefaultSourceFilter !== "all" && setting.sourceType !== memberDefaultSourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        setting.membershipLabel,
        setting.settingLabel,
        setting.sourceLabel,
        setting.splitTemplateLabel,
        setting.agentPercent,
        setting.companyPercent,
        setting.effectiveFrom,
        setting.effectiveTo,
        setting.sourceType
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [memberDefaultQuery, memberDefaultSourceFilter, snapshot?.memberDefaults]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setFilterState({
      membershipId: snapshot.filters.membershipId,
      teamId: snapshot.filters.teamId,
      commissionPlanId: snapshot.filters.commissionPlanId,
      status: snapshot.filters.status,
      transactionId: snapshot.filters.transactionId,
      startDate: snapshot.filters.startDate,
      endDate: snapshot.filters.endDate
    });
    setStatusDrafts(Object.fromEntries(snapshot.calculations.map((row) => [row.id, row.statusValue])));
    setSelectedStatementMembershipId(snapshot.filters.membershipId);
    setSplitTemplateFormState((current) =>
      current.splitTemplateId && snapshot.splitTemplates.some((template) => template.id === current.splitTemplateId)
        ? current
        : buildSplitTemplateFormState()
    );
  }, [
    snapshot,
    snapshot?.calculations,
    snapshot?.filters.commissionPlanId,
    snapshot?.filters.endDate,
    snapshot?.filters.membershipId,
    snapshot?.filters.teamId,
    snapshot?.filters.startDate,
    snapshot?.filters.status,
    snapshot?.filters.transactionId,
    snapshot?.splitTemplates
  ]);

  if (!canViewCommissions || !snapshot) {
    return null;
  }

  function pushNextHref(nextHref: string) {
    const params = new URLSearchParams(currentSearchParams.toString());
    const nextUrl = new URL(nextHref, "http://localhost");

    params.delete("commissionMembershipId");
    params.delete("commissionTeamId");
    params.delete("commissionPlanId");
    params.delete("commissionStatus");
    params.delete("commissionTransactionId");
    params.delete("commissionStartDate");
    params.delete("commissionEndDate");

    nextUrl.searchParams.forEach((value, key) => {
      params.set(key, value);
    });

    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function resetFilters() {
    setFilterState({
      membershipId: "",
      teamId: "",
      commissionPlanId: "",
      status: "",
      transactionId: "",
      startDate: "",
      endDate: ""
    });

    const params = new URLSearchParams(currentSearchParams.toString());
    params.delete("commissionMembershipId");
    params.delete("commissionTeamId");
    params.delete("commissionPlanId");
    params.delete("commissionStatus");
    params.delete("commissionTransactionId");
    params.delete("commissionStartDate");
    params.delete("commissionEndDate");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  async function handleSavePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("save-plan");
    setError("");

    try {
      const rules = [
        planFormState.baseSplitPercent
          ? {
              ruleType: "base_split",
              ruleName: "Base split",
              splitPercent: planFormState.baseSplitPercent
            }
          : null,
        planFormState.brokerageFeeAmount
          ? {
              ruleType: "brokerage_fee",
              ruleName: "Brokerage fee",
              feeType: planFormState.brokerageFeeType,
              feeAmount: planFormState.brokerageFeeAmount
            }
          : null,
        planFormState.referralFeeAmount
          ? {
              ruleType: "referral_fee",
              ruleName: "Referral fee",
              feeType: planFormState.referralFeeType,
              feeAmount: planFormState.referralFeeAmount
            }
          : null,
        planFormState.flatFeeDeduction
          ? {
              ruleType: "flat_fee_deduction",
              ruleName: "Flat fee deduction",
              flatAmount: planFormState.flatFeeDeduction
            }
          : null,
        planFormState.slidingScalePercent
          ? {
              ruleType: "sliding_scale",
              ruleName: "Sliding scale",
              splitPercent: planFormState.slidingScalePercent,
              thresholdStart: planFormState.slidingScaleThresholdStart,
              thresholdEnd: planFormState.slidingScaleThresholdEnd
            }
          : null
      ].filter(Boolean);

      const response = await fetch(
        planFormState.commissionPlanId
          ? `/api/office/accounting/commissions/plans/${planFormState.commissionPlanId}`
          : "/api/office/accounting/commissions/plans",
        {
          method: planFormState.commissionPlanId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: planFormState.name,
          description: planFormState.description,
          calculationMode: planFormState.calculationMode,
          isActive: true,
          rules
        })
        }
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save commission plan.");
      }

      router.refresh();
    } catch (saveError) {
      setError(getCommissionErrorMessage(saveError, "Failed to save commission plan.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAssignPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("assign-plan");
    setError("");

    try {
      const assignmentPayload =
        assignmentFormState.targetType === "team"
          ? {
              teamId: assignmentFormState.teamId,
              commissionPlanId: assignmentFormState.commissionPlanId,
              effectiveFrom: assignmentFormState.effectiveFrom,
              effectiveTo: assignmentFormState.effectiveTo
            }
          : {
              membershipId: assignmentFormState.membershipId,
              commissionPlanId: assignmentFormState.commissionPlanId,
              effectiveFrom: assignmentFormState.effectiveFrom,
              effectiveTo: assignmentFormState.effectiveTo
            };

      const response = await fetch("/api/office/accounting/commissions/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(assignmentPayload)
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to assign commission plan.");
      }

      router.refresh();
    } catch (assignError) {
      setError(getCommissionErrorMessage(assignError, "Failed to assign commission plan.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    setPendingAction(`remove-assignment:${assignmentId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/accounting/commissions/assignments/${assignmentId}`, {
        method: "DELETE"
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to remove commission assignment.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(getCommissionErrorMessage(deleteError, "Failed to remove commission assignment.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveSplitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("save-split-template");
    setError("");

    try {
      const response = await fetch(
        splitTemplateFormState.splitTemplateId
          ? `/api/office/accounting/commissions/split-templates/${splitTemplateFormState.splitTemplateId}`
          : "/api/office/accounting/commissions/split-templates",
        {
          method: splitTemplateFormState.splitTemplateId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: splitTemplateFormState.name,
            agentPercent: splitTemplateFormState.agentPercent,
            isActive: splitTemplateFormState.isActive === "true"
          })
        }
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save split template.");
      }

      setSplitTemplateFormState(buildSplitTemplateFormState());
      router.refresh();
    } catch (saveError) {
      setError(getCommissionErrorMessage(saveError, "Failed to save split template.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteSplitTemplate() {
    if (!splitTemplateFormState.splitTemplateId) {
      return;
    }

    setPendingAction("delete-split-template");
    setError("");

    try {
      const response = await fetch(`/api/office/accounting/commissions/split-templates/${splitTemplateFormState.splitTemplateId}`, {
        method: "DELETE"
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete split template.");
      }

      setSplitTemplateFormState(buildSplitTemplateFormState());
      router.refresh();
    } catch (deleteError) {
      setError(getCommissionErrorMessage(deleteError, "Failed to delete split template.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateCalculationStatus(calculationId: string) {
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
        throw new Error(body?.error ?? "Failed to update calculation status.");
      }

      router.refresh();
    } catch (statusError) {
      setError(getCommissionErrorMessage(statusError, "Failed to update calculation status.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateStatement() {
    if (!selectedStatementMembershipId) {
      return;
    }

    setPendingAction("statement");
    setError("");

    try {
      const response = await fetch("/api/office/accounting/commissions/statements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: selectedStatementMembershipId,
          startDate: filterState.startDate,
          endDate: filterState.endDate
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate statement snapshot.");
      }

      setFilterState((current) => ({
        ...current,
        membershipId: selectedStatementMembershipId
      }));
      pushNextHref(
        buildFilterHref(pathname, {
          ...filterState,
          membershipId: selectedStatementMembershipId
        })
      );
      router.refresh();
    } catch (statementError) {
      setError(getCommissionErrorMessage(statementError, "Failed to generate statement snapshot.", isZh));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-accounting-panel" id="commissions">
      <ListPageSection
        subtitle={isZh ? "集中管理佣金计划、分配关系、已计算记录和付款单准备状态。" : "Commission plans, assignments, calculated rows, and statement-ready visibility."}
        title={isZh ? "佣金管理" : "Commission management"}
      >
        <ListPageStatsGrid className="office-commission-kpi-grid">
          <StatCard
            hint={isZh ? "启用中的可复用默认拆分模板" : "active reusable default split templates"}
            label={isZh ? "拆分模板" : "Split templates"}
            value={snapshot.overview.activeSplitTemplatesCount}
          />
          <StatCard
            hint={isZh ? "已设置启用默认拆分的成员" : "members with an active default split"}
            label={isZh ? "成员默认拆分" : "Member defaults"}
            value={snapshot.overview.membersWithDefaultSplitCount}
          />
          <StatCard
            hint={isZh ? "当前办公室范围内启用的佣金计划" : "active plans configured for this office scope"}
            label={isZh ? "启用计划" : "Active plans"}
            value={snapshot.overview.activePlansCount}
          />
          <StatCard
            hint={isZh ? "经纪人和团队的启用计划分配" : "active plan assignments across agents and teams"}
            label={isZh ? "分配关系" : "Assignments"}
            value={snapshot.overview.activeAssignmentsCount}
          />
          <StatCard
            hint={isZh ? "当前筛选范围内已保存的佣金记录" : "persisted commission rows in the current filter window"}
            label={isZh ? "已计算记录" : "Calculated rows"}
            value={snapshot.overview.calculatedRowsCount}
          />
          <StatCard
            hint={isZh ? "可打包进付款单的记录" : "rows ready for statement packaging"}
            label={isZh ? "付款单就绪" : "Statement ready"}
            value={snapshot.overview.statementReadyLabel}
          />
          <StatCard hint={isZh ? "标记为可付款的记录" : "rows marked payable"} label={isZh ? "可付款" : "Payable"} value={snapshot.overview.payableLabel} />
          <StatCard hint={isZh ? "标记为已付款的记录" : "rows marked paid"} label={isZh ? "已付款" : "Paid"} value={snapshot.overview.paidLabel} />
        </ListPageStatsGrid>

        <div className="office-detail-two-column">
          <div className="office-side-stack">
            <ListPageSection
              subtitle={isZh ? "用于成员入职和资料更新的 20/80、50/50 等默认拆分比例。" : "Reusable 20/80, 50/50, and similar defaults for member onboarding and profile updates."}
              title={isZh ? "拆分模板" : "Split templates"}
            >
              <form className="office-form-grid office-form-grid-3" onSubmit={handleSaveSplitTemplate}>
                <FormField label={isZh ? "已有模板" : "Existing template"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setSplitTemplateFormState(buildSplitTemplateFormStateFromTemplate(snapshot, event.target.value))}
                    value={splitTemplateFormState.splitTemplateId}
                  >
                    <option value="">{isZh ? "新建模板" : "New template"}</option>
                    {snapshot.splitTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "模板名称" : "Template name"}>
                  <TextInput
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, name: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={splitTemplateFormState.name}
                  />
                </FormField>
                <FormField label={isZh ? "经纪人拆分 %" : "Agent split %"}>
                  <TextInput
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, agentPercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={splitTemplateFormState.agentPercent}
                  />
                </FormField>
                <FormField label={isZh ? "状态" : "Status"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, isActive: event.target.value }))}
                    value={splitTemplateFormState.isActive}
                  >
                    <option value="true">{isZh ? "启用" : "Active"}</option>
                    <option value="false">{isZh ? "停用" : "Inactive"}</option>
                  </SelectInput>
                </FormField>
                {canManageCommissions ? (
                  <div className="office-inline-form office-inline-form-compact office-form-grid-span-3">
                    <Button disabled={pendingAction === "save-split-template"} type="submit">
                      {pendingAction === "save-split-template" ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存拆分模板" : "Save split template"}
                    </Button>
                    {splitTemplateFormState.splitTemplateId ? (
                      <Button
                        disabled={pendingAction === "delete-split-template"}
                        onClick={() => void handleDeleteSplitTemplate()}
                        type="button"
                        variant="secondary"
                      >
                        {pendingAction === "delete-split-template" ? (isZh ? "删除中..." : "Deleting...") : isZh ? "删除模板" : "Delete template"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </form>

              {snapshot.splitTemplates.length ? (
                <div className="office-queue-list">
                  {snapshot.splitTemplates.map((template) => (
                    <QueueItem
                      badge={
                        <StatusBadge tone={getBooleanStatusTone(template.isActive)}>
                          {template.isActive ? (isZh ? "启用" : "Active") : isZh ? "停用" : "Inactive"}
                        </StatusBadge>
                      }
                      description={translateCommissionCopy(template.label, isZh)}
                      key={template.id}
                      meta={
                        <>
                          <span>{formatCommissionCount(template.usageCount, "member default", "member defaults", "个成员默认拆分", isZh)}</span>
                        </>
                      }
                      title={template.name}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  description={isZh ? "在这里创建可复用拆分比例，用于用户入职和资料编辑。" : "Create reusable split ratios here for user onboarding and profile editing."}
                  title={isZh ? "还没有拆分模板" : "No split templates yet"}
                />
              )}
            </ListPageSection>
          </div>

          <div className="office-side-stack">
            <ListPageSection
              actions={
                snapshot.memberDefaults.length ? (
                  <span className={styles.memberDefaultsCount}>
                    {isZh ? `${filteredMemberDefaults.length} / ${snapshot.memberDefaults.length}` : `${filteredMemberDefaults.length} of ${snapshot.memberDefaults.length}`}
                  </span>
                ) : null
              }
              subtitle={isZh ? "当前成员级默认拆分来源、比例和生效日期。" : "Current member-level default split source, ratio, and effective date."}
              title={isZh ? "成员默认拆分" : "Member defaults"}
            >
              {snapshot.memberDefaults.length ? (
                <>
                  <div className={styles.memberDefaultsToolbar}>
                    <FormField label={isZh ? "搜索成员" : "Search members"}>
                      <TextInput
                        onChange={(event) => setMemberDefaultQuery(event.target.value)}
                        placeholder={isZh ? "姓名、拆分、模板、日期" : "Name, split, template, date"}
                        type="search"
                        value={memberDefaultQuery}
                      />
                    </FormField>
                    <FormField label={isZh ? "来源" : "Source"}>
                      <SelectInput
                        onChange={(event) => setMemberDefaultSourceFilter(event.target.value as MemberDefaultSourceFilter)}
                        value={memberDefaultSourceFilter}
                      >
                        <option value="all">{isZh ? "全部来源" : "All sources"}</option>
                        <option value="template">{isZh ? "模板" : "Template"}</option>
                        <option value="custom">{isZh ? "自定义" : "Custom"}</option>
                      </SelectInput>
                    </FormField>
                  </div>

                  {filteredMemberDefaults.length ? (
                    <div aria-label={isZh ? "成员默认拆分" : "Member default splits"} className={styles.memberDefaultsList} role="list">
                      {filteredMemberDefaults.map((setting) => (
                        <article className={styles.memberDefaultRow} key={setting.id} role="listitem">
                          <div className={styles.memberDefaultMain}>
                            <Link className={styles.memberDefaultName} href={`/office/settings/users/${setting.membershipId}`}>
                              {setting.membershipLabel}
                            </Link>
                            <span className={styles.memberDefaultSplit}>{translateCommissionCopy(setting.settingLabel, isZh)}</span>
                          </div>
                          <div className={styles.memberDefaultDetails}>
                            <StatusBadge tone={setting.sourceType === "template" ? "accent" : "neutral"}>
                              {setting.sourceType === "template" ? (isZh ? "模板" : "Template") : isZh ? "自定义" : "Custom"}
                            </StatusBadge>
                            <span>{translateCommissionCopy(setting.sourceLabel, isZh)}</span>
                            <span>{isZh ? `生效日 ${setting.effectiveFrom}` : `Effective ${setting.effectiveFrom}`}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={isZh ? "换一个姓名、拆分比例、来源、模板或生效日期再试。" : "Try a different name, split ratio, source, template, or effective date."}
                      title={isZh ? "没有匹配的成员默认拆分" : "No matching member defaults"}
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  description={isZh ? "可以在创建用户或用户资料页分配默认拆分。" : "Assign default splits from user creation or the user profile page."}
                  title={isZh ? "当前范围内没有成员默认拆分" : "No member defaults in scope"}
                />
              )}
            </ListPageSection>

            {snapshot.advancedReviewItems.length ? (
              <ListPageSection
                subtitle={isZh ? "仍需要人工复核的旧计划或分配项目。" : "Legacy plan or assignment items that still need manual review."}
                title={isZh ? "高级复核" : "Advanced review"}
              >
                <div className="office-queue-list">
                  {snapshot.advancedReviewItems.map((item) => (
                    <QueueItem
                      badgeLabel={isZh ? "待复核" : "Review"}
                      badgeTone="warning"
                      description={translateCommissionCopy(item, isZh)}
                      key={item}
                      title={isZh ? "旧佣金项目" : "Legacy commission item"}
                    />
                  ))}
                </div>
              </ListPageSection>
            ) : null}
          </div>
        </div>

        <details className="office-section-card">
          <summary>{isZh ? "高级设置" : "Advanced settings"}</summary>
          <div className="office-section-body">
        <ListPageFilters
          as="form"
          className="office-report-filters"
          onSubmit={(event) => {
            event.preventDefault();
            pushNextHref(buildFilterHref(pathname, filterState));
          }}
        >
          <label className="office-report-filter">
            <span>{isZh ? "经纪人" : "Agent"}</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, membershipId: event.target.value }))} value={filterState.membershipId}>
              <option value="">{isZh ? "全部经纪人" : "All agents"}</option>
              {snapshot.filters.memberOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "团队" : "Team"}</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, teamId: event.target.value }))} value={filterState.teamId}>
              <option value="">{isZh ? "全部团队" : "All teams"}</option>
              {snapshot.filters.teamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "计划" : "Plan"}</span>
            <select
              onChange={(event) => setFilterState((current) => ({ ...current, commissionPlanId: event.target.value }))}
              value={filterState.commissionPlanId}
            >
              <option value="">{isZh ? "全部计划" : "All plans"}</option>
              {snapshot.filters.commissionPlanOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "状态" : "Status"}</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))} value={filterState.status}>
              {commissionStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {commissionStatusOptionLabel(option, isZh)}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "交易" : "Transaction"}</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, transactionId: event.target.value }))} value={filterState.transactionId}>
              <option value="">{isZh ? "全部交易" : "All transactions"}</option>
              {snapshot.filters.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "开始日期" : "Start date"}</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, startDate: event.target.value }))} type="date" value={filterState.startDate} />
          </label>

          <label className="office-report-filter">
            <span>{isZh ? "结束日期" : "End date"}</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, endDate: event.target.value }))} type="date" value={filterState.endDate} />
          </label>

          <div className="office-report-filter-actions">
            <Button type="submit">{isZh ? "应用筛选" : "Apply filters"}</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              {isZh ? "重置" : "Reset"}
            </Button>
          </div>

          <div className="office-report-filter-actions">
            <SelectInput onChange={(event) => setSelectedStatementMembershipId(event.target.value)} value={selectedStatementMembershipId}>
              <option value="">{isZh ? "选择付款单经纪人" : "Choose agent for statement"}</option>
              {snapshot.filters.memberOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
            <Button disabled={!selectedStatementMembershipId || pendingAction === "statement"} onClick={() => void handleGenerateStatement()} type="button" variant="secondary">
              {pendingAction === "statement" ? (isZh ? "生成中..." : "Generating...") : isZh ? "生成付款单" : "Generate statement"}
            </Button>
          </div>
        </ListPageFilters>

        <div className="office-detail-two-column">
          <div className="office-side-stack">
            <ListPageSection
              subtitle={isZh ? "用于交易佣金自动化的可复用拆分和费用计划。" : "Reusable split/fee plans for transaction-side commission automation."}
              title={isZh ? "佣金计划" : "Commission plans"}
            >
              <form className="office-form-grid office-form-grid-3" onSubmit={handleSavePlan}>
                <FormField label={isZh ? "已有计划" : "Existing plan"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState(buildPlanStateFromPlan(snapshot, event.target.value))}
                    value={planFormState.commissionPlanId}
                  >
                    <option value="">{isZh ? "新建计划" : "New plan"}</option>
                    {snapshot.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "计划名称" : "Plan name"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, name: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.name}
                  />
                </FormField>
                <FormField label={isZh ? "计算方式" : "Mode"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, calculationMode: event.target.value }))}
                    value={planFormState.calculationMode}
                  >
                    <option value="split_and_fees">{isZh ? "拆分和费用" : "Split & fees"}</option>
                    <option value="flat_net">{isZh ? "固定净额" : "Flat net"}</option>
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "基础拆分 %" : "Base split %"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, baseSplitPercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.baseSplitPercent}
                  />
                </FormField>
                <FormField className="office-form-grid-span-3" label={isZh ? "说明" : "Description"}>
                  <TextareaInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, description: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.description}
                  />
                </FormField>
                <FormField label={isZh ? "公司费用类型" : "Brokerage fee type"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, brokerageFeeType: event.target.value }))}
                    value={planFormState.brokerageFeeType}
                  >
                    <option value="flat">{isZh ? "固定金额" : "Flat"}</option>
                    <option value="percentage">{isZh ? "百分比" : "Percentage"}</option>
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "公司费用" : "Brokerage fee"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, brokerageFeeAmount: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.brokerageFeeAmount}
                  />
                </FormField>
                <FormField label={isZh ? "推荐费" : "Referral fee"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, referralFeeAmount: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.referralFeeAmount}
                  />
                </FormField>
                <FormField label={isZh ? "推荐费类型" : "Referral fee type"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, referralFeeType: event.target.value }))}
                    value={planFormState.referralFeeType}
                  >
                    <option value="percentage">{isZh ? "百分比" : "Percentage"}</option>
                    <option value="flat">{isZh ? "固定金额" : "Flat"}</option>
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "固定费用扣除" : "Flat fee deduction"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, flatFeeDeduction: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.flatFeeDeduction}
                  />
                </FormField>
                <FormField label={isZh ? "阶梯拆分 %" : "Sliding split %"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScalePercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScalePercent}
                  />
                </FormField>
                <FormField label={isZh ? "阶梯起点" : "Threshold start"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScaleThresholdStart: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScaleThresholdStart}
                  />
                </FormField>
                <FormField label={isZh ? "阶梯终点" : "Threshold end"}>
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScaleThresholdEnd: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScaleThresholdEnd}
                  />
                </FormField>
                {canManageCommissions ? (
                  <div className="office-inline-form office-inline-form-compact office-form-grid-span-3">
                    <Button disabled={pendingAction === "save-plan"} type="submit">
                      {pendingAction === "save-plan" ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存佣金计划" : "Save commission plan"}
                    </Button>
                  </div>
                ) : null}
              </form>

              <div className="office-queue-list">
                {snapshot.plans.map((plan) => (
                  <QueueItem
                    badgeLabel={formatCommissionCount(plan.assignmentCount, "assignment", "assignments", "个分配", isZh)}
                    description={translateCommissionCopy(plan.calculationMode, isZh)}
                    key={plan.id}
                    meta={
                      <>
                        <span>{formatCommissionCount(plan.rules.length, "rule", "rules", "条规则", isZh)}</span>
                      </>
                    }
                    title={plan.name}
                  />
                ))}
              </div>
            </ListPageSection>

            <ListPageSection
              subtitle={isZh ? "把启用的佣金计划分配给经纪人或团队，并保留清晰的优先级。" : "Attach active commission plans to agents or teams with explicit precedence."}
              title={isZh ? "计划分配" : "Plan assignments"}
            >
              <form className="office-inline-form office-inline-form-wrap" onSubmit={handleAssignPlan}>
                <FormField label={isZh ? "分配给" : "Assign to"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) =>
                      setAssignmentFormState((current) => ({
                        ...current,
                        targetType: event.target.value === "team" ? "team" : "agent"
                      }))
                    }
                    value={assignmentFormState.targetType}
                  >
                    <option value="agent">{isZh ? "经纪人" : "Agent"}</option>
                    <option value="team">{isZh ? "团队" : "Team"}</option>
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "经纪人" : "Agent"}>
                  <SelectInput
                    disabled={!canManageCommissions || assignmentFormState.targetType !== "agent"}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, membershipId: event.target.value }))}
                    value={assignmentFormState.membershipId}
                  >
                    <option value="">{isZh ? "选择经纪人" : "Select agent"}</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "团队" : "Team"}>
                  <SelectInput
                    disabled={!canManageCommissions || assignmentFormState.targetType !== "team"}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, teamId: event.target.value }))}
                    value={assignmentFormState.teamId}
                  >
                    <option value="">{isZh ? "选择团队" : "Select team"}</option>
                    {snapshot.filters.teamOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "计划" : "Plan"}>
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, commissionPlanId: event.target.value }))}
                    value={assignmentFormState.commissionPlanId}
                  >
                    <option value="">{isZh ? "选择计划" : "Select plan"}</option>
                    {filteredPlanOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "生效开始" : "Effective from"}>
                  <TextInput
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, effectiveFrom: event.target.value }))}
                    readOnly={!canManageCommissions}
                    type="date"
                    value={assignmentFormState.effectiveFrom}
                  />
                </FormField>
                <FormField label={isZh ? "生效结束" : "Effective to"}>
                  <TextInput
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, effectiveTo: event.target.value }))}
                    readOnly={!canManageCommissions}
                    type="date"
                    value={assignmentFormState.effectiveTo}
                  />
                </FormField>
                {canManageCommissions ? (
                  <div className="office-inline-form-actions">
                    <Button disabled={pendingAction === "assign-plan"} type="submit">
                      {pendingAction === "assign-plan" ? (isZh ? "分配中..." : "Assigning...") : isZh ? "分配计划" : "Assign plan"}
                    </Button>
                  </div>
                ) : null}
              </form>

              <p className="office-helper-copy">
                {isZh
                  ? "经纪人的直接分配优先于团队分配；只有没有启用的直接分配时，团队分配才会生效。"
                  : "Direct agent assignments override team assignments. Team assignments apply only when no active direct assignment exists."}
              </p>

              <CommissionTable>
                <div className="office-table-header office-table-row office-table-row-commission-assignments">
                  <span>{isZh ? "对象" : "Target"}</span>
                  <span>{isZh ? "类型" : "Type"}</span>
                  <span>{isZh ? "计划" : "Plan"}</span>
                  <span>{isZh ? "生效开始" : "Effective from"}</span>
                  <span>{isZh ? "生效结束" : "Effective to"}</span>
                  <span>{isZh ? "操作" : "Actions"}</span>
                </div>
                {snapshot.assignments.map((assignment) => (
                  <div className="office-table-row office-table-row-commission-assignments" key={assignment.id}>
                    <span>{assignment.targetLabel}</span>
                    <span>{assignment.targetType === "team" ? (isZh ? "团队" : "Team") : isZh ? "经纪人" : "Agent"}</span>
                    <span>{assignment.commissionPlanLabel}</span>
                    <span>{assignment.effectiveFrom}</span>
                    <span>{assignment.effectiveTo || (isZh ? "长期有效" : "Open-ended")}</span>
                    <div className="office-accounting-inline-actions">
                      {canManageCommissions ? (
                        <Button
                          disabled={pendingAction === `remove-assignment:${assignment.id}`}
                          onClick={() =>
                            setConfirmDialog({
                              title: isZh ? `移除 ${assignment.targetLabel} 的佣金分配？` : `Remove ${assignment.targetLabel} assignment?`,
                              description: isZh
                                ? "这会永久删除所选佣金分配记录。通常用于删除团队前的清理。"
                                : "This permanently deletes the selected commission assignment record. Use this when cleaning up a team before deleting it.",
                              confirmLabel: isZh ? "移除分配" : "Remove assignment",
                              onConfirm: () => {
                                void handleDeleteAssignment(assignment.id);
                              }
                            })
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {pendingAction === `remove-assignment:${assignment.id}` ? (isZh ? "移除中..." : "Removing...") : isZh ? "移除" : "Remove"}
                        </Button>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </CommissionTable>
            </ListPageSection>
          </div>

          <div className="office-side-stack">
            <ListPageSection
              subtitle={isZh ? "已保存的佣金计算、复核队列和付款准备流程。" : "Persisted commission calculations, review queue, and payout-readiness workflow."}
              title={isZh ? "佣金队列" : "Commission queue"}
            >
              <CommissionTable>
                <div className="office-table-header office-table-row office-table-row-commission">
                  <span>{isZh ? "交易" : "Transaction"}</span>
                  <span>{isZh ? "收款方" : "Recipient"}</span>
                  <span>{isZh ? "计划" : "Plan"}</span>
                  <span>{isZh ? "状态" : "Status"}</span>
                  <span>{isZh ? "付款单" : "Statement"}</span>
                  <span>{isZh ? "计算时间" : "Calculated"}</span>
                  <span>{isZh ? "操作" : "Actions"}</span>
                </div>

                {snapshot.calculations.map((row) => (
                  <div className="office-table-row office-table-row-commission" key={row.id}>
                    <div className="office-table-primary">
                      <strong>{row.transactionLabel}</strong>
                      <p>{translateCommissionCopy(row.recipientRole || row.recipientType, isZh)}</p>
                    </div>
                    <span>{row.recipientLabel}</span>
                    <div className="office-table-primary">
                      <strong>{row.commissionPlanLabel}</strong>
                      <p>{translateCommissionCopy(row.commissionPlanDetailLabel, isZh)}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{translateCommissionCopy(row.status, isZh)}</StatusBadge>
                    <div className="office-table-primary">
                      <strong>{row.statementAmountLabel}</strong>
                      <p>
                        {isZh ? `${row.officeNetLabel} 公司 · ${row.agentNetLabel} 经纪人` : `${row.officeNetLabel} office · ${row.agentNetLabel} agent`}
                      </p>
                    </div>
                    <span>{row.calculatedAt}</span>
                    <div className="office-accounting-inline-actions">
                      {(canManageCommissions || canApproveCommissions) ? (
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
                            onClick={() => void handleUpdateCalculationStatus(row.id)}
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
                    <p>{isZh ? "当前筛选条件下没有匹配的佣金记录。" : "No commission rows match the current filters."}</p>
                  </div>
                ) : null}
              </CommissionTable>
            </ListPageSection>

            <ListPageSection
              subtitle={isZh ? "所选经纪人在当前日期范围内的付款单快照。" : "On-screen statement snapshot for the selected agent and current date window."}
              title={isZh ? "付款单 / 付款准备" : "Statement / payout readiness"}
            >
              {snapshot.statement ? (
                <>
                  <ListPageStatsGrid className="office-commission-kpi-grid">
                    <StatCard hint={isZh ? "当前付款单视图选择的经纪人" : "agent currently selected for statement view"} label={isZh ? "经纪人" : "Agent"} value={snapshot.statement.agentLabel} />
                    <StatCard hint={isZh ? "已计算和已审核记录" : "calculated + reviewed rows"} label={isZh ? "待处理计算额" : "Open calculated"} value={snapshot.statement.openCalculatedLabel} />
                    <StatCard hint={isZh ? "可打包进付款单的记录" : "rows ready for statement packaging"} label={isZh ? "付款单就绪" : "Statement ready"} value={snapshot.statement.statementReadyLabel} />
                    <StatCard hint={isZh ? "标记为可付款的记录" : "rows marked payable"} label={isZh ? "可付款" : "Payable"} value={snapshot.statement.payableLabel} />
                    <StatCard hint={isZh ? "标记为已付款的记录" : "rows marked paid"} label={isZh ? "已付款" : "Paid"} value={snapshot.statement.paidLabel} />
                    <StatCard hint={isZh ? "此快照中经纪人份额合计" : "sum of agent share rows in this snapshot"} label={isZh ? "经纪人净额合计" : "Agent net total"} value={snapshot.statement.totalAgentNetLabel} />
                  </ListPageStatsGrid>
                  <div className="office-queue-list">
                    {snapshot.statement.lineItems.map((item) => (
                      <QueueItem
                        badge={<StatusBadge tone={getStatusTone(item.status)}>{translateCommissionCopy(item.status, isZh)}</StatusBadge>}
                        description={item.statementAmountLabel}
                        key={item.id}
                        title={item.transactionLabel}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="office-accounting-empty">
                  <p>{isZh ? "选择经纪人并生成付款单快照，以复核可付款佣金合计。" : "Select an agent and generate a statement snapshot to review payout-ready commission totals."}</p>
                </div>
              )}
            </ListPageSection>
          </div>
        </div>

        {error ? <p className="office-form-error">{error}</p> : null}
          </div>
        </details>
      </ListPageSection>
      <ConfirmActionDialog
        cancelLabel={isZh ? "取消" : "Cancel"}
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          const action = confirmDialog;
          setConfirmDialog(null);
          action?.onConfirm();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </section>
  );
}
