"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type {
  FrontOfficeActivityCleanupItem,
  FrontOfficeActivityNotificationRecord,
  FrontOfficeActivitySnapshot,
  FrontOfficeDashboardSnapshot,
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

type AgentCleanupFilter =
  | "all"
  | FrontOfficeActivityCleanupItem["kindKey"]
  | "duplicate_review";

type AgentNotificationStreamFilter =
  | "all"
  | FrontOfficeActivityNotificationRecord["streamKey"];

type AgentActivityView =
  | "all"
  | "personal_cleanup"
  | "team_cleanup"
  | "appointment_reminders"
  | "general_notices";
type AgentNotificationReadState = "all" | "unread" | "read";
type ActivityLaneTone = "neutral" | "accent" | "success" | "warning" | "danger";
type AgentLeadershipCleanupFilter =
  | "all"
  | FrontOfficeDashboardSnapshot["leadershipQueue"]["items"][number]["kindKey"];

type AgentNotificationsClientProps = {
  snapshot: FrontOfficeActivitySnapshot;
  initialActivityView: AgentActivityView;
  initialCleanupFilter: AgentCleanupFilter;
  initialFilter: AgentNotificationFilter;
  initialNoticeStreamFilter: AgentNotificationStreamFilter;
  initialReadState: AgentNotificationReadState;
  initialTeamCleanupFilter: AgentLeadershipCleanupFilter;
  leadershipQueue: FrontOfficeDashboardSnapshot["leadershipQueue"];
};

const activityViewOptions: Array<{
  value: AgentActivityView;
  label: string;
}> = [
  { value: "all", label: "Full activity center" },
  { value: "personal_cleanup", label: "Personal cleanup" },
  { value: "team_cleanup", label: "Team cleanup" },
  { value: "appointment_reminders", label: "Appointment reminders" },
  { value: "general_notices", label: "General notices" },
];

const cleanupFilterOptions: Array<{
  value: AgentCleanupFilter;
  label: string;
}> = [
  { value: "all", label: "All personal cleanup" },
  { value: "follow_up", label: "Follow-up due" },
  { value: "appointment_writeback", label: "Appointment writeback" },
  { value: "send_risk", label: "Send-trail risk" },
  { value: "stale_client", label: "Stale dossiers" },
  { value: "duplicate_review", label: "Duplicate review" },
];

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

const noticeStreamFilterOptions: Array<{
  value: AgentNotificationStreamFilter;
  label: string;
}> = [
  { value: "all", label: "All notice lanes" },
  { value: "front_office", label: "FO actions" },
  { value: "back_office", label: "BO handoff" },
  { value: "shared_notice", label: "Shared office notices" },
  { value: "reference", label: "Awareness only" },
];

const leadershipCleanupFilterOptions: Array<{
  value: AgentLeadershipCleanupFilter;
  label: string;
}> = [
  { value: "all", label: "All team pressure" },
  { value: "overdue_task", label: "Overdue tasks" },
  { value: "engagement_risk", label: "Send-trail risk" },
  { value: "stale_client", label: "15+ day stale" },
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
  if (!card.readStateMutable) {
    return readState === "all";
  }

  if (readState === "unread") {
    return card.isUnread;
  }

  if (readState === "read") {
    return !card.isUnread;
  }

  return true;
}

function cardMatchesStreamFilter(
  card: FrontOfficeActivityNotificationRecord,
  filter: AgentNotificationStreamFilter,
) {
  if (card.groupKey !== "general_notice") {
    return true;
  }

  return filter === "all" || card.streamKey === filter;
}

function cleanupItemMatchesFilter(
  item: FrontOfficeActivityCleanupItem,
  filter: AgentCleanupFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "duplicate_review") {
    return false;
  }

  return item.kindKey === filter;
}

function leadershipItemMatchesFilter(
  item: FrontOfficeDashboardSnapshot["leadershipQueue"]["items"][number],
  filter: AgentLeadershipCleanupFilter,
) {
  return filter === "all" || item.kindKey === filter;
}

function normalizeNotificationFilterForActivityView(
  activityView: AgentActivityView,
  filter: AgentNotificationFilter,
): AgentNotificationFilter {
  if (activityView === "general_notices") {
    return "general_notice";
  }

  if (activityView === "appointment_reminders" && filter === "general_notice") {
    return "all";
  }

  return filter;
}

function buildAgentNotificationsHref(input: {
  pathname: string;
  activityView: AgentActivityView;
  cleanupFilter: AgentCleanupFilter;
  filter: AgentNotificationFilter;
  noticeStreamFilter: AgentNotificationStreamFilter;
  readState: AgentNotificationReadState;
  leadershipFilter: AgentLeadershipCleanupFilter;
  anchor?: string;
}) {
  const params = new URLSearchParams();
  const showPersonalCleanupControls =
    input.activityView === "all" || input.activityView === "personal_cleanup";
  const showNotificationControls =
    input.activityView === "all" ||
    input.activityView === "appointment_reminders" ||
    input.activityView === "general_notices";
  const showGeneralNoticeControls =
    input.activityView === "all" || input.activityView === "general_notices";
  const showTeamCleanupControls =
    input.activityView === "all" || input.activityView === "team_cleanup";

  if (input.activityView !== "all") {
    params.set("activityView", input.activityView);
  }

  if (showPersonalCleanupControls && input.cleanupFilter !== "all") {
    params.set("cleanupFilter", input.cleanupFilter);
  }

  if (
    showNotificationControls &&
    input.filter !== "all" &&
    !(
      input.activityView === "general_notices" &&
      input.filter === "general_notice"
    )
  ) {
    params.set("noticeFilter", input.filter);
  }

  if (showGeneralNoticeControls && input.noticeStreamFilter !== "all") {
    params.set("noticeStreamFilter", input.noticeStreamFilter);
  }

  if (showNotificationControls && input.readState !== "all") {
    params.set("readState", input.readState);
  }

  if (showTeamCleanupControls && input.leadershipFilter !== "all") {
    params.set("teamCleanupFilter", input.leadershipFilter);
  }

  const query = params.toString();
  const baseHref = query ? `${input.pathname}?${query}` : input.pathname;

  return input.anchor ? `${baseHref}${input.anchor}` : baseHref;
}

function getActivityViewAnchor(activityView: AgentActivityView) {
  if (activityView === "personal_cleanup") {
    return "#cleanup-center";
  }

  if (activityView === "team_cleanup") {
    return "#team-cleanup-pressure";
  }

  if (activityView === "appointment_reminders") {
    return "#appointment-reminder-pressure";
  }

  if (activityView === "general_notices") {
    return "#notice-stream";
  }

  return "";
}

function resolveOptionValue<T extends string>(
  rawValue: string | null,
  options: Array<{
    value: T;
  }>,
  fallback: T,
) {
  return options.some((option) => option.value === rawValue)
    ? (rawValue as T)
    : fallback;
}

function cleanupMetricMatchesFilter(
  metricKey: FrontOfficeActivitySnapshot["cleanup"]["metrics"][number]["key"],
  filter: AgentCleanupFilter,
) {
  if (filter === "all") {
    return false;
  }

  return metricKey === filter;
}

function streamBadgeTone(
  streamKey: FrontOfficeActivityNotificationRecord["streamKey"],
) {
  if (streamKey === "front_office") {
    return "accent";
  }

  if (streamKey === "back_office") {
    return "warning";
  }

  return "neutral";
}

function toneToBadgeTone(
  tone:
    | FrontOfficeActivityNotificationRecord["pressureTone"]
    | FrontOfficeActivityCleanupItem["tone"]
    | FrontOfficeDashboardSnapshot["leadershipQueue"]["items"][number]["tone"],
) {
  if (tone === "danger") {
    return "danger";
  }

  if (tone === "warning") {
    return "warning";
  }

  if (tone === "success") {
    return "success";
  }

  if (tone === "accent") {
    return "accent";
  }

  return "neutral";
}

export function AgentNotificationsClient({
  snapshot,
  initialActivityView,
  initialCleanupFilter,
  initialFilter,
  initialNoticeStreamFilter,
  initialReadState,
  initialTeamCleanupFilter,
  leadershipQueue,
}: AgentNotificationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isFilterNavigationPending, startFilterNavigation] = useTransition();
  const rawActivityView = resolveOptionValue(
    searchParams.get("activityView"),
    activityViewOptions,
    initialActivityView,
  );
  const activeActivityView =
    !leadershipQueue.visible && rawActivityView === "team_cleanup"
      ? "all"
      : rawActivityView;
  const activeCleanupFilter = resolveOptionValue(
    searchParams.get("cleanupFilter"),
    cleanupFilterOptions,
    initialCleanupFilter,
  );
  const activeFilter = normalizeNotificationFilterForActivityView(
    activeActivityView,
    resolveOptionValue(
      searchParams.get("noticeFilter"),
      notificationFilterOptions,
      initialFilter,
    ),
  );
  const activeNoticeStreamFilter = resolveOptionValue(
    searchParams.get("noticeStreamFilter"),
    noticeStreamFilterOptions,
    initialNoticeStreamFilter,
  );
  const activeReadState = resolveOptionValue(
    searchParams.get("readState"),
    [
      { value: "all" as const },
      { value: "unread" as const },
      { value: "read" as const },
    ],
    initialReadState,
  );
  const activeLeadershipFilter = resolveOptionValue(
    searchParams.get("teamCleanupFilter"),
    leadershipCleanupFilterOptions,
    initialTeamCleanupFilter,
  );
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<
    string[]
  >([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const activeRouteSliceKey = [
    activeActivityView,
    activeCleanupFilter,
    activeFilter,
    activeNoticeStreamFilter,
    activeReadState,
    activeLeadershipFilter,
  ].join("|");

  useEffect(() => {
    setSelectedNotificationIds([]);
    setError("");
    setStatusMessage("");
  }, [activeRouteSliceKey]);

  function updateFilters(
    nextActivityView: AgentActivityView,
    nextCleanupFilter: AgentCleanupFilter,
    nextFilter: AgentNotificationFilter,
    nextNoticeStreamFilter: AgentNotificationStreamFilter,
    nextReadState: AgentNotificationReadState,
    nextLeadershipFilter: AgentLeadershipCleanupFilter,
  ) {
    const resolvedActivityView =
      !leadershipQueue.visible && nextActivityView === "team_cleanup"
        ? "all"
        : nextActivityView;
    const resolvedFilter = normalizeNotificationFilterForActivityView(
      resolvedActivityView,
      nextFilter,
    );
    setSelectedNotificationIds([]);
    setError("");
    setStatusMessage("");
    startFilterNavigation(() => {
      router.replace(
        buildAgentNotificationsHref({
          pathname,
          activityView: resolvedActivityView,
          cleanupFilter: nextCleanupFilter,
          filter: resolvedFilter,
          noticeStreamFilter: nextNoticeStreamFilter,
          readState: nextReadState,
          leadershipFilter: nextLeadershipFilter,
        }),
        { scroll: false },
      );
    });
  }

  const filteredCleanupItems = snapshot.cleanup.items.filter((item) =>
    cleanupItemMatchesFilter(item, activeCleanupFilter),
  );
  const visibleDuplicatePairs =
    activeCleanupFilter === "all" || activeCleanupFilter === "duplicate_review"
      ? snapshot.cleanup.duplicatePairs
      : [];
  const visibleNotificationCards = snapshot.notifications.filter(
    (card) =>
      cardMatchesFilter(card, activeFilter) &&
      cardMatchesStreamFilter(card, activeNoticeStreamFilter) &&
      cardMatchesReadState(card, activeReadState),
  );
  const appointmentReminderCards = visibleNotificationCards.filter(
    (card) => card.groupKey !== "general_notice",
  );
  const generalNoticeCards = visibleNotificationCards.filter(
    (card) => card.groupKey === "general_notice",
  );
  const mutableVisibleNotificationCards = visibleNotificationCards.filter(
    (card) => card.readStateMutable,
  );
  const mutableVisibleNotificationIds = mutableVisibleNotificationCards.map(
    (card) => card.id,
  );
  const selectedVisibleNotificationIds = selectedNotificationIds.filter((id) =>
    mutableVisibleNotificationIds.includes(id),
  );
  const selectedVisibleNotificationSet = new Set(
    selectedVisibleNotificationIds,
  );
  const selectedNotificationCards = mutableVisibleNotificationCards.filter(
    (card) => selectedVisibleNotificationSet.has(card.id),
  );
  const selectionActive = selectedVisibleNotificationIds.length > 0;
  const markReadTargetIds = (
    selectionActive
      ? selectedNotificationCards
      : mutableVisibleNotificationCards
  )
    .filter((card) => card.isUnread)
    .map((card) => card.id);
  const markUnreadTargetIds = (
    selectionActive
      ? selectedNotificationCards
      : mutableVisibleNotificationCards
  )
    .filter((card) => !card.isUnread)
    .map((card) => card.id);
  const unreadVisibleNotificationCount = mutableVisibleNotificationCards.filter(
    (card) => card.isUnread,
  ).length;
  const sharedVisibleNotificationCount = visibleNotificationCards.filter(
    (card) => !card.readStateMutable,
  ).length;
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
  const personalCleanupCount =
    snapshot.cleanup.items.length + snapshot.cleanup.duplicatePairs.length;
  const appointmentReminderCount = snapshot.notifications.filter(
    (card) => card.groupKey !== "general_notice",
  ).length;
  const generalNoticeCount = snapshot.notifications.filter(
    (card) => card.groupKey === "general_notice",
  ).length;
  const unreadGeneralNoticeCount = snapshot.notifications.filter(
    (card) =>
      card.groupKey === "general_notice" &&
      card.readStateMutable &&
      card.isUnread,
  ).length;
  const sharedGeneralNoticeCount = snapshot.notifications.filter(
    (card) => card.groupKey === "general_notice" && !card.readStateMutable,
  ).length;
  const urgentAppointmentReminderCount = snapshot.notifications.filter(
    (card) =>
      card.groupKey !== "general_notice" && card.pressureTone === "danger",
  ).length;
  const filteredLeadershipItems = leadershipQueue.items.filter((item) =>
    leadershipItemMatchesFilter(item, activeLeadershipFilter),
  );
  const showPersonalCleanupSection =
    activeActivityView === "all" || activeActivityView === "personal_cleanup";
  const showTeamCleanupSection =
    leadershipQueue.visible &&
    (activeActivityView === "all" || activeActivityView === "team_cleanup");
  const showNotificationControls =
    activeActivityView === "all" ||
    activeActivityView === "appointment_reminders" ||
    activeActivityView === "general_notices";
  const showTeamCleanupControls =
    leadershipQueue.visible &&
    (activeActivityView === "all" || activeActivityView === "team_cleanup");
  const showAppointmentReminderSection =
    activeActivityView === "all" ||
    activeActivityView === "appointment_reminders";
  const showGeneralNoticeSection =
    activeActivityView === "all" || activeActivityView === "general_notices";
  const teamCleanupCount = leadershipQueue.visible
    ? leadershipQueue.items.length
    : 0;
  const totalTeamCleanupSignals = leadershipQueue.visible
    ? leadershipQueue.overdueTaskCount +
      leadershipQueue.staleClientCount +
      leadershipQueue.engagementRiskCount
    : 0;
  const notificationFilterFieldLabel =
    activeActivityView === "appointment_reminders"
      ? "Reminder type"
      : activeActivityView === "general_notices"
        ? "Notice type"
        : "Notice filter";
  const visibleActivityViewOptions = activityViewOptions.filter(
    (option) => option.value !== "team_cleanup" || leadershipQueue.visible,
  );
  const visibleNotificationFilterOptions = notificationFilterOptions.filter(
    (option) => {
      if (activeActivityView === "general_notices") {
        return option.value === "general_notice";
      }

      if (activeActivityView === "appointment_reminders") {
        return option.value !== "general_notice";
      }

      return true;
    },
  );
  const activeCleanupFilterLabel =
    cleanupFilterOptions.find((option) => option.value === activeCleanupFilter)
      ?.label ?? "current cleanup filter";
  const activeNoticeStreamFilterLabel =
    noticeStreamFilterOptions.find(
      (option) => option.value === activeNoticeStreamFilter,
    )?.label ?? "current notice lane";
  const activeLeadershipFilterLabel =
    leadershipCleanupFilterOptions.find(
      (option) => option.value === activeLeadershipFilter,
    )?.label ?? "current leadership filter";
  const currentPassSummaryLabel =
    activeActivityView === "all"
      ? "Scanning personal cleanup, team cleanup, appointment reminders, and general notices together."
      : activeActivityView === "personal_cleanup"
        ? "Focused on self-owned cleanup pressure only."
        : activeActivityView === "team_cleanup"
          ? `${leadershipQueue.scopeLabel || "Leadership scope"} only.`
          : activeActivityView === "appointment_reminders"
            ? "Focused on inbox-backed appointment writeback only."
            : "Focused on non-calendar notice lanes only.";
  const currentFocusCount =
    activeActivityView === "all"
      ? filteredCleanupItems.length +
        visibleDuplicatePairs.length +
        (leadershipQueue.visible ? filteredLeadershipItems.length : 0) +
        visibleNotificationCards.length
      : activeActivityView === "personal_cleanup"
        ? filteredCleanupItems.length + visibleDuplicatePairs.length
        : activeActivityView === "team_cleanup"
          ? filteredLeadershipItems.length
          : activeActivityView === "appointment_reminders"
            ? appointmentReminderCards.length
            : generalNoticeCards.length;
  const personalCleanupTone: ActivityLaneTone =
    activeActivityView === "personal_cleanup"
      ? "accent"
      : snapshot.summary.urgentCleanupCount > 0
        ? "warning"
        : "neutral";
  const teamCleanupTone: ActivityLaneTone =
    activeActivityView === "team_cleanup"
      ? "accent"
      : totalTeamCleanupSignals > 0
        ? "warning"
        : "neutral";
  const appointmentReminderTone: ActivityLaneTone =
    activeActivityView === "appointment_reminders"
      ? "accent"
      : urgentAppointmentReminderCount > 0
        ? "warning"
        : "neutral";
  const generalNoticeTone: ActivityLaneTone =
    activeActivityView === "general_notices"
      ? "accent"
      : unreadGeneralNoticeCount > 0
        ? "warning"
        : "neutral";
  const focusAreaCards: Array<{
    key: Exclude<AgentActivityView, "all">;
    label: string;
    description: string;
    count: number;
    tone: ActivityLaneTone;
    ownerLabel: string;
    pressureLabel: string;
    sliceLabel: string;
    href: string;
  }> = [
    {
      key: "personal_cleanup" as const,
      label: "Personal cleanup",
      description:
        "Self-owned follow-up, send rescue, stale dossier cleanup, appointment writeback, and duplicate review stay together here.",
      count: personalCleanupCount,
      tone: personalCleanupTone,
      ownerLabel: "Ownership · Assigned to you",
      pressureLabel:
        snapshot.summary.urgentCleanupCount > 0
          ? `${snapshot.summary.urgentCleanupCount} urgent queue item(s)`
          : "No urgent personal cleanup right now",
      sliceLabel:
        activeCleanupFilter === "all"
          ? "Focus filter · All personal cleanup"
          : `Focus filter · ${activeCleanupFilterLabel}`,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "personal_cleanup",
        cleanupFilter: activeCleanupFilter,
        filter: activeFilter,
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: getActivityViewAnchor("personal_cleanup"),
      }),
    },
    ...(leadershipQueue.visible
      ? [
          {
            key: "team_cleanup" as const,
            label: "Team cleanup",
            description:
              "Visible-scope overdue tasks, stale dossiers, and quiet send trails stay readable here without hiding who owns the underlying record.",
            count: teamCleanupCount,
            tone: teamCleanupTone,
            ownerLabel: `Scope · ${leadershipQueue.scopeLabel}`,
            pressureLabel:
              totalTeamCleanupSignals > 0
                ? `${totalTeamCleanupSignals} raw pressure signal(s) across the visible scope`
                : "No visible-scope team cleanup pressure right now",
            sliceLabel:
              activeLeadershipFilter === "all"
                ? "Focus filter · All team pressure"
                : `Focus filter · ${activeLeadershipFilterLabel}`,
            href: buildAgentNotificationsHref({
              pathname,
              activityView: "team_cleanup",
              cleanupFilter: activeCleanupFilter,
              filter: activeFilter,
              noticeStreamFilter: activeNoticeStreamFilter,
              readState: activeReadState,
              leadershipFilter: activeLeadershipFilter,
              anchor: getActivityViewAnchor("team_cleanup"),
            }),
          },
        ]
      : []),
    {
      key: "appointment_reminders" as const,
      label: "Appointment reminders",
      description:
        "Inbox-backed confirmation, reschedule, external-touch, and countdown pressure stays separate from broader notices.",
      count: appointmentReminderCount,
      tone: appointmentReminderTone,
      ownerLabel: "Ownership · Personal inbox + calendar writeback",
      pressureLabel:
        urgentAppointmentReminderCount > 0
          ? `${urgentAppointmentReminderCount} urgent reminder(s)`
          : "No urgent appointment reminder pressure right now",
      sliceLabel:
        activeFilter === "all"
          ? "Focus filter · All reminder types"
          : `Focus filter · ${notificationFilterFieldLabel} = ${visibleNotificationFilterOptions.find((option) => option.value === activeFilter)?.label ?? activeFilter}`,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "appointment_reminders",
        cleanupFilter: activeCleanupFilter,
        filter: activeFilter,
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: getActivityViewAnchor("appointment_reminders"),
      }),
    },
    {
      key: "general_notices" as const,
      label: "General notices",
      description:
        "Non-calendar notices stay in their own lane so Front Office follow-through, Back Office handoff, shared office visibility, and awareness-only items do not blur together.",
      count: generalNoticeCount,
      tone: generalNoticeTone,
      ownerLabel: "Ownership · Personal + shared office visibility",
      pressureLabel:
        unreadGeneralNoticeCount > 0
          ? `${unreadGeneralNoticeCount} unread personal notice(s) in this lane`
          : sharedGeneralNoticeCount > 0
            ? `${sharedGeneralNoticeCount} shared office notice(s) stay open-only`
            : "No unread general notices right now",
      sliceLabel:
        activeNoticeStreamFilter === "all"
          ? "Lane filter · All notice lanes"
          : `Lane filter · ${activeNoticeStreamFilterLabel}`,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "general_notices",
        cleanupFilter: activeCleanupFilter,
        filter: "general_notice",
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: getActivityViewAnchor("general_notices"),
      }),
    },
  ];
  const controlsBusy = pendingAction !== null || isFilterNavigationPending;

  function buildNotificationOpenHref(
    card: FrontOfficeActivityNotificationRecord,
  ) {
    const anchor =
      card.groupKey === "general_notice"
        ? "#notice-stream"
        : "#appointment-reminder-pressure";
    const returnTo = `${buildAgentNotificationsHref({
      pathname,
      activityView: activeActivityView,
      cleanupFilter: activeCleanupFilter,
      filter: activeFilter,
      noticeStreamFilter: activeNoticeStreamFilter,
      readState: activeReadState,
      leadershipFilter: activeLeadershipFilter,
    })}${anchor}`;

    return `${card.href}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function toggleNotificationSelection(notificationId: string) {
    setSelectedNotificationIds((current) =>
      current.includes(notificationId)
        ? current.filter((id) => id !== notificationId)
        : [...current, notificationId],
    );
  }

  function selectAllVisibleNotifications() {
    setSelectedNotificationIds(mutableVisibleNotificationIds);
  }

  function selectUnreadVisibleNotifications() {
    setSelectedNotificationIds(
      mutableVisibleNotificationCards
        .filter((card) => card.isUnread)
        .map((card) => card.id),
    );
  }

  function clearSelectedNotifications() {
    setSelectedNotificationIds([]);
  }

  async function handleNotificationAction(
    notificationId: string,
    action: "mark_read" | "mark_unread",
  ) {
    setPendingAction(`${action}:${notificationId}`);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch(
        `/api/agent/notifications/${notificationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Notification update failed.");
      }

      setSelectedNotificationIds((current) =>
        current.filter((id) => id !== notificationId),
      );
      setStatusMessage(
        action === "mark_read"
          ? "Marked 1 notice as read."
          : "Marked 1 notice as unread.",
      );
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

  async function handleBulkReadStateAction(
    action: "mark_all_read" | "mark_all_unread",
    notificationIds: string[],
  ) {
    if (!notificationIds.length) {
      return;
    }

    setPendingAction(action);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/agent/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          notificationIds,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        updatedCount?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ??
            (action === "mark_all_read"
              ? "Mark-all-read action failed."
              : "Mark-all-unread action failed."),
        );
      }

      const updatedCount =
        typeof body?.updatedCount === "number"
          ? body.updatedCount
          : notificationIds.length;
      setSelectedNotificationIds([]);
      setStatusMessage(
        action === "mark_all_read"
          ? `Marked ${updatedCount} notice(s) as read.`
          : `Marked ${updatedCount} notice(s) as unread.`,
      );
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : action === "mark_all_read"
            ? "Mark-all-read action failed."
            : "Mark-all-unread action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function renderNotificationCard(
    card: FrontOfficeActivityNotificationRecord,
    openLabel: string,
  ) {
    const isSelected = selectedVisibleNotificationSet.has(card.id);

    return (
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
              <Badge tone={toneToBadgeTone(card.pressureTone)}>
                {card.pressureLabel}
              </Badge>
              <Badge tone={toneToBadgeTone(card.tone)}>{card.groupLabel}</Badge>
              {card.groupKey === "general_notice" ? (
                <Badge tone={streamBadgeTone(card.streamKey)}>
                  {card.streamLabel}
                </Badge>
              ) : null}
            </div>
          </div>

          <p>{card.body}</p>
          <div className="list-row-meta front-office-record-meta">
            <span>{card.audienceLabel}</span>
            <span>Owner · {card.ownerLabel}</span>
            <span>Scope · {card.scopeLabel}</span>
            <span>Created · {card.createdAtLabel}</span>
            <span>Read state · {card.readStateLabel}</span>
          </div>
          <p className="front-office-record-supporting">{card.whyNowLabel}</p>
        </div>

        <div className="office-notification-row-actions">
          {card.readStateMutable ? (
            <Button
              disabled={controlsBusy}
              onClick={() => toggleNotificationSelection(card.id)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          ) : null}
          <FrontOfficeLink
            className="office-button-secondary office-button-sm"
            href={buildNotificationOpenHref(card)}
          >
            {openLabel}
          </FrontOfficeLink>
          {card.readStateMutable ? (
            <Button
              disabled={
                isFilterNavigationPending ||
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
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <>
      <SectionCard
        className="office-list-card office-notification-toolbar"
        subtitle="Keep the office-wide cleanup surface stable on one route: self-owned cleanup, visible-scope team cleanup, inbox-backed appointment reminders, and broader general notices. The active slice stays encoded in the URL so refreshes and reopen flows come back to the same pass."
        title="Activity lanes & controls"
      >
        <ListPageStatsGrid>
          <StatCard
            hint="Self-owned cleanup items, plus duplicate review, that still need direct agent follow-through."
            label="Personal cleanup"
            tone={
              activeActivityView === "all" ||
              activeActivityView === "personal_cleanup"
                ? "accent"
                : "default"
            }
            value={personalCleanupCount}
          />
          {leadershipQueue.visible ? (
            <StatCard
              hint="Visible-scope overdue tasks, stale dossiers, and send-trail risk for leads or office admins."
              label="Team cleanup"
              tone={
                activeActivityView === "all" ||
                activeActivityView === "team_cleanup"
                  ? "accent"
                  : "default"
              }
              value={teamCleanupCount}
            />
          ) : null}
          <StatCard
            hint="Calendar-linked reminder notices for confirmation, reschedule, external follow-up, and near-term appointments."
            label="Appointment reminders"
            tone={
              activeActivityView === "all" ||
              activeActivityView === "appointment_reminders"
                ? "accent"
                : "default"
            }
            value={appointmentReminderCount}
          />
          <StatCard
            hint="The remaining notice lane after appointment reminders are split out."
            label="General notices"
            tone={
              activeActivityView === "all" ||
              activeActivityView === "general_notices"
                ? "accent"
                : "default"
            }
            value={generalNoticeCount}
          />
        </ListPageStatsGrid>

        <div className="list-column front-office-record-list">
          {focusAreaCards.map((area) => (
            <article
              className={`list-row front-office-record tone-${area.tone}`}
              key={area.key}
            >
              <div className="list-row-top front-office-record-head">
                <div>
                  <strong>{area.label}</strong>
                  <p>{area.description}</p>
                </div>
                <StatusBadge tone={area.tone}>{area.count} item(s)</StatusBadge>
              </div>
              <div className="list-row-meta front-office-record-meta">
                <span>{area.ownerLabel}</span>
                <span>{area.pressureLabel}</span>
                <span>{area.sliceLabel}</span>
              </div>
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={area.href}
              >
                {activeActivityView === area.key
                  ? "Reopen this slice"
                  : "Open this slice"}
              </FrontOfficeLink>
            </article>
          ))}
        </div>

        <FilterBar className="office-notification-filter-grid office-list-filters">
          <FilterField label="Focus area">
            <SelectInput
              onChange={(event) =>
                updateFilters(
                  event.currentTarget.value as AgentActivityView,
                  activeCleanupFilter,
                  activeFilter,
                  activeNoticeStreamFilter,
                  activeReadState,
                  activeLeadershipFilter,
                )
              }
              value={activeActivityView}
            >
              {visibleActivityViewOptions.map((option) => {
                const count =
                  option.value === "all"
                    ? personalCleanupCount +
                      teamCleanupCount +
                      snapshot.notifications.length
                    : option.value === "personal_cleanup"
                      ? personalCleanupCount
                      : option.value === "team_cleanup"
                        ? teamCleanupCount
                        : option.value === "appointment_reminders"
                          ? appointmentReminderCount
                          : generalNoticeCount;

                return (
                  <option key={option.value} value={option.value}>
                    {option.label} ({count})
                  </option>
                );
              })}
            </SelectInput>
          </FilterField>

          {showPersonalCleanupSection ? (
            <FilterField label="Cleanup focus">
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    event.currentTarget.value as AgentCleanupFilter,
                    activeFilter,
                    activeNoticeStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeCleanupFilter}
              >
                {cleanupFilterOptions.map((option) => {
                  const count =
                    option.value === "all"
                      ? personalCleanupCount
                      : option.value === "duplicate_review"
                        ? snapshot.cleanup.duplicatePairs.length
                        : snapshot.cleanup.items.filter(
                            (item) => item.kindKey === option.value,
                          ).length;

                  return (
                    <option key={option.value} value={option.value}>
                      {option.label} ({count})
                    </option>
                  );
                })}
              </SelectInput>
            </FilterField>
          ) : null}

          {showNotificationControls ? (
            <FilterField label={notificationFilterFieldLabel}>
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    event.currentTarget.value as AgentNotificationFilter,
                    activeNoticeStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeFilter}
              >
                {visibleNotificationFilterOptions.map((option) => {
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
          ) : null}

          {showGeneralNoticeSection ? (
            <FilterField label="Notice lane">
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    activeFilter,
                    event.currentTarget.value as AgentNotificationStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeNoticeStreamFilter}
              >
                {noticeStreamFilterOptions.map((option) => {
                  const count =
                    option.value === "all"
                      ? snapshot.notifications.filter(
                          (card) => card.groupKey === "general_notice",
                        ).length
                      : snapshot.notifications.filter(
                          (card) =>
                            card.groupKey === "general_notice" &&
                            card.streamKey === option.value,
                        ).length;

                  return (
                    <option key={option.value} value={option.value}>
                      {option.label} ({count})
                    </option>
                  );
                })}
              </SelectInput>
            </FilterField>
          ) : null}

          {showNotificationControls ? (
            <FilterField label="Read state">
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    activeFilter,
                    activeNoticeStreamFilter,
                    event.currentTarget.value as AgentNotificationReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeReadState}
              >
                <option value="all">All</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </SelectInput>
            </FilterField>
          ) : null}

          {showTeamCleanupControls ? (
            <FilterField label="Team cleanup">
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    activeFilter,
                    activeNoticeStreamFilter,
                    activeReadState,
                    event.currentTarget.value as AgentLeadershipCleanupFilter,
                  )
                }
                value={activeLeadershipFilter}
              >
                {leadershipCleanupFilterOptions.map((option) => {
                  const count =
                    option.value === "all"
                      ? totalTeamCleanupSignals
                      : option.value === "overdue_task"
                        ? leadershipQueue.overdueTaskCount
                        : option.value === "engagement_risk"
                          ? leadershipQueue.engagementRiskCount
                          : leadershipQueue.staleClientCount;

                  return (
                    <option key={option.value} value={option.value}>
                      {option.label} ({count})
                    </option>
                  );
                })}
              </SelectInput>
            </FilterField>
          ) : null}

          <div className="office-notification-filter-actions">
            {showNotificationControls ? (
              <Button
                disabled={controlsBusy || unreadVisibleNotificationCount === 0}
                onClick={selectUnreadVisibleNotifications}
                type="button"
                variant="secondary"
              >
                Select unread in slice
              </Button>
            ) : null}
            {showNotificationControls ? (
              <Button
                disabled={
                  controlsBusy || mutableVisibleNotificationIds.length === 0
                }
                onClick={selectAllVisibleNotifications}
                type="button"
                variant="secondary"
              >
                Select all personal in slice
              </Button>
            ) : null}
            {showNotificationControls ? (
              <Button
                disabled={controlsBusy || !selectionActive}
                onClick={clearSelectedNotifications}
                type="button"
                variant="secondary"
              >
                Clear selection
              </Button>
            ) : null}
            {showNotificationControls ? (
              <Button
                disabled={
                  isFilterNavigationPending ||
                  pendingAction === "mark_all_read" ||
                  markReadTargetIds.length === 0
                }
                onClick={() => {
                  void handleBulkReadStateAction(
                    "mark_all_read",
                    markReadTargetIds,
                  );
                }}
                type="button"
                variant="secondary"
              >
                {selectionActive
                  ? `Mark selected as read (${markReadTargetIds.length})`
                  : `Mark slice as read (${markReadTargetIds.length})`}
              </Button>
            ) : null}
            {showNotificationControls ? (
              <Button
                disabled={
                  isFilterNavigationPending ||
                  pendingAction === "mark_all_unread" ||
                  markUnreadTargetIds.length === 0
                }
                onClick={() => {
                  void handleBulkReadStateAction(
                    "mark_all_unread",
                    markUnreadTargetIds,
                  );
                }}
                type="button"
                variant="secondary"
              >
                {selectionActive
                  ? `Mark selected as unread (${markUnreadTargetIds.length})`
                  : `Mark slice as unread (${markUnreadTargetIds.length})`}
              </Button>
            ) : null}
            <Button
              disabled={controlsBusy}
              onClick={() =>
                updateFilters("all", "all", "all", "all", "all", "all")
              }
              type="button"
              variant="secondary"
            >
              Reset filter
            </Button>
          </div>
        </FilterBar>

        <div className="list-row-meta front-office-record-meta">
          <span>{currentFocusCount} item(s) in the current pass</span>
          <span>{currentPassSummaryLabel}</span>
          <span>
            URL keeps this focus area and filter slice stable on reopen
          </span>
          {showNotificationControls ? (
            <span>
              {mutableVisibleNotificationIds.length} personal notice(s) support
              read-state in this slice
            </span>
          ) : null}
          {showNotificationControls && unreadVisibleNotificationCount > 0 ? (
            <span>
              {unreadVisibleNotificationCount} unread personal notice(s)
            </span>
          ) : null}
          {showNotificationControls && sharedVisibleNotificationCount > 0 ? (
            <span>
              {sharedVisibleNotificationCount} shared office notice(s) stay
              open-only in this slice
            </span>
          ) : null}
          {selectionActive ? (
            <span>
              {selectedVisibleNotificationIds.length} notice(s) selected
            </span>
          ) : null}
        </div>
      </SectionCard>

      {error ? <p className="office-form-error">{error}</p> : null}
      {statusMessage ? (
        <p className="front-office-record-supporting">{statusMessage}</p>
      ) : null}

      {showPersonalCleanupSection ? (
        <SectionCard
          className="office-list-card"
          id="cleanup-center"
          subtitle="Personal cleanup stays self-owned. Surface the loudest issue per client first, then reopen the same center directly into follow-up, writeback, send rescue, stale-dossier cleanup, or duplicate review."
          title="Personal cleanup"
        >
          <ListPageStatsGrid>
            {snapshot.cleanup.metrics.map((metric) => (
              <StatCard
                hint={metric.helper}
                key={metric.key}
                label={metric.label}
                tone={
                  cleanupMetricMatchesFilter(metric.key, activeCleanupFilter) ||
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

          <div className="list-row-meta front-office-record-meta">
            <span>Owner-assigned Front Office cleanup only</span>
            {activeCleanupFilter !== "all" ? (
              <span>{activeCleanupFilterLabel} focus applied</span>
            ) : null}
          </div>

          <div className="list-column front-office-record-list">
            {filteredCleanupItems.length ? (
              filteredCleanupItems.map((item) => (
                <article
                  className={`list-row front-office-record tone-${item.tone}`}
                  key={item.id}
                >
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <StatusBadge tone={item.tone}>
                      {item.pressureLabel}
                    </StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    <span>Track · {item.kindLabel}</span>
                    <span>Owner · {item.ownerLabel}</span>
                    <span>Scope · {item.scopeLabel}</span>
                    <span>{item.sortLabel}</span>
                    {item.metaLabels.map((label) => (
                      <span key={`${item.id}-${label}`}>{label}</span>
                    ))}
                  </div>
                  <p className="front-office-record-supporting">
                    {item.whyNowLabel}
                  </p>
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
                description={
                  activeCleanupFilter === "duplicate_review"
                    ? "Use the duplicate-review block below for this pass. The client cleanup queue above is intentionally muted while duplicate review is in focus."
                    : activeCleanupFilter === "all"
                      ? "When follow-ups, tracked sends, appointments, external writeback deadlines, or duplicate review start applying pressure, the highest-priority cleanup items will stack here first."
                      : `No personal cleanup items match ${activeCleanupFilterLabel.toLowerCase()} right now.`
                }
                title="No cleanup pressure right now"
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {showTeamCleanupSection ? (
        <SectionCard
          className="office-list-card"
          id="team-cleanup-pressure"
          subtitle="Leadership cleanup stays visible-scope, not owner-blind. This section keeps overdue shared tasks, stale dossiers, and quiet send trails together so leads and office admins can decide where to intervene next."
          title="Team cleanup"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="open shared follow-up tasks already overdue inside your leadership scope"
              label="Overdue tasks"
              tone={leadershipQueue.overdueTaskCount > 0 ? "accent" : "default"}
              value={leadershipQueue.overdueTaskCount}
            />
            <StatCard
              hint="active visible-scope dossiers with 15+ days of inactivity"
              label="15+ day stale"
              tone={leadershipQueue.staleClientCount > 0 ? "accent" : "default"}
              value={leadershipQueue.staleClientCount}
            />
            <StatCard
              hint="tracked sends that were never opened or have gone quiet inside your leadership scope"
              label="Send-trail risk"
              tone={
                leadershipQueue.engagementRiskCount > 0 ? "accent" : "default"
              }
              value={leadershipQueue.engagementRiskCount}
            />
          </ListPageStatsGrid>

          <div className="list-row-meta front-office-record-meta">
            <span>{leadershipQueue.scopeLabel}</span>
            {activeLeadershipFilter !== "all" ? (
              <span>{activeLeadershipFilterLabel} focus applied</span>
            ) : null}
          </div>

          <div className="list-column front-office-record-list">
            {filteredLeadershipItems.length ? (
              filteredLeadershipItems.map((item) => (
                <article
                  className={`list-row front-office-record tone-${item.tone}`}
                  key={item.id}
                >
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <StatusBadge tone={item.tone}>
                      {item.pressureLabel}
                    </StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    <span>Track · {item.kindLabel}</span>
                    <span>Owner · {item.ownerLabel}</span>
                    <span>Scope · {item.scopeLabel}</span>
                    <span>Context · {item.contextLabel}</span>
                  </div>
                  <p className="front-office-record-supporting">
                    {item.whyNowLabel}
                  </p>
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
                description={
                  activeLeadershipFilter === "all"
                    ? "No overdue task, stale-client, or quiet send-trail pressure is visible inside your leadership scope right now."
                    : "No team cleanup items match the current leadership-pressure filter."
                }
                title="Leadership queue is clear"
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {showPersonalCleanupSection &&
      (activeCleanupFilter === "all" ||
        activeCleanupFilter === "duplicate_review") ? (
        visibleDuplicatePairs.length ? (
          <FrontOfficeClientDuplicatesCard
            duplicatePairs={visibleDuplicatePairs}
          />
        ) : activeCleanupFilter === "duplicate_review" ? (
          <SectionCard
            className="office-list-card"
            subtitle="Duplicate review stays separate from the live cleanup list so agents can reconcile dossiers before the next follow-up, send, or appointment."
            title="Duplicate review"
          >
            <EmptyState
              description="No visible-scope duplicate pairs need review right now."
              title="Duplicate review is clear"
            />
          </SectionCard>
        ) : null
      ) : null}

      {showAppointmentReminderSection ? (
        <SectionCard
          className="office-list-card"
          id="appointment-reminder-pressure"
          subtitle="Appointment reminders stay inbox-backed but separate from broader notices, so confirmation, reschedule, external follow-up, and near-term meeting pressure can be worked as one calendar-owned slice."
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
              appointmentReminderCards.map((card) =>
                renderNotificationCard(card, card.actionLabel),
              )
            ) : (
              <EmptyState
                description={
                  activeFilter === "all" || activeFilter === "general_notice"
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
      ) : null}

      {showGeneralNoticeSection ? (
        <SectionCard
          className="office-list-card"
          id="notice-stream"
          subtitle="General notices stay separate from calendar pressure and can be narrowed by whether the next step belongs in Front Office, Back Office, shared office visibility, or awareness only."
          title="General notices"
        >
          <div className="list-row-meta front-office-record-meta">
            <span>{generalNoticeCards.length} notice(s) in this lane</span>
            {activeNoticeStreamFilter !== "all" ? (
              <span>{activeNoticeStreamFilterLabel} focus applied</span>
            ) : null}
          </div>

          <div className="office-notification-list">
            {generalNoticeCards.length ? (
              generalNoticeCards.map((card) =>
                renderNotificationCard(
                  card,
                  card.actionLabel === card.typeLabel
                    ? "Review notice"
                    : card.actionLabel,
                ),
              )
            ) : (
              <EmptyState
                description={
                  activeNoticeStreamFilter !== "all"
                    ? `No general notices match ${activeNoticeStreamFilterLabel.toLowerCase()} right now.`
                    : activeFilter === "all" ||
                        activeFilter === "general_notice"
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
      ) : null}
    </>
  );
}
