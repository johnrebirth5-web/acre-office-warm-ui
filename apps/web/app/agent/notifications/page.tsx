import { listEvents, listNotifications } from "@acre/backoffice";
import { Badge, ListPageStack, PageHeader, PageHeaderSummary, PageShell, SectionCard, SummaryChip } from "@acre/ui";

export default function AgentNotificationsPage() {
  const activityCards = listNotifications();
  const upcomingEvents = listEvents();

  return (
    <PageShell className="office-agent-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Actionable items" value={activityCards.length} />
            <SummaryChip label="Upcoming events" value={upcomingEvents.length} />
          </PageHeaderSummary>
        }
        description="One stream for office notices, RSVP actions, reminders, and activity that matters to the agent."
        eyebrow="Activity center"
        title="Events, notices, RSVP, and reminders from one stream."
      />

      <ListPageStack>
        <SectionCard title="Current activity model" subtitle="This stream merges system notices with event actions.">
        <div className="list-column">
          {activityCards.map((card) => (
            <article className="list-row" key={card.id}>
              <div className="list-row-top">
                <strong>{card.title}</strong>
                <Badge tone="neutral">Actionable</Badge>
              </div>
              <p>{card.body}</p>
              <div className="list-row-meta">
                <span>{card.kind}</span>
                <span>{card.actionLabel}</span>
              </div>
            </article>
          ))}
        </div>
        </SectionCard>

        <SectionCard title="Upcoming events" subtitle="Office-created events feed the same activity surface for agents.">
        <div className="list-column">
          {upcomingEvents.map((event) => (
            <article className="list-row" key={event.id}>
              <div className="list-row-top">
                <strong>{event.title}</strong>
                <Badge tone="success">{event.kind}</Badge>
              </div>
              <p>{event.location}</p>
              <div className="list-row-meta">
                <span>{event.startsAtLabel}</span>
                <span>{event.rsvpCount} RSVP</span>
                <span>{event.visibility}</span>
              </div>
            </article>
          ))}
        </div>
        </SectionCard>
      </ListPageStack>
    </PageShell>
  );
}
