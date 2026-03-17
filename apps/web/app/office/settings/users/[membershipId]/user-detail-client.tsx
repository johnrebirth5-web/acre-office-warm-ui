"use client";

import type { OfficeAdminUserDetailSnapshot } from "@acre/db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Badge, Button, FormField, SectionCard, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import {
  copyTextToClipboard,
  formatInviteExpiry,
  getInvitationTone,
  getIssueLinkLabel,
  getMembershipTone,
  getOnboardingTone,
  getRoleConfigurationHint,
  getRoleEditorOptions,
  getStatusEditorOptions
} from "../users-shared";

type OfficeSettingsUserDetailClientProps = {
  snapshot: OfficeAdminUserDetailSnapshot;
  canManageUsers: boolean;
  mode?: "full" | "access-only";
  operationsHref?: string | null;
};

type DetailDraft = {
  role: string;
  status: string;
  officeId: string;
};

type GeneratedInviteState = {
  membershipId: string;
  invitationUrl: string;
  expiresAtLabel: string;
};

type MutationResponse = {
  membershipId: string;
  invitationUrl: string;
  expiresAt: string;
} | null;

export function OfficeSettingsUserDetailClient({
  snapshot,
  canManageUsers,
  mode = "full",
  operationsHref
}: OfficeSettingsUserDetailClientProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<DetailDraft>({
    role: snapshot.profile.roleValue,
    status: snapshot.profile.statusValue,
    officeId: snapshot.profile.officeAccessValue
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [latestInvite, setLatestInvite] = useState<GeneratedInviteState | null>(null);

  useEffect(() => {
    setDraft({
      role: snapshot.profile.roleValue,
      status: snapshot.profile.statusValue,
      officeId: snapshot.profile.officeAccessValue
    });
  }, [
    snapshot.profile.officeAccessValue,
    snapshot.profile.roleValue,
    snapshot.profile.statusValue
  ]);

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  function setDraftField(field: keyof DetailDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("save");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update the internal account.");
      }

      setActionNotice("User access updated.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update the internal account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvitationAction(action: "issue" | "revoke") {
    setPendingAction(action);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      const body = (await response.json().catch(() => null)) as
        | ({
            error?: string;
          } & MutationResponse)
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update the invitation.");
      }

      if (action === "revoke") {
        setLatestInvite(null);
        setActionNotice("Invitation revoked.");
        refreshCurrentPage();
        return;
      }

      if (!body?.membershipId || !body.invitationUrl || !body.expiresAt) {
        throw new Error("The server did not return a valid invitation link.");
      }

      setLatestInvite({
        membershipId: body.membershipId,
        invitationUrl: body.invitationUrl,
        expiresAtLabel: formatInviteExpiry(body.expiresAt)
      });
      setActionNotice("A fresh setup link is ready to copy.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update the invitation.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnlockUser() {
    setPendingAction("unlock");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/unlock`, {
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to unlock the account.");
      }

      setActionNotice("Account unlocked.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to unlock the account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopyLatestInvite() {
    if (!latestInvite) {
      return;
    }

    setPendingAction("copy");
    setSubmitError("");

    try {
      await copyTextToClipboard(latestInvite.invitationUrl);
      setActionNotice("Invitation link copied.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to copy the invitation link.");
    } finally {
      setPendingAction(null);
    }
  }

  const roleChanged = draft.role !== snapshot.profile.roleValue;
  const permissionEditorHref = `/office/settings/users/${snapshot.profile.membershipId}/permissions`;
  const profileLinkHref = operationsHref ?? snapshot.profile.agentProfileHref;
  const showOperationalSections = mode === "full";

  return (
    <div className="office-settings-user-detail-stack">
      {submitError ? <p className="office-inline-error">{submitError}</p> : null}
      {actionNotice ? <p className="office-inline-success">{actionNotice}</p> : null}

      <SectionCard className="office-settings-user-hero-card">
        <div className="office-settings-user-hero">
          <div aria-hidden="true" className="office-settings-user-avatar">
            {snapshot.profile.name.charAt(0).toUpperCase()}
          </div>

          <div className="office-settings-user-hero-copy">
            <div className="office-settings-user-hero-heading">
              <h3>{snapshot.profile.name}</h3>
              <Badge tone={snapshot.profile.roleValue === "owner" || snapshot.profile.roleValue === "office_admin" ? "accent" : "neutral"}>
                {snapshot.profile.role}
              </Badge>
              <StatusBadge tone={getMembershipTone(snapshot.profile.statusValue)}>{snapshot.profile.status}</StatusBadge>
              <StatusBadge tone={getOnboardingTone(snapshot.profile.onboardingStatusValue)}>{snapshot.profile.onboardingStatusLabel}</StatusBadge>
            </div>

            <div className="office-settings-user-hero-meta">
              <div>
                <span>Email</span>
                <strong>{snapshot.profile.email}</strong>
              </div>
              <div>
                <span>Office access</span>
                <strong>{snapshot.profile.officeAccessLabel}</strong>
              </div>
              <div>
                <span>Team</span>
                <strong>{snapshot.profile.teamSummary}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{snapshot.profile.createdAtLabel || "—"}</strong>
              </div>
              <div>
                <span>Last sign in</span>
                <strong>{snapshot.profile.lastLoginAtLabel || "No successful sign-in yet"}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>{snapshot.profile.authStatusLabel}</strong>
              </div>
            </div>

            <div className="office-settings-user-hero-actions">
              <Badge tone={getInvitationTone(snapshot.profile)}>{snapshot.profile.invitationStatusLabel}</Badge>
              {snapshot.profile.invitationExpiresAtLabel ? <span>Invite expires {snapshot.profile.invitationExpiresAtLabel}</span> : null}
              {snapshot.profile.isLocked ? <StatusBadge tone="danger">Locked until {snapshot.profile.lockedUntilLabel}</StatusBadge> : null}
              {profileLinkHref ? (
                <Link className="office-button office-button-secondary office-button-sm" href={profileLinkHref}>
                  {operationsHref ? "Jump to operations" : "Open agent profile"}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="office-detail-two-column office-settings-user-detail-grid">
        <SectionCard
          subtitle="Update role, membership lifecycle, office access, and invitation state from one place."
          title="Account access"
        >
          <form className="office-form-grid office-form-grid-3" onSubmit={handleSaveUser}>
            <FormField label="Role">
              <SelectInput disabled={!canManageUsers} onChange={(event) => setDraftField("role", event.target.value)} value={draft.role}>
                {getRoleEditorOptions(snapshot.profile).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
              <p className="office-settings-user-note">{getRoleConfigurationHint(draft.role)}</p>
            </FormField>

            <FormField label="Membership">
              <SelectInput disabled={!canManageUsers} onChange={(event) => setDraftField("status", event.target.value)} value={draft.status}>
                {getStatusEditorOptions(snapshot.profile).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Office access">
              <SelectInput disabled={!canManageUsers} onChange={(event) => setDraftField("officeId", event.target.value)} value={draft.officeId}>
                {snapshot.editors.officeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Current lock status">
              <TextInput readOnly value={snapshot.profile.isLocked ? `Locked until ${snapshot.profile.lockedUntilLabel}` : snapshot.profile.lockStatusLabel} />
            </FormField>

            <FormField label="Last failed login">
              <TextInput readOnly value={snapshot.profile.lastFailedLoginAtLabel || "—"} />
            </FormField>

            <FormField label="Password changed">
              <TextInput readOnly value={snapshot.profile.passwordChangedAtLabel || "—"} />
            </FormField>

            <div className="office-form-grid-span-3 office-settings-user-detail-actions">
              {canManageUsers ? (
                <>
                  <Button disabled={pendingAction === "save"} type="submit">
                    {pendingAction === "save" ? "Saving..." : "Save access"}
                  </Button>
                  <Button disabled={pendingAction === "issue"} onClick={() => handleInvitationAction("issue")} type="button" variant="secondary">
                    {pendingAction === "issue" ? "Preparing..." : getIssueLinkLabel(snapshot.profile)}
                  </Button>
                  {snapshot.profile.hasActiveInvitation ? (
                    <Button disabled={pendingAction === "revoke"} onClick={() => handleInvitationAction("revoke")} type="button" variant="secondary">
                      {pendingAction === "revoke" ? "Revoking..." : "Revoke link"}
                    </Button>
                  ) : null}
                  {snapshot.profile.isLocked ? (
                    <Button disabled={pendingAction === "unlock"} onClick={handleUnlockUser} type="button" variant="secondary">
                      {pendingAction === "unlock" ? "Unlocking..." : "Unlock"}
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="office-table-action-muted">View only</span>
              )}
            </div>
          </form>

          {latestInvite ? (
            <div className="office-settings-generated-invite">
              <div className="office-settings-generated-invite-copy">
                <strong>Setup link ready</strong>
                <p>Expires {latestInvite.expiresAtLabel}</p>
              </div>
              <div className="office-settings-generated-invite-actions">
                <TextInput readOnly value={latestInvite.invitationUrl} />
                <Button disabled={pendingAction === "copy"} onClick={handleCopyLatestInvite} variant="secondary">
                  {pendingAction === "copy" ? "Copying..." : "Copy link"}
                </Button>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          actions={
            roleChanged ? (
              <Button disabled type="button" variant="secondary">
                Save access to edit permissions
              </Button>
            ) : (
              <Link className="office-button office-button-primary office-button-sm" href={permissionEditorHref}>
                {canManageUsers ? "Edit permissions" : "View permissions"}
              </Link>
            )
          }
          subtitle="Open a dedicated full-page editor to review the permission tree and manage per-user overrides."
          title="Permissions"
        >
          {roleChanged ? (
            <p className="office-form-helper">
              Save access first if you want the permission editor to use the newly selected role template.
            </p>
          ) : null}

          <div className="office-agents-profile-summary-grid">
            <div className="office-detail-field">
              <span>Current role template</span>
              <strong>{snapshot.permissions.roleLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span>Persisted overrides</span>
              <strong>{snapshot.permissions.overrides.length}</strong>
            </div>
            <div className="office-detail-field">
              <span>Effective permissions</span>
              <strong>{snapshot.permissions.effectivePermissions.length}</strong>
            </div>
            <div className="office-detail-field">
              <span>Editor mode</span>
              <strong>{canManageUsers ? "Dedicated manage page" : "Dedicated read-only page"}</strong>
            </div>
          </div>
        </SectionCard>
      </div>

      {showOperationalSections ? (
        <>
          <div className="office-detail-two-column office-settings-user-detail-grid">
            <SectionCard subtitle="Current office, team memberships, and related profile routing." title="Context">
              <div className="office-settings-user-context-list">
                <div className="office-secondary-meta-row">
                  <dt>Office</dt>
                  <dd>{snapshot.profile.officeName}</dd>
                </div>
                <div className="office-secondary-meta-row">
                  <dt>Title</dt>
                  <dd>{snapshot.profile.title || "—"}</dd>
                </div>
                <div className="office-secondary-meta-row">
                  <dt>Team summary</dt>
                  <dd>{snapshot.profile.teamSummary}</dd>
                </div>
              </div>

              <div className="office-settings-user-team-list">
                {snapshot.teams.map((team) => (
                  <article className="office-settings-user-team-item" key={team.id}>
                    <div>
                      <strong>{team.name}</strong>
                      <p>
                        {team.roleLabel} · {team.reportsToLabel}
                      </p>
                    </div>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </article>
                ))}
                {snapshot.teams.length === 0 ? <p className="office-form-helper">No team assignments yet.</p> : null}
              </div>
            </SectionCard>

            <SectionCard
              subtitle={`${snapshot.onboarding.completedCount} of ${snapshot.onboarding.totalCount} items complete.`}
              title="Onboarding"
            >
              <div className="office-settings-user-inline-badges">
                <StatusBadge tone={getOnboardingTone(snapshot.onboarding.statusValue)}>{snapshot.onboarding.statusLabel}</StatusBadge>
                <Badge tone="neutral">{snapshot.onboarding.totalCount} items</Badge>
              </div>

              <div className="office-settings-user-onboarding-list">
                {snapshot.onboarding.items.map((item) => (
                  <article className="office-settings-user-onboarding-item" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.category}
                        {item.dueAtLabel ? ` · Due ${item.dueAtLabel}` : ""}
                      </p>
                    </div>
                    <div className="office-settings-user-onboarding-meta">
                      <StatusBadge
                        tone={
                          item.statusValue === "completed"
                            ? "success"
                            : item.statusValue === "in_progress"
                              ? "accent"
                              : item.statusValue === "reopened"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {item.statusLabel}
                      </StatusBadge>
                      {item.completedAtLabel ? <small>Completed {item.completedAtLabel}</small> : null}
                    </div>
                  </article>
                ))}
                {snapshot.onboarding.items.length === 0 ? <p className="office-form-helper">No onboarding items have been assigned.</p> : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard subtitle="Current commission assignment and recent persisted calculation visibility for this membership." title="Commission summary">
            <div className="office-agents-profile-summary-grid">
              <div className="office-detail-field">
                <span>Active plan</span>
                <strong>{snapshot.commission.activePlanLabel || "Manual / unassigned"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Plan source</span>
                <strong>{snapshot.commission.activePlanSourceLabel || "No active assignment"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Statement ready</span>
                <strong>{snapshot.commission.statementReadyLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Payable</span>
                <strong>{snapshot.commission.payableLabel}</strong>
              </div>
            </div>

            <div className="office-note-list">
              {snapshot.commission.recentCalculations.map((calculation) => (
                <article className="office-note-item" key={calculation.id}>
                  <span>{calculation.status}</span>
                  <div>
                    <strong>{calculation.transactionHref ? <Link href={calculation.transactionHref}>{calculation.transactionLabel}</Link> : calculation.transactionLabel}</strong>
                    <p>
                      {calculation.recipientLabel} · {calculation.statementAmountLabel}
                    </p>
                  </div>
                </article>
              ))}
              {snapshot.commission.recentCalculations.length === 0 ? (
                <p className="office-form-helper">No commission calculations have been recorded for this user yet.</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard subtitle="Latest audit trail items tied to this user account, invitations, and credential events." title="Recent activity">
            <div className="office-settings-user-activity-list">
              {snapshot.recentActivity.map((item) => (
                <article className="office-settings-user-activity-item" key={item.id}>
                  <div className="office-settings-user-activity-copy">
                    <strong>{item.actionLabel}</strong>
                    <p>{item.detail}</p>
                    <small>
                      {item.actorDisplayName} · {item.timestampLabel}
                    </small>
                  </div>
                  {item.href ? (
                    <Link className="office-button office-button-secondary office-button-sm" href={item.href}>
                      Open
                    </Link>
                  ) : null}
                </article>
              ))}
              {snapshot.recentActivity.length === 0 ? <p className="office-form-helper">No recent user activity yet.</p> : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
