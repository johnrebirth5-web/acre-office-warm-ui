import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import { getFrontOfficeActivitySnapshot } from "@acre/db";
import { Badge, EmptyState, SectionCard, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";

export default async function AgentNotificationsPage() {
  const context = await requireSessionContext();

  if (!hasAnyPermission(context.currentMembership, ["notifications:view", "events:view"])) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const snapshot = await getFrontOfficeActivitySnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone
  });

  return (
    <FrontOfficePageTemplate
      description="Front Office activity should merge reminders, office notices, and event context into one readable stream."
      eyebrow="Activity"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="This stream groups the notices and reminders that actually affect the field workflow."
          title="Current activity"
        >
          <div className="list-column front-office-record-list">
            {snapshot.notifications.length ? (
              snapshot.notifications.map((card) => (
                <article className="list-row front-office-record" key={card.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{card.title}</strong>
                      <p>{card.body}</p>
                    </div>
                    <Badge className="front-office-activity-badge" tone={card.isUnread ? "accent" : "neutral"}>
                      {card.isUnread ? "Unread" : "In view"}
                    </Badge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{card.typeLabel}</span>
                    <span>{card.actionLabel}</span>
                  </div>
                  <FrontOfficeLink className="office-inline-link front-office-inline-link" href={card.href}>
                    Open notice
                  </FrontOfficeLink>
                </article>
              ))
            ) : (
              <EmptyState
                description="Activity cards will show up here when Front Office notices and reminders are available."
                title="No activity items"
              />
            )}
          </div>
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Upcoming office commitments should stay close to the same activity stream."
            title="Upcoming events"
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

          <SectionCard
            className="office-list-card"
            subtitle="This page should stay operational, not noisy."
            title="Stream rule"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Rule"
                description="Keep notices, RSVP context, and reminders visible together so the agent does not have to hunt through different modules."
                title="One stream, not five inboxes"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Actionable items" value={snapshot.summary.actionableItemCount} />
          <SummaryChip label="Unread notices" value={snapshot.summary.unreadNoticeCount} />
          <SummaryChip label="Upcoming events" value={snapshot.summary.upcomingEventCount} />
          <SummaryChip label="Stream" tone="accent" value="Unified" />
        </>
      }
      title="Activity stream"
    />
  );
}
