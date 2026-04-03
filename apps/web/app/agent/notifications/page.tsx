import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import {
  getFrontOfficeActivitySnapshot,
  getFrontOfficeDashboardSnapshot,
} from "@acre/db";
import { EmptyState, SectionCard, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";
import { AgentNotificationsClient } from "./agent-notifications-client";

type AgentNotificationsPageProps = {
  searchParams?: Promise<{
    noticeFilter?: string;
    readState?: string;
  }>;
};

const allowedNoticeFilters = new Set([
  "all",
  "confirmation_due",
  "reschedule_due",
  "external_touch_due",
  "appointment_soon",
  "general_notice",
]);

const allowedReadStates = new Set(["all", "unread", "read"]);

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

  const [snapshot, dashboardSnapshot] = await Promise.all([
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
  ]);
  const searchParams = (await props.searchParams) ?? {};
  const initialFilter = allowedNoticeFilters.has(searchParams.noticeFilter ?? "")
    ? (searchParams.noticeFilter as
        | "all"
        | "confirmation_due"
        | "reschedule_due"
        | "external_touch_due"
        | "appointment_soon"
        | "general_notice")
    : "all";
  const initialReadState = allowedReadStates.has(searchParams.readState ?? "")
    ? (searchParams.readState as "all" | "unread" | "read")
    : "all";
  const appointmentReminderCards = snapshot.notifications.filter(
    (card) => card.groupKey !== "general_notice",
  );

  return (
    <FrontOfficePageTemplate
      description="One Front Office center for reminders, cleanup pressure, duplicate review, and the notices that still need agent attention."
      eyebrow="Activity"
      main={
        <AgentNotificationsClient
          initialFilter={initialFilter}
          initialReadState={initialReadState}
          snapshot={snapshot}
        />
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Client-linked appointments now surface in the cleanup queue above. This rail keeps shared office notices, meetings, and RSVP context close by without mixing them into the same action stack."
            title="Upcoming office events"
          >
            <div className="office-queue-list">
              {snapshot.events.length ? (
                snapshot.events.map((event) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink className="office-inline-link front-office-inline-link" href={event.href}>
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
              subtitle="Team leads and office admins should still be able to scan overdue tasks, stale clients, and quiet send trails from the same activity center they already use for personal cleanup."
              title={dashboardSnapshot.leadershipQueue.scopeLabel}
            >
              <div className="office-queue-list">
                {dashboardSnapshot.leadershipQueue.items.length ? (
                  dashboardSnapshot.leadershipQueue.items.map((item) => (
                    <FrontOfficeRailItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      }
                      badgeLabel={item.contextLabel}
                      badgeTone={item.tone}
                      description={item.description}
                      key={item.id}
                      title={item.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="No overdue task, stale-client, or quiet send-trail pressure is visible inside your leadership scope right now."
                    title="Leadership queue is clear"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="The center should stay practical: clean the record, move the next touch, and keep formal ops in Back Office."
            title="How to use this center"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Queue"
                badgeTone="accent"
                description="Each client only shows the highest-pressure cleanup signal first, so the queue stays readable instead of repeating every weak signal at once."
                title="Resolve the loudest issue first"
              />
              <FrontOfficeRailItem
                badgeLabel="CRM"
                badgeTone="warning"
                description="Use the duplicate-review block before the next send or appointment so tracked history, follow-up tasks, and handoff context stay on one surviving dossier."
                title="Merge duplicates before the next touch"
              />
              <FrontOfficeRailItem
                badgeLabel="BO"
                description="This route should clean execution drift inside Front Office, then send formal transaction, signature, or accounting work back into Back Office instead of duplicating it here."
                title="Keep the FO and BO boundary honest"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Actionable items" value={snapshot.summary.actionableItemCount} />
          <SummaryChip label="Cleanup items" tone="accent" value={snapshot.summary.cleanupItemCount} />
          <SummaryChip label="Potential dupes" tone="accent" value={snapshot.summary.duplicateReviewCount} />
          <SummaryChip label="Reminder notices" tone="accent" value={appointmentReminderCards.length} />
          <SummaryChip label="Appointments soon" value={snapshot.summary.appointmentSoonCount} />
          <SummaryChip label="Unread notices" value={snapshot.summary.unreadNoticeCount} />
          <SummaryChip label="Upcoming events" value={snapshot.summary.upcomingEventCount} />
          {dashboardSnapshot.leadershipQueue.visible ? (
            <SummaryChip
              label="Leadership pressure"
              tone="accent"
              value={dashboardSnapshot.summary.leadershipPressureCount}
            />
          ) : null}
        </>
      }
      title="Activity & cleanup"
    />
  );
}
