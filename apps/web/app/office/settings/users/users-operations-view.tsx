import Link from "next/link";
import { Button, DataTable, DataTableBody, DataTableHeader, EmptyState, FilterField, ListPageFooter, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";

type OfficeSettingsUsersOperationsViewProps = {
  snapshot: OfficeAgentsRosterSnapshot;
};

const onboardingStatusOptions = [
  { value: "", label: "All onboarding states" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" }
] as const;

const membershipStatusOptions = [
  { value: "", label: "All member states" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
] as const;

function getMembershipTone(value: OfficeAgentsRosterSnapshot["rows"][number]["membershipStatusValue"]) {
  if (value === "active") {
    return "success" as const;
  }

  if (value === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getOnboardingTone(value: string) {
  if (value === "Complete") {
    return "success" as const;
  }

  if (value === "In progress") {
    return "accent" as const;
  }

  return "warning" as const;
}

export function OfficeSettingsUsersOperationsView({ snapshot }: OfficeSettingsUsersOperationsViewProps) {
  const hasActiveRosterFilters = Boolean(
    snapshot.filters.q ||
      snapshot.filters.officeId ||
      snapshot.filters.role ||
      snapshot.filters.teamId ||
      snapshot.filters.onboardingStatus ||
      snapshot.filters.membershipStatus
  );

  return (
    <section className="office-section-card office-settings-users-roster-card">
      <header className="office-section-head office-settings-users-roster-head">
        <div className="office-section-copy">
          <h3>Operational roster</h3>
          <p>Search the member roster and review team, onboarding, workload, transaction, goal, and billing summaries from one list.</p>
        </div>
      </header>

      <div className="office-section-body">
        <form className="office-filter-bar office-agents-toolbar" method="get">
          <input name="view" type="hidden" value="operations" />

          <FilterField className="office-agents-search-field" label="Search">
            <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="Search name, email, title, or team" type="search" />
          </FilterField>

          <FilterField className="office-agents-filter-field" label="Office">
            <SelectInput defaultValue={snapshot.filters.officeId} name="officeId">
              <option value="">All offices</option>
              {snapshot.filters.officeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-agents-filter-field" label="Role">
            <SelectInput defaultValue={snapshot.filters.role} name="role">
              <option value="">All roles</option>
              {snapshot.filters.roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-agents-filter-field" label="Team">
            <SelectInput defaultValue={snapshot.filters.teamId} name="teamId">
              <option value="">All teams</option>
              {snapshot.filters.teamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-agents-filter-field" label="Onboarding">
            <SelectInput defaultValue={snapshot.filters.onboardingStatus} name="onboardingStatus">
              {onboardingStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-agents-membership-field" label="Membership">
            <SelectInput defaultValue={snapshot.filters.membershipStatus} name="membershipStatus">
              {membershipStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <div className="office-filter-actions office-agents-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Link className="office-button-secondary" href="/office/settings/users?view=operations">
              Reset
            </Link>
          </div>
        </form>

        {snapshot.rows.length ? (
          <DataTable className="office-table office-agents-roster-table">
            <DataTableHeader className="office-agents-roster-head">
              <span>Member</span>
              <span>Office</span>
              <span>Role</span>
              <span>Team</span>
              <span>Membership</span>
              <span>Onboarding</span>
              <span className="office-agents-roster-head-metric">Workload</span>
              <span className="office-agents-roster-head-metric">Transactions</span>
              <span className="office-agents-roster-head-metric">Goals</span>
              <span className="office-agents-roster-head-metric">Billing</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.rows.map((row) => (
                <Link className="office-data-table-row office-agents-roster-row" href={`/office/settings/users/${row.membershipId}`} key={row.membershipId} role="row">
                  <span className="office-data-table-row-main office-agents-roster-stack office-agents-roster-primary">
                    <strong>{row.name}</strong>
                    <small>{row.email}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.officeName}</span>
                  <span className="office-agents-roster-stack">
                    <strong>{row.role}</strong>
                    <small>{row.title}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.teamLabel}</span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getMembershipTone(row.membershipStatusValue)}>{row.membershipStatus}</StatusBadge>
                    <small>{row.membershipStatusValue === "active" ? "In roster" : "Needs review"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getOnboardingTone(row.onboardingStatus)}>{row.onboardingStatus}</StatusBadge>
                    <small>{row.onboardingProgressLabel}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.activeTasksCount} active</strong>
                    <small>{row.activeTasksCount === 0 ? "No open workload" : "Tasks currently assigned"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.transactionSummaryLabel}</strong>
                    <small>{row.openTransactionCount} open pipeline</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.goalProgressSummary}</strong>
                    <small>{row.recentClosedTransactionCount} closed in 90d</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.billingBalanceLabel}</strong>
                    <small>{row.billingSummaryLabel}</small>
                  </span>
                </Link>
              ))}
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyState
            description="Try relaxing the current office, team, onboarding, or membership filters."
            title="No members matched the current operations filters"
          />
        )}

        <ListPageFooter
          controls={
            hasActiveRosterFilters ? (
              <Link className="office-list-page-button" href="/office/settings/users?view=operations">
                Clear filters
              </Link>
            ) : null
          }
          summary={`${snapshot.rows.length} roster rows in the current scope`}
        />
      </div>
    </section>
  );
}
