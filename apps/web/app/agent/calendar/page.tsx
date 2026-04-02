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
  const snapshot = await getFrontOfficeAppointmentsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });
  const requestedClientId = readSearchParamValue(searchParams.clientId)?.trim();
  const initialClientId = snapshot.clientOptions.some(
    (option) => option.value === requestedClientId,
  )
    ? requestedClientId
    : undefined;

  return (
    <FrontOfficePageTemplate
      description="Schedule showings, consultations, and client meetings inside Front Office, while keeping the next Back Office handoff visible on the same page."
      eyebrow="Calendar"
      main={
        <FrontOfficeCalendarClient
          initialClientId={initialClientId}
          snapshot={snapshot}
        />
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="A compact read on how much execution pressure is already committed on your calendar."
            title="Workflow signals"
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
                hint="showings waiting in your queue"
                label="Showings"
                value={snapshot.summary.showingCount}
              />
              <StatCard
                hint="formal transaction follow-through waiting in BO"
                label="BO-ready"
                tone="accent"
                value={snapshot.summary.handoffReadyCount}
              />
              <StatCard
                hint="current role template in Front Office"
                label="Access"
                tone="accent"
                value={access.label}
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
            subtitle="These are the operating rules for the new FO calendar surface, including the first external calendar and email bridges."
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
                description="Scheduled appointments can now jump into Google Calendar, Outlook, downloadable ICS files, or a client-facing email brief, and Acre records the latest bridge action without pretending it already owns a two-way sync."
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
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip
            label="Upcoming"
            value={snapshot.summary.upcomingCount}
          />
          <SummaryChip
            label="Today"
            tone="accent"
            value={snapshot.summary.todayCount}
          />
          <SummaryChip label="Showings" value={snapshot.summary.showingCount} />
          <SummaryChip
            label="BO-ready"
            tone="accent"
            value={snapshot.summary.handoffReadyCount}
          />
        </>
      }
      title="Appointments & calendar"
    />
  );
}
