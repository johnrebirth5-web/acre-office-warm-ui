import Link from "next/link";
import { canAccessAccountActivity, canReviewOfficeTasks, canSecondaryReviewOfficeTasks } from "@acre/auth";
import {
  Button,
  EmptyState,
  FilterBar,
  FilterField,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  SectionCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { getOfficeActivityLogSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { ActivityAlertsLayout } from "./activity-alerts-layout";
import { ActivityCommentComposer } from "./activity-comment-composer";

type OfficeActivityPageProps = {
  searchParams?: Promise<{
    view?: string;
    activitySection?: string;
    alertSection?: string;
    actorMembershipId?: string;
    objectType?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
};

type ActivitySearchParams = {
  view?: string;
  activitySection?: string;
  alertSection?: string;
  actorMembershipId?: string;
  objectType?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
};

const ACTIVITY_PAGE_SIZE = 10;

function normalizePage(value: string | undefined) {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildActivityHref(currentSearchParams: ActivitySearchParams, nextSearchParams: ActivitySearchParams) {
  const merged = new URLSearchParams();
  const finalSearchParams = {
    view: currentSearchParams.view,
    activitySection: currentSearchParams.activitySection,
    alertSection: currentSearchParams.alertSection,
    actorMembershipId: currentSearchParams.actorMembershipId,
    objectType: currentSearchParams.objectType,
    startDate: currentSearchParams.startDate,
    endDate: currentSearchParams.endDate,
    page: currentSearchParams.page,
    ...nextSearchParams
  };

  for (const [key, value] of Object.entries(finalSearchParams)) {
    if (typeof value === "string" && value.trim().length > 0) {
      merged.set(key, value);
    }
  }

  const query = merged.toString();
  return query ? `/office/activity?${query}` : "/office/activity";
}

export default async function OfficeActivityPage(props: OfficeActivityPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessAccountActivity(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeActivityLogSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    currentMembershipId: context.currentMembership.id,
    canReviewTasks: canReviewOfficeTasks(context.currentMembership),
    canSecondaryReviewTasks: canSecondaryReviewOfficeTasks(context.currentMembership),
    view: searchParams.view,
    activitySection: searchParams.activitySection,
    alertSection: searchParams.alertSection,
    actorMembershipId: searchParams.actorMembershipId,
    objectType: searchParams.objectType,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate
  });

  const selectedView = snapshot.selectedView;
  const currentPage = normalizePage(searchParams.page);
  const normalizedSearchParams = {
    view: selectedView === "all" ? "" : selectedView,
    activitySection: selectedView === "activity" ? snapshot.activitySelectedSection : "",
    alertSection: typeof searchParams.alertSection === "string" ? searchParams.alertSection : "",
    actorMembershipId: snapshot.filters.actorMembershipId,
    objectType: snapshot.filters.objectType === "all" ? "" : snapshot.filters.objectType,
    startDate: snapshot.filters.startDate,
    endDate: snapshot.filters.endDate,
    page: ""
  };
  const totalActivityRecords = snapshot.activityEvents.length;
  const totalActivityPages = Math.max(Math.ceil(totalActivityRecords / ACTIVITY_PAGE_SIZE), 1);
  const activityPage = Math.min(currentPage, totalActivityPages);
  const activityPageStartIndex = totalActivityRecords === 0 ? 0 : (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivityEvents = snapshot.activityEvents.slice(
    activityPageStartIndex,
    activityPageStartIndex + ACTIVITY_PAGE_SIZE
  );
  const activityPageStartLabel = totalActivityRecords === 0 ? 0 : activityPageStartIndex + 1;
  const activityPageEndLabel = totalActivityRecords === 0 ? 0 : activityPageStartIndex + paginatedActivityEvents.length;
  const activitySubtitle = totalActivityRecords
    ? `Showing ${activityPageStartLabel}-${activityPageEndLabel} of ${totalActivityRecords} audit records`
    : "Showing 0 audit records";
  const activityPaginationBaseHref = buildActivityHref(normalizedSearchParams, { page: "" });
  const activitySidebar = (
    <SectionCard
      className="office-activity-sections-card"
      subtitle="Counts in the latest 200-record audit window"
      title="Activity log"
    >
      <nav className="office-activity-section-list">
        {snapshot.activitySections.map((section) => (
          <Link
            className={`office-activity-section-link${selectedView === "activity" && section.key === snapshot.activitySelectedSection ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "activity",
              activitySection: section.key,
              alertSection: "",
              page: ""
            })}
            key={section.key}
          >
            <strong>{section.label}</strong>
            <span>{section.count}</span>
          </Link>
        ))}
      </nav>
    </SectionCard>
  );
  const activityStream =
    selectedView !== "alerts" ? (
      <SectionCard
        className="office-activity-log-card"
        subtitle={activitySubtitle}
        title={selectedView === "activity" ? snapshot.activitySelectedSectionLabel : "Activity log"}
      >
        <div className="office-activity-records">
          {paginatedActivityEvents.length ? (
            paginatedActivityEvents.map((event) => (
              <article className="office-activity-record" key={event.id}>
                <div className="office-activity-record-top">
                  <div className="office-activity-record-copy">
                    <div className="office-activity-record-summary">
                      <strong>{event.actorDisplayName}</strong>
                      <span>{event.summary}</span>
                    </div>
                    {event.href ? (
                      <Link className="office-activity-object-link" href={event.href}>
                        {event.objectLabel}
                      </Link>
                    ) : (
                      <p className="office-activity-object-link is-static">{event.objectLabel}</p>
                    )}
                  </div>

                  <div className="office-activity-record-meta">
                    <StatusBadge tone={event.isComment ? "neutral" : "accent"}>{event.actionLabel}</StatusBadge>
                    <time>{event.timestampLabel}</time>
                  </div>
                </div>

                {event.detailSummary.length ? (
                  <ul className="office-activity-detail-list">
                    {event.detailSummary.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState description="Try a wider date range or a broader view filter." title="No audit events are currently available for this scope." />
          )}
        </div>
        {totalActivityRecords > ACTIVITY_PAGE_SIZE ? (
          <div className="office-list-page-pagination office-activity-pagination">
            {activityPage > 1 ? (
              <Link
                className="office-list-page-button"
                href={buildActivityHref(normalizedSearchParams, {
                  page: activityPage - 1 > 1 ? String(activityPage - 1) : ""
                })}
              >
                Previous
              </Link>
            ) : (
              <span className="office-list-page-button is-disabled">Previous</span>
            )}

            <form action={activityPaginationBaseHref} className="office-activity-page-jump" method="get">
              <label className="office-activity-page-jump-label" htmlFor="activity-page-jump-input">
                Page
              </label>
              <input
                aria-label="Jump to page"
                className="office-input office-activity-page-jump-input"
                defaultValue={activityPage}
                id="activity-page-jump-input"
                max={totalActivityPages}
                min={1}
                name="page"
                type="number"
              />
              <span className="office-list-page-indicator">/ {totalActivityPages}</span>
              <Button size="sm" type="submit" variant="secondary">
                Go
              </Button>
            </form>

            {activityPage < totalActivityPages ? (
              <Link
                className="office-list-page-button"
                href={buildActivityHref(normalizedSearchParams, {
                  page: String(activityPage + 1)
                })}
              >
                Next
              </Link>
            ) : (
              <span className="office-list-page-button is-disabled">Next</span>
            )}
          </div>
        ) : null}
      </SectionCard>
    ) : null;

  return (
    <PageShell className="office-activity-page office-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <ActivityCommentComposer
              officeId={context.currentOffice?.id ?? null}
              scopeLabel={context.currentOffice?.name ?? context.currentOrganization.name}
            />
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Audit window" tone="accent" value={snapshot.latestWindowCount} />
            <SummaryChip label="Live alerts" value={selectedView === "activity" ? "On demand" : "Loading..."} />
          </PageHeaderSummary>
        }
        description="Audit-backed activity records remain the source of truth. Operational alerts are derived live from current transaction, task, and contact state."
        eyebrow="Account activity"
        title="Account activity"
      />

      <FilterBar as="form" className="office-activity-filter-bar office-activity-toolbar-card" method="get">
        <div className="bm-filter-strip office-toggle-strip">
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "all" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "all",
              activitySection: "",
              alertSection: "",
              page: ""
            })}
          >
            All
          </Link>
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "activity" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "activity",
              alertSection: "",
              page: ""
            })}
          >
            Activity only
          </Link>
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "alerts" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "alerts",
              activitySection: "",
              page: ""
            })}
          >
            Alerts only
          </Link>
        </div>

        <div className="office-activity-filter-grid">
          <FilterField className="office-activity-filter-field" label="Actor (activity only)">
            <select defaultValue={snapshot.filters.actorMembershipId} disabled={selectedView === "alerts"} name="actorMembershipId">
              <option value="">All actors</option>
              {snapshot.filters.actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField className="office-activity-filter-field" label="Object type">
            <select defaultValue={snapshot.filters.objectType} name="objectType">
              <option value="all">All objects</option>
              <option value="transaction">Transactions</option>
              <option value="contact">Contacts</option>
              <option value="task">Tasks</option>
              <option value="agent">Agents / teams</option>
              <option value="document">Documents / forms</option>
              <option value="accounting">Accounting</option>
              <option value="comment">Comments</option>
              <option value="auth">Authentication</option>
            </select>
          </FilterField>

          <FilterField className="office-activity-filter-field" label="Start date">
            <input defaultValue={snapshot.filters.startDate} name="startDate" type="date" />
          </FilterField>

          <FilterField className="office-activity-filter-field" label="End date">
            <input defaultValue={snapshot.filters.endDate} name="endDate" type="date" />
          </FilterField>

          <div className="office-activity-filter-actions">
            <input name="view" type="hidden" value={selectedView} />
            {selectedView === "activity" ? (
              <input name="activitySection" type="hidden" value={snapshot.activitySelectedSection} />
            ) : null}
            {selectedView === "alerts" ? (
              <input name="alertSection" type="hidden" value={normalizedSearchParams.alertSection} />
            ) : null}
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
            <Link className="office-button-secondary" href="/office/activity">
              Reset
            </Link>
          </div>
        </div>
      </FilterBar>

      <ActivityAlertsLayout
        activitySidebar={activitySidebar}
        activityStream={activityStream}
        currentSearchParams={normalizedSearchParams}
        selectedView={selectedView}
      />
    </PageShell>
  );
}
