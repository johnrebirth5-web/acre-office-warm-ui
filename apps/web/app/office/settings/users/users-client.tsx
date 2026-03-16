"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Badge, Button, DataTable, DataTableBody, DataTableHeader, EmptyState, FilterField, FormField, ListPageFooter, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeAdminUsersSnapshot } from "@acre/db";
import {
  copyTextToClipboard,
  createRoleOptions,
  formatInviteExpiry,
  getAuthTone,
  getInvitationTone,
  getMembershipTone,
  getOnboardingTone,
  getRoleConfigurationHint
} from "./users-shared";

type OfficeSettingsUsersClientProps = {
  snapshot: OfficeAdminUsersSnapshot;
  canManageUsers: boolean;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUserDraft, setCreateUserDraft] = useState<CreateUserDraft>(() => buildCreateUserDraft(snapshot));
  const [latestInvite, setLatestInvite] = useState<GeneratedInviteState | null>(null);

  useEffect(() => {
    setSearchQuery(snapshot.filters.q);
    setRoleFilter(snapshot.filters.role);
    setStatusFilter(snapshot.filters.status);
    setOfficeFilter(snapshot.filters.officeId);
    setCreateUserDraft((current) =>
      snapshot.filters.officeOptions.some((option) => option.id === current.officeId)
        ? current
        : {
            ...current,
            officeId: getDefaultOfficeId(snapshot)
          }
    );
  }, [snapshot]);

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
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

      setLatestInvite({
        membershipId: body.membershipId,
        email: body.email ?? createUserDraft.email,
        actionLabel: "Invite link ready",
        invitationUrl: body.invitationUrl,
        expiresAtLabel: formatInviteExpiry(body.expiresAt)
      });
      setCreateUserDraft(buildCreateUserDraft(snapshot));
      setActionNotice("Invited user created. Copy the link below to complete onboarding.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create the invited user.");
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

  return (
    <>
      <section className="office-section-card office-settings-users-roster-card">
        <header className="office-section-head office-settings-users-roster-head">
          <div className="office-section-copy">
            <h3>Internal accounts</h3>
            <p>Search by name, email, role, or office, then open a user to manage access, invitation state, and activity.</p>
          </div>
          {canManageUsers ? (
            <Button className="office-settings-users-create-button" onClick={() => setIsCreateModalOpen(true)} type="button">
              Create user
            </Button>
          ) : null}
        </header>

        <div className="office-section-body">
          <form className="office-filter-bar office-settings-users-filter-bar" onSubmit={handleFilterSubmit}>
            <FilterField className="office-settings-users-search-field" label="Search">
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
                {snapshot.filters.officeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FilterField>

            <div className="office-filter-actions office-settings-users-filter-actions">
              <Button type="submit">Apply filters</Button>
              <Button onClick={handleResetFilters} type="button" variant="secondary">
                Reset
              </Button>
            </div>
          </form>

          {submitError ? <p className="office-inline-error">{submitError}</p> : null}
          {actionNotice ? <p className="office-inline-success">{actionNotice}</p> : null}

          <DataTable className="office-table office-settings-users-table">
            <DataTableHeader className="office-table-header office-table-row office-table-row-settings-users-roster">
              <span>User</span>
              <span>Email</span>
              <span>Onboarding</span>
              <span>Security</span>
              <span>Role</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.rows.length ? (
                snapshot.rows.map((row) =>
                  row.href ? (
                    <Link className="office-table-row office-table-row-settings-users-roster office-settings-users-link-row" href={row.href} key={row.membershipId}>
                      <div className="office-settings-users-primary">
                        <strong>{row.name}</strong>
                        <p>
                          {row.title ? `${row.title} · ` : ""}
                          {row.officeAccessLabel}
                        </p>
                      </div>
                      <div className="office-settings-users-cell">
                        <strong>{row.email}</strong>
                        <p>{row.status}</p>
                      </div>
                      <div className="office-settings-users-cell">
                        {row.onboardingStatusValue ? (
                          <StatusBadge tone={getOnboardingTone(row.onboardingStatusValue)}>{row.onboardingStatusLabel}</StatusBadge>
                        ) : (
                          <Badge tone="neutral">No onboarding</Badge>
                        )}
                        <p>{row.onboardingStatusValue ? "Agent onboarding tracked" : "No onboarding profile"}</p>
                      </div>
                      <div className="office-settings-users-cell">
                        <div className="office-settings-user-badges">
                          <StatusBadge tone={getAuthTone(row)}>{row.authStatusLabel}</StatusBadge>
                          <Badge tone={getInvitationTone(row)}>{row.invitationStatusLabel}</Badge>
                        </div>
                        <p>{row.isLocked ? `Locked until ${row.lockedUntilLabel}` : row.lockStatusLabel}</p>
                      </div>
                      <div className="office-settings-users-cell office-settings-users-role-cell">
                        <Badge tone={row.roleValue === "office_admin" || row.roleValue === "owner" ? "accent" : "neutral"}>{row.role}</Badge>
                        <StatusBadge tone={getMembershipTone(row.statusValue)}>{row.status}</StatusBadge>
                      </div>
                    </Link>
                  ) : null
                )
              ) : (
                <EmptyState description="Try widening the filters or resetting the current search." title="No internal users matched the current filters" />
              )}
            </DataTableBody>
          </DataTable>

          <ListPageFooter summary={`${snapshot.rows.length} internal account rows`} />
        </div>
      </section>

      {isCreateModalOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <section className="bm-transaction-modal office-settings-users-create-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header office-settings-users-modal-header">
              <div className="bm-transaction-modal-title-block">
                <h3>Create user</h3>
                <p>Invite a new internal Back Office account and copy the setup link from this panel.</p>
              </div>
              <button aria-label="Close create user panel" onClick={() => setIsCreateModalOpen(false)} type="button">
                Close
              </button>
            </header>

            <div className="bm-transaction-modal-body office-settings-users-modal-body">
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
                  <p className="office-settings-user-note">{getRoleConfigurationHint(createUserDraft.role)}</p>
                </FormField>

                <FormField label="Office access">
                  <SelectInput onChange={(event) => setCreateField("officeId", event.target.value)} value={createUserDraft.officeId}>
                    {snapshot.filters.officeOptions.map((option) => (
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
                <p className="office-settings-user-note">Create a user to generate a copyable invite link here.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
