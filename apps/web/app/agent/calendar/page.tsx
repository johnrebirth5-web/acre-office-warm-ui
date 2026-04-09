import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeAppointmentsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import {
  deriveCalendarViewFromRoute,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "./calendar-view";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../lib/auth-session";
import { FrontOfficeCalendarClient } from "./front-office-calendar-client";

type AgentCalendarPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function AgentCalendarPage(props: AgentCalendarPageProps) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const searchParams = (await props.searchParams) ?? {};
  const requestedCalendarViewValue = readSearchParamValue(
    searchParams.calendarView,
  )?.trim();
  const requestedCalendarView = resolveCalendarView(requestedCalendarViewValue);
  const hasExplicitCalendarView = Boolean(requestedCalendarViewValue);
  const calendarViewFromFilters = deriveCalendarViewFromRoute({
    coordination:
      readSearchParamValue(searchParams.coordination)?.trim() ?? "all",
    followUp: readSearchParamValue(searchParams.followUp)?.trim() ?? "all",
    status: readSearchParamValue(searchParams.status)?.trim() ?? "all",
  });
  const activeCalendarView: CalendarViewKey = hasExplicitCalendarView
    ? requestedCalendarView
    : calendarViewFromFilters;
  const activeCalendarViewConfig = getCalendarViewConfig(activeCalendarView);
  const activeCalendarViewPatch = hasExplicitCalendarView
    ? getCalendarViewRoutePatch(activeCalendarView)
    : null;
  const snapshot = await getFrontOfficeAppointmentsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    clientId: readSearchParamValue(searchParams.clientId)?.trim(),
    listingId: readSearchParamValue(searchParams.listingId)?.trim(),
    type: readSearchParamValue(searchParams.type)?.trim(),
    status:
      activeCalendarViewPatch?.status ??
      readSearchParamValue(searchParams.status)?.trim(),
    coordination:
      activeCalendarViewPatch?.coordination ??
      readSearchParamValue(searchParams.coordination)?.trim(),
    followUp:
      activeCalendarViewPatch?.followUp ??
      readSearchParamValue(searchParams.followUp)?.trim(),
    targetAppointmentId: readSearchParamValue(
      searchParams.appointmentId,
    )?.trim(),
  });
  const requestedClientId = readSearchParamValue(searchParams.clientId)?.trim();
  const initialClientId = snapshot.clientOptions.some(
    (option) => option.value === requestedClientId,
  )
    ? requestedClientId
    : undefined;
  const requestedListingId = readSearchParamValue(
    searchParams.listingId,
  )?.trim();
  const initialListingId = snapshot.listingOptions.some(
    (option) => option.value === requestedListingId,
  )
    ? requestedListingId
    : undefined;

  return (
    <FrontOfficePageTemplate
      description={`${activeCalendarViewConfig.description} Schedule showings, consultations, and client meetings inside Front Office, while keeping external bridge actions, internal Acre mail-thread continuity, writeback history, client/listing deep-link context, detail focus, and the next Back Office handoff visible on the same page.`}
      eyebrow="Calendar"
      main={
        <FrontOfficeCalendarClient
          initialClientId={initialClientId}
          initialListingId={initialListingId}
          snapshot={snapshot}
        />
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Separate the queue into reply pressure, confirmation pressure, scheduled touch pressure, writeback pending, bridge logs, Acre mail-thread continuity, and BO-ready handoff so the page reads like a workbench instead of a draft exporter."
            title="Coordination pressure"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="scheduled appointments from now forward"
                label="Upcoming"
                value={snapshot.summary.upcomingCount}
              />
              <StatCard
                hint="items landing today"
                label="Today"
                tone="accent"
                value={snapshot.summary.todayCount}
              />
              <StatCard
                hint="appointments whose outside reply still needs attention"
                label="Reply due"
                value={snapshot.summary.awaitingReplyCount}
              />
              <StatCard
                hint="scheduled appointments explicitly waiting on an outside confirmation reply"
                label="Confirmation pending"
                tone="accent"
                value={snapshot.summary.confirmationPendingCount}
              />
              <StatCard
                hint="appointments still waiting on outside coordination but missing a saved next-touch deadline"
                label="Missing next touch"
                tone="accent"
                value={snapshot.summary.missingTouchPlanCount}
              />
              <StatCard
                hint="next external touches already due or overdue in the visible queue"
                label="Touch due"
                value={snapshot.summary.touchDueCount}
              />
              <StatCard
                hint="next external touches already saved but not due yet"
                label="Touch scheduled"
                tone="accent"
                value={snapshot.summary.touchScheduledCount}
              />
              <StatCard
                hint="appointments whose latest writeback says the time needs to move"
                label="Reschedule requested"
                tone="accent"
                value={snapshot.summary.rescheduleRequestedCount}
              />
              <StatCard
                hint="appointments that already opened Google, Outlook, ICS, or email from Acre"
                label="Bridge logged"
                value={snapshot.summary.bridgedCount}
              />
              <StatCard
                hint="appointments where Acre opened the bridge but no writeback has been saved yet"
                label="Writeback pending"
                tone="accent"
                value={snapshot.summary.writebackPendingCount}
              />
              <StatCard
                hint="formal transaction follow-through waiting in BO"
                label="BO-ready"
                tone="accent"
                value={snapshot.summary.handoffReadyCount}
              />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This queue is now driven by explicit Front Office handoff drafts instead of stage-text heuristics."
            title="Ready for Back Office"
          >
            <div className="list-column front-office-record-list">
              {snapshot.handoffs.length ? (
                snapshot.handoffs.map((handoff) => (
                  <article
                    className="list-row front-office-record tone-warning"
                    key={handoff.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{handoff.clientName}</strong>
                        <p>{handoff.summary}</p>
                      </div>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{handoff.stageLabel}</span>
                      <span>Formal workflow lives in Back Office</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={handoff.href}
                    >
                      Open Back Office create flow
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/office/transactions"
                    >
                      Open Back Office
                    </Link>
                  }
                  description="When a client reaches a BO-ready phase such as negotiation or offer, the draft queue will appear here."
                  title="Nothing waiting for formal workflow"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These are the operating rules for the current FO calendar surface, including action-first external bridge payloads, visible writeback, and appointment-level coordination guidance."
            title="Current scope"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="FO"
                description="Appointments stay light and execution-first here: showings, meetings, links, addresses, notes, and reminder signals that also feed the activity stream."
                title="Daily scheduling lives here"
              />
              <FrontOfficeRailItem
                badgeLabel="CRM"
                description="Marking an appointment complete writes back into the client record by updating the last-contact signal."
                title="Client context stays warm"
              />
              <FrontOfficeRailItem
                badgeLabel="Sync"
                description="Scheduled appointments can now open richer Google / Outlook drafts, downloadable ICS exports, or an Acre internal mail-thread continuity copy for the email brief, and Acre records the bridge trail plus the agent-managed writeback on the same appointment record without pretending it already owns a two-way sync."
                title="External bridge is action-first"
              />
              <FrontOfficeRailItem
                badgeLabel="BO"
                description="Formal transaction creation, signature routing, accounting, and archive still continue in Back Office."
                title="Formal workflow does not duplicate"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            description={activeCalendarViewConfig.description}
            featured
            label="Current lane"
            tone="accent"
            value={activeCalendarViewConfig.label}
          />
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip
            label="Upcoming"
            value={snapshot.summary.upcomingCount}
          />
          <SummaryChip
            label="Awaiting reply"
            value={snapshot.summary.awaitingReplyCount}
          />
          <SummaryChip
            label="Awaiting confirm"
            tone="accent"
            value={snapshot.summary.confirmationPendingCount}
          />
          <SummaryChip
            label="Touch due"
            value={snapshot.summary.touchDueCount}
          />
          <SummaryChip
            label="Touch scheduled"
            tone="accent"
            value={snapshot.summary.touchScheduledCount}
          />
          <SummaryChip
            label="Reschedule"
            tone="accent"
            value={snapshot.summary.rescheduleRequestedCount}
          />
          <SummaryChip
            label="Writeback pending"
            tone="accent"
            value={snapshot.summary.writebackPendingCount}
          />
          <SummaryChip
            label="Missing touch"
            tone="accent"
            value={snapshot.summary.missingTouchPlanCount}
          />
        </>
      }
      title="Appointments & calendar"
    />
  );
}
