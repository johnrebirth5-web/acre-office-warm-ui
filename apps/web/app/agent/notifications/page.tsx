import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import {
  buildFrontOfficeCleanupDigest,
  getFrontOfficeActivitySnapshot,
  getFrontOfficeDashboardSnapshot,
  type FrontOfficeDashboardSnapshot,
} from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";
import {
  activityViewOptions,
  buildAgentNotificationsHref,
  cleanupFilterOptions,
  getActivityViewBridgeLabel,
  getActivityViewNextMoveLabel,
  getActivityViewNextMoveChipLabel,
  getActivityViewOperatorCue,
  getActivityViewSectionTargetLabel,
  getActivityViewTriageOrderLabel,
  leadershipCleanupFilterOptions,
  noticeStreamFilterOptions,
  reminderFilterOptions,
  resolveReminderFilterValue,
  readStateOptions,
  resolveOptionValue,
} from "./agent-notifications-config";
import { AgentNotificationsClient } from "./agent-notifications-client";
import { FrontOfficeCleanupDigestCard } from "./front-office-cleanup-digest-card";

type AgentNotificationsPageProps = {
  searchParams?: Promise<{
    activityView?: string;
    appointmentFilter?: string;
    cleanupFilter?: string;
    noticeFilter?: string;
    noticeStreamFilter?: string;
    readState?: string;
    teamCleanupFilter?: string;
  }>;
};

function leadershipItemMatchesFilter(
  item: FrontOfficeDashboardSnapshot["leadershipQueue"]["activityCenterItems"][number],
  filter: "all" | "overdue_task" | "engagement_risk" | "stale_client",
) {
  return filter === "all" || item.kindKey === filter;
}

function getOptionLabel<TValue extends string>(
  options: Array<{ value: TValue; label: string }>,
  value: TValue,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function buildActivityFocusDescription(
  value: (typeof activityViewOptions)[number]["value"],
) {
  switch (value) {
    case "personal_cleanup":
      return "Focus on your own follow-up cleanup first, then widen back into reminders and notices once the urgent items are under control.";
    case "team_cleanup":
      return "Use this view when team-wide overdue work matters more than your personal queue.";
    case "appointment_reminders":
      return "Stay here when the next move is a confirmation, reschedule, or appointment follow-up.";
    case "general_notices":
      return "Use this view when the next move is a notice, shared visibility update, or handoff instead of personal cleanup.";
    default:
      return "This page keeps cleanup, reminders, team pressure, and notices in one place while letting you narrow the view without losing your place.";
  }
}

export default async function AgentNotificationsPage(
  props: AgentNotificationsPageProps,
) {
  const context = await requireSessionContext();

  if (
    !hasAnyPermission(context.currentMembership, [
      "notifications:view",
      "events:view",
      "clients:view",
      "dashboard:view",
    ])
  ) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const [snapshot, dashboardSnapshot, cleanupDigest] = await Promise.all([
    getFrontOfficeActivitySnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
    getFrontOfficeDashboardSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      viewerRole: context.currentMembership.role,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
    buildFrontOfficeCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
  ]);
  const searchParams = (await props.searchParams) ?? {};
  const initialActivityView = resolveOptionValue(
    searchParams.activityView,
    activityViewOptions,
    "all",
  );
  const initialFilter = resolveReminderFilterValue(
    searchParams.appointmentFilter,
    searchParams.noticeFilter,
    "all",
  );
  const initialCleanupFilter = resolveOptionValue(
    searchParams.cleanupFilter,
    cleanupFilterOptions,
    "all",
  );
  const initialNoticeStreamFilter = resolveOptionValue(
    searchParams.noticeStreamFilter,
    noticeStreamFilterOptions,
    "all",
  );
  const initialReadState = resolveOptionValue(
    searchParams.readState,
    readStateOptions,
    "all",
  );
  const initialTeamCleanupFilter = resolveOptionValue(
    searchParams.teamCleanupFilter,
    leadershipCleanupFilterOptions,
    "all",
  );
  const appointmentReminderCards = snapshot.notifications.filter(
    (card) => card.groupKey !== "general_notice",
  );
  const generalNoticeCards = snapshot.notifications.filter(
    (card) => card.groupKey === "general_notice",
  );
  const personalCleanupCount =
    snapshot.cleanup.items.length + snapshot.cleanup.duplicatePairs.length;
  const filteredLeadershipItems =
    dashboardSnapshot.leadershipQueue.activityCenterItems.filter((item) =>
      leadershipItemMatchesFilter(item, initialTeamCleanupFilter),
    );
  const visibleRouteItemCount =
    snapshot.summary.actionableItemCount + filteredLeadershipItems.length;
  const activeViewLabel = getOptionLabel(
    activityViewOptions,
    initialActivityView,
  );
  const cleanupFilterLabel = getOptionLabel(
    cleanupFilterOptions,
    initialCleanupFilter,
  );
  const noticeLaneLabel = getOptionLabel(
    noticeStreamFilterOptions,
    initialNoticeStreamFilter,
  );
  const readStateLabel = getOptionLabel(readStateOptions, initialReadState);
  const leadershipQueueHref = buildAgentNotificationsHref({
    pathname: "/agent/notifications",
    activityView: "team_cleanup",
    cleanupFilter: initialCleanupFilter,
    filter: initialFilter,
    noticeStreamFilter: initialNoticeStreamFilter,
    readState: initialReadState,
    leadershipFilter: initialTeamCleanupFilter,
    anchor: "#team-cleanup-pressure",
  });
  const sectionTargetLabel =
    getActivityViewSectionTargetLabel(initialActivityView);
  const cleanupDigestHref = `/api/agent/notifications/cleanup-digest?timeZone=${encodeURIComponent(
    context.currentUser.timezone,
  )}`;
  const cleanupDigestMailThreadHref =
    "/api/agent/notifications/cleanup-digest/mail-thread";

  return (
    <FrontOfficePageTemplate
      description="Keep self-owned cleanup, visible team pressure, calendar writeback, and broader notice follow-through in one Front Office route without blurring the Back Office boundary."
      eyebrow="Activity"
      main={
        <AgentNotificationsClient
          initialActivityView={initialActivityView}
          initialCleanupFilter={initialCleanupFilter}
          initialFilter={initialFilter}
          initialNoticeStreamFilter={initialNoticeStreamFilter}
          initialReadState={initialReadState}
          initialTeamCleanupFilter={initialTeamCleanupFilter}
          leadershipQueue={dashboardSnapshot.leadershipQueue}
          snapshot={snapshot}
        />
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle={buildActivityFocusDescription(initialActivityView)}
            title="Current route focus"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel={activeViewLabel}
                badgeTone="accent"
                context={`${visibleRouteItemCount} visible item(s)`}
                description={buildActivityFocusDescription(initialActivityView)}
                meta={
                  <>
                    <span>Section target · {sectionTargetLabel}</span>
                    <span>
                      {getActivityViewNextMoveLabel(initialActivityView)}
                    </span>
                    <span>{readStateLabel}</span>
                    <span>{cleanupFilterLabel}</span>
                    <span>{noticeLaneLabel}</span>
                    <span>
                      {getActivityViewBridgeLabel(initialActivityView)}
                    </span>
                  </>
                }
                title="Keep this section target stable"
              />
              <FrontOfficeRailItem
                badgeLabel={cleanupFilterLabel}
                badgeTone="warning"
                context={`${personalCleanupCount} personal cleanup item(s)`}
                description="Use the cleanup lane when the next move is to repair owner-owned FO drift on one dossier before you reopen calendar writeback or broader notices."
                meta={
                  <>
                    <span>{snapshot.summary.urgentCleanupCount} urgent</span>
                    <span>
                      {snapshot.summary.duplicateReviewCount} duplicate-review
                      signal(s)
                    </span>
                    <span>
                      {getActivityViewTriageOrderLabel("personal_cleanup")}
                    </span>
                  </>
                }
                title="Personal cleanup"
              />
              <FrontOfficeRailItem
                badgeLabel={getOptionLabel(
                  reminderFilterOptions,
                  initialFilter,
                )}
                badgeTone="accent"
                context={`${appointmentReminderCards.length} appointment reminder(s)`}
                description="Calendar writeback stays separate from broader notices so confirmation, reschedule, and promised-touch work can reopen as one clean command slice."
                meta={
                  <>
                    <span>
                      {snapshot.summary.appointmentSoonCount} appointment
                      cleanup signal(s)
                    </span>
                    <span>
                      {getActivityViewNextMoveLabel("appointment_reminders")}
                    </span>
                    <span>
                      {getActivityViewOperatorCue("appointment_reminders")}
                    </span>
                  </>
                }
                title="Appointments"
              />
              <FrontOfficeRailItem
                badgeLabel={noticeLaneLabel}
                context={`${generalNoticeCards.length} general notice(s)`}
                description="General notices keep FO actions, BO handoff signals, shared office visibility, and awareness-only messages separated instead of collapsing them into one queue pile."
                meta={
                  <>
                    <span>{readStateLabel}</span>
                    <span>
                      {getOptionLabel(
                        noticeStreamFilterOptions,
                        initialNoticeStreamFilter,
                      )}
                    </span>
                    <span>{getActivityViewOperatorCue("general_notices")}</span>
                  </>
                }
                title="Notices"
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Client-linked appointments now surface in the cleanup queue above. This rail keeps shared office notices, meetings, and RSVP context close by without mixing them into the same command stack."
            title="Upcoming office events"
          >
            <div className="office-queue-list">
              {snapshot.events.length ? (
                snapshot.events.map((event) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={event.href}
                      >
                        Open event
                      </FrontOfficeLink>
                    }
                    badgeLabel={event.typeLabel}
                    badgeTone="accent"
                    context={event.visibilityLabel}
                    description={event.locationLabel}
                    key={event.id}
                    meta={
                      <>
                        <span>{event.startsAtLabel}</span>
                        <span>{event.rsvpLabel}</span>
                        <span>{event.visibilityLabel}</span>
                      </>
                    }
                    title={event.title}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Office events will appear here when there are upcoming commitments."
                  title="No upcoming events"
                />
              )}
            </div>
          </SectionCard>

          {dashboardSnapshot.leadershipQueue.visible ? (
            <SectionCard
              className="office-list-card"
              actions={
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={leadershipQueueHref}
                >
                  Open full queue
                </FrontOfficeLink>
              }
              subtitle="Team leads and office admins should still be able to scan overdue tasks, stale clients, and quiet send trails from the same activity center they already use for personal cleanup. The full queue now lives in the main activity stack below."
              title={`${dashboardSnapshot.leadershipQueue.scopeLabel} overview`}
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="open shared follow-up tasks already overdue"
                  label="Overdue tasks"
                  value={dashboardSnapshot.leadershipQueue.overdueTaskCount}
                />
                <StatCard
                  hint="active clients with 15+ days of inactivity"
                  label="15+ day stale"
                  value={dashboardSnapshot.leadershipQueue.staleClientCount}
                />
                <StatCard
                  hint="latest tracked sends that were never opened or have gone quiet"
                  label="Send-trail risk"
                  value={dashboardSnapshot.leadershipQueue.engagementRiskCount}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list">
                {filteredLeadershipItems.length ? (
                  filteredLeadershipItems.slice(0, 2).map((item) => (
                    <FrontOfficeRailItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      }
                      badgeLabel={item.kindLabel}
                      badgeTone={item.tone}
                      context={item.ownerLabel}
                      description={item.whyNowLabel}
                      key={item.id}
                      meta={
                        <>
                          <span>{item.pressureLabel}</span>
                          <span>{item.scopeLabel}</span>
                          <span>{item.description}</span>
                        </>
                      }
                      title={item.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description={
                      initialTeamCleanupFilter === "all"
                        ? "No overdue task, stale-client, or quiet send-trail pressure is visible inside your leadership scope right now."
                        : "No team cleanup items match the current leadership-pressure filter."
                    }
                    title="Leadership queue is clear"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="A quick snapshot of overdue follow-up and reminders."
            title="Cleanup summary"
          >
            <FrontOfficeCleanupDigestCard
              cleanupDigest={cleanupDigest}
              cleanupDigestHref={cleanupDigestHref}
              cleanupDigestMailThreadHref={cleanupDigestMailThreadHref}
            />
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Visible"
            tone="accent"
            value={visibleRouteItemCount}
          />
          <SummaryChip
            label="My follow-ups"
            value={personalCleanupCount}
          />
          {dashboardSnapshot.leadershipQueue.visible ? (
            <SummaryChip
              label="Team follow-ups"
              value={dashboardSnapshot.summary.leadershipPressureCount}
            />
          ) : null}
          <SummaryChip
            label="Appointments"
            value={appointmentReminderCards.length}
          />
          <SummaryChip
            label="Notices"
            value={generalNoticeCards.length}
          />
          <SummaryChip
            label="Urgent cleanup"
            tone="accent"
            value={snapshot.summary.urgentCleanupCount}
          />
        </>
      }
      title="Activity"
    />
  );
}
