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
  all: "全部提醒",
  "offers-awaiting-review": "等待审核的报价",
  "offers-expiring-soon": "即将到期的报价",
  "tasks-awaiting-your-review": "等待你审核的任务",
  "tasks-awaiting-second-review": "等待二级审核的任务",
  "rejected-tasks-needing-action": "被拒后需要处理的任务",
  "transaction-closing-soon": "即将成交的交易",
  "overdue-transaction-tasks": "逾期交易任务",
  "contacts-follow-up-soon": "即将需要跟进的联系人",
  "overdue-follow-up-tasks": "逾期跟进任务",
  "transaction-finance-incomplete": "交易财务信息不完整",
  "missing-required-documents": "缺少必需文件",
  "signature-pending": "待签署",
  "incoming-updates-awaiting-review": "等待审核的传入更新"
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
          throw new Error(payload?.error ?? "加载运营提醒失败。");
        }

        const nextSnapshot = (await response.json()) as OfficeOperationalAlertsSnapshot;
        setSnapshot(nextSnapshot);
      } catch (loadError) {
        if (abortController.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "加载运营提醒失败。");
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
    <section className="office-activity-layout">
      <aside className="office-activity-nav-column">
        {props.activitySidebar}

        <SectionCard
          className="office-activity-sections-card"
          subtitle={
            shouldLoadAlerts ? "从当前系统状态实时推导的提醒" : "切换到“全部”或“仅提醒”即可加载实时提醒。"
          }
          title="运营提醒"
        >
          {shouldLoadAlerts ? (
            isLoading ? (
              <AlertsLoadingState copy="正在加载当前运营提醒..." />
            ) : error ? (
              <div className="office-activity-alerts-feedback">
                <p className="office-form-error">{error}</p>
                <Button onClick={() => setReloadCount((count) => count + 1)} size="sm" type="button" variant="secondary">
                  重试提醒
                </Button>
              </div>
            ) : (
              <nav className="office-activity-section-list">
                {alertSections.map((section) => (
                  <Link
                    className={`office-activity-section-link${props.selectedView === "alerts" && section.key === selectedAlertSection ? " is-active" : ""}`}
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
              <p>当前视图包含实时运营提醒时，提醒会按需加载。</p>
            </div>
          )}
        </SectionCard>
      </aside>

      <div className="office-activity-streams">
        {props.activityStream}

        {props.selectedView !== "activity" ? (
          <SectionCard
            className="office-activity-log-card office-alerts-card"
            subtitle={
              isLoading ? "正在加载当前提醒" : `显示 ${alerts.length} 条当前提醒`
            }
            title={props.selectedView === "alerts" ? selectedAlertSectionLabel : "运营提醒"}
          >
            <div className="office-activity-records">
              {isLoading ? (
                <AlertsLoadingState copy="正在加载当前运营提醒..." />
              ) : error ? (
                <EmptyState
                  action={
                    <Button onClick={() => setReloadCount((count) => count + 1)} size="sm" type="button" variant="secondary">
                      重试提醒
                    </Button>
                  }
                  description={error}
                  title="无法加载运营提醒"
                />
              ) : alerts.length ? (
                alerts.map((alert) => (
                  <article className="office-activity-record office-alert-record" key={alert.id}>
                    <div className="office-activity-record-top">
                      <div className="office-activity-record-copy">
                        <div className="office-activity-record-summary">
                          <strong>{alert.title}</strong>
                          <span>{alert.summary}</span>
                        </div>
                        {alert.href ? (
                          <Link className="office-activity-object-link" href={alert.href}>
                            {alert.objectLabel}
                          </Link>
                        ) : (
                          <p className="office-activity-object-link is-static">{alert.objectLabel}</p>
                        )}
                      </div>

                      <div className="office-activity-record-meta">
                        <StatusBadge tone={getAlertTone(alert.severity)}>{alert.severityLabel}</StatusBadge>
                        <span>{alert.referenceLabel}</span>
                      </div>
                    </div>

                    <div className="office-alert-type-row">
                      <span className="office-alert-type-label">{alert.typeLabel}</span>
                    </div>

                    {alert.detailSummary.length ? (
                      <ul className="office-activity-detail-list">
                        {alert.detailSummary.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyState
                  description="根据当前实时工作流状态，这个范围暂无需要处理的提醒。"
                  title="当前范围没有活动中的实时运营提醒。"
                />
              )}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </section>
  );
}
