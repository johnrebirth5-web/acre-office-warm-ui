"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeAgentProfileSnapshot } from "@acre/db";
import { UserTeamAssignmentsCard } from "./user-team-assignments-card";

type UserOperationsDetailSectionsProps = {
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
  bankPayeeName: string;
  bankFirstName: string;
  bankLastName: string;
  bankEmail: string;
  bankAddress: string;
  bankName: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  bankPhoneNumber: string;
  bankTaxIdType: string;
  bankTaxIdValue: string;
  bankDateOfBirth: string;
  bankAccountType: string;
};

type ProfileBasicsTab = "profile" | "bank";

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
    commissionEffectiveFrom: snapshot.defaultCommission.effectiveFrom,
    commissionEffectiveTo: snapshot.defaultCommission.effectiveTo,
    avatarUrl: snapshot.profile.avatarUrl,
    internalExtension: snapshot.profile.internalExtension,
    bankPayeeName: snapshot.bankInformation.payeeName,
    bankFirstName: snapshot.bankInformation.firstName,
    bankLastName: snapshot.bankInformation.lastName,
    bankEmail: snapshot.bankInformation.email,
    bankAddress: snapshot.bankInformation.address,
    bankName: snapshot.bankInformation.bankName,
    bankAccountNumber: snapshot.bankInformation.accountNumber,
    bankRoutingNumber: snapshot.bankInformation.routingNumber,
    bankPhoneNumber: snapshot.bankInformation.phoneNumber,
    bankTaxIdType: snapshot.bankInformation.taxIdType,
    bankTaxIdValue: snapshot.bankInformation.taxIdValue,
    bankDateOfBirth: snapshot.bankInformation.dateOfBirth,
    bankAccountType: snapshot.bankInformation.accountType
  };
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

function getCommissionStatusTone(status: string) {
  if (status === "Paid" || status === "Payable") {
    return "success" as const;
  }

  if (status === "Statement ready" || status === "Reviewed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getLicenseExpirationStatus(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return {
      tone: "neutral" as const,
      badge: "Not set",
      summary: "No expiration date recorded",
      detail: "Add an expiration date to automatically track renewal timing for this agent."
    };
  }

  const parsed = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return {
      tone: "warning" as const,
      badge: "Needs review",
      summary: "Expiration date could not be read",
      detail: "Enter a valid expiration date to calculate the renewal timing."
    };
  }

  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expirationUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const daysUntilExpiration = Math.round((expirationUtc - startOfTodayUtc) / 86_400_000);
  const expirationDateLabel = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });

  if (daysUntilExpiration < 0) {
    const daysSinceExpiration = Math.abs(daysUntilExpiration);

    return {
      tone: "danger" as const,
      badge: "Expired",
      summary: daysSinceExpiration === 1 ? "Expired 1 day ago" : `Expired ${daysSinceExpiration} days ago`,
      detail: `License expiration date was ${expirationDateLabel}.`
    };
  }

  if (daysUntilExpiration === 0) {
    return {
      tone: "warning" as const,
      badge: "Today",
      summary: "Expires today",
      detail: `License expiration date is ${expirationDateLabel}.`
    };
  }

  if (daysUntilExpiration === 1) {
    return {
      tone: "warning" as const,
      badge: "Tomorrow",
      summary: "Expires tomorrow",
      detail: `License expiration date is ${expirationDateLabel}.`
    };
  }

  if (daysUntilExpiration <= 30) {
    return {
      tone: "warning" as const,
      badge: "Renew soon",
      summary: `Expires in ${daysUntilExpiration} days`,
      detail: `License expiration date is ${expirationDateLabel}.`
    };
  }

  if (daysUntilExpiration <= 90) {
    return {
      tone: "accent" as const,
      badge: "Upcoming",
      summary: `${daysUntilExpiration} days remaining`,
      detail: `License expiration date is ${expirationDateLabel}.`
    };
  }

  return {
    tone: "success" as const,
    badge: "Active",
    summary: `${daysUntilExpiration} days remaining`,
    detail: `License expiration date is ${expirationDateLabel}.`
  };
}

function supportsTeamHierarchy(roleValue: string) {
  return roleValue === "agent" || roleValue === "team_lead";
}

const bankTaxIdTypeOptions = [
  { value: "ssn", label: "SSN" },
  { value: "ein", label: "EIN" }
] as const;

const bankAccountTypeOptions = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "business_checking", label: "Business checking" },
  { value: "business_savings", label: "Business savings" },
  { value: "other", label: "Other" }
] as const;

export function UserOperationsDetailSections({
  snapshot,
  canManageAgents,
  canManageOnboarding,
  canManageGoals,
  canManageTeams
}: UserOperationsDetailSectionsProps) {
  const router = useRouter();
  const canViewBankInformation = snapshot.bankInformation.canView;
  const canManageBankInformation = snapshot.bankInformation.canManage;
  const [profileState, setProfileState] = useState<ProfileState>(buildProfileState(snapshot));
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileBasicsTab>(() =>
    canManageAgents || !canViewBankInformation ? "profile" : "bank"
  );
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
  const teamAssignmentLockedReason =
    canManageTeams && !supportsTeamHierarchy(snapshot.profile.roleValue)
      ? "Only Agent / Team Lead accounts can be added to Teams / Junior Teams. Update the account role in Settings > Users first."
      : null;
  const licenseExpirationStatus = getLicenseExpirationStatus(profileState.startDate);

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfileState((current) => ({ ...current, [field]: value }));
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
      const commissionFieldsChanged =
        profileState.splitTemplateId !== snapshot.defaultCommission.splitTemplateId ||
        profileState.customAgentPercent !== snapshot.defaultCommission.customAgentPercent ||
        profileState.commissionEffectiveFrom !== snapshot.defaultCommission.effectiveFrom ||
        profileState.commissionEffectiveTo !== snapshot.defaultCommission.effectiveTo;
      const shouldSubmitCommissionFields =
        commissionFieldsChanged &&
        (Boolean(profileState.splitTemplateId.trim()) ||
          Boolean(profileState.customAgentPercent.trim()) ||
          Boolean(snapshot.defaultCommission.settingLabel));
      const effectiveFromValue = shouldSubmitCommissionFields
        ? profileState.commissionEffectiveFrom ||
          snapshot.defaultCommission.effectiveFrom ||
          new Date().toISOString().slice(0, 10)
        : undefined;
      const profilePayload = {
        ...profileState,
        ...(shouldSubmitCommissionFields
          ? {
              commissionEffectiveFrom: effectiveFromValue,
              commissionEffectiveTo: profileState.commissionEffectiveTo,
              splitTemplateId: profileState.splitTemplateId,
              customAgentPercent: profileState.customAgentPercent
            }
          : {
              commissionEffectiveFrom: undefined,
              commissionEffectiveTo: undefined,
              splitTemplateId: undefined,
              customAgentPercent: undefined
            })
      };
      const response = await fetch(`/api/office/agents/${snapshot.profile.membershipId}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profilePayload)
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
    <>
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

      <section id="profile">
        <SectionCard subtitle="Back-office profile, licensing, default commission split, and internal operating metadata for this membership." title="Profile basics">
          <form className="office-profile-basics-form" onSubmit={handleProfileSave}>
            {canViewBankInformation ? (
              <div aria-label="Profile basics sections" className="office-profile-basics-tabs" role="tablist">
                <button
                  aria-selected={activeProfileTab === "profile"}
                  className={activeProfileTab === "profile" ? "office-profile-basics-tab is-active" : "office-profile-basics-tab"}
                  onClick={() => setActiveProfileTab("profile")}
                  role="tab"
                  type="button"
                >
                  Profile basics
                </button>
                <button
                  aria-selected={activeProfileTab === "bank"}
                  className={activeProfileTab === "bank" ? "office-profile-basics-tab is-active" : "office-profile-basics-tab"}
                  onClick={() => setActiveProfileTab("bank")}
                  role="tab"
                  type="button"
                >
                  Bank information
                </button>
              </div>
            ) : null}

            {activeProfileTab === "profile" ? (
              <div className="office-detail-grid office-profile-basics-panel" role="tabpanel">
                <FormField className="office-detail-field" label="Display name">
                  <TextInput onChange={(event) => setProfileField("displayName", event.target.value)} readOnly={!canManageAgents} value={profileState.displayName} />
                </FormField>
                <FormField className="office-detail-field" label="License number">
                  <TextInput onChange={(event) => setProfileField("licenseNumber", event.target.value)} readOnly={!canManageAgents} value={profileState.licenseNumber} />
                </FormField>
                <FormField className="office-detail-field" label="License state">
                  <TextInput onChange={(event) => setProfileField("licenseState", event.target.value)} readOnly={!canManageAgents} value={profileState.licenseState} />
                </FormField>
                <FormField className="office-detail-field" label="Expiration date">
                  <TextInput onChange={(event) => setProfileField("startDate", event.target.value)} readOnly={!canManageAgents} type="date" value={profileState.startDate} />
                </FormField>
                <div aria-live="polite" className="office-detail-field office-agent-expiration-field">
                  <span>Expiration status</span>
                  <StatusBadge className="office-agent-expiration-badge" tone={licenseExpirationStatus.tone}>
                    {licenseExpirationStatus.badge}
                  </StatusBadge>
                  <strong>{licenseExpirationStatus.summary}</strong>
                  <p>{licenseExpirationStatus.detail}</p>
                </div>
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
              </div>
            ) : null}

            {canViewBankInformation && activeProfileTab === "bank" ? (
              <div className="office-detail-grid office-profile-basics-panel" role="tabpanel">
                <div className="office-detail-field office-detail-field-wide office-profile-basics-callout">
                  <span>Sensitive bank information</span>
                  <strong>Use this tab to collect payout and year-end tax reporting details for the member.</strong>
                  <p>These fields are returned to agent managers and to the member when viewing their own profile.</p>
                </div>
                <FormField
                  className="office-detail-field"
                  helper="Use the exact payee / legal name that should appear on the year-end 1099 summary."
                  label="Payee Name"
                >
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankPayeeName", event.target.value)} readOnly={!canManageBankInformation} value={profileState.bankPayeeName} />
                </FormField>
                <FormField
                  className="office-detail-field"
                  helper="Please enter company name if this is a business account."
                  label="First Name"
                >
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankFirstName", event.target.value)} readOnly={!canManageBankInformation} value={profileState.bankFirstName} />
                </FormField>
                <FormField className="office-detail-field" label="Last Name">
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankLastName", event.target.value)} readOnly={!canManageBankInformation} value={profileState.bankLastName} />
                </FormField>
                <FormField className="office-detail-field" label="Email">
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankEmail", event.target.value)} readOnly={!canManageBankInformation} type="email" value={profileState.bankEmail} />
                </FormField>
                <FormField className="office-detail-field" label="Phone Number">
                  <TextInput autoComplete="off" inputMode="tel" onChange={(event) => setProfileField("bankPhoneNumber", event.target.value)} readOnly={!canManageBankInformation} type="tel" value={profileState.bankPhoneNumber} />
                </FormField>
                <FormField className="office-detail-field office-detail-field-wide" label="Address">
                  <TextareaInput
                    autoComplete="off"
                    onChange={(event) => setProfileField("bankAddress", event.target.value)}
                    placeholder="Complete address with unit number, city, state, and zip code"
                    readOnly={!canManageBankInformation}
                    rows={3}
                    value={profileState.bankAddress}
                  />
                </FormField>
                <FormField className="office-detail-field" label="Bank Name">
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankName", event.target.value)} readOnly={!canManageBankInformation} value={profileState.bankName} />
                </FormField>
                <FormField className="office-detail-field" label="Account Number">
                  <TextInput
                    autoComplete="off"
                    inputMode="numeric"
                    onChange={(event) => setProfileField("bankAccountNumber", event.target.value)}
                    readOnly={!canManageBankInformation}
                    value={profileState.bankAccountNumber}
                  />
                </FormField>
                <FormField className="office-detail-field" label="Routing Number">
                  <TextInput
                    autoComplete="off"
                    inputMode="numeric"
                    onChange={(event) => setProfileField("bankRoutingNumber", event.target.value)}
                    readOnly={!canManageBankInformation}
                    value={profileState.bankRoutingNumber}
                  />
                </FormField>
                <FormField
                  className="office-detail-field"
                  helper="Choose which you used for year-end tax reporting purposes."
                  label="SSN or EIN"
                >
                  <SelectInput disabled={!canManageBankInformation} onChange={(event) => setProfileField("bankTaxIdType", event.target.value)} value={profileState.bankTaxIdType}>
                    <option value="">Select tax ID type</option>
                    {bankTaxIdTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField className="office-detail-field" label="SSN or EIN value">
                  <TextInput
                    autoComplete="off"
                    inputMode="numeric"
                    onChange={(event) => setProfileField("bankTaxIdValue", event.target.value)}
                    readOnly={!canManageBankInformation}
                    value={profileState.bankTaxIdValue}
                  />
                </FormField>
                <FormField className="office-detail-field" label="Date of Birth">
                  <TextInput autoComplete="off" onChange={(event) => setProfileField("bankDateOfBirth", event.target.value)} readOnly={!canManageBankInformation} type="date" value={profileState.bankDateOfBirth} />
                </FormField>
                <FormField className="office-detail-field" label="Account type">
                  <SelectInput disabled={!canManageBankInformation} onChange={(event) => setProfileField("bankAccountType", event.target.value)} value={profileState.bankAccountType}>
                    <option value="">Select account type</option>
                    {bankAccountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
              </div>
            ) : null}
            {canManageAgents || (canManageBankInformation && activeProfileTab === "bank") ? (
              <div className="office-form-actions">
                <Button disabled={pendingAction === "profile"} type="submit">
                  {pendingAction === "profile" ? "Saving..." : canManageAgents ? "Save profile" : "Save bank information"}
                </Button>
              </div>
            ) : null}
          </form>
        </SectionCard>
      </section>

      <div className="office-detail-two-column office-settings-user-operations-split">
        <UserTeamAssignmentsCard
          assignmentLockedReason={teamAssignmentLockedReason}
          availableTeams={snapshot.availableTeams}
          canManageTeams={canManageTeams}
          memberName={snapshot.profile.displayName}
          membershipId={snapshot.profile.membershipId}
          teams={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.name,
            roleLabel: team.role,
            reportsToLabel: team.reportsToLabel,
            isActive: team.isActive
          }))}
        />

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

      <SectionCard subtitle="Default split, recent calculated rows, and payout-readiness visibility for this member." title="Commission summary">
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
          <EmptyState title="No commission calculations yet" description="No commission calculations have been recorded for this member yet." />
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
          subtitle="Back-office onboarding checklist for this member. Completion updates the profile onboarding status automatically."
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

      <div className="office-detail-two-column office-settings-user-activity-split">
        <SectionCard subtitle="Most recent transaction work currently owned by this member." title="Recent transactions">
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

    </>
  );
}
