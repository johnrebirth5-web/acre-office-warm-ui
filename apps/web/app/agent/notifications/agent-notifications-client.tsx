"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type {
  FrontOfficeActivityNotificationRecord,
  FrontOfficeActivitySnapshot,
} from "@acre/db";
import {
  Badge,
  Button,
  EmptyState,
  FilterBar,
  FilterField,
  ListPageStatsGrid,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
} from "@acre/ui";
import { FrontOfficeClientDuplicatesCard } from "../clients/front-office-client-duplicates-card";
import { FrontOfficeLink } from "../_components/front-office-link";

type AgentNotificationFilter =
  | "all"
  | FrontOfficeActivityNotificationRecord["groupKey"];

type AgentNotificationReadState = "all" | "unread" | "read";

type AgentNotificationsClientProps = {
  snapshot: FrontOfficeActivitySnapshot;
  initialFilter: AgentNotificationFilter;
  initialReadState: AgentNotificationReadState;
};

const notificationFilterOptions: Array<{
  value: AgentNotificationFilter;
  label: string;
}> = [
  { value: "all", label: "All notices" },
  { value: "confirmation_due", label: "Confirmation due" },
  { value: "reschedule_due", label: "Reschedule follow-up" },
  { value: "external_touch_due", label: "External touch due" },
  { value: "appointment_soon", label: "Appointment soon" },
  { value: "general_notice", label: "General notices" },
];

function cardMatchesFilter(
  card: FrontOfficeActivityNotificationRecord,
  filter: AgentNotificationFilter,
) {
  return filter === "all" || card.groupKey === filter;
}

function cardMatchesReadState(
  card: FrontOfficeActivityNotificationRecord,
  readState: AgentNotificationReadState,
) {
  if (readState === "unread") {
    return card.isUnread;
  }

  if (readState === "read") {
    return !card.isUnread;
  }

  return true;
}

function buildAgentNotificationsHref(input: {
  pathname: string;
  filter: AgentNotificationFilter;
  readState: AgentNotificationReadState;
}) {
  const params = new URLSearchParams();

  if (input.filter !== "all") {
    params.set("noticeFilter", input.filter);
  }

  if (input.readState !== "all") {
    params.set("readState", input.readState);
  }

  const query = params.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
}

export function AgentNotificationsClient({
  snapshot,
  initialFilter,
  initialReadState,
}: AgentNotificationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeFilter, setActiveFilter] =
    useState<AgentNotificationFilter>(initialFilter);
  const [activeReadState, setActiveReadState] =
    useState<AgentNotificationReadState>(initialReadState);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateFilters(
    nextFilter: AgentNotificationFilter,
    nextReadState: AgentNotificationReadState,
  ) {
    setActiveFilter(nextFilter);
    setActiveReadState(nextReadState);
    router.replace(
      buildAgentNotificationsHref({
        pathname,
        filter: nextFilter,
        readState: nextReadState,
      }),
      { scroll: false },
    );
  }

  const appointmentReminderCards = snapshot.notifications.filter(
    (card) =>
      card.groupKey !== "general_notice" &&
      cardMatchesFilter(card, activeFilter) &&
      cardMatchesReadState(card, activeReadState),
  );
  const generalNoticeCards = snapshot.notifications.filter(
    (card) =>
      card.groupKey === "general_notice" &&
      cardMatchesFilter(card, activeFilter) &&
      cardMatchesReadState(card, activeReadState),
  );
  const visibleNotificationCards = snapshot.notifications.filter((card) =>
    cardMatchesFilter(card, activeFilter) &&
    cardMatchesReadState(card, activeReadState),
  );
  const unreadVisibleNotificationIds = visibleNotificationCards
    .filter((card) => card.isUnread)
    .map((card) => card.id);
  const confirmationDueCount = snapshot.notifications.filter(
    (card) => card.groupKey === "confirmation_due",
  ).length;
  const rescheduleDueCount = snapshot.notifications.filter(
    (card) => card.groupKey === "reschedule_due",
  ).length;
  const externalTouchDueCount = snapshot.notifications.filter(
    (card) => card.groupKey === "external_touch_due",
  ).length;
  const appointmentSoonNoticeCount = snapshot.notifications.filter(
    (card) => card.groupKey === "appointment_soon",
  ).length;

  async function handleNotificationAction(
    notificationId: string,
    action: "mark_read" | "mark_unread",
  ) {
    setPendingAction(`${action}:${notificationId}`);
    setError("");

    try {
      const response = await fetch(`/api/agent/notifications/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Notification update failed.");
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Notification update failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkAllRead() {
    setPendingAction("mark-all");
    setError("");

    try {
      const response = await fetch("/api/agent/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_all_read",
          notificationIds: unreadVisibleNotificationIds,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Mark-all action failed.");
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Mark-all action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <SectionCard
        className="office-list-card office-notification-toolbar"
        subtitle="Use reminder type and read-state filters to isolate one slice of pressure, then clear unread state as you work through the queue."
        title="Notice controls"
      >
        <FilterBar className="office-notification-filter-grid office-list-filters">
          <FilterField label="Reminder filter">
            <SelectInput
              onChange={(event) =>
                updateFilters(
                  event.currentTarget.value as AgentNotificationFilter,
                  activeReadState,
                )
              }
              value={activeFilter}
            >
              {notificationFilterOptions.map((option) => {
                const count =
                  option.value === "all"
                    ? snapshot.notifications.length
                    : snapshot.notifications.filter(
                        (card) => card.groupKey === option.value,
                      ).length;

                return (
                  <option key={option.value} value={option.value}>
                    {option.label} ({count})
                  </option>
                );
              })}
            </SelectInput>
          </FilterField>

          <FilterField label="Read state">
            <SelectInput
              onChange={(event) =>
                updateFilters(
                  activeFilter,
                  event.currentTarget.value as AgentNotificationReadState,
                )
              }
              value={activeReadState}
            >
              <option value="all">All</option>
              <option value="unread">Unread only</option>
              <option value="read">Read only</option>
            </SelectInput>
          </FilterField>

          <div className="office-notification-filter-actions">
            <Button
              disabled={
                pendingAction === "mark-all" ||
                unreadVisibleNotificationIds.length === 0
              }
              onClick={() => {
                void handleMarkAllRead();
              }}
              type="button"
              variant="secondary"
            >
              Mark all in view as read
            </Button>
            <Button
              onClick={() => updateFilters("all", "all")}
              type="button"
              variant="secondary"
            >
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </SectionCard>

      {error ? <p className="office-form-error">{error}</p> : null}

      <SectionCard
        className="office-list-card"
        subtitle="This queue keeps the highest-pressure cleanup signal per client visible in one place, including appointment follow-up, confirmation, reschedule pressure, and now the next external touch deadline, while duplicate review stays as a separate block so agents can clean the dossier before the next touch."
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
              description="When follow-ups, tracked sends, appointments, external writeback deadlines, or duplicate review start applying pressure, the highest-priority cleanup items will stack here first."
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
        subtitle="Calendar-linked reminder notices now stay separate from the broader notice stream, so confirmation, reschedule, external follow-up, and near-term appointment pressure can be scanned without mixing them into every other office notice."
        title="Appointment reminder pressure"
      >
        <ListPageStatsGrid>
          <StatCard
            hint="Appointments waiting on an explicit client confirmation deadline."
            label="Confirmation due"
            tone={confirmationDueCount > 0 ? "accent" : "default"}
            value={confirmationDueCount}
          />
          <StatCard
            hint="Appointments where the client asked to reschedule and the next writeback touch is due."
            label="Reschedule follow-up"
            tone={rescheduleDueCount > 0 ? "accent" : "default"}
            value={rescheduleDueCount}
          />
          <StatCard
            hint="External follow-up deadlines driven by appointment writeback instead of the meeting start alone."
            label="External touch due"
            tone={externalTouchDueCount > 0 ? "accent" : "default"}
            value={externalTouchDueCount}
          />
          <StatCard
            hint="Near-term appointments that are surfacing because the meeting itself is coming up."
            label="Appointment soon"
            tone={appointmentSoonNoticeCount > 0 ? "accent" : "default"}
            value={appointmentSoonNoticeCount}
          />
        </ListPageStatsGrid>

        <div className="office-notification-list">
          {appointmentReminderCards.length ? (
            appointmentReminderCards.map((card) => (
              <article
                className={[
                  "office-notification-row",
                  card.isUnread ? "is-unread" : "",
                  card.tone === "danger" ? "is-critical" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={card.id}
              >
                <div className="office-notification-row-copy">
                  <div className="office-notification-row-head">
                    <div className="office-notification-row-title">
                      <span
                        aria-hidden={!card.isUnread}
                        className="office-notification-unread-dot"
                      />
                      <strong>{card.title}</strong>
                    </div>

                    <div className="office-notification-row-meta">
                      <Badge tone={card.tone === "danger" ? "danger" : "warning"}>
                        {card.groupLabel}
                      </Badge>
                      <span>{card.createdAtLabel}</span>
                      <span>{card.typeLabel}</span>
                      <span>{card.isUnread ? "Unread" : "In view"}</span>
                    </div>
                  </div>

                  <p>{card.body}</p>
                </div>

                <div className="office-notification-row-actions">
                  <FrontOfficeLink className="office-button-secondary office-button-sm" href={card.href}>
                    {card.actionLabel}
                  </FrontOfficeLink>
                  <Button
                    disabled={
                      pendingAction === `mark_read:${card.id}` ||
                      pendingAction === `mark_unread:${card.id}`
                    }
                    onClick={() => {
                      void handleNotificationAction(
                        card.id,
                        card.isUnread ? "mark_read" : "mark_unread",
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {card.isUnread ? "Mark read" : "Mark unread"}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              description={
                activeFilter === "all" ||
                activeFilter === "general_notice"
                  ? "Calendar-linked confirmation, reschedule, external follow-up, and near-term appointment reminders will appear here when that pressure enters the inbox layer."
                  : activeReadState === "all"
                    ? "No appointment reminder notices match the current filter."
                    : "No appointment reminder notices match the current reminder filter and read-state view."
              }
              title="No appointment reminder notices"
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="This stream now stays focused on the remaining Front Office notices after appointment reminder pressure has been split into its own queue."
        title="Notice stream"
      >
        <div className="office-notification-list">
          {generalNoticeCards.length ? (
            generalNoticeCards.map((card) => (
              <article
                className={[
                  "office-notification-row",
                  card.isUnread ? "is-unread" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={card.id}
              >
                <div className="office-notification-row-copy">
                  <div className="office-notification-row-head">
                    <div className="office-notification-row-title">
                      <span
                        aria-hidden={!card.isUnread}
                        className="office-notification-unread-dot"
                      />
                      <strong>{card.title}</strong>
                    </div>

                    <div className="office-notification-row-meta">
                      <Badge tone={card.isUnread ? "accent" : "neutral"}>
                        {card.groupLabel}
                      </Badge>
                      <span>{card.typeLabel}</span>
                      <span>{card.createdAtLabel}</span>
                      <span>{card.actionLabel}</span>
                    </div>
                  </div>

                  <p>{card.body}</p>
                </div>

                <div className="office-notification-row-actions">
                  <FrontOfficeLink
                    className="office-button-secondary office-button-sm"
                    href={card.href}
                  >
                    Open notice
                  </FrontOfficeLink>
                  <Button
                    disabled={
                      pendingAction === `mark_read:${card.id}` ||
                      pendingAction === `mark_unread:${card.id}`
                    }
                    onClick={() => {
                      void handleNotificationAction(
                        card.id,
                        card.isUnread ? "mark_read" : "mark_unread",
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {card.isUnread ? "Mark read" : "Mark unread"}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              description={
                activeFilter === "all" || activeFilter === "general_notice"
                  ? "Broader Front Office notices will appear here after appointment reminder pressure has been handled or when non-calendar notices are available."
                  : activeReadState === "all"
                    ? "No general notices match the current filter."
                    : "No general notices match the current reminder filter and read-state view."
              }
              title="No general notices"
            />
          )}
        </div>
      </SectionCard>
    </>
  );
}
