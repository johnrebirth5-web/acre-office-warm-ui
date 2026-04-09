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

type CleanupDigest = {
  generatedAtLabel: string;
  nextActionDetail: string;
  nextActionLabel: string;
  scopeLabel: string;
  sections: CleanupDigestSection[];
  summary: CleanupDigestSummary;
  timeZone: string;
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
        setRunMessage(
          payload?.error ?? "Could not record the cleanup digest run.",
        );
        return;
      }

      setRunMessage(
        [
          payload?.activityLabel ?? "Cleanup digest run recorded.",
          payload?.manualOnlyDetail ??
            "Manual-only. No scheduler. No provider sync.",
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
      setRunMessage("Could not record the cleanup digest run.");
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
          payload?.hint ?? payload?.error ?? "Could not open the mail thread.",
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
          `${payload.actionLabel ?? "Internal mail thread"} opened.`,
          payload.continuity?.detail ?? null,
          payload.manualOnlyDetail ?? null,
          payload.continuity?.nextStep ?? null,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      setMailThreadMessage("Could not open the cleanup digest mail thread.");
    } finally {
      setIsOpeningMailThread(false);
    }
  }

  return (
    <div className={styles.summaryPanel}>
      <div className={styles.summaryPanelHeader}>
        <div className={styles.summaryPanelCopy}>
          <span className={styles.summaryPanelEyebrow}>Manual summary</span>
          <strong>{cleanupDigest.nextActionLabel}</strong>
          <p>{cleanupDigest.nextActionDetail}</p>
        </div>
        <StatusBadge tone={digestTone}>Manual mode</StatusBadge>
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
            {cleanupDigest.summary.totalCount} item(s) in scope for this manual
            pass.
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
          <p>The route stays no-store, so each refresh pulls a new snapshot.</p>
        </div>
      </div>

      <div className={styles.summaryPanelPills}>
        <span className={styles.summaryPanelPill}>
          <strong>Mode</strong>
          Manual
        </span>
        <span className={styles.summaryPanelPill}>
          <strong>Route</strong>
          JSON preview
        </span>
        <span className={styles.summaryPanelPill}>
          <strong>Refresh</strong>
          Pulls a new live snapshot
        </span>
      </div>

      <div className={styles.summaryPanelActions}>
        <Button
          disabled={isRunningManualDigest}
          onClick={runCleanupDigest}
          type="button"
          variant="primary"
        >
          {isRunningManualDigest
            ? "Running manual digest..."
            : "Run manual digest"}
        </Button>
        <Button
          disabled={isOpeningMailThread}
          onClick={openCleanupDigestMailThread}
          type="button"
          variant="secondary"
        >
          {isOpeningMailThread
            ? "Opening internal thread..."
            : "Open internal mail thread"}
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
          {isRefreshing ? "Refreshing digest..." : "Refresh digest"}
        </Button>
        <FrontOfficeLink
          className="office-inline-link front-office-inline-link"
          href={cleanupDigestHref}
        >
          Open JSON
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
          <span>Manual summary rail</span>
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
            <span>Manual mode</span>
          </div>
        </article>

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
                <span>{section.items[0]?.detail ?? "Digest preview only"}</span>
              </div>
              {section.items[0] ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={section.items[0].href}
                >
                  Open first item
                </FrontOfficeLink>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            className="front-office-inline-empty"
            description="The live digest is clear right now. Keep using the activity workbench below for direct cleanup and read-state changes."
            title="No digest pressure"
          />
        )}
      </div>
    </div>
  );
}
