"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Button,
  EmptyState,
  ListPageStatsGrid,
  StatCard,
  StatusBadge,
} from "@acre/ui";
import { FrontOfficeLink } from "../_components/front-office-link";
import styles from "./agent-notifications.module.css";

type CleanupDigestSectionItem = {
  actionDetail?: string;
  actionLabel?: string;
  destinationLabel?: string;
  detail?: string;
  dueAtLabel?: string;
  href: string;
  title: string;
};

type CleanupDigestSection = {
  count: number;
  items: CleanupDigestSectionItem[];
  key: string;
  label: string;
  summary: string;
};

type CleanupDigestSummary = {
  appointmentCount: number;
  clientReminderCount: number;
  dueSoonCount?: number;
  followUpTaskCount: number;
  notificationCount: number;
  totalCount: number;
  urgentCount?: number;
};

type CleanupDigestRunItemStatus =
  | "pending"
  | "completed"
  | "skipped"
  | "revisit";

type CleanupDigestRunItem = {
  actionDetail: string;
  actionLabel: string;
  destinationLabel: string;
  detail: string;
  dueAtLabel: string;
  href: string;
  id: string;
  sortOrder: number;
  status: CleanupDigestRunItemStatus;
  statusLabel: string;
  statusTone: "neutral" | "accent" | "success" | "warning" | "danger";
  statusUpdatedAtLabel: string | null;
  title: string;
  tone: "neutral" | "accent" | "warning" | "danger";
};

type CleanupDigestRun = {
  completedAtLabel: string | null;
  createdAtLabel: string;
  id: string;
  items: CleanupDigestRunItem[];
  progress: {
    completedCount: number;
    handledCount: number;
    openCount: number;
    pendingCount: number;
    percentComplete: number;
    revisitCount: number;
    skippedCount: number;
    totalCount: number;
  };
  scopeLabel: string;
  status: "active" | "completed" | "archived";
  statusLabel: string;
  statusTone: "neutral" | "accent" | "success" | "warning" | "danger";
  timeZone: string;
  updatedAtLabel: string;
  windowLabel: string;
};

type CleanupDigestWorkflowStep = {
  actionLabel: string;
  count: number;
  detail: string;
  href: string;
  key: string;
  label: string;
  tone: "neutral" | "accent" | "warning" | "danger";
};

type CleanupDigestWorkflow = {
  detail: string;
  label: string;
  primaryStepKey: string | null;
  providerSyncState: "none";
  runMode: "manual_operator_pass";
  schedulerState: "runner_contract_ready";
  steps: CleanupDigestWorkflowStep[];
};

type CleanupDigest = {
  activeRun?: CleanupDigestRun | null;
  generatedAtLabel: string;
  nextActionDetail: string;
  nextActionLabel: string;
  scopeLabel: string;
  sections: CleanupDigestSection[];
  summary: CleanupDigestSummary;
  timeZone: string;
  workflow?: CleanupDigestWorkflow;
  windowLabel: string;
};

type FrontOfficeCleanupDigestCardProps = {
  cleanupDigest: CleanupDigest;
  cleanupDigestHref: string;
  cleanupDigestMailThreadHref: string;
};

function getCleanupDigestTone(summary: CleanupDigestSummary) {
  if ((summary.urgentCount ?? 0) > 0) {
    return "danger" as const;
  }

  if ((summary.dueSoonCount ?? 0) > 0) {
    return "warning" as const;
  }

  return "accent" as const;
}

export function FrontOfficeCleanupDigestCard({
  cleanupDigest,
  cleanupDigestHref,
  cleanupDigestMailThreadHref,
}: FrontOfficeCleanupDigestCardProps) {
  const router = useRouter();
  const [isRefreshing, startRefreshing] = useTransition();
  const [isRunningManualDigest, setIsRunningManualDigest] = useState(false);
  const [isOpeningMailThread, setIsOpeningMailThread] = useState(false);
  const [activeRun, setActiveRun] = useState<CleanupDigestRun | null>(
    cleanupDigest.activeRun ?? null,
  );
  const [updatingRunItemId, setUpdatingRunItemId] = useState<string | null>(
    null,
  );
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [mailThreadMessage, setMailThreadMessage] = useState<string | null>(
    null,
  );
  const [checklistMessage, setChecklistMessage] = useState<string | null>(null);
  const digestTone = getCleanupDigestTone(cleanupDigest.summary);
  const topSections = cleanupDigest.sections
    .filter((section) => section.count > 0)
    .slice(0, 2);
  const workflowSteps = cleanupDigest.workflow?.steps ?? [];
  const primaryWorkflowStep = workflowSteps[0] ?? null;

  useEffect(() => {
    setActiveRun(cleanupDigest.activeRun ?? null);
  }, [cleanupDigest.activeRun]);

  async function runCleanupDigest() {
    setRunMessage(null);
    setIsRunningManualDigest(true);

    try {
      const response = await fetch(cleanupDigestHref, {
        cache: "no-store",
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        activityLabel?: string;
        digest?: {
          activeRun?: CleanupDigestRun | null;
          nextActionDetail?: string;
          nextActionLabel?: string;
        };
        error?: string;
        manualOnlyDetail?: string;
        run?: CleanupDigestRun;
      } | null;

      if (!response.ok) {
        setRunMessage(payload?.error ?? "Could not refresh the summary.");
        return;
      }

      setRunMessage(
        [
          payload?.activityLabel ?? "Summary refresh recorded.",
          payload?.manualOnlyDetail ??
            "Reviewed here only. Nothing runs on a schedule and nothing syncs automatically.",
          payload?.run?.progress
            ? `Checklist: ${payload.run.progress.handledCount}/${payload.run.progress.totalCount} handled.`
            : null,
          cleanupDigest.workflow?.label
            ? `Workflow: ${cleanupDigest.workflow.label}.`
            : null,
          payload?.digest?.nextActionLabel
            ? `Next: ${payload.digest.nextActionLabel}.`
            : null,
          payload?.digest?.nextActionDetail ?? null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      setActiveRun(payload?.run ?? payload?.digest?.activeRun ?? null);
      router.refresh();
    } catch {
      setRunMessage("Could not refresh the summary.");
    } finally {
      setIsRunningManualDigest(false);
    }
  }

  async function openCleanupDigestMailThread() {
    setMailThreadMessage(null);
    setIsOpeningMailThread(true);

    try {
      const response = await fetch(cleanupDigestMailThreadHref, {
        cache: "no-store",
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        actionLabel?: string;
        continuity?: { detail?: string; nextStep?: string };
        error?: string;
        hint?: string;
        manualOnlyDetail?: string;
        threadHref?: string;
      } | null;

      if (!response.ok || !payload?.threadHref) {
        setMailThreadMessage(
          payload?.hint ??
            payload?.error ??
            "Could not open the internal thread.",
        );
        return;
      }

      const opened = window.open(
        payload.threadHref,
        "_blank",
        "noopener,noreferrer",
      );

      if (!opened) {
        window.location.assign(payload.threadHref);
      }

      setMailThreadMessage(
        [
          `${payload.actionLabel ?? "Internal thread"} opened.`,
          payload.continuity?.detail ?? null,
          payload.manualOnlyDetail ?? null,
          payload.continuity?.nextStep ?? null,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      setMailThreadMessage("Could not open the internal thread.");
    } finally {
      setIsOpeningMailThread(false);
    }
  }

  async function updateCleanupRunItemStatus(
    item: CleanupDigestRunItem,
    status: CleanupDigestRunItemStatus,
  ) {
    setChecklistMessage(null);
    setUpdatingRunItemId(item.id);

    const params = new URLSearchParams({
      timeZone: cleanupDigest.timeZone,
    });

    try {
      const response = await fetch(
        `/api/agent/notifications/cleanup-digest/run-items/${encodeURIComponent(
          item.id,
        )}?${params.toString()}`,
        {
          body: JSON.stringify({ status }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        manualOnlyDetail?: string;
        run?: CleanupDigestRun;
      } | null;

      if (!response.ok || !payload?.run) {
        setChecklistMessage(
          payload?.error ?? "Could not update the cleanup checklist item.",
        );
        return;
      }

      setActiveRun(payload.run);
      setChecklistMessage(
        [
          `${item.title} marked ${status.replace(/_/g, " ")}.`,
          payload.manualOnlyDetail ?? null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      router.refresh();
    } catch {
      setChecklistMessage("Could not update the cleanup checklist item.");
    } finally {
      setUpdatingRunItemId(null);
    }
  }

  return (
    <div className={styles.summaryPanel}>
      <div className={styles.summaryPanelHeader}>
        <div className={styles.summaryPanelCopy}>
          <span className={styles.summaryPanelEyebrow}>
            Manual cleanup pass
          </span>
          <strong>{cleanupDigest.nextActionLabel}</strong>
          <p>{cleanupDigest.nextActionDetail}</p>
        </div>
        <StatusBadge tone={digestTone}>Manual run</StatusBadge>
      </div>

      <ListPageStatsGrid>
        <StatCard
          hint="unread notification cleanup signals in the digest window"
          label="Unread notices"
          tone={
            cleanupDigest.summary.notificationCount > 0 ? "accent" : "default"
          }
          value={cleanupDigest.summary.notificationCount}
        />
        <StatCard
          hint="follow-up tasks due inside the digest window"
          label="Follow-up tasks"
          tone={
            cleanupDigest.summary.followUpTaskCount > 0 ? "accent" : "default"
          }
          value={cleanupDigest.summary.followUpTaskCount}
        />
        <StatCard
          hint="client reminders and appointment continuity signals"
          label="Reminder pressure"
          tone={
            cleanupDigest.summary.clientReminderCount +
              cleanupDigest.summary.appointmentCount >
            0
              ? "accent"
              : "default"
          }
          value={
            cleanupDigest.summary.clientReminderCount +
            cleanupDigest.summary.appointmentCount
          }
        />
      </ListPageStatsGrid>

      <div className={styles.summaryPanelGrid}>
        <div className={styles.summaryPanelBlock}>
          <span className={styles.summaryPanelBlockEyebrow}>Window</span>
          <strong>{cleanupDigest.windowLabel}</strong>
          <p>
            {cleanupDigest.summary.totalCount} item(s) in scope for this pass.
          </p>
        </div>
        <div className={styles.summaryPanelBlock}>
          <span className={styles.summaryPanelBlockEyebrow}>Scope</span>
          <strong>{cleanupDigest.scopeLabel}</strong>
          <p>{cleanupDigest.timeZone}</p>
        </div>
        <div className={styles.summaryPanelBlock}>
          <span className={styles.summaryPanelBlockEyebrow}>Updated</span>
          <strong>{cleanupDigest.generatedAtLabel}</strong>
          <p>Refresh to pull the newest snapshot.</p>
        </div>
      </div>

      <div className={styles.summaryPanelPills}>
        <span className={styles.summaryPanelPill}>
          <strong>Mode</strong>
          Manual pass
        </span>
        <span className={styles.summaryPanelPill}>
          <strong>Scheduler</strong>
          Ready, not active
        </span>
        <span className={styles.summaryPanelPill}>
          <strong>Writeback</strong>
          Agent saved
        </span>
      </div>

      {cleanupDigest.workflow ? (
        <div className={styles.summaryPanelGrid}>
          <div className={styles.summaryPanelBlock}>
            <span className={styles.summaryPanelBlockEyebrow}>Pass</span>
            <strong>{cleanupDigest.workflow.label}</strong>
            <p>{cleanupDigest.workflow.detail}</p>
          </div>
          <div className={styles.summaryPanelBlock}>
            <span className={styles.summaryPanelBlockEyebrow}>
              Primary step
            </span>
            <strong>{primaryWorkflowStep?.label ?? "No active step"}</strong>
            <p>
              {primaryWorkflowStep?.detail ??
                "The digest is clear, but the same runner contract can support a future scheduled pass."}
            </p>
          </div>
          <div className={styles.summaryPanelBlock}>
            <span className={styles.summaryPanelBlockEyebrow}>Boundary</span>
            <strong>No provider sync</strong>
            <p>
              Runs and internal threads are recorded; outside systems stay
              manual until a user writes back.
            </p>
          </div>
        </div>
      ) : null}

      <div className={styles.summaryPanelActions}>
        <Button
          disabled={isRunningManualDigest}
          onClick={runCleanupDigest}
          type="button"
          variant="primary"
        >
          {isRunningManualDigest ? "Running digest..." : "Run manual digest"}
        </Button>
        {primaryWorkflowStep ? (
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={primaryWorkflowStep.href}
          >
            {primaryWorkflowStep.actionLabel}
          </FrontOfficeLink>
        ) : null}
        <Button
          disabled={isOpeningMailThread}
          onClick={openCleanupDigestMailThread}
          type="button"
          variant="secondary"
        >
          {isOpeningMailThread
            ? "Opening internal thread..."
            : "Open internal thread"}
        </Button>
        <Button
          disabled={isRefreshing}
          onClick={() => {
            startRefreshing(() => {
              router.refresh();
            });
          }}
          type="button"
          variant="secondary"
        >
          {isRefreshing ? "Refreshing page..." : "Refresh page"}
        </Button>
        <FrontOfficeLink
          className="office-inline-link front-office-inline-link"
          href={cleanupDigestHref}
        >
          Open data
        </FrontOfficeLink>
      </div>
      {runMessage ? (
        <p className="front-office-record-supporting">{runMessage}</p>
      ) : null}
      {mailThreadMessage ? (
        <p className="front-office-record-supporting">{mailThreadMessage}</p>
      ) : null}
      {checklistMessage ? (
        <p className="front-office-record-supporting">{checklistMessage}</p>
      ) : null}

      {activeRun ? (
        <div className="office-queue-list">
          <div className="list-row-meta front-office-record-meta">
            <span>Checklist run</span>
            <span>{activeRun.createdAtLabel}</span>
            <span>{activeRun.windowLabel}</span>
          </div>
          <article
            className={`list-row front-office-record tone-${activeRun.statusTone}`}
          >
            <div className="list-row-top front-office-record-head">
              <div>
                <strong>{activeRun.statusLabel}</strong>
                <p>
                  {activeRun.progress.handledCount}/
                  {activeRun.progress.totalCount} handled ·{" "}
                  {activeRun.progress.openCount} open ·{" "}
                  {activeRun.progress.percentComplete}% complete
                </p>
              </div>
              <StatusBadge tone={activeRun.statusTone}>
                {activeRun.progress.openCount} open
              </StatusBadge>
            </div>
            <div className="list-row-meta front-office-record-meta">
              <span>{activeRun.scopeLabel}</span>
              <span>Updated {activeRun.updatedAtLabel}</span>
              <span>
                Done {activeRun.progress.completedCount} · Skipped{" "}
                {activeRun.progress.skippedCount} · Later{" "}
                {activeRun.progress.revisitCount}
              </span>
            </div>
          </article>

          {activeRun.items.length ? (
            activeRun.items.slice(0, 8).map((item) => {
              const isUpdating = updatingRunItemId === item.id;
              const isClosed =
                item.status === "completed" || item.status === "skipped";

              return (
                <article
                  className={`list-row front-office-record tone-${item.tone}`}
                  key={item.id}
                >
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <StatusBadge tone={item.statusTone}>
                      {item.statusLabel}
                    </StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{item.dueAtLabel}</span>
                    <span>{item.destinationLabel}</span>
                    <span>
                      {item.statusUpdatedAtLabel
                        ? `Touched ${item.statusUpdatedAtLabel}`
                        : item.actionDetail}
                    </span>
                  </div>
                  <div className={styles.summaryPanelActions}>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </FrontOfficeLink>
                    {isClosed ? (
                      <Button
                        disabled={isUpdating}
                        onClick={() => {
                          void updateCleanupRunItemStatus(item, "pending");
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {isUpdating ? "Updating..." : "Reopen"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          disabled={isUpdating}
                          onClick={() => {
                            void updateCleanupRunItemStatus(item, "completed");
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Done
                        </Button>
                        <Button
                          disabled={isUpdating}
                          onClick={() => {
                            void updateCleanupRunItemStatus(item, "skipped");
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Skip
                        </Button>
                        {item.status !== "revisit" ? (
                          <Button
                            disabled={isUpdating}
                            onClick={() => {
                              void updateCleanupRunItemStatus(item, "revisit");
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Review later
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              className="front-office-inline-empty"
              description="The run is recorded, and there are no checklist rows in this pass."
              title="Checklist clear"
            />
          )}
        </div>
      ) : null}

      <div className="office-queue-list">
        <div className="list-row-meta front-office-record-meta">
          <span>Summary overview</span>
          <span>{cleanupDigest.generatedAtLabel}</span>
          <span>{cleanupDigest.timeZone}</span>
        </div>

        <article className={`list-row front-office-record tone-${digestTone}`}>
          <div className="list-row-top front-office-record-head">
            <div>
              <strong>{cleanupDigest.nextActionLabel}</strong>
              <p>{cleanupDigest.nextActionDetail}</p>
            </div>
            <StatusBadge tone={digestTone}>
              {cleanupDigest.summary.totalCount}
            </StatusBadge>
          </div>
          <div className="list-row-meta front-office-record-meta">
            <span>{cleanupDigest.windowLabel}</span>
            <span>{cleanupDigest.scopeLabel}</span>
            <span>Manual pass</span>
          </div>
        </article>

        {workflowSteps.length ? (
          workflowSteps.slice(0, 4).map((step, index) => (
            <article
              className={`list-row front-office-record tone-${step.tone}`}
              key={step.key}
            >
              <div className="list-row-top front-office-record-head">
                <div>
                  <strong>
                    {index + 1}. {step.label}
                  </strong>
                  <p>{step.detail}</p>
                </div>
                <StatusBadge tone={step.tone}>{step.count}</StatusBadge>
              </div>
              <div className="list-row-meta front-office-record-meta">
                <span>Manual</span>
                <span>Recorded in Acre when run</span>
              </div>
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={step.href}
              >
                {step.actionLabel}
              </FrontOfficeLink>
            </article>
          ))
        ) : null}

        {topSections.length ? (
          topSections.map((section) => (
            <article
              className="list-row front-office-record tone-accent"
              key={section.key}
            >
              <div className="list-row-top front-office-record-head">
                <div>
                  <strong>{section.label}</strong>
                  <p>{section.summary}</p>
                </div>
                <StatusBadge tone="accent">{section.count}</StatusBadge>
              </div>
              <div className="list-row-meta front-office-record-meta">
                <span>{section.items[0]?.dueAtLabel ?? "No due label"}</span>
                <span>
                  {section.items[0]?.destinationLabel ?? "Preview only"}
                </span>
                <span>{section.items[0]?.actionDetail ?? "Manual review"}</span>
              </div>
              {section.items[0] ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={section.items[0].href}
                >
                  {section.items[0].actionLabel ?? "Open first item"}
                </FrontOfficeLink>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            className="front-office-inline-empty"
            description="The live summary is clear right now. Use the activity list below for direct cleanup and read-state changes."
            title="Nothing urgent right now"
          />
        )}
      </div>
    </div>
  );
}
