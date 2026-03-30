"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActivityAlertSectionKey, ActivityLogViewMode, OfficeOperationalAlertsSnapshot } from "@acre/db";
import { Button, EmptyState, SectionCard, StatusBadge } from "@acre/ui";

type ActivitySearchParams = {
  view: string;
  activitySection: string;
  alertSection: string;
  actorMembershipId: string;
  objectType: string;
  startDate: string;
  endDate: string;
};

type ActivityAlertsLayoutProps = {
  selectedView: ActivityLogViewMode;
  currentSearchParams: ActivitySearchParams;
  activitySidebar: ReactNode;
  activityStream: ReactNode;
};

const alertSectionLabels: Record<ActivityAlertSectionKey, string> = {
  all: "All alerts",
  "offers-awaiting-review": "Offers awaiting review",
  "offers-expiring-soon": "Offers expiring soon",
  "tasks-awaiting-your-review": "Tasks awaiting your review",
  "tasks-awaiting-second-review": "Tasks awaiting second review",
  "rejected-tasks-needing-action": "Rejected tasks needing action",
  "transaction-closing-soon": "Transaction closing soon",
  "overdue-transaction-tasks": "Overdue transaction tasks",
  "contacts-follow-up-soon": "Contacts needing follow-up soon",
  "overdue-follow-up-tasks": "Overdue follow-up tasks",
  "transaction-finance-incomplete": "Transaction finance incomplete",
  "missing-required-documents": "Missing required documents",
  "signature-pending": "Signature pending",
  "incoming-updates-awaiting-review": "Incoming updates awaiting review"
};

function buildActivityHref(currentSearchParams: ActivitySearchParams, nextSearchParams: Partial<ActivitySearchParams>) {
  const merged = new URLSearchParams();
  const finalSearchParams = {
    ...currentSearchParams,
    ...nextSearchParams
  };

  for (const [key, value] of Object.entries(finalSearchParams)) {
    if (typeof value === "string" && value.trim().length > 0) {
      merged.set(key, value);
    }
  }

  const query = merged.toString();
  return query ? `/office/activity?${query}` : "/office/activity";
}

function getAlertTone(severity: string) {
  if (severity === "high") {
    return "danger" as const;
  }

  if (severity === "medium") {
    return "warning" as const;
  }

  return "accent" as const;
}

function normalizeAlertSection(value: string): ActivityAlertSectionKey {
  if (value in alertSectionLabels) {
    return value as ActivityAlertSectionKey;
  }

  return "all";
}

function getAlertsRequestHref(searchParams: ActivitySearchParams) {
  const query = new URLSearchParams();

  if (searchParams.objectType) {
    query.set("objectType", searchParams.objectType);
  }

  if (searchParams.alertSection) {
    query.set("alertSection", searchParams.alertSection);
  }

  if (searchParams.startDate) {
    query.set("startDate", searchParams.startDate);
  }

  if (searchParams.endDate) {
    query.set("endDate", searchParams.endDate);
  }

  const queryString = query.toString();
  return `/api/office/activity/alerts${queryString ? `?${queryString}` : ""}`;
}

function AlertsLoadingState(props: { copy: string }) {
  return (
    <div className="office-activity-alerts-loading" role="status" aria-live="polite">
      <p>{props.copy}</p>
      <div className="office-activity-alerts-loading-block" />
      <div className="office-activity-alerts-loading-block is-short" />
      <div className="office-activity-alerts-loading-block" />
    </div>
  );
}

export function ActivityAlertsLayout(props: ActivityAlertsLayoutProps) {
  const shouldLoadAlerts = props.selectedView !== "activity";
  const [snapshot, setSnapshot] = useState<OfficeOperationalAlertsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(shouldLoadAlerts);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!shouldLoadAlerts) {
      setSnapshot(null);
      setIsLoading(false);
      setError("");
      return;
    }

    const abortController = new AbortController();

    async function loadAlerts() {
      setSnapshot(null);
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(getAlertsRequestHref(props.currentSearchParams), {
          method: "GET",
          cache: "no-store",
          signal: abortController.signal
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load operational alerts.");
        }

        const nextSnapshot = (await response.json()) as OfficeOperationalAlertsSnapshot;
        setSnapshot(nextSnapshot);
      } catch (loadError) {
        if (abortController.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load operational alerts.");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadAlerts();

    return () => {
      abortController.abort();
    };
  }, [
    props.currentSearchParams.alertSection,
    props.currentSearchParams.endDate,
    props.currentSearchParams.objectType,
    props.currentSearchParams.startDate,
    reloadCount,
    shouldLoadAlerts
  ]);

  const selectedAlertSection = snapshot?.alertSelectedSection ?? normalizeAlertSection(props.currentSearchParams.alertSection);
  const selectedAlertSectionLabel = snapshot?.alertSelectedSectionLabel ?? alertSectionLabels[selectedAlertSection];
  const alertSections = snapshot?.alertSections ?? [];
  const alerts = snapshot?.alerts ?? [];

  return (
    <section className="bm-activity-layout">
      <aside className="bm-activity-nav-column">
        {props.activitySidebar}

        <SectionCard
          className="office-activity-sections-card"
          subtitle={
            shouldLoadAlerts ? "Live alerts derived from current system state" : "Switch to All or Alerts only to load live alerts."
          }
          title="Operational alerts"
        >
          {shouldLoadAlerts ? (
            isLoading ? (
              <AlertsLoadingState copy="Loading current operational alerts..." />
            ) : error ? (
              <div className="office-activity-alerts-feedback">
                <p className="office-form-error">{error}</p>
                <Button onClick={() => setReloadCount((count) => count + 1)} size="sm" type="button" variant="secondary">
                  Retry alerts
                </Button>
              </div>
            ) : (
              <nav className="bm-activity-section-list">
                {alertSections.map((section) => (
                  <Link
                    className={`bm-activity-section-link${props.selectedView === "alerts" && section.key === selectedAlertSection ? " is-active" : ""}`}
                    href={buildActivityHref(props.currentSearchParams, {
                      view: "alerts",
                      activitySection: "",
                      alertSection: section.key === "all" ? "" : section.key
                    })}
                    key={section.key}
                  >
                    <strong>{section.label}</strong>
                    <span>{section.count}</span>
                  </Link>
                ))}
              </nav>
            )
          ) : (
            <div className="office-activity-alerts-feedback">
              <p>Alerts are loaded on demand when the current view includes live operational alerts.</p>
            </div>
          )}
        </SectionCard>
      </aside>

      <div className="bm-activity-streams">
        {props.activityStream}

        {props.selectedView !== "activity" ? (
          <SectionCard
            className="office-activity-log-card office-alerts-card"
            subtitle={
              isLoading ? "Loading current alerts" : `Showing ${alerts.length} current alerts`
            }
            title={props.selectedView === "alerts" ? selectedAlertSectionLabel : "Operational alerts"}
          >
            <div className="bm-activity-records">
              {isLoading ? (
                <AlertsLoadingState copy="Loading current operational alerts..." />
              ) : error ? (
                <EmptyState
                  action={
                    <Button onClick={() => setReloadCount((count) => count + 1)} size="sm" type="button" variant="secondary">
                      Retry alerts
                    </Button>
                  }
                  description={error}
                  title="Operational alerts could not be loaded"
                />
              ) : alerts.length ? (
                alerts.map((alert) => (
                  <article className="bm-activity-record bm-alert-record" key={alert.id}>
                    <div className="bm-activity-record-top">
                      <div className="bm-activity-record-copy">
                        <div className="bm-activity-record-summary">
                          <strong>{alert.title}</strong>
                          <span>{alert.summary}</span>
                        </div>
                        {alert.href ? (
                          <Link className="bm-activity-object-link" href={alert.href}>
                            {alert.objectLabel}
                          </Link>
                        ) : (
                          <p className="bm-activity-object-link is-static">{alert.objectLabel}</p>
                        )}
                      </div>

                      <div className="bm-activity-record-meta">
                        <StatusBadge tone={getAlertTone(alert.severity)}>{alert.severityLabel}</StatusBadge>
                        <span>{alert.referenceLabel}</span>
                      </div>
                    </div>

                    <div className="bm-alert-type-row">
                      <span className="bm-alert-type-label">{alert.typeLabel}</span>
                    </div>

                    {alert.detailSummary.length ? (
                      <ul className="bm-activity-detail-list">
                        {alert.detailSummary.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyState
                  description="This scope is clear based on the current live workflow state."
                  title="No live operational alerts are active for this scope."
                />
              )}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </section>
  );
}
