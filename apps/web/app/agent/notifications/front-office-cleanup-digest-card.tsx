"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [mailThreadMessage, setMailThreadMessage] = useState<string | null>(
    null,
  );
  const digestTone = getCleanupDigestTone(cleanupDigest.summary);
  const topSections = cleanupDigest.sections
    .filter((section) => section.count > 0)
    .slice(0, 2);
  const workflowSteps = cleanupDigest.workflow?.steps ?? [];
  const primaryWorkflowStep = workflowSteps[0] ?? null;

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
          nextActionDetail?: string;
          nextActionLabel?: string;
        };
        error?: string;
        manualOnlyDetail?: string;
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
