"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  ConfirmActionDialog,
  EmptyState,
  FormField,
  PageHeader,
  PageShell,
  QueueItem,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeAgentProfileSnapshot } from "@acre/db";

type AgentProfileClientProps = {
  snapshot: OfficeAgentProfileSnapshot;
  canManageAgents: boolean;
  canManageOnboarding: boolean;
  canManageGoals: boolean;
  canManageTeams: boolean;
};

type ProfileState = {
  displayName: string;
  bio: string;
  notes: string;
  licenseNumber: string;
  licenseState: string;
  startDate: string;
  splitTemplateId: string;
  customAgentPercent: string;
  commissionEffectiveFrom: string;
  commissionEffectiveTo: string;
  avatarUrl: string;
  internalExtension: string;
};

type OnboardingDraft = {
  title: string;
  description: string;
  category: string;
  dueAt: string;
  status: string;
};

type GoalDraft = {
  periodType: string;
  startsAt: string;
  endsAt: string;
  targetTransactionCount: string;
  targetClosedVolume: string;
  targetOfficeNet: string;
  targetAgentNet: string;
  notes: string;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function buildProfileState(snapshot: OfficeAgentProfileSnapshot): ProfileState {
  return {
    displayName: snapshot.profile.displayName,
    bio: snapshot.profile.bio,
    notes: snapshot.profile.notes,
    licenseNumber: snapshot.profile.licenseNumber,
    licenseState: snapshot.profile.licenseState,
    startDate: snapshot.profile.startDate,
    splitTemplateId: snapshot.defaultCommission.splitTemplateId,
    customAgentPercent: snapshot.defaultCommission.customAgentPercent,
    commissionEffectiveFrom: snapshot.defaultCommission.effectiveFrom || new Date().toISOString().slice(0, 10),
    commissionEffectiveTo: snapshot.defaultCommission.effectiveTo,
    avatarUrl: snapshot.profile.avatarUrl,
    internalExtension: snapshot.profile.internalExtension
  };
}

function getMembershipTone(value: OfficeAgentProfileSnapshot["profile"]["membershipStatusValue"]) {
  if (value === "active") {
    return "success" as const;
  }

  if (value === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getCommissionStatusTone(status: string) {
  if (status === "Paid" || status === "Payable") {
    return "success" as const;
  }

  if (status === "Statement ready" || status === "Reviewed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function buildOnboardingDraft(item: OfficeAgentProfileSnapshot["onboarding"]["items"][number]): OnboardingDraft {
  return {
    title: item.title,
    description: item.description,
    category: item.category,
    dueAt: item.dueAt,
    status: item.statusValue
  };
}

function buildGoalDraft(goal: OfficeAgentProfileSnapshot["goals"][number]): GoalDraft {
  return {
    periodType: goal.periodType.toLowerCase(),
    startsAt: goal.startsAt,
    endsAt: goal.endsAt,
    targetTransactionCount: goal.targetTransactionCount === "—" ? "" : goal.targetTransactionCount,
    targetClosedVolume: goal.targetClosedVolume === "—" ? "" : goal.targetClosedVolume.replace(/[$,]/g, ""),
    targetOfficeNet: goal.targetOfficeNet === "—" ? "" : goal.targetOfficeNet.replace(/[$,]/g, ""),
    targetAgentNet: goal.targetAgentNet === "—" ? "" : goal.targetAgentNet.replace(/[$,]/g, ""),
    notes: goal.notes
  };
}

function buildEmptyGoalDraft(): GoalDraft {
  const currentYear = new Date().getFullYear();
  return {
    periodType: "annual",
    startsAt: `${currentYear}-01-01`,
    endsAt: `${currentYear}-12-31`,
    targetTransactionCount: "",
    targetClosedVolume: "",
    targetOfficeNet: "",
    targetAgentNet: "",
    notes: ""
  };
}

function buildEmptyOnboardingDraft(): OnboardingDraft {
  return {
    title: "",
    description: "",
    category: "General",
    dueAt: "",
    status: "pending"
  };
}

function getAssignableTeams(snapshot: OfficeAgentProfileSnapshot) {
  return snapshot.availableTeams.filter((team) => !snapshot.teams.some((assigned) => assigned.id === team.id));
}

export function AgentProfileClient({
  snapshot,
  canManageAgents,
  canManageOnboarding,
  canManageGoals,
  canManageTeams
}: AgentProfileClientProps) {
  const router = useRouter();
  const [profileState, setProfileState] = useState<ProfileState>(buildProfileState(snapshot));
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedReportsToTeamMembershipId, setSelectedReportsToTeamMembershipId] = useState("");
  const [newOnboardingItem, setNewOnboardingItem] = useState<OnboardingDraft>(buildEmptyOnboardingDraft);
  const [newGoal, setNewGoal] = useState<GoalDraft>(buildEmptyGoalDraft);
  const [onboardingDrafts, setOnboardingDrafts] = useState<Record<string, OnboardingDraft>>(
    Object.fromEntries(snapshot.onboarding.items.map((item) => [item.id, buildOnboardingDraft(item)]))
  );
  const [goalDrafts, setGoalDrafts] = useState<Record<string, GoalDraft>>(
    Object.fromEntries(snapshot.goals.map((goal) => [goal.id, buildGoalDraft(goal)]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const availableTeamOptions = useMemo(
    () => getAssignableTeams(snapshot),
    [snapshot.availableTeams, snapshot.teams]
  );
  const selectedTeamOption = useMemo(
    () => availableTeamOptions.find((team) => team.id === selectedTeamId) ?? null,
    [availableTeamOptions, selectedTeamId]
  );

  useEffect(() => {
    const teamStillAvailable = selectedTeamId ? availableTeamOptions.some((team) => team.id === selectedTeamId) : true;

    if (!teamStillAvailable) {
      setSelectedTeamId("");
      setSelectedReportsToTeamMembershipId("");
      return;
    }

    if (!selectedTeamOption) {
      if (selectedReportsToTeamMembershipId) {
        setSelectedReportsToTeamMembershipId("");
      }
      return;
    }

    const managerStillAvailable = selectedTeamOption.managerOptions.some(
      (manager) => manager.teamMembershipId === selectedReportsToTeamMembershipId
    );

    if (!managerStillAvailable) {
      setSelectedReportsToTeamMembershipId(selectedTeamOption.defaultReportsToTeamMembershipId ?? "");
    }
  }, [availableTeamOptions, selectedReportsToTeamMembershipId, selectedTeamId, selectedTeamOption]);

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfileState((current) => ({ ...current, [field]: value }));
  }

  function handleSelectedTeamChange(nextTeamId: string) {
    setSelectedTeamId(nextTeamId);
    const nextTeam = availableTeamOptions.find((team) => team.id === nextTeamId) ?? null;
    setSelectedReportsToTeamMembershipId(nextTeam?.defaultReportsToTeamMembershipId ?? "");
  }

  function setOnboardingField(itemId: string, field: keyof OnboardingDraft, value: string) {
    setOnboardingDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? buildEmptyOnboardingDraft()),
        [field]: value
      }
    }));
  }

  function setGoalField(goalId: string, field: keyof GoalDraft, value: string) {
    setGoalDrafts((current) => ({
      ...current,
      [goalId]: {
        ...(current[goalId] ?? buildEmptyGoalDraft()),
        [field]: value
      }
    }));
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("profile");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profileState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save profile.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAssignTeam() {
    if (!selectedTeamId) {
      return;
    }

    setPendingAction("assign-team");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${selectedTeamId}/memberships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: snapshot.profile.membershipId,
          role: "member",
          reportsToTeamMembershipId: selectedReportsToTeamMembershipId || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to add agent to team.");
      }

      router.refresh();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to add agent to team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveTeam(teamId: string) {
    setPendingAction(`remove-team:${teamId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}/memberships/${snapshot.profile.membershipId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to remove agent from team.");
      }

      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove agent from team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateOnboardingItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-onboarding");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/onboarding-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newOnboardingItem)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create onboarding item.");
      }

      setNewOnboardingItem(buildEmptyOnboardingDraft());
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create onboarding item.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleApplyOnboardingTemplate() {
    setPendingAction("apply-onboarding-template");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/onboarding-template`, {
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to apply onboarding template.");
      }

      router.refresh();
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Failed to apply onboarding template.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveOnboardingItem(itemId: string) {
    setPendingAction(`save-onboarding:${itemId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/onboarding-items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(onboardingDrafts[itemId])
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update onboarding item.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update onboarding item.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-goal");
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/goals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newGoal)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create goal.");
      }

      setNewGoal(buildEmptyGoalDraft());
      router.refresh();
    } catch (goalError) {
      setError(goalError instanceof Error ? goalError.message : "Failed to create goal.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveGoal(goalId: string) {
    setPendingAction(`save-goal:${goalId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/goals/${goalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(goalDrafts[goalId])
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update goal.");
      }

      router.refresh();
    } catch (goalError) {
      setError(goalError instanceof Error ? goalError.message : "Failed to update goal.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <PageShell className="office-agent-profile-page">
      <PageHeader
        actions={
          <>
            <Badge tone="neutral">{snapshot.profile.officeName}</Badge>
            <StatusBadge tone={getMembershipTone(snapshot.profile.membershipStatusValue)}>{snapshot.profile.membershipStatus}</StatusBadge>
            <StatusBadge tone={snapshot.profile.onboardingStatusValue === "complete" ? "success" : snapshot.profile.onboardingStatusValue === "in_progress" ? "accent" : "warning"}>
              {snapshot.profile.onboardingStatus}
            </StatusBadge>
            <Link className="office-button-secondary" href="/office/agents">
              Back to agents
            </Link>
          </>
        }
        description={`${snapshot.profile.email} · ${snapshot.profile.role}${snapshot.profile.title ? ` · ${snapshot.profile.title}` : ""}`}
        eyebrow="Agent profile"
        title={snapshot.profile.displayName}
      />

      <section className="office-kpi-grid office-agents-kpi-grid">
        <StatCard hint="currently open or in-progress" label="Active tasks" value={snapshot.summary.activeTaskCount} />
        <StatCard hint="next onboarding and task due items" label="Operational agenda" value={snapshot.summary.operationalAgendaCount} />
        <StatCard hint="opportunity + active + pending" label="Open transactions" value={snapshot.summary.openTransactionCount} />
        <StatCard hint="closed in the recent 90-day window" label="Recent closed" value={snapshot.summary.recentClosedTransactionCount} />
        <StatCard hint="from agent billing foundation" label="Current balance" value={snapshot.summary.currentBalanceLabel} />
        <StatCard hint="open + pending agent billing charges" label="Open / pending charges" value={`${snapshot.summary.openChargesCount} / ${snapshot.summary.pendingChargesCount}`} />
        <StatCard hint="configured payment methods on file" label="Payment methods" value={snapshot.summary.paymentMethodsCount} />
        <StatCard hint="current active goal snapshot" label="Goal progress" value={snapshot.summary.currentGoalSummary} />
      </section>

      <SectionCard subtitle="Back-office profile, licensing, default commission split, and internal operating metadata for this agent membership." title="Profile basics">
        <form className="office-detail-grid" onSubmit={handleProfileSave}>
          <FormField className="office-detail-field" label="Display name">
            <TextInput onChange={(event) => setProfileField("displayName", event.target.value)} readOnly={!canManageAgents} value={profileState.displayName} />
          </FormField>
          <FormField className="office-detail-field" label="License number">
            <TextInput onChange={(event) => setProfileField("licenseNumber", event.target.value)} readOnly={!canManageAgents} value={profileState.licenseNumber} />
          </FormField>
          <FormField className="office-detail-field" label="License state">
            <TextInput onChange={(event) => setProfileField("licenseState", event.target.value)} readOnly={!canManageAgents} value={profileState.licenseState} />
          </FormField>
          <FormField className="office-detail-field" label="Start date">
            <TextInput onChange={(event) => setProfileField("startDate", event.target.value)} readOnly={!canManageAgents} type="date" value={profileState.startDate} />
          </FormField>
            <FormField className="office-detail-field" label="Default split template">
              <SelectInput
                disabled={!canManageAgents}
                onChange={(event) =>
                  setProfileState((current) => ({
                    ...current,
                    splitTemplateId: event.target.value,
                    customAgentPercent: event.target.value ? "" : current.customAgentPercent
                  }))
                }
                value={profileState.splitTemplateId}
              >
                <option value="">Custom split</option>
                {snapshot.defaultCommission.templateOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.agentPercent}/{option.companyPercent})
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField className="office-detail-field" label="Custom agent split %">
              <TextInput
                onChange={(event) =>
                  setProfileState((current) => ({
                    ...current,
                    customAgentPercent: event.target.value,
                    splitTemplateId: event.target.value.trim() ? "" : current.splitTemplateId
                  }))
                }
                placeholder="Example: 50"
                readOnly={!canManageAgents}
                value={profileState.customAgentPercent}
              />
            </FormField>
            <FormField className="office-detail-field" label="Split effective from">
              <TextInput
                onChange={(event) => setProfileField("commissionEffectiveFrom", event.target.value)}
                readOnly={!canManageAgents}
                type="date"
                value={profileState.commissionEffectiveFrom}
              />
            </FormField>
            <FormField className="office-detail-field" label="Internal extension">
              <TextInput onChange={(event) => setProfileField("internalExtension", event.target.value)} readOnly={!canManageAgents} value={profileState.internalExtension} />
            </FormField>
            <div className="office-detail-field">
              <span>Current default split</span>
              <strong>{snapshot.defaultCommission.settingLabel || snapshot.profile.commissionPlanName || "Not configured"}</strong>
              <p>{snapshot.defaultCommission.sourceLabel || "Choose a template or enter a custom split."}</p>
            </div>
          <FormField className="office-detail-field office-detail-field-wide" label="Bio">
            <TextareaInput onChange={(event) => setProfileField("bio", event.target.value)} readOnly={!canManageAgents} value={profileState.bio} />
          </FormField>
          <FormField className="office-detail-field office-detail-field-wide" label="Notes">
            <TextareaInput onChange={(event) => setProfileField("notes", event.target.value)} readOnly={!canManageAgents} value={profileState.notes} />
          </FormField>
          {canManageAgents ? (
            <div className="office-form-actions">
              <Button disabled={pendingAction === "profile"} type="submit">
                {pendingAction === "profile" ? "Saving..." : "Save profile"}
              </Button>
            </div>
          ) : null}
        </form>
      </SectionCard>

      <div className="office-detail-two-column">
        <SectionCard subtitle="Team memberships for this agent. Add or remove roster assignments here." title="Teams">
          <div className="office-agents-profile-team-list">
            {snapshot.teams.map((team) => (
              <div className="office-agents-profile-team-row" key={team.id}>
                <div>
                  <Link href={`/office/agents?teamId=${team.id}`}>{team.name}</Link>
                  <p>
                    {team.role}
                    {team.reportsToLabel !== "No direct manager" ? ` · Reports to ${team.reportsToLabel}` : ""}
                  </p>
                </div>
                <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                {canManageTeams ? (
                  <Button
                    disabled={pendingAction === `remove-team:${team.id}`}
                    onClick={() =>
                      setConfirmDialog({
                        title: `Remove ${snapshot.profile.displayName} from ${team.name}?`,
                        description: "This will remove the agent's current assignment to this team.",
                        confirmLabel: "Remove from team",
                        onConfirm: () => {
                          void handleRemoveTeam(team.id);
                        }
                      })
                    }
                    size="sm"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {snapshot.teams.length === 0 ? <p className="office-form-helper">No team assignments yet.</p> : null}
          </div>

          {canManageTeams && availableTeamOptions.length ? (
            <div className="office-inline-form">
              <FormField label="Team">
                <SelectInput onChange={(event) => handleSelectedTeamChange(event.target.value)} value={selectedTeamId}>
                  <option value="">Select team to assign</option>
                  {availableTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Direct manager">
                <SelectInput
                  disabled={!selectedTeamOption || selectedTeamOption.managerOptions.length === 0}
                  onChange={(event) => setSelectedReportsToTeamMembershipId(event.target.value)}
                  value={selectedReportsToTeamMembershipId}
                >
                  <option value="">No direct manager</option>
                  {(selectedTeamOption?.managerOptions ?? []).map((manager) => (
                    <option key={manager.teamMembershipId} value={manager.teamMembershipId}>
                      {manager.label} · {manager.role}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <Button disabled={!selectedTeamId || pendingAction === "assign-team"} onClick={handleAssignTeam} type="button">
                {pendingAction === "assign-team" ? "Assigning..." : "Add to team"}
              </Button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard subtitle="Current pipeline, billing, and workload visibility derived from real transactions, tasks, and billing records." title="Operational summary">
          <div className="office-agents-profile-summary-grid">
            {snapshot.summary.pipelineCounts.map((metric) => (
              <StatCard hint="current pipeline count" key={metric.label} label={metric.label} value={metric.count} />
            ))}
            <StatCard hint="current open charges in billing" label="Open charges" value={snapshot.summary.openChargesCount} />
            <StatCard hint="not yet posted or due billing items" label="Pending charges" value={snapshot.summary.pendingChargesCount} />
          </div>

          <div className="office-detail-two-column office-agents-profile-secondary-columns">
            <dl className="office-secondary-meta-list office-agents-operational-facts">
              <div className="office-secondary-meta-row">
                <dt>Current goal summary</dt>
                <dd>{snapshot.summary.currentGoalSummary}</dd>
              </div>
              <div className="office-secondary-meta-row">
                <dt>Current balance</dt>
                <dd>{snapshot.summary.currentBalanceLabel}</dd>
              </div>
              <div className="office-secondary-meta-row">
                <dt>Payment methods</dt>
                <dd>{snapshot.summary.paymentMethodsCount}</dd>
              </div>
              <div className="office-secondary-meta-row">
                <dt>Membership status</dt>
                <dd>{snapshot.profile.membershipStatus}</dd>
              </div>
            </dl>

            <section aria-label="Operational agenda" className="office-agents-agenda-panel">
              <div className="office-agents-agenda-head">
                <strong>Operational agenda</strong>
                <span>{snapshot.operationalAgenda.length} current items</span>
              </div>
              <div className="office-agents-agenda-list">
                {snapshot.operationalAgenda.map((item) => (
                  <article className="office-agents-agenda-item" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.kind}</p>
                    </div>
                    <div className="office-agents-agenda-item-meta">
                      <StatusBadge tone={item.statusLabel === "Completed" ? "success" : item.statusLabel === "Pending" ? "warning" : "accent"}>
                        {item.statusLabel}
                      </StatusBadge>
                      <small>{item.dueAtLabel}</small>
                      {item.href ? <Link href={item.href}>Open</Link> : null}
                    </div>
                  </article>
                ))}
                {snapshot.operationalAgenda.length === 0 ? (
                  <p className="office-form-helper">No urgent onboarding or transaction workload items right now.</p>
                ) : null}
              </div>
            </section>
          </div>
        </SectionCard>
      </div>

      <SectionCard subtitle="Default split, recent calculated rows, and payout-readiness visibility for this agent." title="Commission summary">
        {snapshot.financialsRestricted ? (
          <p className="office-form-helper">Commission and payout amounts are restricted for your current access level on this profile.</p>
        ) : null}
        <div className="office-agents-profile-summary-grid">
          <StatCard hint="default split used for normal transaction commission calculation" label="Default split" value={snapshot.commissions.defaultSplitLabel || "Not configured"} />
          <StatCard hint="rows already in statement-ready status" label="Statement ready" value={snapshot.commissions.statementReadyLabel} />
          <StatCard hint="rows that can move into payout handling" label="Payable" value={snapshot.commissions.payableLabel} />
          <StatCard hint="rows already marked paid in the commission workflow" label="Paid" value={snapshot.commissions.paidLabel} />
        </div>

        {snapshot.commissions.defaultSplitSourceLabel ? (
          <p className="office-form-helper">Default split source: {snapshot.commissions.defaultSplitSourceLabel}</p>
        ) : null}

        {snapshot.commissions.recentCalculations.length ? (
          <div className="office-queue-list">
            {snapshot.commissions.recentCalculations.map((calculation) => (
              <QueueItem
                badge={<StatusBadge tone={getCommissionStatusTone(calculation.status)}>{calculation.status}</StatusBadge>}
                description={calculation.recipientLabel}
                key={calculation.id}
                meta={
                  <>
                    <span>{calculation.statementAmountLabel}</span>
                  </>
                }
                title={<Link href={calculation.transactionHref}>{calculation.transactionLabel}</Link>}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No commission calculations yet" description="No commission calculations have been recorded for this agent yet." />
        )}
      </SectionCard>

      <section id="onboarding">
        <SectionCard
          actions={
            <>
              <Badge tone="neutral">{snapshot.onboarding.templateDefaultsCount} template defaults</Badge>
              {canManageOnboarding ? (
                <Button
                  disabled={pendingAction === "apply-onboarding-template"}
                  onClick={handleApplyOnboardingTemplate}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {pendingAction === "apply-onboarding-template" ? "Applying..." : "Apply standard onboarding"}
                </Button>
              ) : null}
            </>
          }
          subtitle="Back-office onboarding checklist for this agent. Completion updates the profile onboarding status automatically."
          title="Onboarding"
        >
        <div className="office-agents-onboarding-summary">
          <StatusBadge tone={snapshot.onboarding.statusLabel === "Complete" ? "success" : snapshot.onboarding.statusLabel === "In progress" ? "accent" : "warning"}>
            {snapshot.onboarding.statusLabel}
          </StatusBadge>
          <span>
            {snapshot.onboarding.completedCount} of {snapshot.onboarding.totalCount} items complete
          </span>
        </div>

        <div className="office-agents-template-list">
          {snapshot.onboarding.templateDefaults.map((item) => (
            <article className="office-agents-template-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.category}
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </div>
              <small>{item.dueDaysOffsetLabel}</small>
            </article>
          ))}
          {snapshot.onboarding.templateDefaults.length === 0 ? (
            <p className="office-form-helper">No reusable onboarding defaults configured for this office yet.</p>
          ) : null}
        </div>

        <div className="office-agents-onboarding-list">
          {snapshot.onboarding.items.map((item) => {
            const draft = onboardingDrafts[item.id] ?? buildOnboardingDraft(item);
            return (
              <form
                className="office-section-card office-agents-onboarding-card"
                key={item.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSaveOnboardingItem(item.id);
                }}
              >
                <div className="office-section-body">
                  <div className="office-agents-onboarding-card-head">
                    <FormField className="office-agents-onboarding-title" label="Title">
                      <TextInput onChange={(event) => setOnboardingField(item.id, "title", event.target.value)} readOnly={!canManageOnboarding} value={draft.title} />
                    </FormField>
                    <StatusBadge tone={item.statusValue === "completed" ? "success" : item.statusValue === "in_progress" ? "accent" : item.statusValue === "reopened" ? "warning" : "neutral"}>
                      {item.status}
                    </StatusBadge>
                  </div>
                  <div className="office-form-grid office-form-grid-3">
                    <FormField label="Category">
                      <TextInput onChange={(event) => setOnboardingField(item.id, "category", event.target.value)} readOnly={!canManageOnboarding} value={draft.category} />
                    </FormField>
                    <FormField label="Due date">
                      <TextInput onChange={(event) => setOnboardingField(item.id, "dueAt", event.target.value)} readOnly={!canManageOnboarding} type="date" value={draft.dueAt} />
                    </FormField>
                    <FormField label="Status">
                      <SelectInput disabled={!canManageOnboarding} onChange={(event) => setOnboardingField(item.id, "status", event.target.value)} value={draft.status}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="reopened">Reopened</option>
                      </SelectInput>
                    </FormField>
                    <FormField className="office-form-grid-span-3" label="Description">
                      <TextareaInput onChange={(event) => setOnboardingField(item.id, "description", event.target.value)} readOnly={!canManageOnboarding} value={draft.description} />
                    </FormField>
                  </div>
                  <div className="office-inline-meta">
                    <span>Completed at: {item.completedAt || "—"}</span>
                    <span>Completed by: {item.completedByName || "—"}</span>
                  </div>
                  {canManageOnboarding ? (
                    <div className="office-inline-form office-inline-form-compact">
                      <Button disabled={pendingAction === `save-onboarding:${item.id}`} size="sm" type="submit">
                        {pendingAction === `save-onboarding:${item.id}` ? "Saving..." : "Save item"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </form>
            );
          })}
        </div>

        {canManageOnboarding ? (
          <form className="office-section-card office-agents-onboarding-create" onSubmit={handleCreateOnboardingItem}>
            <div className="office-section-body">
              <div className="office-form-grid office-form-grid-3">
                <FormField label="Title">
                  <TextInput onChange={(event) => setNewOnboardingItem((current) => ({ ...current, title: event.target.value }))} value={newOnboardingItem.title} />
                </FormField>
                <FormField label="Category">
                  <TextInput onChange={(event) => setNewOnboardingItem((current) => ({ ...current, category: event.target.value }))} value={newOnboardingItem.category} />
                </FormField>
                <FormField label="Due date">
                  <TextInput onChange={(event) => setNewOnboardingItem((current) => ({ ...current, dueAt: event.target.value }))} type="date" value={newOnboardingItem.dueAt} />
                </FormField>
                <FormField className="office-form-grid-span-3" label="Description">
                  <TextareaInput onChange={(event) => setNewOnboardingItem((current) => ({ ...current, description: event.target.value }))} value={newOnboardingItem.description} />
                </FormField>
              </div>
              <div className="office-inline-form office-inline-form-compact">
                <Button disabled={pendingAction === "create-onboarding"} type="submit">
                  {pendingAction === "create-onboarding" ? "Creating..." : "Add onboarding item"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
        </SectionCard>
      </section>

      <section id="goals">
        <SectionCard subtitle="Simple performance goals with actuals derived from current transaction and billing data." title="Goals">
        <div className="office-agents-goals-grid">
          {snapshot.goals.map((goal) => {
            const draft = goalDrafts[goal.id] ?? buildGoalDraft(goal);
            return (
              <form
                className="office-section-card office-agents-goal-card"
                key={goal.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSaveGoal(goal.id);
                }}
              >
                <div className="office-section-body">
                  <div className="office-agents-goal-card-head">
                    <strong>{goal.periodType} goal</strong>
                    <span>
                      {goal.startsAt} to {goal.endsAt}
                    </span>
                  </div>
                  <div className="office-form-grid office-form-grid-3">
                    <FormField label="Period">
                      <SelectInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "periodType", event.target.value)} value={draft.periodType}>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </SelectInput>
                    </FormField>
                    <FormField label="Starts at">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "startsAt", event.target.value)} type="date" value={draft.startsAt} />
                    </FormField>
                    <FormField label="Ends at">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "endsAt", event.target.value)} type="date" value={draft.endsAt} />
                    </FormField>
                    <FormField label="Target transactions">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "targetTransactionCount", event.target.value)} value={draft.targetTransactionCount} />
                    </FormField>
                    <FormField label="Target closed volume">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "targetClosedVolume", event.target.value)} value={draft.targetClosedVolume} />
                    </FormField>
                    <FormField label="Target office net">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "targetOfficeNet", event.target.value)} value={draft.targetOfficeNet} />
                    </FormField>
                    <FormField label="Target agent net">
                      <TextInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "targetAgentNet", event.target.value)} value={draft.targetAgentNet} />
                    </FormField>
                    <FormField className="office-form-grid-span-2" label="Notes">
                      <TextareaInput disabled={!canManageGoals} onChange={(event) => setGoalField(goal.id, "notes", event.target.value)} value={draft.notes} />
                    </FormField>
                  </div>
                  <div className="office-secondary-meta-list">
                    <div className="office-secondary-meta-row">
                      <dt>Actual transactions</dt>
                      <dd>{goal.actualTransactionCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Actual closed volume</dt>
                      <dd>{goal.actualClosedVolume}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Actual office net</dt>
                      <dd>{goal.actualOfficeNet}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>Actual agent net</dt>
                      <dd>{goal.actualAgentNet}</dd>
                    </div>
                  </div>
                  {canManageGoals ? (
                    <div className="office-inline-form office-inline-form-compact">
                      <Button disabled={pendingAction === `save-goal:${goal.id}`} size="sm" type="submit">
                        {pendingAction === `save-goal:${goal.id}` ? "Saving..." : "Save goal"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </form>
            );
          })}
          {snapshot.goals.length === 0 ? <p className="office-form-helper">No goals set yet.</p> : null}
        </div>

        {canManageGoals ? (
          <form className="office-section-card office-agents-goal-create" onSubmit={handleCreateGoal}>
            <div className="office-section-body">
              <div className="office-form-grid office-form-grid-3">
                <FormField label="Period">
                  <SelectInput onChange={(event) => setNewGoal((current) => ({ ...current, periodType: event.target.value }))} value={newGoal.periodType}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </SelectInput>
                </FormField>
                <FormField label="Starts at">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, startsAt: event.target.value }))} type="date" value={newGoal.startsAt} />
                </FormField>
                <FormField label="Ends at">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, endsAt: event.target.value }))} type="date" value={newGoal.endsAt} />
                </FormField>
                <FormField label="Target transactions">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, targetTransactionCount: event.target.value }))} value={newGoal.targetTransactionCount} />
                </FormField>
                <FormField label="Target closed volume">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, targetClosedVolume: event.target.value }))} value={newGoal.targetClosedVolume} />
                </FormField>
                <FormField label="Target office net">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, targetOfficeNet: event.target.value }))} value={newGoal.targetOfficeNet} />
                </FormField>
                <FormField label="Target agent net">
                  <TextInput onChange={(event) => setNewGoal((current) => ({ ...current, targetAgentNet: event.target.value }))} value={newGoal.targetAgentNet} />
                </FormField>
                <FormField className="office-form-grid-span-2" label="Notes">
                  <TextareaInput onChange={(event) => setNewGoal((current) => ({ ...current, notes: event.target.value }))} value={newGoal.notes} />
                </FormField>
              </div>
              <div className="office-inline-form office-inline-form-compact">
                <Button disabled={pendingAction === "create-goal"} type="submit">
                  {pendingAction === "create-goal" ? "Creating..." : "Add goal"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
        </SectionCard>
      </section>

      <div className="office-detail-two-column">
        <SectionCard subtitle="Most recent transaction work currently owned by this agent." title="Recent transactions">
          {snapshot.recentTransactions.length ? (
            <div className="office-queue-list">
              {snapshot.recentTransactions.map((transaction) => (
                <QueueItem
                  badgeLabel={transaction.status}
                  description={transaction.priceLabel}
                  key={transaction.id}
                  title={<Link href={transaction.href}>{transaction.label}</Link>}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No recent transactions yet" />
          )}
        </SectionCard>

        <SectionCard subtitle="Latest audit log items tied to this membership." title="Recent activity">
          {snapshot.recentActivity.length ? (
            <div className="office-queue-list">
              {snapshot.recentActivity.map((item) => (
                <QueueItem
                  description={item.objectLabel}
                  key={item.id}
                  meta={
                    <>
                      <span>{item.timestampLabel}</span>
                    </>
                  }
                  title={item.actionLabel}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity yet" />
          )}
        </SectionCard>
      </div>

      {error ? <p className="office-form-error">{error}</p> : null}

      <ConfirmActionDialog
        cancelLabel="Keep assignment"
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </PageShell>
  );
}
