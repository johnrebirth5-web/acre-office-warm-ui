"use client";

import type { OfficeAdminUserDetailSnapshot } from "@acre/db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
} from "@acre/ui";
import {
  copyTextToClipboard,
  formatInviteExpiry,
  getInvitationTone,
  getIssueLinkLabel,
  getMembershipTone,
  getOnboardingTone,
  getRoleConfigurationHint,
  getRoleEditorOptions,
  getStatusEditorOptions,
  isPrivilegedRoleValue,
} from "../users-shared";
import { UserTeamAssignmentsCard } from "./user-team-assignments-card";

type OfficeSettingsUserDetailClientProps = {
  snapshot: OfficeAdminUserDetailSnapshot;
  canManageUsers: boolean;
  canManageSensitiveUsers: boolean;
  canManageTeams: boolean;
  mode?: "full" | "access-only";
  operationsHref?: string | null;
};

type DetailDraft = {
  role: string;
  status: string;
  defaultOfficeId: string;
  accessibleOfficeIds: string[];
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

function serializeStringList(values: string[]) {
  return JSON.stringify([...new Set(values)].sort());
}

export function OfficeSettingsUserDetailClient({
  snapshot,
  canManageUsers,
  canManageSensitiveUsers,
  canManageTeams,
  mode = "full",
  operationsHref,
}: OfficeSettingsUserDetailClientProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<DetailDraft>({
    role: snapshot.profile.roleValue,
    status: snapshot.profile.statusValue,
    defaultOfficeId: snapshot.profile.defaultOfficeId ?? "",
    accessibleOfficeIds: snapshot.profile.accessibleOfficeIds,
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [latestInvite, setLatestInvite] = useState<GeneratedInviteState | null>(
    null,
  );
  const canManagePrivilegedAccount =
    canManageSensitiveUsers ||
    !isPrivilegedRoleValue(snapshot.profile.roleValue);
  const canManageAccountAccess = canManageUsers && canManagePrivilegedAccount;
  const actualOfficeOptions = snapshot.editors.officeOptions.filter(
    (option) => option.id !== "__all__",
  );
  const hasImplicitAllCompanyAccess =
    draft.role === "owner" ||
    draft.role === "office_admin" ||
    draft.role === "office_manager";
  const effectiveAccessibleOfficeIds = hasImplicitAllCompanyAccess
    ? actualOfficeOptions.map((option) => option.id)
    : draft.accessibleOfficeIds;
  const effectiveAccessibleOfficeIdsSet = new Set(effectiveAccessibleOfficeIds);
  const companyPermissionsByOfficeId = new Map(
    snapshot.companyPermissions.map((entry) => [entry.officeId, entry]),
  );

  function getCommissionStatusTone(status: string) {
    if (status === "Paid" || status === "Payable") {
      return "success" as const;
    }

    if (status === "Statement ready" || status === "Reviewed") {
      return "accent" as const;
    }

    return "neutral" as const;
  }

  useEffect(() => {
    setDraft({
      role: snapshot.profile.roleValue,
      status: snapshot.profile.statusValue,
      defaultOfficeId: snapshot.profile.defaultOfficeId ?? "",
      accessibleOfficeIds: snapshot.profile.accessibleOfficeIds,
    });
  }, [
    snapshot.profile.accessibleOfficeIds,
    snapshot.profile.defaultOfficeId,
    snapshot.profile.roleValue,
    snapshot.profile.statusValue,
  ]);

  useEffect(() => {
    if (hasImplicitAllCompanyAccess) {
      const allOfficeIds = actualOfficeOptions.map((option) => option.id);
      const nextDefaultOfficeId = allOfficeIds.includes(draft.defaultOfficeId)
        ? draft.defaultOfficeId
        : (allOfficeIds[0] ?? "");
      const currentSerialized = JSON.stringify(
        [...draft.accessibleOfficeIds].sort(),
      );
      const nextSerialized = JSON.stringify([...allOfficeIds].sort());

      if (
        currentSerialized !== nextSerialized ||
        draft.defaultOfficeId !== nextDefaultOfficeId
      ) {
        setDraft((current) => ({
          ...current,
          defaultOfficeId: nextDefaultOfficeId,
          accessibleOfficeIds: allOfficeIds,
        }));
      }
      return;
    }

    if (draft.accessibleOfficeIds.length === 0 && actualOfficeOptions[0]) {
      setDraft((current) => ({
        ...current,
        defaultOfficeId: actualOfficeOptions[0]?.id ?? "",
        accessibleOfficeIds: [actualOfficeOptions[0]?.id ?? ""].filter(Boolean),
      }));
      return;
    }

    if (
      draft.defaultOfficeId &&
      !draft.accessibleOfficeIds.includes(draft.defaultOfficeId)
    ) {
      setDraft((current) => ({
        ...current,
        defaultOfficeId: current.accessibleOfficeIds[0] ?? "",
      }));
    }
  }, [
    actualOfficeOptions,
    draft.accessibleOfficeIds,
    draft.defaultOfficeId,
    hasImplicitAllCompanyAccess,
  ]);

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  function setDraftField(field: keyof DetailDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleOfficeAccess(officeId: string, checked: boolean) {
    if (hasImplicitAllCompanyAccess) {
      return;
    }

    setDraft((current) => {
      const accessibleOfficeIds = checked
        ? [...new Set([...current.accessibleOfficeIds, officeId])]
        : current.accessibleOfficeIds.filter(
            (currentId) => currentId !== officeId,
          );
      const defaultOfficeId = checked
        ? current.defaultOfficeId || officeId
        : current.defaultOfficeId === officeId
          ? (accessibleOfficeIds[0] ?? "")
          : current.defaultOfficeId;

      return {
        ...current,
        defaultOfficeId,
        accessibleOfficeIds,
      };
    });
  }

  function setDefaultOffice(officeId: string) {
    setDraft((current) => ({
      ...current,
      defaultOfficeId: officeId,
      accessibleOfficeIds: hasImplicitAllCompanyAccess
        ? actualOfficeOptions.map((option) => option.id)
        : current.accessibleOfficeIds.includes(officeId)
          ? current.accessibleOfficeIds
          : [...current.accessibleOfficeIds, officeId],
    }));
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("save");
    setSubmitError("");
    setActionNotice("");

    try {
      if (!draft.defaultOfficeId) {
        throw new Error("Choose a default company.");
      }

      if (
        !hasImplicitAllCompanyAccess &&
        draft.accessibleOfficeIds.length === 0
      ) {
        throw new Error("Choose at least one company for this user.");
      }

      const response = await fetch(
        `/api/office/settings/users/${snapshot.profile.membershipId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...draft,
            accessibleOfficeIds: effectiveAccessibleOfficeIds,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Failed to update the internal account.",
        );
      }

      setActionNotice("User access updated.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to update the internal account.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvitationAction(action: "issue" | "revoke") {
    setPendingAction(action);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(
        `/api/office/settings/users/${snapshot.profile.membershipId}/invitation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      );

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
        expiresAtLabel: formatInviteExpiry(body.expiresAt),
      });
      setActionNotice("A fresh setup link is ready to copy.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to update the invitation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnlockUser() {
    setPendingAction("unlock");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(
        `/api/office/settings/users/${snapshot.profile.membershipId}/unlock`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to unlock the account.");
      }

      setActionNotice("Account unlocked.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to unlock the account.",
      );
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
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to copy the invitation link.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const roleChanged = draft.role !== snapshot.profile.roleValue;
  const membershipChanged = draft.status !== snapshot.profile.statusValue;
  const defaultOfficeChanged =
    draft.defaultOfficeId !== (snapshot.profile.defaultOfficeId ?? "");
  const companyAccessChanged =
    serializeStringList(effectiveAccessibleOfficeIds) !==
    serializeStringList(snapshot.profile.accessibleOfficeIds);
  const accountAccessChanged =
    roleChanged ||
    membershipChanged ||
    defaultOfficeChanged ||
    companyAccessChanged;
  const permissionEditorHref = `/office/settings/users/${snapshot.profile.membershipId}/permissions`;
  const profileLinkHref = operationsHref ?? snapshot.profile.agentProfileHref;
  const showOperationalSections = mode === "full";

  return (
    <div className="office-settings-user-detail-stack">
      {submitError ? (
        <p className="office-inline-error">{submitError}</p>
      ) : null}
      {actionNotice ? (
        <p className="office-inline-success">{actionNotice}</p>
      ) : null}

      <SectionCard
        actions={
          profileLinkHref ? (
            <Link
              className="office-button-secondary office-button-sm"
              href={profileLinkHref}
            >
              {operationsHref ? "Jump to operations" : "Open agent profile"}
            </Link>
          ) : null
        }
        subtitle="Current identity, invitation state, and sign-in context for this internal account."
        title="Account snapshot"
      >
        <div className="office-settings-user-inline-badges">
          <Badge
            tone={
              snapshot.profile.roleValue === "owner" ||
              snapshot.profile.roleValue === "office_admin"
                ? "accent"
                : "neutral"
            }
          >
            {snapshot.profile.role}
          </Badge>
          <StatusBadge tone={getMembershipTone(snapshot.profile.statusValue)}>
            {snapshot.profile.status}
          </StatusBadge>
          <StatusBadge
            tone={getOnboardingTone(snapshot.profile.onboardingStatusValue)}
          >
            {snapshot.profile.onboardingStatusLabel}
          </StatusBadge>
          <Badge tone={getInvitationTone(snapshot.profile)}>
            {snapshot.profile.invitationStatusLabel}
          </Badge>
          {snapshot.profile.isLocked ? (
            <StatusBadge tone="danger">
              Locked until {snapshot.profile.lockedUntilLabel}
            </StatusBadge>
          ) : null}
        </div>

        <div className="office-detail-grid">
          <div className="office-detail-field office-detail-field-wide">
            <span>Member</span>
            <strong>{snapshot.profile.name}</strong>
            <p>{snapshot.profile.title || snapshot.profile.email}</p>
          </div>
          <div className="office-detail-field">
            <span>Email</span>
            <strong>{snapshot.profile.email}</strong>
          </div>
          <div className="office-detail-field">
            <span>Company access</span>
            <strong>{snapshot.profile.officeAccessLabel}</strong>
          </div>
          <div className="office-detail-field">
            <span>Team</span>
            <strong>{snapshot.profile.teamSummary}</strong>
          </div>
          <div className="office-detail-field">
            <span>Created</span>
            <strong>{snapshot.profile.createdAtLabel || "—"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Last sign in</span>
            <strong>
              {snapshot.profile.lastLoginAtLabel || "No successful sign-in yet"}
            </strong>
          </div>
          <div className="office-detail-field">
            <span>Password</span>
            <strong>{snapshot.profile.authStatusLabel}</strong>
          </div>
          <div className="office-detail-field">
            <span>Invitation</span>
            <strong>{snapshot.profile.invitationStatusLabel}</strong>
          </div>
        </div>

        <div className="office-inline-meta">
          {snapshot.profile.invitationExpiresAtLabel ? (
            <span>
              Invite expires {snapshot.profile.invitationExpiresAtLabel}
            </span>
          ) : null}
          <span>
            Last failed login: {snapshot.profile.lastFailedLoginAtLabel || "—"}
          </span>
          <span>
            Password changed: {snapshot.profile.passwordChangedAtLabel || "—"}
          </span>
        </div>
      </SectionCard>

      <div className="office-detail-two-column office-settings-user-detail-grid">
        <SectionCard
          className="office-settings-user-access-card"
          subtitle="Update role, membership lifecycle, company access, and invitation state from one place."
          title="Account access"
        >
          <form
            className="office-settings-user-access-form"
            onSubmit={handleSaveUser}
          >
            <div className="office-form-grid office-form-grid-2 office-settings-user-access-controls">
              <FormField label="Role">
                <SelectInput
                  disabled={!canManageAccountAccess}
                  onChange={(event) =>
                    setDraftField("role", event.target.value)
                  }
                  value={draft.role}
                >
                  {getRoleEditorOptions(
                    snapshot.profile,
                    canManageSensitiveUsers,
                  ).map((option) => (
                    <option
                      disabled={option.disabled}
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label="Membership">
                <SelectInput
                  disabled={!canManageAccountAccess}
                  onChange={(event) =>
                    setDraftField("status", event.target.value)
                  }
                  value={draft.status}
                >
                  {getStatusEditorOptions(snapshot.profile).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

            <FormField label="Company access and default company">
              <div className="office-settings-user-company-access-list">
                {actualOfficeOptions.map((option) => {
                  const hasAccess = effectiveAccessibleOfficeIdsSet.has(
                    option.id,
                  );
                  const isDefault = draft.defaultOfficeId === option.id;
                  const companyPermission = companyPermissionsByOfficeId.get(
                    option.id,
                  );
                  const overrideCount =
                    companyPermission?.permissions.overrides.length ?? 0;
                  const effectivePermissionCount =
                    companyPermission?.permissions.effectivePermissions
                      .length ?? 0;
                  const canClearAccess =
                    hasImplicitAllCompanyAccess ||
                    !hasAccess ||
                    effectiveAccessibleOfficeIds.length > 1;
                  const canOpenCompanyPermissions =
                    !accountAccessChanged && hasAccess;

                  return (
                    <article
                      className={`office-settings-user-company-access-item${
                        hasAccess ? " is-active" : ""
                      }${isDefault ? " is-default" : ""}`}
                      key={option.id}
                    >
                      <div className="office-settings-user-company-access-copy">
                        <div className="office-settings-user-company-access-heading">
                          <strong>{option.label}</strong>
                          {isDefault ? (
                            <Badge tone="accent">Default</Badge>
                          ) : null}
                          <StatusBadge tone={hasAccess ? "success" : "neutral"}>
                            {hasAccess ? "Access granted" : "No access"}
                          </StatusBadge>
                          {overrideCount > 0 ? (
                            <Badge tone="neutral">
                              {overrideCount} overrides
                            </Badge>
                          ) : null}
                        </div>
                        <div className="office-settings-user-company-access-meta">
                          <span>
                            {hasImplicitAllCompanyAccess
                              ? "This role automatically inherits every company."
                              : hasAccess
                                ? "This user can sign in and switch into this company."
                                : "Enable access if this user should be able to switch into this company."}
                          </span>
                          <span>
                            {isDefault
                              ? "This is the first company they land in after sign-in."
                              : `Selecting Default company also keeps this company in the access list.${overrideCount > 0 ? ` ${effectivePermissionCount} effective permissions already exist for this saved scope.` : ""}`}
                          </span>
                        </div>
                      </div>

                      <div className="office-settings-user-company-access-actions">
                        <label className="office-settings-user-company-access-toggle">
                          <input
                            checked={hasAccess}
                            disabled={
                              !canManageAccountAccess ||
                              hasImplicitAllCompanyAccess ||
                              !canClearAccess
                            }
                            onChange={(event) =>
                              toggleOfficeAccess(
                                option.id,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            {hasImplicitAllCompanyAccess
                              ? "Inherited access"
                              : hasAccess
                                ? "Has access"
                                : "Grant access"}
                          </span>
                        </label>

                        <label className="office-settings-user-company-access-toggle">
                          <input
                            checked={isDefault}
                            disabled={!canManageAccountAccess}
                            name="defaultOfficeId"
                            onChange={() => setDefaultOffice(option.id)}
                            type="radio"
                          />
                          <span>
                            {isDefault ? "Default company" : "Make default"}
                          </span>
                        </label>

                        {canOpenCompanyPermissions ? (
                          <Link
                            className="office-button-secondary office-button-sm"
                            href={`${permissionEditorHref}?scope=company&officeId=${option.id}`}
                          >
                            {overrideCount > 0
                              ? "Edit company permissions"
                              : "Review company permissions"}
                          </Link>
                        ) : (
                          <Button disabled type="button" variant="secondary">
                            {accountAccessChanged
                              ? "Save access first"
                              : "Grant access first"}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </FormField>

            <div className="office-settings-user-access-callout">
              <strong>Permissions scope</strong>
              <p>{getRoleConfigurationHint(draft.role)}</p>
              <p className="office-form-helper">
                {hasImplicitAllCompanyAccess
                  ? "This role automatically receives access to every company. Use the per-company links above when one location needs a custom permission override."
                  : "Choose every company this user can switch into, mark one as the default sign-in company, and then open that company's permission page only if it needs exceptions."}
              </p>
              <p className="office-form-helper">
                At least one company must stay assigned. If you set a different
                default company, it is automatically kept in the access list.
              </p>
              {snapshot.profile.hasActiveLeaderAssignments &&
              snapshot.profile.roleValue === "agent" ? (
                <p className="office-form-helper">
                  This member already leads a Team / Junior Team, but the saved
                  account role is still Agent. Team Lead visibility is applied
                  automatically now, and you can switch the role to Team Lead
                  here whenever you want to persist the matching template.
                </p>
              ) : null}
              {snapshot.profile.hasActiveLeaderAssignments &&
              snapshot.profile.roleValue !== "agent" ? (
                <p className="office-form-helper">
                  Active Team / Junior Team owners cannot be switched to Agent
                  until leadership is transferred or removed in Settings &gt;
                  Teams.
                </p>
              ) : null}
            </div>

            <div className="office-settings-user-security-grid">
              <div className="office-detail-field">
                <span>Current lock status</span>
                <strong>
                  {snapshot.profile.isLocked
                    ? `Locked until ${snapshot.profile.lockedUntilLabel}`
                    : snapshot.profile.lockStatusLabel}
                </strong>
              </div>

              <div className="office-detail-field">
                <span>Last failed login</span>
                <strong>
                  {snapshot.profile.lastFailedLoginAtLabel || "—"}
                </strong>
              </div>

              <div className="office-detail-field">
                <span>Password changed</span>
                <strong>
                  {snapshot.profile.passwordChangedAtLabel || "—"}
                </strong>
              </div>
            </div>

            <div className="office-settings-user-detail-actions office-settings-user-access-actions">
              {canManageAccountAccess ? (
                <>
                  <Button disabled={pendingAction === "save"} type="submit">
                    {pendingAction === "save" ? "Saving..." : "Save access"}
                  </Button>
                  <Button
                    disabled={pendingAction === "issue"}
                    onClick={() => handleInvitationAction("issue")}
                    type="button"
                    variant="secondary"
                  >
                    {pendingAction === "issue"
                      ? "Preparing..."
                      : getIssueLinkLabel(snapshot.profile)}
                  </Button>
                  {snapshot.profile.hasActiveInvitation ? (
                    <Button
                      disabled={pendingAction === "revoke"}
                      onClick={() => handleInvitationAction("revoke")}
                      type="button"
                      variant="secondary"
                    >
                      {pendingAction === "revoke"
                        ? "Revoking..."
                        : "Revoke link"}
                    </Button>
                  ) : null}
                  {snapshot.profile.isLocked ? (
                    <Button
                      disabled={pendingAction === "unlock"}
                      onClick={handleUnlockUser}
                      type="button"
                      variant="secondary"
                    >
                      {pendingAction === "unlock" ? "Unlocking..." : "Unlock"}
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="office-table-action-muted">
                  {canManageUsers && !canManagePrivilegedAccount
                    ? "Only Owner / Office Admin can manage this account."
                    : "View only"}
                </span>
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
                <Button
                  disabled={pendingAction === "copy"}
                  onClick={handleCopyLatestInvite}
                  variant="secondary"
                >
                  {pendingAction === "copy" ? "Copying..." : "Copy link"}
                </Button>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          className="office-settings-user-permissions-card"
          subtitle="Open a dedicated full-page editor to review the permission tree and manage per-user overrides."
          title="Permissions"
        >
          {accountAccessChanged ? (
            <p className="office-form-helper">
              Save access first if you want the permission editor to reflect the
              current role, company list, and default company.
            </p>
          ) : null}

          <div className="office-settings-user-permissions-cta">
            <div className="office-settings-user-permissions-copy">
              <strong>
                {canManageSensitiveUsers
                  ? "Dedicated manage page"
                  : "Dedicated read-only page"}
              </strong>
              <p>
                Review role defaults, inherited permissions, and member-level
                overrides in a focused editor. Company rows on the left also
                open directly into each saved company scope.
              </p>
            </div>
            {accountAccessChanged ? (
              <Button disabled type="button" variant="secondary">
                Save access to continue
              </Button>
            ) : (
              <Link
                className="office-button office-button-primary office-button-sm"
                href={permissionEditorHref}
              >
                {canManageSensitiveUsers
                  ? "Edit permissions"
                  : "View permissions"}
              </Link>
            )}
          </div>

          <div className="office-settings-user-permissions-grid">
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
              <strong>
                {snapshot.permissions.effectivePermissions.length}
              </strong>
            </div>
            <div className="office-detail-field">
              <span>Editor mode</span>
              <strong>
                {canManageUsers
                  ? "Dedicated manage page"
                  : "Dedicated read-only page"}
              </strong>
            </div>
          </div>
        </SectionCard>
      </div>

      {showOperationalSections ? (
        <UserTeamAssignmentsCard
          availableTeams={snapshot.availableTeams}
          canManageTeams={canManageTeams}
          memberName={snapshot.profile.name}
          membershipId={snapshot.profile.membershipId}
          teams={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.name,
            roleLabel: team.roleLabel,
            reportsToLabel: team.reportsToLabel,
            isActive: team.isActive,
          }))}
        />
      ) : null}

      {showOperationalSections ? (
        <>
          <div className="office-detail-two-column office-settings-user-detail-grid">
            <SectionCard
              subtitle="Current default company, team memberships, and related profile routing."
              title="Context"
            >
              <div className="office-settings-user-context-list">
                <div className="office-secondary-meta-row">
                  <dt>Default company</dt>
                  <dd>{snapshot.profile.defaultOfficeName}</dd>
                </div>
                <div className="office-secondary-meta-row">
                  <dt>Company access</dt>
                  <dd>{snapshot.profile.officeAccessLabel}</dd>
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
                  <article
                    className="office-settings-user-team-item"
                    key={team.id}
                  >
                    <div>
                      <strong>{team.name}</strong>
                      <p>
                        {team.roleLabel} · {team.reportsToLabel}
                      </p>
                    </div>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>
                      {team.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </article>
                ))}
                {snapshot.teams.length === 0 ? (
                  <p className="office-form-helper">No team assignments yet.</p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              subtitle={`${snapshot.onboarding.completedCount} of ${snapshot.onboarding.totalCount} items complete.`}
              title="Onboarding"
            >
              <div className="office-settings-user-inline-badges">
                <StatusBadge
                  tone={getOnboardingTone(snapshot.onboarding.statusValue)}
                >
                  {snapshot.onboarding.statusLabel}
                </StatusBadge>
                <Badge tone="neutral">
                  {snapshot.onboarding.totalCount} items
                </Badge>
              </div>

              <div className="office-settings-user-onboarding-list">
                {snapshot.onboarding.items.map((item) => (
                  <article
                    className="office-settings-user-onboarding-item"
                    key={item.id}
                  >
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
                      {item.completedAtLabel ? (
                        <small>Completed {item.completedAtLabel}</small>
                      ) : null}
                    </div>
                  </article>
                ))}
                {snapshot.onboarding.items.length === 0 ? (
                  <p className="office-form-helper">
                    No onboarding items have been assigned.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            subtitle="Current commission assignment and recent persisted calculation visibility for this membership."
            title="Commission summary"
          >
            <div className="office-agents-profile-summary-grid">
              <div className="office-detail-field">
                <span>Active plan</span>
                <strong>
                  {snapshot.commission.activePlanLabel || "Manual / unassigned"}
                </strong>
              </div>
              <div className="office-detail-field">
                <span>Plan source</span>
                <strong>
                  {snapshot.commission.activePlanSourceLabel ||
                    "No active assignment"}
                </strong>
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

            {snapshot.commission.recentCalculations.length ? (
              <div className="office-queue-list">
                {snapshot.commission.recentCalculations.map((calculation) => (
                  <QueueItem
                    badge={
                      <StatusBadge
                        tone={getCommissionStatusTone(calculation.status)}
                      >
                        {calculation.status}
                      </StatusBadge>
                    }
                    description={calculation.recipientLabel}
                    key={calculation.id}
                    meta={
                      <>
                        <span>{calculation.statementAmountLabel}</span>
                      </>
                    }
                    title={
                      calculation.transactionHref ? (
                        <Link href={calculation.transactionHref}>
                          {calculation.transactionLabel}
                        </Link>
                      ) : (
                        calculation.transactionLabel
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No commission calculations yet"
                description="No commission calculations have been recorded for this user yet."
              />
            )}
          </SectionCard>

          <SectionCard
            subtitle="Latest audit trail items tied to this user account, invitations, and credential events."
            title="Recent activity"
          >
            <div className="office-settings-user-activity-list">
              {snapshot.recentActivity.map((item) => (
                <article
                  className="office-settings-user-activity-item"
                  key={item.id}
                >
                  <div className="office-settings-user-activity-copy">
                    <strong>{item.actionLabel}</strong>
                    <p>{item.detail}</p>
                    <small>
                      {item.actorDisplayName} · {item.timestampLabel}
                    </small>
                  </div>
                  {item.href ? (
                    <Link
                      className="office-button-secondary office-button-sm"
                      href={item.href}
                    >
                      Open
                    </Link>
                  ) : null}
                </article>
              ))}
              {snapshot.recentActivity.length === 0 ? (
                <p className="office-form-helper">
                  No recent user activity yet.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
