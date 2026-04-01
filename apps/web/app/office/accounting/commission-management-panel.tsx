"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { OfficeCommissionManagementSnapshot } from "@acre/db";
import {
  Button,
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

function CommissionTable(props: { children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className="office-table">{props.children}</div>
    </HorizontalScrollArea>
  );
}

const commissionStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "calculated", label: "Calculated" },
  { value: "reviewed", label: "Reviewed" },
  { value: "statement_ready", label: "Statement ready" },
  { value: "payable", label: "Payable" },
  { value: "paid", label: "Paid" }
];

const commissionStatusUpdateOptions = commissionStatusOptions.filter((option) => option.value);

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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filteredPlanOptions = useMemo(
    () => snapshot?.plans.map((plan) => ({ id: plan.id, label: plan.name })) ?? [],
    [snapshot]
  );

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
      setError(saveError instanceof Error ? saveError.message : "Failed to save commission plan.");
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
      setError(assignError instanceof Error ? assignError.message : "Failed to assign commission plan.");
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
      setError(saveError instanceof Error ? saveError.message : "Failed to save split template.");
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
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete split template.");
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
      setError(statusError instanceof Error ? statusError.message : "Failed to update calculation status.");
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
      setError(statementError instanceof Error ? statementError.message : "Failed to generate statement snapshot.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-accounting-panel" id="commissions">
      <ListPageSection subtitle="Commission plans, assignments, calculated rows, and statement-ready visibility." title="Commission management">
        <ListPageStatsGrid className="office-commission-kpi-grid">
          <StatCard hint="active reusable default split templates" label="Split templates" value={snapshot.overview.activeSplitTemplatesCount} />
          <StatCard hint="members with an active default split" label="Member defaults" value={snapshot.overview.membersWithDefaultSplitCount} />
          <StatCard hint="active plans configured for this office scope" label="Active plans" value={snapshot.overview.activePlansCount} />
          <StatCard hint="active plan assignments across agents and teams" label="Assignments" value={snapshot.overview.activeAssignmentsCount} />
          <StatCard hint="persisted commission rows in the current filter window" label="Calculated rows" value={snapshot.overview.calculatedRowsCount} />
          <StatCard hint="rows ready for statement packaging" label="Statement ready" value={snapshot.overview.statementReadyLabel} />
          <StatCard hint="rows marked payable" label="Payable" value={snapshot.overview.payableLabel} />
          <StatCard hint="rows marked paid" label="Paid" value={snapshot.overview.paidLabel} />
        </ListPageStatsGrid>

        <div className="office-detail-two-column">
          <div className="office-side-stack">
            <ListPageSection subtitle="Reusable 20/80, 50/50, and similar defaults for member onboarding and profile updates." title="Split templates">
              <form className="office-form-grid office-form-grid-3" onSubmit={handleSaveSplitTemplate}>
                <FormField label="Existing template">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setSplitTemplateFormState(buildSplitTemplateFormStateFromTemplate(snapshot, event.target.value))}
                    value={splitTemplateFormState.splitTemplateId}
                  >
                    <option value="">New template</option>
                    {snapshot.splitTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Template name">
                  <TextInput
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, name: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={splitTemplateFormState.name}
                  />
                </FormField>
                <FormField label="Agent split %">
                  <TextInput
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, agentPercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={splitTemplateFormState.agentPercent}
                  />
                </FormField>
                <FormField label="Status">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setSplitTemplateFormState((current) => ({ ...current, isActive: event.target.value }))}
                    value={splitTemplateFormState.isActive}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </SelectInput>
                </FormField>
                {canManageCommissions ? (
                  <div className="office-inline-form office-inline-form-compact office-form-grid-span-3">
                    <Button disabled={pendingAction === "save-split-template"} type="submit">
                      {pendingAction === "save-split-template" ? "Saving..." : "Save split template"}
                    </Button>
                    {splitTemplateFormState.splitTemplateId ? (
                      <Button
                        disabled={pendingAction === "delete-split-template"}
                        onClick={() => void handleDeleteSplitTemplate()}
                        type="button"
                        variant="secondary"
                      >
                        {pendingAction === "delete-split-template" ? "Deleting..." : "Delete template"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </form>

              {snapshot.splitTemplates.length ? (
                <div className="office-queue-list">
                  {snapshot.splitTemplates.map((template) => (
                    <QueueItem
                      badge={<StatusBadge tone={getBooleanStatusTone(template.isActive)}>{template.isActive ? "Active" : "Inactive"}</StatusBadge>}
                      description={template.label}
                      key={template.id}
                      meta={
                        <>
                          <span>{template.usageCount} member defaults</span>
                        </>
                      }
                      title={template.name}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Create reusable split ratios here for user onboarding and profile editing."
                  title="No split templates yet"
                />
              )}
            </ListPageSection>
          </div>

          <div className="office-side-stack">
            <ListPageSection subtitle="Current member-level default split source, ratio, and effective date." title="Member defaults">
              {snapshot.memberDefaults.length ? (
                <div className="office-queue-list">
                  {snapshot.memberDefaults.map((setting) => (
                    <QueueItem
                      badgeLabel={setting.sourceType === "template" ? "Template" : "Custom"}
                      badgeTone={setting.sourceType === "template" ? "accent" : "neutral"}
                      description={setting.settingLabel}
                      key={setting.id}
                      meta={
                        <>
                          <span>{setting.sourceLabel}</span>
                          <span>Effective {setting.effectiveFrom}</span>
                        </>
                      }
                      title={setting.membershipLabel}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Assign default splits from user creation or the user profile page."
                  title="No member defaults in scope"
                />
              )}
            </ListPageSection>

            {snapshot.advancedReviewItems.length ? (
              <ListPageSection subtitle="Legacy plan or assignment items that still need manual review." title="Advanced review">
                <div className="office-queue-list">
                  {snapshot.advancedReviewItems.map((item) => (
                    <QueueItem badgeLabel="Review" badgeTone="warning" description={item} key={item} title="Legacy commission item" />
                  ))}
                </div>
              </ListPageSection>
            ) : null}
          </div>
        </div>

        <details className="office-section-card">
          <summary>Advanced settings</summary>
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
            <span>Agent</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, membershipId: event.target.value }))} value={filterState.membershipId}>
              <option value="">All agents</option>
              {snapshot.filters.memberOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Team</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, teamId: event.target.value }))} value={filterState.teamId}>
              <option value="">All teams</option>
              {snapshot.filters.teamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Plan</span>
            <select
              onChange={(event) => setFilterState((current) => ({ ...current, commissionPlanId: event.target.value }))}
              value={filterState.commissionPlanId}
            >
              <option value="">All plans</option>
              {snapshot.filters.commissionPlanOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Status</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))} value={filterState.status}>
              {commissionStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Transaction</span>
            <select onChange={(event) => setFilterState((current) => ({ ...current, transactionId: event.target.value }))} value={filterState.transactionId}>
              <option value="">All transactions</option>
              {snapshot.filters.transactionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="office-report-filter">
            <span>Start date</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, startDate: event.target.value }))} type="date" value={filterState.startDate} />
          </label>

          <label className="office-report-filter">
            <span>End date</span>
            <input onChange={(event) => setFilterState((current) => ({ ...current, endDate: event.target.value }))} type="date" value={filterState.endDate} />
          </label>

          <div className="office-report-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
            </Button>
          </div>

          <div className="office-report-filter-actions">
            <SelectInput onChange={(event) => setSelectedStatementMembershipId(event.target.value)} value={selectedStatementMembershipId}>
              <option value="">Choose agent for statement</option>
              {snapshot.filters.memberOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
            <Button disabled={!selectedStatementMembershipId || pendingAction === "statement"} onClick={() => void handleGenerateStatement()} type="button" variant="secondary">
              {pendingAction === "statement" ? "Generating..." : "Generate statement"}
            </Button>
          </div>
        </ListPageFilters>

        <div className="office-detail-two-column">
          <div className="office-side-stack">
            <ListPageSection subtitle="Reusable split/fee plans for transaction-side commission automation." title="Commission plans">
              <form className="office-form-grid office-form-grid-3" onSubmit={handleSavePlan}>
                <FormField label="Existing plan">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState(buildPlanStateFromPlan(snapshot, event.target.value))}
                    value={planFormState.commissionPlanId}
                  >
                    <option value="">New plan</option>
                    {snapshot.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Plan name">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, name: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.name}
                  />
                </FormField>
                <FormField label="Mode">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, calculationMode: event.target.value }))}
                    value={planFormState.calculationMode}
                  >
                    <option value="split_and_fees">Split & fees</option>
                    <option value="flat_net">Flat net</option>
                  </SelectInput>
                </FormField>
                <FormField label="Base split %">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, baseSplitPercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.baseSplitPercent}
                  />
                </FormField>
                <FormField className="office-form-grid-span-3" label="Description">
                  <TextareaInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, description: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.description}
                  />
                </FormField>
                <FormField label="Brokerage fee type">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, brokerageFeeType: event.target.value }))}
                    value={planFormState.brokerageFeeType}
                  >
                    <option value="flat">Flat</option>
                    <option value="percentage">Percentage</option>
                  </SelectInput>
                </FormField>
                <FormField label="Brokerage fee">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, brokerageFeeAmount: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.brokerageFeeAmount}
                  />
                </FormField>
                <FormField label="Referral fee">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, referralFeeAmount: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.referralFeeAmount}
                  />
                </FormField>
                <FormField label="Referral fee type">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setPlanFormState((current) => ({ ...current, referralFeeType: event.target.value }))}
                    value={planFormState.referralFeeType}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat</option>
                  </SelectInput>
                </FormField>
                <FormField label="Flat fee deduction">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, flatFeeDeduction: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.flatFeeDeduction}
                  />
                </FormField>
                <FormField label="Sliding split %">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScalePercent: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScalePercent}
                  />
                </FormField>
                <FormField label="Threshold start">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScaleThresholdStart: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScaleThresholdStart}
                  />
                </FormField>
                <FormField label="Threshold end">
                  <TextInput
                    onChange={(event) => setPlanFormState((current) => ({ ...current, slidingScaleThresholdEnd: event.target.value }))}
                    readOnly={!canManageCommissions}
                    value={planFormState.slidingScaleThresholdEnd}
                  />
                </FormField>
                {canManageCommissions ? (
                  <div className="office-inline-form office-inline-form-compact office-form-grid-span-3">
                    <Button disabled={pendingAction === "save-plan"} type="submit">
                      {pendingAction === "save-plan" ? "Saving..." : "Save commission plan"}
                    </Button>
                  </div>
                ) : null}
              </form>

              <div className="office-queue-list">
                {snapshot.plans.map((plan) => (
                  <QueueItem
                    badgeLabel={`${plan.assignmentCount} assignments`}
                    description={plan.calculationMode}
                    key={plan.id}
                    meta={
                      <>
                        <span>{plan.rules.length} rules</span>
                      </>
                    }
                    title={plan.name}
                  />
                ))}
              </div>
            </ListPageSection>

            <ListPageSection subtitle="Attach active commission plans to agents or teams with explicit precedence." title="Plan assignments">
              <form className="office-inline-form office-inline-form-wrap" onSubmit={handleAssignPlan}>
                <FormField label="Assign to">
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
                    <option value="agent">Agent</option>
                    <option value="team">Team</option>
                  </SelectInput>
                </FormField>
                <FormField label="Agent">
                  <SelectInput
                    disabled={!canManageCommissions || assignmentFormState.targetType !== "agent"}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, membershipId: event.target.value }))}
                    value={assignmentFormState.membershipId}
                  >
                    <option value="">Select agent</option>
                    {snapshot.filters.memberOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Team">
                  <SelectInput
                    disabled={!canManageCommissions || assignmentFormState.targetType !== "team"}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, teamId: event.target.value }))}
                    value={assignmentFormState.teamId}
                  >
                    <option value="">Select team</option>
                    {snapshot.filters.teamOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Plan">
                  <SelectInput
                    disabled={!canManageCommissions}
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, commissionPlanId: event.target.value }))}
                    value={assignmentFormState.commissionPlanId}
                  >
                    <option value="">Select plan</option>
                    {filteredPlanOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Effective from">
                  <TextInput
                    onChange={(event) => setAssignmentFormState((current) => ({ ...current, effectiveFrom: event.target.value }))}
                    readOnly={!canManageCommissions}
                    type="date"
                    value={assignmentFormState.effectiveFrom}
                  />
                </FormField>
                <FormField label="Effective to">
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
                      {pendingAction === "assign-plan" ? "Assigning..." : "Assign plan"}
                    </Button>
                  </div>
                ) : null}
              </form>

              <p className="office-helper-copy">
                Direct agent assignments override team assignments. Team assignments apply only when no active direct assignment exists.
              </p>

              <CommissionTable>
                <div className="office-table-header office-table-row office-table-row-commission-assignments">
                  <span>Target</span>
                  <span>Type</span>
                  <span>Plan</span>
                  <span>Effective from</span>
                  <span>Effective to</span>
                </div>
                {snapshot.assignments.map((assignment) => (
                  <div className="office-table-row office-table-row-commission-assignments" key={assignment.id}>
                    <span>{assignment.targetLabel}</span>
                    <span>{assignment.targetType === "team" ? "Team" : "Agent"}</span>
                    <span>{assignment.commissionPlanLabel}</span>
                    <span>{assignment.effectiveFrom}</span>
                    <span>{assignment.effectiveTo || "Open-ended"}</span>
                  </div>
                ))}
              </CommissionTable>
            </ListPageSection>
          </div>

          <div className="office-side-stack">
            <ListPageSection subtitle="Persisted commission calculations, review queue, and payout-readiness workflow." title="Commission queue">
              <CommissionTable>
                <div className="office-table-header office-table-row office-table-row-commission">
                  <span>Transaction</span>
                  <span>Recipient</span>
                  <span>Plan</span>
                  <span>Status</span>
                  <span>Statement</span>
                  <span>Calculated</span>
                  <span>Actions</span>
                </div>

                {snapshot.calculations.map((row) => (
                  <div className="office-table-row office-table-row-commission" key={row.id}>
                    <div className="office-table-primary">
                      <strong>{row.transactionLabel}</strong>
                      <p>{row.recipientRole || row.recipientType}</p>
                    </div>
                    <span>{row.recipientLabel}</span>
                    <div className="office-table-primary">
                      <strong>{row.commissionPlanLabel}</strong>
                      <p>{row.commissionPlanDetailLabel}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>
                    <div className="office-table-primary">
                      <strong>{row.statementAmountLabel}</strong>
                      <p>
                        {row.officeNetLabel} office · {row.agentNetLabel} agent
                      </p>
                    </div>
                    <span>{row.calculatedAt}</span>
                    <div className="office-accounting-inline-actions">
                      {(canManageCommissions || canApproveCommissions) ? (
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
                            {commissionStatusUpdateOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
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
                            {pendingAction === `status:${row.id}` ? "Saving..." : "Save"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}

                {snapshot.calculations.length === 0 ? (
                  <div className="office-accounting-empty">
                    <p>No commission rows match the current filters.</p>
                  </div>
                ) : null}
              </CommissionTable>
            </ListPageSection>

            <ListPageSection subtitle="On-screen statement snapshot for the selected agent and current date window." title="Statement / payout readiness">
              {snapshot.statement ? (
                <>
                  <ListPageStatsGrid className="office-commission-kpi-grid">
                    <StatCard hint="agent currently selected for statement view" label="Agent" value={snapshot.statement.agentLabel} />
                    <StatCard hint="calculated + reviewed rows" label="Open calculated" value={snapshot.statement.openCalculatedLabel} />
                    <StatCard hint="rows ready for statement packaging" label="Statement ready" value={snapshot.statement.statementReadyLabel} />
                    <StatCard hint="rows marked payable" label="Payable" value={snapshot.statement.payableLabel} />
                    <StatCard hint="rows marked paid" label="Paid" value={snapshot.statement.paidLabel} />
                    <StatCard hint="sum of agent share rows in this snapshot" label="Agent net total" value={snapshot.statement.totalAgentNetLabel} />
                  </ListPageStatsGrid>
                  <div className="office-queue-list">
                    {snapshot.statement.lineItems.map((item) => (
                      <QueueItem
                        badge={<StatusBadge tone={getStatusTone(item.status)}>{item.status}</StatusBadge>}
                        description={item.statementAmountLabel}
                        key={item.id}
                        title={item.transactionLabel}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="office-accounting-empty">
                  <p>Select an agent and generate a statement snapshot to review payout-ready commission totals.</p>
                </div>
              )}
            </ListPageSection>
          </div>
        </div>

        {error ? <p className="office-form-error">{error}</p> : null}
          </div>
        </details>
      </ListPageSection>
    </section>
  );
}
