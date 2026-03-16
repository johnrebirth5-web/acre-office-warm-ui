"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  FormField,
  ListPageFilters,
  ListPageFooter,
  ListPageTableSection,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeAdminUserRow, OfficeAdminUsersSnapshot } from "@acre/db";

type OfficeSettingsUsersClientProps = {
  snapshot: OfficeAdminUsersSnapshot;
  canManageUsers: boolean;
};

type UserRowDraft = {
  role: string;
  status: string;
  officeId: string;
};

type CreateUserDraft = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  officeId: string;
  title: string;
};

type GeneratedInviteState = {
  membershipId: string;
  email: string;
  actionLabel: string;
  invitationUrl: string;
  expiresAtLabel: string;
};

type MutationResponse = {
  membershipId: string;
  invitationUrl: string;
  expiresAt: string;
  email?: string;
} | null;

const createRoleOptions = [
  { value: "owner", label: "Owner" },
  { value: "office_admin", label: "Office Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "human_resources", label: "Human Resources" },
  { value: "team_lead", label: "Team Lead" },
  { value: "agent", label: "Agent" }
] as const;

function buildUsersHref(
  pathname: string,
  filters: {
    q: string;
    role: string;
    status: string;
    officeId: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (filters.q.trim()) {
    searchParams.set("q", filters.q.trim());
  }

  if (filters.role.trim()) {
    searchParams.set("role", filters.role.trim());
  }

  if (filters.status.trim()) {
    searchParams.set("status", filters.status.trim());
  }

  if (filters.officeId.trim()) {
    searchParams.set("officeId", filters.officeId.trim());
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getDefaultOfficeId(snapshot: OfficeAdminUsersSnapshot) {
  const preferredOfficeId = snapshot.filters.officeId.trim();
  return snapshot.filters.officeOptions.some((option) => option.id === preferredOfficeId) ? preferredOfficeId : "__all__";
}

function buildCreateUserDraft(snapshot: OfficeAdminUsersSnapshot): CreateUserDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    role: "agent",
    officeId: getDefaultOfficeId(snapshot),
    title: ""
  };
}

function getMembershipTone(status: OfficeAdminUserRow["statusValue"]) {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getAuthTone(row: OfficeAdminUserRow) {
  if (row.mustChangePassword) {
    return "warning" as const;
  }

  if (row.hasCredential) {
    return "success" as const;
  }

  if (row.statusValue === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getInvitationTone(row: OfficeAdminUserRow) {
  if (row.hasActiveInvitation) {
    return "accent" as const;
  }

  if (row.statusValue === "invited") {
    return "warning" as const;
  }

  if (row.hasCredential) {
    return "success" as const;
  }

  return "neutral" as const;
}

function getRoleEditorOptions(row: OfficeAdminUserRow) {
  if (row.roleValue === "office_manager") {
    return [{ value: "office_manager", label: "Office Manager (Legacy)" }, ...createRoleOptions];
  }

  if (row.roleValue === "office_user") {
    return [{ value: "office_user", label: "Office User (Legacy)" }, ...createRoleOptions];
  }

  return createRoleOptions;
}

function getStatusEditorOptions(row: OfficeAdminUserRow) {
  if (row.hasCredential) {
    return [
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" }
    ];
  }

  if (row.statusValue === "invited") {
    return [
      { value: "invited", label: "Invited" },
      { value: "disabled", label: "Disabled" }
    ];
  }

  return [
    { value: "disabled", label: "Disabled" },
    { value: "invited", label: "Invited" }
  ];
}

function getIssueLinkLabel(row: OfficeAdminUserRow) {
  if (row.hasActiveInvitation) {
    return row.statusValue === "invited" ? "Reissue invite" : "Reissue setup link";
  }

  if (row.statusValue === "invited") {
    return "Issue invite";
  }

  return row.hasCredential ? "Reset password" : "Issue setup link";
}

function formatInviteExpiry(isoValue: string) {
  const expiresAt = new Date(isoValue);

  if (Number.isNaN(expiresAt.getTime())) {
    return "Pending";
  }

  return expiresAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

export function OfficeSettingsUsersClient({ snapshot, canManageUsers }: OfficeSettingsUsersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(snapshot.filters.q);
  const [roleFilter, setRoleFilter] = useState(snapshot.filters.role);
  const [statusFilter, setStatusFilter] = useState(snapshot.filters.status);
  const [officeFilter, setOfficeFilter] = useState(snapshot.filters.officeId);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [createUserDraft, setCreateUserDraft] = useState<CreateUserDraft>(() => buildCreateUserDraft(snapshot));
  const [latestInvite, setLatestInvite] = useState<GeneratedInviteState | null>(null);
  const [rowDrafts, setRowDrafts] = useState<Record<string, UserRowDraft>>(
    Object.fromEntries(
      snapshot.rows.map((row) => [
        row.membershipId,
        {
          role: row.roleEditorValue,
          status: row.statusValue,
          officeId: row.officeAccessValue
        }
      ])
    )
  );

  useEffect(() => {
    setSearchQuery(snapshot.filters.q);
    setRoleFilter(snapshot.filters.role);
    setStatusFilter(snapshot.filters.status);
    setOfficeFilter(snapshot.filters.officeId);
    setRowDrafts(
      Object.fromEntries(
        snapshot.rows.map((row) => [
          row.membershipId,
          {
            role: row.roleEditorValue,
            status: row.statusValue,
            officeId: row.officeAccessValue
          }
        ])
      )
    );
    setCreateUserDraft((current) =>
      snapshot.filters.officeOptions.some((option) => option.id === current.officeId)
        ? current
        : {
            ...current,
            officeId: getDefaultOfficeId(snapshot)
          }
    );
  }, [snapshot]);

  const officeOptions = useMemo(() => snapshot.filters.officeOptions, [snapshot.filters.officeOptions]);

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  function setRowDraft(membershipId: string, field: keyof UserRowDraft, value: string) {
    setRowDrafts((current) => ({
      ...current,
      [membershipId]: {
        ...(current[membershipId] ?? { role: "office_user", status: "active", officeId: "__all__" }),
        [field]: value
      }
    }));
  }

  function setCreateField(field: keyof CreateUserDraft, value: string) {
    setCreateUserDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildUsersHref(pathname, {
        q: searchQuery,
        role: roleFilter,
        status: statusFilter,
        officeId: officeFilter
      })
    );
  }

  function handleResetFilters() {
    setSearchQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setOfficeFilter("");
    router.push(
      buildUsersHref(pathname, {
        q: "",
        role: "",
        status: "",
        officeId: ""
      })
    );
  }

  async function handleSaveUser(membershipId: string) {
    const draft = rowDrafts[membershipId];
    if (!draft) {
      return;
    }

    setPendingAction(`save-user:${membershipId}`);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${membershipId}`, {
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

      refreshCurrentPage();
      setActionNotice("User access updated.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update the internal account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-user");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch("/api/office/settings/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(createUserDraft)
      });

      const body = (await response.json().catch(() => null)) as
        | ({
            error?: string;
          } & MutationResponse)
        | null;

      if (!response.ok || !body?.membershipId || !body.invitationUrl || !body.expiresAt) {
        throw new Error(body?.error ?? "Failed to create the invited user.");
      }

      const nextInvite = {
        membershipId: body.membershipId,
        email: body.email ?? createUserDraft.email,
        actionLabel: "Invite link ready",
        invitationUrl: body.invitationUrl,
        expiresAtLabel: formatInviteExpiry(body.expiresAt)
      } satisfies GeneratedInviteState;

      setLatestInvite(nextInvite);
      setCreateUserDraft(buildCreateUserDraft(snapshot));
      setActionNotice("Invited user created. Copy the link below to complete onboarding.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create the invited user.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvitationAction(membershipId: string, action: "issue" | "revoke", email: string) {
    setPendingAction(`${action}:${membershipId}`);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${membershipId}/invitation`, {
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
        if (latestInvite?.membershipId === membershipId) {
          setLatestInvite(null);
        }

        setActionNotice("Invitation revoked.");
        refreshCurrentPage();
        return;
      }

      if (!body?.membershipId || !body.invitationUrl || !body.expiresAt) {
        throw new Error("The server did not return a valid invitation link.");
      }

      setLatestInvite({
        membershipId: body.membershipId,
        email,
        actionLabel: "Setup link ready",
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

  async function handleUnlockUser(membershipId: string) {
    setPendingAction(`unlock:${membershipId}`);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${membershipId}/unlock`, {
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

    setPendingAction("copy-invite");
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

  const userFilters = (
    <ListPageFilters as="form" onSubmit={handleFilterSubmit}>
      <FilterField label="Search">
        <TextInput onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, email, title, office..." value={searchQuery} />
      </FilterField>

      <FilterField label="Role">
        <SelectInput onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
          <option value="">All roles</option>
          {snapshot.filters.roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Status">
        <SelectInput onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="">All statuses</option>
          {snapshot.filters.statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Office access">
        <SelectInput onChange={(event) => setOfficeFilter(event.target.value)} value={officeFilter}>
          <option value="">All assignments</option>
          {officeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <div className="office-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Button onClick={handleResetFilters} type="button" variant="secondary">
          Reset
        </Button>
      </div>
    </ListPageFilters>
  );

  return (
    <>
      {canManageUsers ? (
        <SectionCard
          subtitle="Create invited Back Office accounts across owner, office admin, finance, HR, team lead, and agent tiers. Email delivery is not implemented yet, so setup links are copied from this screen."
          title="Invite internal user"
        >
          <form className="office-form-grid office-form-grid-3" onSubmit={handleCreateUser}>
            <FormField label="First name">
              <TextInput onChange={(event) => setCreateField("firstName", event.target.value)} required value={createUserDraft.firstName} />
            </FormField>

            <FormField label="Last name">
              <TextInput onChange={(event) => setCreateField("lastName", event.target.value)} required value={createUserDraft.lastName} />
            </FormField>

            <FormField label="Email">
              <TextInput
                autoComplete="email"
                onChange={(event) => setCreateField("email", event.target.value)}
                required
                type="email"
                value={createUserDraft.email}
              />
            </FormField>

            <FormField label="Role">
              <SelectInput onChange={(event) => setCreateField("role", event.target.value)} value={createUserDraft.role}>
                {createRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Office access">
              <SelectInput onChange={(event) => setCreateField("officeId", event.target.value)} value={createUserDraft.officeId}>
                {officeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Title">
              <TextInput onChange={(event) => setCreateField("title", event.target.value)} placeholder="Back Office title" value={createUserDraft.title} />
            </FormField>

            <div className="office-form-grid-span-3 office-settings-user-create-actions">
              <Button disabled={pendingAction === "create-user"} type="submit">
                {pendingAction === "create-user" ? "Creating..." : "Create invited user"}
              </Button>
            </div>
          </form>

          {latestInvite ? (
            <div className="office-settings-generated-invite">
              <div className="office-settings-generated-invite-copy">
                <strong>{latestInvite.actionLabel}</strong>
                <p>
                  {latestInvite.email} · Expires {latestInvite.expiresAtLabel}
                </p>
              </div>
              <div className="office-settings-generated-invite-actions">
                <TextInput readOnly value={latestInvite.invitationUrl} />
                <Button disabled={pendingAction === "copy-invite"} onClick={handleCopyLatestInvite} variant="secondary">
                  {pendingAction === "copy-invite" ? "Copying..." : "Copy link"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="office-settings-user-note">Create or reissue an invite to surface a copyable setup link here.</p>
          )}
        </SectionCard>
      ) : null}

      <ListPageTableSection
        filters={userFilters}
        footer={<ListPageFooter summary={`${snapshot.rows.length} internal account rows`} />}
        subtitle="Membership status still controls lifecycle, while password setup and lockout live on the credential layer."
        title="Internal accounts"
      >
        {submitError ? <p className="office-inline-error">{submitError}</p> : null}
        {actionNotice ? <p className="office-inline-success">{actionNotice}</p> : null}

        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-users">
            <span>User</span>
            <span>Role</span>
            <span>Office access</span>
            <span>Membership</span>
            <span>Security</span>
            <span>Actions</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.rows.length ? (
              snapshot.rows.map((row) => {
                const draft = rowDrafts[row.membershipId] ?? {
                  role: row.roleEditorValue,
                  status: row.statusValue,
                  officeId: row.officeAccessValue
                };

                return (
                  <DataTableRow className="office-table-row office-table-row-settings-users" key={row.membershipId}>
                    <div className="office-table-primary">
                      <strong>{row.href ? <Link href={row.href}>{row.name}</Link> : row.name}</strong>
                      <p>
                        {row.email}
                        {row.title ? ` · ${row.title}` : ""}
                      </p>
                      <div className="office-settings-user-badges">
                        <Badge tone={row.roleValue === "office_admin" ? "accent" : "neutral"}>{row.role}</Badge>
                        <StatusBadge tone={getMembershipTone(row.statusValue)}>{row.status}</StatusBadge>
                      </div>
                    </div>

                    {canManageUsers ? (
                      <SelectInput onChange={(event) => setRowDraft(row.membershipId, "role", event.target.value)} value={draft.role}>
                        {getRoleEditorOptions(row).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      <span>{row.role}</span>
                    )}

                    {canManageUsers ? (
                      <SelectInput onChange={(event) => setRowDraft(row.membershipId, "officeId", event.target.value)} value={draft.officeId}>
                        {officeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      <span>{row.officeAccessLabel}</span>
                    )}

                    <div className="office-settings-user-stack">
                      {canManageUsers ? (
                        <SelectInput onChange={(event) => setRowDraft(row.membershipId, "status", event.target.value)} value={draft.status}>
                          {getStatusEditorOptions(row).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectInput>
                      ) : (
                        <StatusBadge tone={getMembershipTone(row.statusValue)}>{row.status}</StatusBadge>
                      )}
                      <p>{row.officeAccessLabel}</p>
                    </div>

                    <div className="office-settings-user-stack">
                      <StatusBadge tone={getAuthTone(row)}>{row.authStatusLabel}</StatusBadge>
                      <Badge tone={getInvitationTone(row)}>{row.invitationStatusLabel}</Badge>
                      {row.invitationExpiresAtLabel ? <p>Invite expires {row.invitationExpiresAtLabel}</p> : null}
                      {row.isLocked ? (
                        <StatusBadge tone="danger">Locked until {row.lockedUntilLabel}</StatusBadge>
                      ) : (
                        <Badge tone="neutral">{row.lockStatusLabel}</Badge>
                      )}
                    </div>

                    <div className="office-table-actions office-settings-user-actions">
                      {canManageUsers ? (
                        <>
                          <Button
                            disabled={pendingAction === `save-user:${row.membershipId}`}
                            onClick={() => handleSaveUser(row.membershipId)}
                            size="sm"
                            variant="secondary"
                          >
                            {pendingAction === `save-user:${row.membershipId}` ? "Saving..." : "Save"}
                          </Button>

                          <Button
                            disabled={pendingAction === `issue:${row.membershipId}`}
                            onClick={() => handleInvitationAction(row.membershipId, "issue", row.email)}
                            size="sm"
                            variant="secondary"
                          >
                            {pendingAction === `issue:${row.membershipId}` ? "Preparing..." : getIssueLinkLabel(row)}
                          </Button>

                          {row.hasActiveInvitation ? (
                            <Button
                              disabled={pendingAction === `revoke:${row.membershipId}`}
                              onClick={() => handleInvitationAction(row.membershipId, "revoke", row.email)}
                              size="sm"
                              variant="secondary"
                            >
                              {pendingAction === `revoke:${row.membershipId}` ? "Revoking..." : "Revoke link"}
                            </Button>
                          ) : null}

                          {row.isLocked ? (
                            <Button
                              disabled={pendingAction === `unlock:${row.membershipId}`}
                              onClick={() => handleUnlockUser(row.membershipId)}
                              size="sm"
                              variant="secondary"
                            >
                              {pendingAction === `unlock:${row.membershipId}` ? "Unlocking..." : "Unlock"}
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <span className="office-table-action-muted">View only</span>
                      )}
                    </div>
                  </DataTableRow>
                );
              })
            ) : (
              <EmptyState description="Try widening the filters or resetting the current search." title="No internal users matched the current filters" />
            )}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </>
  );
}
