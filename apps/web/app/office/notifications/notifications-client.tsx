"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OfficeNotificationItem, OfficeNotificationsSnapshot } from "@acre/db";
import { Badge, Button, EmptyState, FilterBar, FilterField, SectionCard, SelectInput, StatCard, StatusBadge } from "@acre/ui";
import { LocalDateTime } from "../_components/local-date-time";
import { useI18n } from "../../../lib/i18n/client";

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

function getNotificationActionLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  if (notification.type === "payout_statement_ready") {
    return t((messages) => messages.officeNotifications.reviewStatement);
  }

  if (
    notification.type === "transaction_overdue"
  ) {
    return t((messages) => messages.officeNotifications.openTransaction);
  }

  if (
    notification.type === "payout_statement_revision_requested" ||
    notification.type === "payout_statement_confirmed"
  ) {
    return t((messages) => messages.officeNotifications.openStatement);
  }

  return t((messages) => messages.officeNotifications.openRecord);
}

function getArchiveActionLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  if (notification.isArchived) {
    return t((messages) => messages.officeNotifications.restore);
  }

  return notification.isUnread
    ? t((messages) => messages.officeNotifications.dismiss)
    : t((messages) => messages.officeNotifications.archive);
}

function getNotificationTypeLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (notification.type) {
    case "internal_message_received":
      return t((messages) => messages.officeNav.items.mail);
    case "appointment_due_soon":
      return t((messages) => messages.agentCalendar.replyDue);
    case "appointment_external_touch_due":
      return t((messages) => messages.agentCalendar.touchDue);
    case "task_review_requested":
      return t((messages) => messages.officeNotifications.reviewQueue);
    case "task_second_review_requested":
      return t((messages) => messages.officeNotifications.reviewQueue);
    case "task_rejected":
      return t((messages) => messages.officeSignatures.declined);
    case "offer_created":
      return t((messages) => messages.officeOffers.title);
    case "offer_received":
      return t((messages) => messages.officeOffers.received);
    case "offer_expiring_soon":
      return t((messages) => messages.officeOffers.expiringSoon);
    case "signature_pending":
      return t((messages) => messages.officeSignatures.pendingSend);
    case "signature_completed":
      return t((messages) => messages.officeSignatures.completed);
    case "incoming_update_pending_review":
      return t((messages) => messages.officeNotifications.incomingUpdate);
    case "follow_up_assigned":
      return t((messages) => messages.officeNotifications.followUp);
    case "follow_up_overdue":
      return t((messages) => messages.officeNotifications.followUp);
    case "onboarding_assigned":
      return t((messages) => messages.officeNotifications.onboarding);
    case "onboarding_due_soon":
      return t((messages) => messages.officeNotifications.onboarding);
    case "payout_statement_ready":
      return t((messages) => messages.officeNotifications.payoutReview);
    case "payout_statement_revision_requested":
      return t((messages) => messages.officeNotifications.payoutReview);
    case "payout_statement_confirmed":
      return t((messages) => messages.officeNotifications.payoutReview);
    case "transaction_overdue":
      return t((messages) => messages.officeNotifications.transactions);
    default:
      return notification.typeLabel;
  }
}

function getNotificationTypeOptionLabel(
  value: string,
  fallbackLabel: string,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (value) {
    case "internal_message_received":
      return t((messages) => messages.officeNav.items.mail);
    case "appointment_due_soon":
      return t((messages) => messages.agentCalendar.replyDue);
    case "appointment_external_touch_due":
      return t((messages) => messages.agentCalendar.touchDue);
    case "task_review_requested":
    case "task_second_review_requested":
      return t((messages) => messages.officeNotifications.reviewQueue);
    case "task_rejected":
      return t((messages) => messages.officeSignatures.declined);
    case "offer_created":
      return t((messages) => messages.officeOffers.title);
    case "offer_received":
      return t((messages) => messages.officeOffers.received);
    case "offer_expiring_soon":
      return t((messages) => messages.officeOffers.expiringSoon);
    case "signature_pending":
      return t((messages) => messages.officeSignatures.pendingSend);
    case "signature_completed":
      return t((messages) => messages.officeSignatures.completed);
    case "incoming_update_pending_review":
      return t((messages) => messages.officeNotifications.incomingUpdate);
    case "follow_up_assigned":
    case "follow_up_overdue":
      return t((messages) => messages.officeNotifications.followUp);
    case "onboarding_assigned":
    case "onboarding_due_soon":
      return t((messages) => messages.officeNotifications.onboarding);
    case "payout_statement_ready":
    case "payout_statement_revision_requested":
    case "payout_statement_confirmed":
      return t((messages) => messages.officeNotifications.payoutReview);
    case "transaction_overdue":
      return t((messages) => messages.officeNotifications.transactions);
    default:
      return fallbackLabel;
  }
}

function getNotificationCategoryLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (notification.category) {
    case "message":
      return t((messages) => messages.officeNav.items.mail);
    case "task":
      return t((messages) => messages.officeNotifications.tasks);
    case "offer":
      return t((messages) => messages.officeOffers.title);
    case "signature":
      return t((messages) => messages.officeSignatures.title);
    case "incoming_update":
      return t((messages) => messages.officeNotifications.incomingUpdates);
    case "follow_up":
      return t((messages) => messages.officeNotifications.followUp);
    case "onboarding":
      return t((messages) => messages.officeNotifications.onboarding);
    case "event":
      return t((messages) => messages.officeNotifications.events);
    case "transaction":
      return t((messages) => messages.officeNotifications.transactions);
    case "system":
      return t((messages) => messages.officeNotifications.system);
    default:
      return t((messages) => messages.officeNotifications.categoryGeneral);
  }
}

function getNotificationCategoryOptionLabel(
  value: string,
  fallbackLabel: string,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (value) {
    case "message":
      return t((messages) => messages.officeNav.items.mail);
    case "task":
      return t((messages) => messages.officeNotifications.tasks);
    case "offer":
      return t((messages) => messages.officeOffers.title);
    case "signature":
      return t((messages) => messages.officeSignatures.title);
    case "incoming_update":
      return t((messages) => messages.officeNotifications.incomingUpdates);
    case "follow_up":
      return t((messages) => messages.officeNotifications.followUp);
    case "onboarding":
      return t((messages) => messages.officeNotifications.onboarding);
    case "event":
      return t((messages) => messages.officeNotifications.events);
    case "transaction":
      return t((messages) => messages.officeNotifications.transactions);
    case "system":
      return t((messages) => messages.officeNotifications.system);
    default:
      return fallbackLabel;
  }
}

function getSeverityLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (notification.severity) {
    case "critical":
      return t((messages) => messages.officeNotifications.severityCritical);
    case "warning":
      return t((messages) => messages.officeNotifications.severityNeedsAttention);
    default:
      return t((messages) => messages.officeNotifications.severityInfo);
  }
}

function getInboxStateLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  return notification.isArchived
    ? t((messages) => messages.officeNotifications.inboxStateArchived)
    : t((messages) => messages.officeNotifications.inboxStateInbox);
}

function getReadStateLabel(
  notification: OfficeNotificationItem,
  t: ReturnType<typeof useI18n>["t"]
) {
  return notification.isUnread
    ? t((messages) => messages.officeNotifications.readStateUnread)
    : t((messages) => messages.officeNotifications.readStateRead);
}

export function OfficeNotificationsClient({ snapshot }: OfficeNotificationsClientProps) {
  const { t, formatDate, formatDateTime } = useI18n();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visibleNotificationIds = snapshot.groups.flatMap((group) => group.notifications.map((notification) => notification.id));

  async function handleNotificationAction(
    notificationId: string,
    action: "mark_read" | "mark_unread" | "archive" | "unarchive"
  ) {
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
        throw new Error(body?.error ?? t((messages) => messages.officeNotifications.notificationUpdateFailed));
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t((messages) => messages.officeNotifications.notificationUpdateFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkAllRead() {
    setPendingAction("mark-all");
    setError("");

    try {
      if (!visibleNotificationIds.length) {
        setPendingAction(null);
        return;
      }

      const response = await fetch("/api/office/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "mark_all_read",
          notificationIds: visibleNotificationIds
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? t((messages) => messages.officeNotifications.markAllFailed));
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t((messages) => messages.officeNotifications.markAllFailed));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-notification-summary-grid">
        <StatCard hint={t((messages) => messages.officeNotifications.summaryUnreadHint)} label={t((messages) => messages.officeNotifications.unread)} value={snapshot.summary.unreadCount} />
        <StatCard hint={t((messages) => messages.officeNotifications.summaryReviewHint)} label={t((messages) => messages.officeNotifications.reviewQueue)} value={snapshot.summary.reviewCount} />
        <StatCard
          className={snapshot.summary.transactionOverdueCount > 0 ? "office-stat-card-danger" : undefined}
          hint={t((messages) => messages.officeNotifications.summaryTransactionOverdueHint)}
          label={t((messages) => messages.officeNotifications.overdueTransactions)}
          value={snapshot.summary.transactionOverdueCount}
        />
        <StatCard
          hint={t((messages) => messages.officeNotifications.summaryPayoutHint)}
          label={t((messages) => messages.officeNotifications.payoutReview)}
          value={snapshot.summary.payoutReviewCount}
        />
        <StatCard hint={t((messages) => messages.officeNotifications.summaryTimeSensitiveHint)} label={t((messages) => messages.officeOffers.expiringSoon)} value={snapshot.summary.timeSensitiveCount} />
        <StatCard hint={t((messages) => messages.officeNotifications.summaryArchivedHint)} label={t((messages) => messages.officeNotifications.archived)} value={snapshot.summary.archivedCount} />
      </section>

      {snapshot.transactionOverdueQueue.length ? (
        <SectionCard
          className="office-list-card office-notification-overdue-card"
          subtitle={t((messages) => messages.officeNotifications.overduePinnedSubtitle)}
          title={t((messages) => messages.officeNotifications.criticalOverdueTransactions)}
        >
          <div className="office-notification-overdue-head">
            <div className="office-notification-overdue-copy">
              <span className="office-notification-priority-eyebrow">{t((messages) => messages.officeNotifications.actionRequired)}</span>
              <strong>
                {snapshot.summary.transactionOverdueCount === 1
                  ? t((messages) => messages.officeNotifications.singleTransactionOverdue)
                  : t((messages) => messages.officeNotifications.multipleTransactionsOverdue, {
                      count: snapshot.summary.transactionOverdueCount,
                    })}
              </strong>
            </div>
            <StatusBadge tone="danger">
              {t((messages) => messages.officeNotifications.overdueCount, {
                count: snapshot.summary.transactionOverdueCount,
              })}
            </StatusBadge>
          </div>

          <div className="office-notification-overdue-list">
            {snapshot.transactionOverdueQueue.map((transaction) => (
              <article className="office-notification-overdue-item" key={transaction.notificationId}>
                <div className="office-notification-overdue-item-main">
                  <strong>{transaction.title}</strong>
                  <span>{transaction.propertyLabel || transaction.ownerLabel}</span>
                </div>
                <div className="office-notification-overdue-meta">
                  <span>{transaction.ownerLabel}</span>
                  <StatusBadge tone="danger">{transaction.statusLabel}</StatusBadge>
                  <span>
                    {t((messages) => messages.officeNotifications.referenceDate)}{" "}
                    <LocalDateTime fallbackLabel={transaction.referenceDateLabel} value={transaction.referenceDate} />
                  </span>
                  <span>
                    {t((messages) => messages.officeNotifications.overdueSince)}{" "}
                    <LocalDateTime fallbackLabel={transaction.overdueSinceLabel} value={transaction.overdueSince} />
                  </span>
                </div>
                <Link className="office-button office-button-sm" href={transaction.openHref}>
                  {t((messages) => messages.officeNotifications.openTransaction)}
                </Link>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {snapshot.payoutReviewQueue.length ? (
        <SectionCard
          className="office-list-card office-notification-priority-card"
          subtitle={t((messages) => messages.officeNotifications.payoutPinnedSubtitle)}
          title={t((messages) => messages.officeNotifications.needsPayoutReview)}
        >
          <div className="office-notification-priority-head">
            <p className="office-form-helper">
              {snapshot.summary.payoutReviewCount === 1
                ? t((messages) => messages.officeNotifications.singlePayoutWaiting)
                : t((messages) => messages.officeNotifications.multiplePayoutWaiting, { count: snapshot.summary.payoutReviewCount })}
            </p>
            <StatusBadge tone="danger">
              {t((messages) => messages.officeNotifications.awaitingReview, { count: snapshot.summary.payoutReviewCount })}
            </StatusBadge>
          </div>

          <div className="office-notification-priority-list">
            {snapshot.payoutReviewQueue.map((statement) => (
              <article className="office-notification-priority-item" key={statement.statementId}>
                <div className="office-notification-priority-copy">
                  <span className="office-notification-priority-eyebrow">{t((messages) => messages.officeNotifications.actionRequired)}</span>
                  <strong>{statement.periodLabel}</strong>
                  <p>
                    {t((messages) => messages.officeNotifications.generatedPrefix, {
                      value: formatDateTime(statement.generatedAt) || statement.generatedAtLabel,
                    })}{" "}
                    ·{" "}
                    {t((messages) => messages.officeNotifications.finalPayoutAmount, {
                      value: statement.totalStatementAmountLabel,
                    })}
                  </p>
                </div>

                <div className="office-notification-row-actions">
                  <Link className="office-button" href={statement.openHref}>
                    {t((messages) => messages.officeNotifications.reviewStatement)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card office-notification-toolbar"
        subtitle={t((messages) => messages.officeNotifications.filtersSubtitle)}
        title={t((messages) => messages.officeNotifications.filtersTitle)}
      >
        <FilterBar as="form" className="office-notification-filter-grid office-list-filters" method="get">
          <FilterField label={t((messages) => messages.officeNotifications.view)}>
            <SelectInput defaultValue={snapshot.filters.view} name="view">
              <option value="inbox">{t((messages) => messages.officeNotifications.inbox)}</option>
              <option value="archived">{t((messages) => messages.officeNotifications.archived)}</option>
            </SelectInput>
          </FilterField>

          <FilterField label={t((messages) => messages.officeNotifications.category)}>
            <SelectInput defaultValue={snapshot.filters.category} name="category">
              <option value="">{t((messages) => messages.officeNotifications.allCategories)}</option>
              {snapshot.categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getNotificationCategoryOptionLabel(option.value, option.label, t)} ({option.count})
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label={t((messages) => messages.officeNotifications.type)}>
            <SelectInput defaultValue={snapshot.filters.type} name="type">
              <option value="">{t((messages) => messages.officeNotifications.allNotificationTypes)}</option>
              {snapshot.typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getNotificationTypeOptionLabel(option.value, option.label, t)} ({option.count})
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label={t((messages) => messages.officeNotifications.readState)}>
            <SelectInput defaultValue={snapshot.filters.readState} name="readState">
              <option value="all">{t((messages) => messages.officeNotifications.allReadStates)}</option>
              <option value="unread">{t((messages) => messages.officeNotifications.unreadOnly)}</option>
              <option value="read">{t((messages) => messages.officeNotifications.readOnly)}</option>
            </SelectInput>
          </FilterField>

          <div className="office-notification-filter-actions">
            <Button type="submit">
              {t((messages) => messages.common.applyFilters)}
            </Button>
            <Link className="office-button-secondary" href="/office/notifications">
              {t((messages) => messages.common.reset)}
            </Link>
            <Button
              disabled={pendingAction === "mark-all" || snapshot.unreadCount === 0}
              onClick={handleMarkAllRead}
              type="button"
              variant="secondary"
            >
              {t((messages) => messages.officeNotifications.markAllRead)}
            </Button>
          </div>
        </FilterBar>
      </SectionCard>

      {error ? <p className="office-form-error">{error}</p> : null}

      <SectionCard
        className="office-list-card office-notification-list-card"
        subtitle={
          snapshot.filters.view === "archived"
            ? t((messages) => messages.officeNotifications.archivedItemsInView, { count: snapshot.totalCount })
            : t((messages) => messages.officeNotifications.inboxItemsInView, { count: snapshot.totalCount })
        }
        title={snapshot.filters.view === "archived" ? t((messages) => messages.officeNotifications.archivedNotifications) : t((messages) => messages.officeNotifications.inboxNotifications)}
      >
        {snapshot.groups.length ? (
          <div className="office-notification-groups">
            {snapshot.groups.map((group) => (
              <section className="office-notification-group" key={group.key}>
                <header className="office-notification-group-head">
                  <strong>{formatDate(group.key) || group.label}</strong>
                  <span>{group.notifications.length}</span>
                </header>

                <div className="office-notification-list">
                  {group.notifications.map((notification) => (
                    <article
                      className={[
                        "office-notification-row",
                        notification.isUnread ? "is-unread" : "",
                        notification.severity === "critical" ? "is-critical" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={notification.id}
                    >
                      <div className="office-notification-row-copy">
                        <div className="office-notification-row-head">
                          <div className="office-notification-row-title">
                            <span className="office-notification-unread-dot" aria-hidden={!notification.isUnread} />
                            <strong>{notification.title}</strong>
                          </div>

                          <div className="office-notification-row-meta">
                            <Badge tone={getSeverityTone(notification)}>{getSeverityLabel(notification, t)}</Badge>
                            <Badge tone="neutral">{getNotificationCategoryLabel(notification, t)}</Badge>
                            <StatusBadge tone={notification.isArchived ? "warning" : "success"}>
                              {getInboxStateLabel(notification, t)}
                            </StatusBadge>
                            <span>{getNotificationTypeLabel(notification, t)}</span>
                            <span><LocalDateTime fallbackLabel={notification.createdAtLabel} value={notification.createdAt} /></span>
                            <span>{getReadStateLabel(notification, t)}</span>
                          </div>
                        </div>

                        <p>{notification.body}</p>
                      </div>

                      <div className="office-notification-row-actions">
                        {notification.actionUrl ? (
                          <Link className="office-button-secondary office-button-sm" href={notification.openHref}>
                            {getNotificationActionLabel(notification, t)}
                          </Link>
                        ) : null}
                        <Button
                          disabled={Boolean(
                            pendingAction &&
                              pendingAction.endsWith(`:${notification.id}`) &&
                              (pendingAction.startsWith("mark_read:") || pendingAction.startsWith("mark_unread:"))
                          )}
                          onClick={() =>
                            handleNotificationAction(notification.id, notification.isUnread ? "mark_read" : "mark_unread")
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {notification.isUnread ? t((messages) => messages.officeNotifications.markRead) : t((messages) => messages.officeNotifications.markUnread)}
                        </Button>
                        <Button
                          disabled={Boolean(
                            pendingAction &&
                              pendingAction.endsWith(`:${notification.id}`) &&
                              (pendingAction.startsWith("archive:") || pendingAction.startsWith("unarchive:"))
                          )}
                          onClick={() =>
                            handleNotificationAction(notification.id, notification.isArchived ? "unarchive" : "archive")
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {getArchiveActionLabel(notification, t)}
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
            description={
              snapshot.filters.view === "archived"
                ? t((messages) => messages.officeNotifications.noArchivedMatched)
                : t((messages) => messages.officeNotifications.noInboxMatched)
            }
            title={snapshot.filters.view === "archived" ? t((messages) => messages.officeNotifications.noArchivedTitle) : t((messages) => messages.officeNotifications.noInboxTitle)}
          />
        )}
      </SectionCard>
    </>
  );
}
