"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OfficeNotificationItem, OfficeNotificationsSnapshot } from "@acre/db";
import { Badge, Button, EmptyState, FilterBar, FilterField, SectionCard, SelectInput, StatCard } from "@acre/ui";

type OfficeNotificationsClientProps = {
  snapshot: OfficeNotificationsSnapshot;
};

function getSeverityTone(notification: OfficeNotificationItem) {
  if (notification.severity === "critical") {
    return "danger" as const;
  }

  if (notification.severity === "warning") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function OfficeNotificationsClient({ snapshot }: OfficeNotificationsClientProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleNotificationAction(notificationId: string, action: "mark_read" | "mark_unread") {
    setPendingAction(`${action}:${notificationId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/notifications/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Notification update failed.");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Notification update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkAllRead() {
    setPendingAction("mark-all");
    setError("");

    try {
      const response = await fetch("/api/office/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "mark_all_read",
          type: snapshot.filters.type,
          category: snapshot.filters.category
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Mark-all action failed.");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mark-all action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-notification-summary-grid">
        <StatCard hint="Unread first across the full inbox." label="Unread" value={snapshot.summary.unreadCount} />
        <StatCard hint="Task review and incoming update items still waiting on you." label="Review queue" value={snapshot.summary.reviewCount} />
        <StatCard hint="Expiring, overdue, or near-due reminder notifications." label="Time-sensitive" value={snapshot.summary.timeSensitiveCount} />
        <StatCard hint="Count in the current filtered view." label="In view" value={snapshot.totalCount} />
      </section>

      <SectionCard
        className="office-list-card office-notification-toolbar"
        subtitle="Unread-first sorting stays on by default."
        title="Filters"
      >
        <FilterBar as="form" className="office-notification-filter-grid office-list-filters" method="get">
          <FilterField label="Category">
            <SelectInput defaultValue={snapshot.filters.category} name="category">
              <option value="">All categories</option>
              {snapshot.categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Type">
            <SelectInput defaultValue={snapshot.filters.type} name="type">
              <option value="">All notification types</option>
              {snapshot.typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Read state">
            <SelectInput defaultValue={snapshot.filters.readState} name="readState">
              <option value="all">All</option>
              <option value="unread">Unread only</option>
              <option value="read">Read only</option>
            </SelectInput>
          </FilterField>

          <div className="office-notification-filter-actions">
            <Button type="submit">
              Apply filters
            </Button>
            <Link className="office-button-secondary" href="/office/notifications">
              Reset
            </Link>
            <Button
              disabled={pendingAction === "mark-all" || snapshot.unreadCount === 0}
              onClick={handleMarkAllRead}
              type="button"
              variant="secondary"
            >
              Mark all in view as read
            </Button>
          </div>
        </FilterBar>
      </SectionCard>

      {error ? <p className="office-form-error">{error}</p> : null}

      <SectionCard
        className="office-list-card office-notification-list-card"
        subtitle={`${snapshot.totalCount} items in the current view`}
        title="All notifications"
      >
        {snapshot.groups.length ? (
          <div className="office-notification-groups">
            {snapshot.groups.map((group) => (
              <section className="office-notification-group" key={group.key}>
                <header className="office-notification-group-head">
                  <strong>{group.label}</strong>
                  <span>{group.notifications.length}</span>
                </header>

                <div className="office-notification-list">
                  {group.notifications.map((notification) => (
                    <article className={`office-notification-row${notification.isUnread ? " is-unread" : ""}`} key={notification.id}>
                      <div className="office-notification-row-copy">
                        <div className="office-notification-row-head">
                          <div className="office-notification-row-title">
                            <span className="office-notification-unread-dot" aria-hidden={!notification.isUnread} />
                            <strong>{notification.title}</strong>
                          </div>

                          <div className="office-notification-row-meta">
                            <Badge tone={getSeverityTone(notification)}>{notification.severityLabel}</Badge>
                            <Badge tone="neutral">{notification.categoryLabel}</Badge>
                            <span>{notification.typeLabel}</span>
                            <span>{notification.createdAtLabel}</span>
                            <span>{notification.readStateLabel}</span>
                          </div>
                        </div>

                        <p>{notification.body}</p>
                      </div>

                      <div className="office-notification-row-actions">
                        {notification.actionUrl ? (
                          <Link className="office-button-secondary office-button-sm" href={notification.openHref}>
                            Open record
                          </Link>
                        ) : null}
                        <Button
                          disabled={pendingAction === `mark_read:${notification.id}` || pendingAction === `mark_unread:${notification.id}`}
                          onClick={() =>
                            handleNotificationAction(notification.id, notification.isUnread ? "mark_read" : "mark_unread")
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {notification.isUnread ? "Mark read" : "Mark unread"}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No notifications match the current filters yet."
            title="No notifications in this view"
          />
        )}
      </SectionCard>
    </>
  );
}
