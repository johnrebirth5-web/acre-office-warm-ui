"use client";

import type { PermissionKey } from "@acre/auth";
import type {
  OfficeAdminUserDetailSnapshot,
  OrganizationRoleTemplatesSnapshot,
  PermissionOverrideValue,
  PermissionTreeStateNode
} from "@acre/db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, FormField, SectionCard, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import {
  applyOverridesToPermissionTree,
  buildPermissionOverrideMap,
  collectEnabledPermissionKeys,
  serializePermissionOverrideMap
} from "../../permissions-shared";
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
  roleTemplates: OrganizationRoleTemplatesSnapshot;
  canManageUsers: boolean;
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

const inheritPermissionValue = "__inherit__";

function getPermissionStateTone(enabled: boolean) {
  return enabled ? "success" : "neutral";
}

function getPermissionOverrideTone(effect: PermissionOverrideValue | null) {
  if (effect === "allow") {
    return "success" as const;
  }

  if (effect === "deny") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function getPermissionOverrideLabel(effect: PermissionOverrideValue | null) {
  if (effect === "allow") {
    return "User allow";
  }

  if (effect === "deny") {
    return "User deny";
  }

  return "Inherit";
}

function PermissionTreeEditor(props: {
  nodes: PermissionTreeStateNode[];
  disabled: boolean;
  onOverrideChange: (permissionKey: PermissionKey, effect: PermissionOverrideValue | null) => void;
  level?: number;
}) {
  const level = props.level ?? 0;

  return (
    <div className={`office-permission-tree${level > 0 ? " office-permission-tree-nested" : ""}`}>
      {props.nodes.map((node) => (
        <div className="office-permission-node" key={node.key}>
          <div className="office-permission-node-header">
            <div className="office-permission-node-copy">
              <div className="office-permission-node-heading">
                <strong>{node.label}</strong>
                <code>{node.key}</code>
              </div>
              <p>{node.description}</p>
              <div className="office-permission-node-badges">
                <Badge tone={getPermissionStateTone(node.effectiveEnabled)}>{node.effectiveEnabled ? "Enabled" : "Disabled"}</Badge>
                <Badge tone={node.inheritedEnabled ? "accent" : "neutral"}>
                  {node.inheritedEnabled ? "Role template" : "Not inherited"}
                </Badge>
                <Badge tone={getPermissionOverrideTone(node.overrideEffect)}>{getPermissionOverrideLabel(node.overrideEffect)}</Badge>
              </div>
            </div>

            <div className="office-permission-node-controls">
              <SelectInput
                disabled={props.disabled || !node.editable}
                onChange={(event) =>
                  props.onOverrideChange(
                    node.key,
                    event.target.value === inheritPermissionValue ? null : (event.target.value as PermissionOverrideValue)
                  )
                }
                value={node.overrideEffect ?? inheritPermissionValue}
              >
                <option value={inheritPermissionValue}>Inherit role template</option>
                <option value="allow">Allow for this user</option>
                <option value="deny">Deny for this user</option>
              </SelectInput>
            </div>
          </div>

          {node.children.length > 0 ? (
            <PermissionTreeEditor
              disabled={props.disabled}
              level={level + 1}
              nodes={node.children}
              onOverrideChange={props.onOverrideChange}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OfficeSettingsUserDetailClient({
  snapshot,
  roleTemplates,
  canManageUsers
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
  const [permissionOverrides, setPermissionOverrides] = useState(() => buildPermissionOverrideMap(snapshot.permissions.overrides));

  useEffect(() => {
    setDraft({
      role: snapshot.profile.roleValue,
      status: snapshot.profile.statusValue,
      officeId: snapshot.profile.officeAccessValue
    });
    setPermissionOverrides(buildPermissionOverrideMap(snapshot.permissions.overrides));
  }, [
    snapshot.permissions.overrides,
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

  async function handleSavePermissions() {
    setPendingAction("permissions-save");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/permissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          overrides: [...permissionOverrides.entries()].map(([permissionKey, effect]) => ({
            permissionKey,
            effect
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update permission overrides.");
      }

      setActionNotice("User permission overrides updated.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update permission overrides.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPermissions() {
    setPendingAction("permissions-reset");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/permissions`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to reset permission overrides.");
      }

      setPermissionOverrides(new Map<PermissionKey, PermissionOverrideValue>());
      setActionNotice("Permission overrides reset to role defaults.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to reset permission overrides.");
    } finally {
      setPendingAction(null);
    }
  }

  function setPermissionOverride(permissionKey: PermissionKey, effect: PermissionOverrideValue | null) {
    setPermissionOverrides((current) => {
      const next = new Map(current);

      if (effect) {
        next.set(permissionKey, effect);
      } else {
        next.delete(permissionKey);
      }

      return next;
    });
  }

  const roleTemplateMap = useMemo(
    () => new Map(roleTemplates.roles.map((template) => [template.role, template])),
    [roleTemplates.roles]
  );
  const selectedRoleTemplate = roleTemplateMap.get(draft.role as OfficeAdminUserDetailSnapshot["profile"]["roleValue"]) ?? null;
  const previewTree = useMemo(() => {
    const baseTree = selectedRoleTemplate?.tree ?? snapshot.permissions.tree;
    return applyOverridesToPermissionTree(baseTree, permissionOverrides);
  }, [permissionOverrides, selectedRoleTemplate, snapshot.permissions.tree]);
  const effectivePreviewPermissions = useMemo(() => collectEnabledPermissionKeys(previewTree), [previewTree]);
  const serializedInitialOverrides = useMemo(
    () => serializePermissionOverrideMap(buildPermissionOverrideMap(snapshot.permissions.overrides)),
    [snapshot.permissions.overrides]
  );
  const serializedDraftOverrides = useMemo(() => serializePermissionOverrideMap(permissionOverrides), [permissionOverrides]);
  const isPermissionsDirty = serializedInitialOverrides !== serializedDraftOverrides;
  const roleChanged = draft.role !== snapshot.profile.roleValue;
  const activeRoleDescription = selectedRoleTemplate?.description ?? snapshot.permissions.roleDescription;

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
              {snapshot.profile.agentProfileHref ? (
                <Link className="office-button office-button-secondary office-button-sm" href={snapshot.profile.agentProfileHref}>
                  Open agent profile
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
            <div className="office-settings-user-inline-badges">
              <Badge tone="accent">{selectedRoleTemplate?.label ?? snapshot.permissions.roleLabel}</Badge>
              <Badge tone="neutral">{snapshot.permissions.overrides.length} persisted overrides</Badge>
              <Badge tone="success">{effectivePreviewPermissions.length} effective permissions</Badge>
            </div>
          }
          subtitle={activeRoleDescription}
          title="Permissions"
        >
          {roleChanged ? (
            <p className="office-form-helper">
              Role changes are previewed live below. Save access first, then save permission overrides if you want them applied against
              the new role template.
            </p>
          ) : null}

          <div className="office-settings-user-detail-actions">
            {canManageUsers ? (
              <>
                <Button disabled={!isPermissionsDirty || roleChanged || pendingAction === "permissions-save"} onClick={handleSavePermissions}>
                  {pendingAction === "permissions-save" ? "Saving..." : "Save permissions"}
                </Button>
                <Button
                  disabled={permissionOverrides.size === 0 || pendingAction === "permissions-reset"}
                  onClick={handleResetPermissions}
                  variant="secondary"
                >
                  {pendingAction === "permissions-reset" ? "Resetting..." : "Reset to role defaults"}
                </Button>
              </>
            ) : (
              <span className="office-table-action-muted">View only</span>
            )}
          </div>

          <PermissionTreeEditor
            disabled={!canManageUsers || roleChanged}
            nodes={previewTree}
            onOverrideChange={setPermissionOverride}
          />
        </SectionCard>
      </div>

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
    </div>
  );
}
