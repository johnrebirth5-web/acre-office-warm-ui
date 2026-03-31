import { listEvents, listNotifications } from "@acre/backoffice";
import { Badge, EmptyState, SectionCard, SummaryChip } from "@acre/ui";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";

export default function AgentNotificationsPage() {
  const activityCards = listNotifications();
  const upcomingEvents = listEvents();

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
          <div className="office-notification-list">
            {activityCards.length ? (
              activityCards.map((card) => (
                <article className="office-notification-row" key={card.id}>
                  <div className="office-notification-row-copy">
                    <div className="office-notification-row-head">
                      <div className="office-notification-row-title">
                        <strong>{card.title}</strong>
                      </div>

                      <div className="office-notification-row-meta">
                        <Badge className="front-office-activity-badge" tone="accent">
                          Actionable
                        </Badge>
                        <Badge tone="neutral">{card.kind}</Badge>
                        <span>{card.actionLabel}</span>
                      </div>
                    </div>
                    <p>{card.body}</p>
                  </div>
                  <div className="office-notification-row-actions">
                    <span className="office-inline-link">Open item</span>
                  </div>
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
            <div className="office-note-list">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => (
                  <article className="office-note-item" key={event.id}>
                    <span>{event.kind}</span>
                    <div className="front-office-note-copy">
                      <strong>{event.title}</strong>
                      <p>{event.location}</p>
                      <p>{event.startsAtLabel} · {event.rsvpCount} RSVP · {event.visibility}</p>
                    </div>
                  </article>
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
            <div className="office-note-list">
              <article className="office-note-item">
                <span>Rule</span>
                <div className="front-office-note-copy">
                  <strong>One stream, not five inboxes</strong>
                  <p>Keep notices, RSVP context, and reminders visible together so the agent does not have to hunt through different modules.</p>
                </div>
              </article>
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Actionable items" value={activityCards.length} />
          <SummaryChip label="Upcoming events" value={upcomingEvents.length} />
          <SummaryChip label="Stream" tone="accent" value="Unified" />
        </>
      }
      title="Activity stream"
    />
  );
}
