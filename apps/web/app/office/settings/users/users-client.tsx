"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Badge, Button, DataTable, DataTableBody, DataTableHeader, EmptyState, FilterField, FormField, ListPageFooter, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeAdminUsersSnapshot } from "@acre/db";
import { OfficeListPagePagination } from "../../_components/office-list-page-template";
import {
  copyTextToClipboard,
  formatInviteExpiry,
  getAuthTone,
  getCreateRoleOptions,
  getInvitationTone,
  getMembershipTone,
  getOnboardingTone,
  getRoleConfigurationHint
} from "./users-shared";

type OfficeSettingsUsersClientProps = {
  snapshot: OfficeAdminUsersSnapshot;
  canManageUsers: boolean;
  canManageAdminRoles: boolean;
  canManageTeams: boolean;
};

type CreateUserDraft = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  defaultOfficeId: string;
  accessibleOfficeIds: string[];
  title: string;
  splitTemplateId: string;
  customAgentPercent: string;
  commissionEffectiveFrom: string;
  teamId: string;
  reportsToTeamMembershipId: string;
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

const usersPageSizeOptions = [50] as const;

function buildUsersHref(
  pathname: string,
  filters: {
    q: string;
    role: string;
    status: string;
    officeId: string;
    page?: number;
  }
) {
  const searchParams = new URLSearchParams();
  searchParams.set("view", "access");

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

  if ((filters.page ?? 1) > 1) {
    searchParams.set("page", String(filters.page));
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getDefaultOfficeId(snapshot: OfficeAdminUsersSnapshot) {
  const preferredOfficeId = snapshot.filters.officeId.trim();
  if (
    preferredOfficeId &&
    snapshot.createOptions.officeOptions.some(
      (option) => option.id === preferredOfficeId,
    )
  ) {
    return preferredOfficeId;
  }

  return snapshot.createOptions.officeOptions[0]?.id ?? "__all__";
}

function getActualOfficeOptions(snapshot: OfficeAdminUsersSnapshot) {
  return snapshot.createOptions.officeOptions;
}

function roleHasImplicitAllCompanyAccess(role: string) {
  return role === "owner" || role === "office_admin" || role === "office_manager";
}

function buildCreateUserDraft(snapshot: OfficeAdminUsersSnapshot): CreateUserDraft {
  const defaultOfficeId = getDefaultOfficeId(snapshot);
  const actualOfficeOptions = getActualOfficeOptions(snapshot);

  return {
    firstName: "",
    lastName: "",
    email: "",
    role: "agent",
    defaultOfficeId,
    accessibleOfficeIds:
      defaultOfficeId !== "__all__"
        ? [defaultOfficeId]
        : actualOfficeOptions[0]
          ? [actualOfficeOptions[0].id]
          : [],
    title: "",
    splitTemplateId: "",
    customAgentPercent: "",
    commissionEffectiveFrom: new Date().toISOString().slice(0, 10),
    teamId: "",
    reportsToTeamMembershipId: ""
  };
}

function roleSupportsTeamAssignment(role: string) {
  return role === "agent" || role === "team_lead";
}

function getCreateAssignableTeams(snapshot: OfficeAdminUsersSnapshot, officeId: string) {
  if (!officeId || officeId === "__all__") {
    return snapshot.createOptions.assignableTeams;
  }

  return snapshot.createOptions.assignableTeams.filter((team) => team.officeId === officeId || team.officeId === null);
}

function formatCreateTeamOptionLabel(
  team: OfficeAdminUsersSnapshot["createOptions"]["assignableTeams"][number]
) {
  return `${team.officeName} · ${team.label}`;
}

export function OfficeSettingsUsersClient({
  snapshot,
  canManageUsers,
  canManageAdminRoles,
  canManageTeams
}: OfficeSettingsUsersClientProps) {
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
  const actualOfficeOptions = getActualOfficeOptions(snapshot);
  const hasImplicitAllCompanyAccess = roleHasImplicitAllCompanyAccess(createUserDraft.role);
  const canAssignTeamOnCreate = canManageTeams && roleSupportsTeamAssignment(createUserDraft.role);
  const assignableCreateRoleOptions = getCreateRoleOptions(canManageAdminRoles);
  const createAssignableTeams = getCreateAssignableTeams(snapshot, createUserDraft.defaultOfficeId);
  const selectedCreateTeam = createAssignableTeams.find((team) => team.id === createUserDraft.teamId) ?? null;
  const pageStart = snapshot.totalCount === 0 ? 0 : (snapshot.page - 1) * snapshot.pageSize + 1;
  const pageEnd = snapshot.totalCount === 0 ? 0 : Math.min(snapshot.page * snapshot.pageSize, snapshot.totalCount);

  useEffect(() => {
    setSearchQuery(snapshot.filters.q);
    setRoleFilter(snapshot.filters.role);
    setStatusFilter(snapshot.filters.status);
    setOfficeFilter(snapshot.filters.officeId);
    setCreateUserDraft((current) =>
      actualOfficeOptions.some((option) => option.id === current.defaultOfficeId)
        ? current
        : {
            ...current,
            defaultOfficeId: getDefaultOfficeId(snapshot),
            accessibleOfficeIds: getDefaultOfficeId(snapshot) !== "__all__" ? [getDefaultOfficeId(snapshot)] : []
          }
    );
  }, [actualOfficeOptions, snapshot]);

  useEffect(() => {
    const nextAssignableTeams = getCreateAssignableTeams(snapshot, createUserDraft.defaultOfficeId);
    const nextSelectedTeam = nextAssignableTeams.find((team) => team.id === createUserDraft.teamId) ?? null;

    if (!canAssignTeamOnCreate) {
      if (createUserDraft.teamId || createUserDraft.reportsToTeamMembershipId) {
        setCreateUserDraft((current) => ({
          ...current,
          teamId: "",
          reportsToTeamMembershipId: ""
        }));
      }
      return;
    }

    const teamStillAvailable = createUserDraft.teamId
      ? nextAssignableTeams.some((team) => team.id === createUserDraft.teamId)
      : true;

    if (!teamStillAvailable && (createUserDraft.teamId || createUserDraft.reportsToTeamMembershipId)) {
      setCreateUserDraft((current) => ({
        ...current,
        teamId: "",
        reportsToTeamMembershipId: ""
      }));
      return;
    }

    if (!nextSelectedTeam) {
      return;
    }

    const managerStillAvailable = nextSelectedTeam.managerOptions.some(
      (manager) => manager.teamMembershipId === createUserDraft.reportsToTeamMembershipId
    );

    if (!managerStillAvailable) {
      setCreateUserDraft((current) => ({
        ...current,
        reportsToTeamMembershipId: nextSelectedTeam.defaultReportsToTeamMembershipId ?? ""
      }));
    }
  }, [
    canAssignTeamOnCreate,
    createUserDraft.defaultOfficeId,
    createUserDraft.reportsToTeamMembershipId,
    createUserDraft.teamId,
    snapshot
  ]);

  useEffect(() => {
    if (hasImplicitAllCompanyAccess) {
      const allOfficeIds = actualOfficeOptions.map((option) => option.id);
      const nextDefaultOfficeId =
        allOfficeIds.includes(createUserDraft.defaultOfficeId)
          ? createUserDraft.defaultOfficeId
          : allOfficeIds[0] ?? "__all__";
      const currentSerialized = JSON.stringify([...createUserDraft.accessibleOfficeIds].sort());
      const nextSerialized = JSON.stringify([...allOfficeIds].sort());

      if (currentSerialized !== nextSerialized || createUserDraft.defaultOfficeId !== nextDefaultOfficeId) {
        setCreateUserDraft((current) => ({
          ...current,
          defaultOfficeId: nextDefaultOfficeId,
          accessibleOfficeIds: allOfficeIds
        }));
      }
      return;
    }

    if (
      createUserDraft.accessibleOfficeIds.length === 0 &&
      actualOfficeOptions[0]
    ) {
      setCreateUserDraft((current) => ({
        ...current,
        defaultOfficeId: current.defaultOfficeId !== "__all__" ? current.defaultOfficeId : actualOfficeOptions[0]?.id ?? "__all__",
        accessibleOfficeIds: [actualOfficeOptions[0]?.id ?? ""].filter(Boolean)
      }));
      return;
    }

    if (
      createUserDraft.defaultOfficeId &&
      !createUserDraft.accessibleOfficeIds.includes(createUserDraft.defaultOfficeId)
    ) {
      setCreateUserDraft((current) => ({
        ...current,
        defaultOfficeId: current.accessibleOfficeIds[0] ?? "__all__"
      }));
    }
  }, [
    actualOfficeOptions,
    createUserDraft.accessibleOfficeIds,
    createUserDraft.defaultOfficeId,
    hasImplicitAllCompanyAccess
  ]);

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

  function toggleCreateOfficeAccess(officeId: string, checked: boolean) {
    setCreateUserDraft((current) => {
      if (!checked && current.accessibleOfficeIds.length === 1 && current.accessibleOfficeIds.includes(officeId)) {
        return current;
      }

      const accessibleOfficeIds = checked
        ? [...new Set([...current.accessibleOfficeIds, officeId])]
        : current.accessibleOfficeIds.filter((currentOfficeId) => currentOfficeId !== officeId);
      const defaultOfficeId = checked
        ? current.defaultOfficeId && current.defaultOfficeId !== "__all__"
          ? current.defaultOfficeId
          : officeId
        : current.defaultOfficeId === officeId
          ? (accessibleOfficeIds[0] ?? "")
          : current.defaultOfficeId;

      return {
        ...current,
        defaultOfficeId,
        accessibleOfficeIds
      };
    });
  }

  function setCreateDefaultOffice(officeId: string) {
    setCreateUserDraft((current) => ({
      ...current,
      defaultOfficeId: officeId,
      accessibleOfficeIds: roleHasImplicitAllCompanyAccess(current.role)
        ? current.accessibleOfficeIds
        : current.accessibleOfficeIds.includes(officeId)
          ? current.accessibleOfficeIds
          : [...current.accessibleOfficeIds, officeId]
    }));
  }

  function openCreateModal() {
    setSubmitError("");
    setActionNotice("");
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setSubmitError("");
    setActionNotice("");
    setIsCreateModalOpen(false);
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildUsersHref(pathname, {
        q: searchQuery,
        role: roleFilter,
        status: statusFilter,
        officeId: officeFilter,
        page: 1
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
        officeId: "",
        page: 1
      })
    );
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-user");
    setSubmitError("");
    setActionNotice("");

    try {
      if (!createUserDraft.splitTemplateId && !createUserDraft.customAgentPercent.trim()) {
        throw new Error("Choose a default split template or enter a custom agent split.");
      }

      if (!createUserDraft.defaultOfficeId || createUserDraft.defaultOfficeId === "__all__") {
        throw new Error("Choose a default company.");
      }

      if (!hasImplicitAllCompanyAccess && createUserDraft.accessibleOfficeIds.length === 0) {
        throw new Error("Choose at least one company for this user.");
      }

      const createPayload = {
        ...createUserDraft,
        accessibleOfficeIds: hasImplicitAllCompanyAccess
          ? actualOfficeOptions.map((option) => option.id)
          : createUserDraft.accessibleOfficeIds,
        teamId: canAssignTeamOnCreate ? createUserDraft.teamId : "",
        reportsToTeamMembershipId: canAssignTeamOnCreate ? createUserDraft.reportsToTeamMembershipId : ""
      };

      const response = await fetch("/api/office/settings/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(createPayload)
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
            <p>
              <strong>{snapshot.totalCount}</strong> internal accounts in the current result set. Search by name, email, role, or company, then open a user to manage access, invitation state, and activity.
            </p>
          </div>
          {canManageUsers ? (
            <Button className="office-settings-users-create-button" onClick={openCreateModal} type="button">
              Create user
            </Button>
          ) : null}
        </header>

        <div className="office-section-body">
          <form className="office-filter-bar office-settings-users-filter-bar" onSubmit={handleFilterSubmit}>
            <FilterField className="office-settings-users-search-field" label="Search">
              <TextInput onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, email, title, company..." value={searchQuery} />
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

            <FilterField label="Company access">
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

          <ListPageFooter
            controls={
              <OfficeListPagePagination
                nextHref={
                  snapshot.page < snapshot.totalPages
                    ? buildUsersHref(pathname, {
                        q: snapshot.filters.q,
                        role: snapshot.filters.role,
                        status: snapshot.filters.status,
                        officeId: snapshot.filters.officeId,
                        page: snapshot.page + 1
                      })
                    : undefined
                }
                onPageSizeChange={() => undefined}
                page={snapshot.page}
                pageSize={snapshot.pageSize}
                pageSizeOptions={usersPageSizeOptions}
                previousHref={
                  snapshot.page > 1
                    ? buildUsersHref(pathname, {
                        q: snapshot.filters.q,
                        role: snapshot.filters.role,
                        status: snapshot.filters.status,
                        officeId: snapshot.filters.officeId,
                        page: snapshot.page - 1
                      })
                    : undefined
                }
                showPageSize={false}
                totalPages={snapshot.totalPages}
              />
            }
            summary={`${pageStart}-${pageEnd} of ${snapshot.totalCount} internal account rows`}
          />
        </div>
      </section>

      {isCreateModalOpen ? (
        <div className="office-modal-overlay office-create-modal-overlay office-settings-users-modal-overlay" onClick={closeCreateModal}>
          <section
            aria-labelledby="office-settings-users-create-title"
            aria-modal="true"
            className="office-modal office-create-modal office-settings-users-create-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-modal-header office-create-modal-header office-settings-users-modal-header">
              <div className="office-modal-title-block office-create-modal-title-block office-settings-users-modal-title-block">
                <span className="office-create-modal-kicker office-settings-users-modal-kicker">Internal accounts</span>
                <h3 id="office-settings-users-create-title">Create user</h3>
                <p>Invite a new internal Back Office account and copy the setup link from this panel.</p>
              </div>
              <Button aria-label="Close create user panel" onClick={closeCreateModal} size="sm" type="button" variant="ghost">
                Close
              </Button>
            </header>

            <div className="office-modal-body office-create-modal-body office-settings-users-modal-body">
              <form className="office-settings-users-create-form" onSubmit={handleCreateUser}>
                <section className="office-create-modal-section office-settings-users-create-section">
                  <div className="office-create-modal-section-head office-settings-users-create-section-head">
                    <h4>Account details</h4>
                    <p>Capture the invited user identity, company assignment, and role before sending the setup link.</p>
                  </div>

                  <div className="office-form-grid office-form-grid-3 office-settings-users-create-grid">
                    <FormField label="First name">
                      <TextInput autoComplete="given-name" onChange={(event) => setCreateField("firstName", event.target.value)} required value={createUserDraft.firstName} />
                    </FormField>

                    <FormField label="Last name">
                      <TextInput autoComplete="family-name" onChange={(event) => setCreateField("lastName", event.target.value)} required value={createUserDraft.lastName} />
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
                        {assignableCreateRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField label="Default company">
                      <SelectInput onChange={(event) => setCreateDefaultOffice(event.target.value)} value={createUserDraft.defaultOfficeId}>
                        {actualOfficeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField className="office-form-grid-span-3" label="Company access">
                      <div aria-label="Company access options" className="office-settings-users-company-access-grid" role="group">
                        {actualOfficeOptions.map((option) => {
                          const hasAccess = hasImplicitAllCompanyAccess || createUserDraft.accessibleOfficeIds.includes(option.id);
                          const isDefault = createUserDraft.defaultOfficeId === option.id;
                          const description = hasImplicitAllCompanyAccess
                            ? "Included automatically for this role"
                            : isDefault
                              ? "Default sign-in company"
                              : hasAccess
                                ? "Access granted"
                                : "Click to grant access";

                          return (
                            <label
                              className={`office-settings-users-company-access-option${hasAccess ? " is-selected" : ""}${hasImplicitAllCompanyAccess ? " is-disabled" : ""}`}
                              key={option.id}
                            >
                              <span className="office-settings-users-company-access-option-control">
                                <input
                                  checked={hasAccess}
                                  disabled={hasImplicitAllCompanyAccess}
                                  onChange={(event) => toggleCreateOfficeAccess(option.id, event.target.checked)}
                                  type="checkbox"
                                />
                              </span>
                              <span className="office-settings-users-company-access-option-copy">
                                <span className="office-settings-users-company-access-option-title">
                                  <strong>{option.label}</strong>
                                  {isDefault ? <Badge tone="accent">Default</Badge> : null}
                                </span>
                                <span className="office-settings-users-company-access-option-description">{description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </FormField>

                    <FormField label="Title">
                      <TextInput onChange={(event) => setCreateField("title", event.target.value)} placeholder="Back Office title" value={createUserDraft.title} />
                    </FormField>

                    <p className="office-form-grid-span-3 office-settings-users-modal-note">{getRoleConfigurationHint(createUserDraft.role)}</p>
                    <p className="office-form-grid-span-3 office-form-helper">
                      {hasImplicitAllCompanyAccess
                        ? "This role automatically receives access to all companies. You only need to pick the default company above."
                        : "Use the checkboxes to choose every company this user can access. At least one company must stay selected, and the default company stays inside the selected access list automatically."}
                    </p>
                    {!canManageAdminRoles ? (
                      <p className="office-form-grid-span-3 office-form-helper">
                        Owner and Office Admin assignments are limited to current Owner / Office Admin users.
                      </p>
                    ) : null}
                  </div>
                </section>

                {canAssignTeamOnCreate ? (
                  <section className="office-create-modal-section office-settings-users-create-section">
                    <div className="office-create-modal-section-head office-settings-users-create-section-head">
                      <h4>Placement</h4>
                      <p>Optionally assign a branch and manager so the user lands in the right reporting structure on day one.</p>
                    </div>

                    <div className="office-form-grid office-settings-users-create-grid">
                      <FormField label="Team / branch">
                        <SelectInput
                          onChange={(event) =>
                            setCreateUserDraft((current) => {
                              const nextTeamId = event.target.value;
                              const nextTeam = createAssignableTeams.find((team) => team.id === nextTeamId) ?? null;

                              return {
                                ...current,
                                teamId: nextTeamId,
                                reportsToTeamMembershipId: nextTeam?.defaultReportsToTeamMembershipId ?? ""
                              };
                            })
                          }
                          value={createUserDraft.teamId}
                        >
                          <option value="">No team assignment</option>
                          {createAssignableTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {formatCreateTeamOptionLabel(team)}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>

                      <FormField label="Direct manager">
                        <SelectInput
                          disabled={!selectedCreateTeam || selectedCreateTeam.managerOptions.length === 0}
                          onChange={(event) => setCreateField("reportsToTeamMembershipId", event.target.value)}
                          value={createUserDraft.reportsToTeamMembershipId}
                        >
                          <option value="">No direct manager</option>
                          {(selectedCreateTeam?.managerOptions ?? []).map((manager) => (
                            <option key={manager.teamMembershipId} value={manager.teamMembershipId}>
                              {manager.label} · {manager.role}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>

                      <p className="office-form-grid-span-2 office-settings-users-modal-note">
                        Optional. Choose a top-level team or a junior branch during onboarding.
                      </p>
                    </div>
                  </section>
                ) : null}

                <section className="office-create-modal-section office-settings-users-create-section">
                  <div className="office-create-modal-section-head office-settings-users-create-section-head">
                    <h4>Commission defaults</h4>
                    <p>Pick a split template or enter a custom agent percentage before the invitation is sent.</p>
                  </div>

                  <div className="office-form-grid office-form-grid-3 office-settings-users-create-grid">
                    <FormField label="Default split template">
                      <SelectInput
                        onChange={(event) =>
                          setCreateUserDraft((current) => ({
                            ...current,
                            splitTemplateId: event.target.value,
                            customAgentPercent: event.target.value ? "" : current.customAgentPercent
                          }))
                        }
                        value={createUserDraft.splitTemplateId}
                      >
                        <option value="">Select template</option>
                        {snapshot.filters.commissionTemplateOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label} ({option.agentPercent}/{option.companyPercent})
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField label="Custom agent split %">
                      <TextInput
                        onChange={(event) =>
                          setCreateUserDraft((current) => ({
                            ...current,
                            customAgentPercent: event.target.value,
                            splitTemplateId: event.target.value.trim() ? "" : current.splitTemplateId
                          }))
                        }
                        placeholder="Example: 50"
                        value={createUserDraft.customAgentPercent}
                      />
                    </FormField>

                    <FormField label="Split effective from">
                      <TextInput
                        onChange={(event) => setCreateField("commissionEffectiveFrom", event.target.value)}
                        required
                        type="date"
                        value={createUserDraft.commissionEffectiveFrom}
                      />
                    </FormField>

                    <p className="office-form-grid-span-3 office-settings-users-modal-note">
                      Choose a split template or enter a custom agent percentage. The company share is calculated from the remaining balance.
                    </p>
                  </div>
                </section>

                {submitError ? <p className="office-inline-error office-settings-users-modal-feedback">{submitError}</p> : null}
                {actionNotice ? <p className="office-inline-success office-settings-users-modal-feedback">{actionNotice}</p> : null}

                <footer className="office-create-modal-footer office-settings-users-modal-footer">
                  <div className="office-create-modal-footer-copy office-settings-users-modal-footer-copy">
                    <strong>Send the invite after review</strong>
                    <p>The newest setup link will appear below immediately after the user record is created.</p>
                  </div>

                  <div className="office-settings-user-create-actions">
                    <Button disabled={pendingAction === "create-user"} type="submit">
                      {pendingAction === "create-user" ? "Creating..." : "Create invited user"}
                    </Button>
                  </div>
                </footer>
              </form>

              <section className="office-create-modal-section office-settings-users-invite-panel">
                <div className="office-settings-users-invite-panel-head">
                  <h4>Invite link</h4>
                  <p>Copy the latest generated link here and send it to the user to finish setup.</p>
                </div>

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
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
