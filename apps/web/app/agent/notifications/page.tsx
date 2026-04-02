import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import { getFrontOfficeActivitySnapshot } from "@acre/db";
import {
  Badge,
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeClientDuplicatesCard } from "../clients/front-office-client-duplicates-card";
import { requireSessionContext } from "../../../lib/auth-session";

export default async function AgentNotificationsPage() {
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

  const snapshot = await getFrontOfficeActivitySnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone
  });

  return (
    <FrontOfficePageTemplate
      description="One Front Office center for reminders, cleanup pressure, duplicate review, and the notices that still need agent attention."
      eyebrow="Activity"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="This queue keeps the highest-pressure cleanup signal per client visible in one place, including appointment follow-up, confirmation, and reschedule pressure, while duplicate review stays as a separate block so agents can clean the dossier before the next touch."
            title="Cleanup center"
          >
            <ListPageStatsGrid>
              {snapshot.cleanup.metrics.map((metric) => (
                <StatCard
                  hint={metric.helper}
                  key={metric.label}
                  label={metric.label}
                  tone={
                    metric.tone === "accent" ||
                    metric.tone === "warning" ||
                    metric.tone === "danger"
                      ? "accent"
                      : "default"
                  }
                  value={metric.count}
                />
              ))}
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.cleanup.items.length ? (
                snapshot.cleanup.items.map((item) => (
                  <article
                    className={`list-row front-office-record tone-${item.tone}`}
                    key={item.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge tone={item.tone}>{item.kindLabel}</StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      {item.metaLabels.map((label) => (
                        <span key={`${item.id}-${label}`}>{label}</span>
                      ))}
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="When follow-ups, tracked sends, appointments, or duplicate review start applying pressure, the highest-priority cleanup items will stack here first."
                  title="No cleanup pressure right now"
                />
              )}
            </div>
          </SectionCard>

          {snapshot.cleanup.duplicatePairs.length ? (
            <FrontOfficeClientDuplicatesCard
              duplicatePairs={snapshot.cleanup.duplicatePairs}
            />
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="This stream still keeps live notices and reminders readable, but it now sits underneath the cleanup queue instead of being the only activity surface."
            title="Notice stream"
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
                      <Badge
                        className="front-office-activity-badge"
                        tone={card.isUnread ? "accent" : "neutral"}
                      >
                        {card.isUnread ? "Unread" : "In view"}
                      </Badge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{card.typeLabel}</span>
                      <span>{card.actionLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={card.href}
                    >
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
        </>
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
          <SummaryChip label="Appointments soon" value={snapshot.summary.appointmentSoonCount} />
          <SummaryChip label="Unread notices" value={snapshot.summary.unreadNoticeCount} />
          <SummaryChip label="Upcoming events" value={snapshot.summary.upcomingEventCount} />
        </>
      }
      title="Activity & cleanup"
    />
  );
}
