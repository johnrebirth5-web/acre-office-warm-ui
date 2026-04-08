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
import {
  activityViewOptions,
  appointmentReminderGroupConfig,
  buildAgentNotificationsHref,
  cleanupFilterOptions,
  generalNoticeLaneConfig,
  getActivityViewAnchor,
  leadershipCleanupFilterOptions,
  noticeStreamFilterOptions,
  personalCleanupTrackConfig,
  readStateOptions,
  reminderFilterOptions,
  resolveNoticeFeedback,
  resolveOptionValue,
  resolveReminderFilterValue,
  sanitizeNotificationReturnTo,
  teamCleanupGroupConfig,
  type AgentActivityView,
  type AgentCleanupFilter,
  type AgentLeadershipCleanupFilter,
  type AgentNotificationFeedback,
  type AgentNotificationReadState,
  type AgentReminderFilter,
  type AgentNotificationStreamFilter,
} from "./agent-notifications-config";
import styles from "./agent-notifications.module.css";

type ActivityLaneTone = "neutral" | "accent" | "success" | "warning" | "danger";
type ActivityLaneCard = {
  key: AgentActivityView;
  label: string;
  description: string;
  count: number;
  tone: ActivityLaneTone;
  ownerLabel: string;
  pressureLabel: string;
  sliceLabel: string;
  href?: string;
};

type ActivityShortcut = {
  key: string;
  label: string;
  count: number;
  href: string;
};

type ActivityPrimaryAction = {
  key: string;
  label: string;
  description: string;
  href: string;
  tone: ActivityLaneTone;
  badgeLabel: string;
  meta: string[];
  ctaLabel: string;
};

type ActivityWorkbenchCard = {
  key: string;
  label: string;
  description: string;
  count: number;
  tone: ActivityLaneTone;
  href: string;
  actionLabel: string;
  nextStepLabel: string;
  meta: string[];
};

type AgentNotificationsClientProps = {
  snapshot: FrontOfficeActivitySnapshot;
  initialActivityView: AgentActivityView;
  initialCleanupFilter: AgentCleanupFilter;
  initialFilter: AgentReminderFilter;
  initialNoticeStreamFilter: AgentNotificationStreamFilter;
  initialReadState: AgentNotificationReadState;
  initialTeamCleanupFilter: AgentLeadershipCleanupFilter;
  leadershipQueue: FrontOfficeDashboardSnapshot["leadershipQueue"];
};

type LeadershipWorkbenchItem =
  FrontOfficeDashboardSnapshot["leadershipQueue"]["activityCenterItems"][number];

function cardMatchesReminderFilter(
  card: FrontOfficeActivityNotificationRecord,
  filter: AgentReminderFilter,
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
  item: LeadershipWorkbenchItem,
  filter: AgentLeadershipCleanupFilter,
) {
  return filter === "all" || item.kindKey === filter;
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
    | LeadershipWorkbenchItem["tone"],
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

function getCountDrivenTone(
  count: number,
  activeTone: Exclude<ActivityLaneTone, "neutral">,
): ActivityLaneTone {
  return count > 0 ? activeTone : "neutral";
}

function getLocalGeneralNoticePressureState(
  card: FrontOfficeActivityNotificationRecord,
  isUnread: boolean,
): Pick<
  FrontOfficeActivityNotificationRecord,
  "pressureKey" | "pressureLabel" | "pressureTone" | "whyNowLabel"
> {
  if (card.groupKey !== "general_notice" || !card.readStateMutable) {
    return {
      pressureKey: card.pressureKey,
      pressureLabel: card.pressureLabel,
      pressureTone: card.pressureTone,
      whyNowLabel: card.whyNowLabel,
    };
  }

  if (isUnread) {
    return {
      pressureKey:
        card.tone === "danger"
          ? ("action_now" as const)
          : card.tone === "warning"
            ? ("needs_review" as const)
            : ("new_notice" as const),
      pressureLabel:
        card.tone === "danger"
          ? "Action now"
          : card.tone === "warning"
            ? "Needs review"
            : "New notice",
      pressureTone: card.tone === "neutral" ? ("accent" as const) : card.tone,
      whyNowLabel:
        card.tone === "danger"
          ? "This personal notice is still unread and is carrying active pressure."
          : card.tone === "warning"
            ? "This personal notice is still unread and should be reviewed in the current pass."
            : "This personal notice has not been reviewed yet.",
    };
  }

  return {
    pressureKey: "reviewed" as const,
    pressureLabel: "Reviewed",
    pressureTone: "neutral" as const,
    whyNowLabel:
      "This notice was already reviewed, but it stays in the stream so the current filter slice remains stable.",
  };
}

function getNotificationOpenLabel(card: FrontOfficeActivityNotificationRecord) {
  if (!card.readStateMutable) {
    return card.actionLabel === card.typeLabel
      ? "Review notice"
      : card.actionLabel;
  }

  if (card.isUnread && card.actionLabel === card.typeLabel) {
    return "Open & mark read";
  }

  if (!card.isUnread && card.actionLabel === card.typeLabel) {
    return "Open again";
  }

  return card.actionLabel;
}

function groupItemsByConfig<TItem, TKey extends string>(input: {
  items: TItem[];
  config: Array<{
    key: TKey;
    label: string;
    description: string;
  }>;
  getKey: (item: TItem) => TKey;
}) {
  return input.config
    .map((group) => ({
      ...group,
      items: input.items.filter((item) => input.getKey(item) === group.key),
    }))
    .filter((group) => group.items.length > 0);
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
  const [isRouteTransitionPending, startRouteTransition] = useTransition();
  const feedbackToken = resolveNoticeFeedback(
    searchParams.get("noticeFeedback"),
  );
  const openedNoticeId = searchParams.get("openedNoticeId")?.trim() ?? "";
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
  const activeReminderFilter = resolveReminderFilterValue(
    searchParams.get("appointmentFilter"),
    searchParams.get("noticeFilter"),
    initialFilter,
  );
  const activeNoticeStreamFilter = resolveOptionValue(
    searchParams.get("noticeStreamFilter"),
    noticeStreamFilterOptions,
    initialNoticeStreamFilter,
  );
  const activeReadState = resolveOptionValue(
    searchParams.get("readState"),
    readStateOptions,
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
  const [localNotifications, setLocalNotifications] = useState(
    snapshot.notifications,
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [recentlyOpenedNoticeId, setRecentlyOpenedNoticeId] = useState("");

  const activeRouteSliceKey = [
    activeActivityView,
    activeCleanupFilter,
    activeReminderFilter,
    activeNoticeStreamFilter,
    activeReadState,
    activeLeadershipFilter,
  ].join("|");
  const canonicalRouteHref = buildAgentNotificationsHref({
    pathname,
    activityView: activeActivityView,
    cleanupFilter: activeCleanupFilter,
    filter: activeReminderFilter,
    noticeStreamFilter: activeNoticeStreamFilter,
    readState: activeReadState,
    leadershipFilter: activeLeadershipFilter,
  });
  const canonicalQuery = canonicalRouteHref.split("?")[1] ?? "";

  useEffect(() => {
    setSelectedNotificationIds([]);
    setError("");
    setStatusMessage("");
    setRecentlyOpenedNoticeId("");
  }, [activeRouteSliceKey]);

  useEffect(() => {
    setLocalNotifications(snapshot.notifications);
  }, [snapshot.notifications]);

  useEffect(() => {
    if (!feedbackToken) {
      return;
    }

    setError("");
    setRecentlyOpenedNoticeId(openedNoticeId);
    setStatusMessage(
      feedbackToken === "opened_marked_read"
        ? activeReadState === "unread"
          ? "Opened a notice from the activity center. It was marked read, dropped out of the unread-only slice, and you can reopen this same pass from the current slice link."
          : "Opened a notice from the activity center and marked it read automatically. The current slice link still brings you back to this same filtered pass."
        : feedbackToken === "reopened_notice"
          ? "Reopened a previously reviewed notice from the activity center and kept the same filtered pass ready to reopen."
          : "Opened a shared notice from the activity center. Shared notices stay open-only, keep their read state unchanged, and return to the same filtered pass.",
    );
  }, [activeReadState, feedbackToken, openedNoticeId]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    if (currentQuery === canonicalQuery) {
      return;
    }

    startRouteTransition(() => {
      router.replace(canonicalRouteHref, { scroll: false });
    });
  }, [
    canonicalQuery,
    canonicalRouteHref,
    router,
    searchParams,
    startRouteTransition,
  ]);

  function updateFilters(
    nextActivityView: AgentActivityView,
    nextCleanupFilter: AgentCleanupFilter,
    nextFilter: AgentReminderFilter,
    nextNoticeStreamFilter: AgentNotificationStreamFilter,
    nextReadState: AgentNotificationReadState,
    nextLeadershipFilter: AgentLeadershipCleanupFilter,
    options?: {
      anchor?: string;
      scroll?: boolean;
    },
  ) {
    const resolvedActivityView =
      !leadershipQueue.visible && nextActivityView === "team_cleanup"
        ? "all"
        : nextActivityView;
    setSelectedNotificationIds([]);
    setError("");
    setStatusMessage("");
    startRouteTransition(() => {
      router.replace(
        buildAgentNotificationsHref({
          pathname,
          activityView: resolvedActivityView,
          cleanupFilter: nextCleanupFilter,
          filter: nextFilter,
          noticeStreamFilter: nextNoticeStreamFilter,
          readState: nextReadState,
          leadershipFilter: nextLeadershipFilter,
          anchor: options?.anchor,
        }),
        { scroll: options?.scroll ?? false },
      );
    });
  }

  const filteredCleanupItems = snapshot.cleanup.items.filter((item) =>
    cleanupItemMatchesFilter(item, activeCleanupFilter),
  );
  const leadershipWorkbenchItems =
    leadershipQueue.activityCenterItems.length > 0
      ? leadershipQueue.activityCenterItems
      : leadershipQueue.items;
  const visibleDuplicatePairs =
    activeCleanupFilter === "all" || activeCleanupFilter === "duplicate_review"
      ? snapshot.cleanup.duplicatePairs
      : [];
  const appointmentReminderCards = localNotifications.filter(
    (card) =>
      card.groupKey !== "general_notice" &&
      cardMatchesReminderFilter(card, activeReminderFilter) &&
      cardMatchesReadState(card, activeReadState),
  );
  const generalNoticeCards = localNotifications.filter(
    (card) =>
      card.groupKey === "general_notice" &&
      cardMatchesStreamFilter(card, activeNoticeStreamFilter) &&
      cardMatchesReadState(card, activeReadState),
  );
  const visibleNotificationCards =
    activeActivityView === "appointment_reminders"
      ? appointmentReminderCards
      : activeActivityView === "general_notices"
        ? generalNoticeCards
        : [...appointmentReminderCards, ...generalNoticeCards];
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
  const readVisibleNotificationCount =
    mutableVisibleNotificationCards.length - unreadVisibleNotificationCount;
  const sharedVisibleNotificationCount = visibleNotificationCards.filter(
    (card) => !card.readStateMutable,
  ).length;
  const confirmationDueCount = localNotifications.filter(
    (card) => card.groupKey === "confirmation_due",
  ).length;
  const rescheduleDueCount = localNotifications.filter(
    (card) => card.groupKey === "reschedule_due",
  ).length;
  const externalTouchDueCount = localNotifications.filter(
    (card) => card.groupKey === "external_touch_due",
  ).length;
  const appointmentSoonNoticeCount = localNotifications.filter(
    (card) => card.groupKey === "appointment_soon",
  ).length;
  const personalCleanupCount =
    snapshot.cleanup.items.length + snapshot.cleanup.duplicatePairs.length;
  const appointmentReminderCount = localNotifications.filter(
    (card) => card.groupKey !== "general_notice",
  ).length;
  const generalNoticeCount = localNotifications.filter(
    (card) => card.groupKey === "general_notice",
  ).length;
  const unreadGeneralNoticeCount = localNotifications.filter(
    (card) =>
      card.groupKey === "general_notice" &&
      card.readStateMutable &&
      card.isUnread,
  ).length;
  const sharedGeneralNoticeCount = localNotifications.filter(
    (card) => card.groupKey === "general_notice" && !card.readStateMutable,
  ).length;
  const urgentAppointmentReminderCount = localNotifications.filter(
    (card) =>
      card.groupKey !== "general_notice" && card.pressureTone === "danger",
  ).length;
  const filteredLeadershipItems = leadershipWorkbenchItems.filter((item) =>
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
  const showNotificationTypeControl =
    activeActivityView === "all" ||
    activeActivityView === "appointment_reminders";
  const showTeamCleanupControls =
    leadershipQueue.visible &&
    (activeActivityView === "all" || activeActivityView === "team_cleanup");
  const showAppointmentReminderSection =
    activeActivityView === "all" ||
    activeActivityView === "appointment_reminders";
  const showGeneralNoticeSection =
    activeActivityView === "all" || activeActivityView === "general_notices";
  const teamCleanupCount = leadershipQueue.visible
    ? leadershipWorkbenchItems.length
    : 0;
  const totalTeamCleanupSignals = leadershipQueue.visible
    ? leadershipQueue.counts.totalSignalCount
    : 0;
  const notificationFilterFieldLabel = "Reminder type";
  const visibleReminderFilterOptions = reminderFilterOptions;
  const activeCleanupFilterLabel =
    cleanupFilterOptions.find((option) => option.value === activeCleanupFilter)
      ?.label ?? "current cleanup filter";
  const activeReminderFilterLabel =
    reminderFilterOptions.find(
      (option) => option.value === activeReminderFilter,
    )?.label ?? "current reminder filter";
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
      ? "Working a workbench pass across all four lanes. Overview stays intentionally preview-first so the page reads like an operator center, while each lane still remembers its own filters in the URL."
      : activeActivityView === "personal_cleanup"
        ? "Focused on self-owned cleanup pressure only."
        : activeActivityView === "team_cleanup"
          ? `${leadershipQueue.scopeLabel || "Leadership scope"} only.`
          : activeActivityView === "appointment_reminders"
            ? "Focused on inbox-backed appointment writeback only."
            : "Focused on broader notice follow-through without mixing in calendar pressure.";
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
  const focusAreaCards: ActivityLaneCard[] = [
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
        filter: activeReminderFilter,
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
              filter: activeReminderFilter,
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
        activeReminderFilter === "all"
          ? "Focus filter · All reminder types"
          : `Focus filter · ${notificationFilterFieldLabel} = ${activeReminderFilterLabel}`,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "appointment_reminders",
        cleanupFilter: activeCleanupFilter,
        filter: activeReminderFilter,
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
        filter: activeReminderFilter,
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: getActivityViewAnchor("general_notices"),
      }),
    },
  ];
  const activityLaneTabs: ActivityLaneCard[] = [
    {
      key: "all" as const,
      label: "Inbox overview",
      description:
        "Keep personal cleanup, team pressure, appointment reminders, and broader notices visible on one stable route.",
      count:
        personalCleanupCount +
        teamCleanupCount +
        appointmentReminderCount +
        generalNoticeCount,
      tone:
        activeActivityView === "all"
          ? "accent"
          : snapshot.summary.urgentCleanupCount > 0 ||
              urgentAppointmentReminderCount > 0 ||
              totalTeamCleanupSignals > 0 ||
              unreadGeneralNoticeCount > 0
            ? "warning"
            : "neutral",
      ownerLabel: "Scope · Personal + shared office activity",
      pressureLabel:
        snapshot.summary.urgentCleanupCount > 0 ||
        urgentAppointmentReminderCount > 0
          ? "High-pressure signals are active across the center"
          : "No urgent pressure is active across the center",
      sliceLabel: "Route view · Full activity center",
    },
    ...focusAreaCards,
  ];
  const activeLaneTab =
    activityLaneTabs.find((area) => area.key === activeActivityView) ??
    activityLaneTabs[0];
  const isOverviewMode = activeActivityView === "all";
  const overviewPreviewLimit = 4;
  const displayedCleanupItems = isOverviewMode
    ? filteredCleanupItems.slice(0, overviewPreviewLimit)
    : filteredCleanupItems;
  const displayedLeadershipItems = isOverviewMode
    ? filteredLeadershipItems.slice(0, overviewPreviewLimit)
    : filteredLeadershipItems;
  const displayedAppointmentReminderCards = isOverviewMode
    ? appointmentReminderCards.slice(0, overviewPreviewLimit)
    : appointmentReminderCards;
  const displayedGeneralNoticeCards = isOverviewMode
    ? generalNoticeCards.slice(0, overviewPreviewLimit)
    : generalNoticeCards;
  const hiddenCleanupItemCount =
    filteredCleanupItems.length - displayedCleanupItems.length;
  const hiddenLeadershipItemCount =
    filteredLeadershipItems.length - displayedLeadershipItems.length;
  const hiddenAppointmentReminderCount =
    appointmentReminderCards.length - displayedAppointmentReminderCards.length;
  const hiddenGeneralNoticeCount =
    generalNoticeCards.length - displayedGeneralNoticeCards.length;
  const appointmentReminderGroups = groupItemsByConfig({
    items: displayedAppointmentReminderCards,
    config: appointmentReminderGroupConfig,
    getKey: (card) => card.groupKey,
  });
  const generalNoticeGroups = groupItemsByConfig({
    items: displayedGeneralNoticeCards,
    config: generalNoticeLaneConfig,
    getKey: (card) => card.streamKey,
  });
  const teamCleanupGroups = groupItemsByConfig({
    items: displayedLeadershipItems,
    config: teamCleanupGroupConfig,
    getKey: (item) => item.kindKey,
  });
  const controlsBusy = pendingAction !== null || isRouteTransitionPending;
  const bulkSelectionSummary = selectionActive
    ? `${selectedVisibleNotificationIds.length} personal notice(s) selected for bulk actions`
    : `${mutableVisibleNotificationIds.length} personal notice(s) in the current slice can change read state`;
  const bulkSelectionDetail = selectionActive
    ? "Bulk actions apply only to the current selection until you clear it. Opening one of those personal notices will still mark it read automatically."
    : "When nothing is selected, bulk read and unread actions apply to the full visible personal slice. Opening any personal notice also marks it read automatically.";
  const currentRouteHref = buildAgentNotificationsHref({
    pathname,
    activityView: activeActivityView,
    cleanupFilter: activeCleanupFilter,
    filter: activeReminderFilter,
    noticeStreamFilter: activeNoticeStreamFilter,
    readState: activeReadState,
    leadershipFilter: activeLeadershipFilter,
  });
  const currentSliceHref = `${currentRouteHref}${
    activeActivityView === "all"
      ? ""
      : getActivityViewAnchor(activeActivityView)
  }`;

  function getNoticeOpenFeedback(
    card: FrontOfficeActivityNotificationRecord,
  ): AgentNotificationFeedback {
    if (!card.readStateMutable) {
      return "opened_shared_notice";
    }

    return card.isUnread ? "opened_marked_read" : "reopened_notice";
  }

  function buildNotificationOpenHref(
    card: FrontOfficeActivityNotificationRecord,
  ) {
    const anchor =
      card.groupKey === "general_notice"
        ? "#notice-stream"
        : "#appointment-reminder-pressure";
    const returnTo = `${currentRouteHref}${anchor}`;
    const sanitizedHref = sanitizeNotificationReturnTo(card.href);

    if (!sanitizedHref) {
      return card.href;
    }

    const parsed = new URL(sanitizedHref, "http://acre.local");
    parsed.searchParams.set("returnTo", returnTo);
    parsed.searchParams.set("feedback", getNoticeOpenFeedback(card));

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function applyLocalNotificationReadState(
    notificationIds: string[],
    nextUnread: boolean,
  ) {
    if (!notificationIds.length) {
      return;
    }

    const notificationIdSet = new Set(notificationIds);

    setLocalNotifications((current) =>
      current.map((card) => {
        if (!notificationIdSet.has(card.id) || !card.readStateMutable) {
          return card;
        }

        const nextPressure = getLocalGeneralNoticePressureState(
          card,
          nextUnread,
        );

        return {
          ...card,
          ...nextPressure,
          isUnread: nextUnread,
          readStateLabel: nextUnread ? "Unread" : "Read",
        };
      }),
    );
  }

  const duplicateReviewHref =
    "/agent/clients?clientView=duplicate_review#duplicate-review";
  const nextPersonalCleanupItem = filteredCleanupItems[0] ?? null;
  const nextTeamCleanupItem = filteredLeadershipItems[0] ?? null;
  const nextAppointmentReminderCard =
    appointmentReminderCards.find(
      (card) => card.readStateMutable && card.isUnread,
    ) ??
    appointmentReminderCards[0] ??
    null;
  const nextGeneralNoticeCard =
    generalNoticeCards.find((card) => card.readStateMutable && card.isUnread) ??
    generalNoticeCards[0] ??
    null;
  const followUpShortcutCount = snapshot.cleanup.items.filter(
    (item) => item.kindKey === "follow_up",
  ).length;
  const appointmentWritebackShortcutCount = snapshot.cleanup.items.filter(
    (item) => item.kindKey === "appointment_writeback",
  ).length;
  const duplicateReviewShortcutCount = snapshot.cleanup.duplicatePairs.length;
  const teamOverdueShortcutCount = leadershipQueue.visible
    ? leadershipQueue.overdueTaskCount
    : 0;
  const confirmationShortcutCount = localNotifications.filter(
    (card) =>
      card.groupKey === "confirmation_due" &&
      cardMatchesReadState(card, activeReadState),
  ).length;
  const backOfficeNoticeShortcutCount = localNotifications.filter(
    (card) =>
      card.groupKey === "general_notice" &&
      card.streamKey === "back_office" &&
      cardMatchesReadState(card, activeReadState),
  ).length;
  const quickFocusShortcuts: ActivityShortcut[] = [
    {
      key: "follow-up",
      label: "Follow-up due",
      count: followUpShortcutCount,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "personal_cleanup",
        cleanupFilter: "follow_up",
        filter: activeReminderFilter,
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: "#cleanup-center",
      }),
    },
    {
      key: "appointment-writeback",
      label: "Appointment writeback",
      count: appointmentWritebackShortcutCount,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "personal_cleanup",
        cleanupFilter: "appointment_writeback",
        filter: activeReminderFilter,
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: "#cleanup-center",
      }),
    },
    {
      key: "duplicate-review",
      label: "Duplicate review",
      count: duplicateReviewShortcutCount,
      href: duplicateReviewHref,
    },
    ...(leadershipQueue.visible
      ? [
          {
            key: "team-overdue",
            label: "Team overdue tasks",
            count: teamOverdueShortcutCount,
            href: buildAgentNotificationsHref({
              pathname,
              activityView: "team_cleanup",
              cleanupFilter: activeCleanupFilter,
              filter: activeReminderFilter,
              noticeStreamFilter: activeNoticeStreamFilter,
              readState: activeReadState,
              leadershipFilter: "overdue_task",
              anchor: "#team-cleanup-pressure",
            }),
          },
        ]
      : []),
    {
      key: "confirmation-due",
      label: "Confirmation due",
      count: confirmationShortcutCount,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "appointment_reminders",
        cleanupFilter: activeCleanupFilter,
        filter: "confirmation_due",
        noticeStreamFilter: activeNoticeStreamFilter,
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: "#appointment-reminder-pressure",
      }),
    },
    {
      key: "bo-handoff",
      label: "BO handoff notices",
      count: backOfficeNoticeShortcutCount,
      href: buildAgentNotificationsHref({
        pathname,
        activityView: "general_notices",
        cleanupFilter: activeCleanupFilter,
        filter: activeReminderFilter,
        noticeStreamFilter: "back_office",
        readState: activeReadState,
        leadershipFilter: activeLeadershipFilter,
        anchor: "#notice-stream",
      }),
    },
  ].filter((shortcut) => shortcut.count > 0);
  const personalCleanupWorkbenchCards: ActivityWorkbenchCard[] =
    personalCleanupTrackConfig.map((track) => {
      const matchingItems =
        track.key === "duplicate_review"
          ? []
          : snapshot.cleanup.items.filter((item) => item.kindKey === track.key);
      const count =
        track.key === "duplicate_review"
          ? snapshot.cleanup.duplicatePairs.length
          : matchingItems.length;
      const nextDuplicatePair = snapshot.cleanup.duplicatePairs[0] ?? null;
      const nextLabel =
        track.key === "duplicate_review"
          ? nextDuplicatePair
            ? `Next · ${nextDuplicatePair.recommendedClient.fullName} / ${nextDuplicatePair.duplicateClient.fullName}`
            : "Route stays ready for future duplicate review"
          : matchingItems[0]
            ? `Next · ${matchingItems[0].title}`
            : "Route stays ready for future cleanup";

      return {
        key: track.key,
        label: track.label,
        description: track.description,
        count,
        tone:
          activeActivityView === "personal_cleanup" &&
          activeCleanupFilter === track.key
            ? "accent"
            : getCountDrivenTone(
                count,
                track.key === "send_risk" || track.key === "follow_up"
                  ? "warning"
                  : "accent",
              ),
        href: buildAgentNotificationsHref({
          pathname,
          activityView: "personal_cleanup",
          cleanupFilter: track.key,
          filter: activeReminderFilter,
          noticeStreamFilter: activeNoticeStreamFilter,
          readState: activeReadState,
          leadershipFilter: activeLeadershipFilter,
          anchor: "#cleanup-center",
        }),
        actionLabel:
          activeActivityView === "personal_cleanup" &&
          activeCleanupFilter === track.key
            ? "Stay on this cleanup focus"
            : "Open this cleanup focus",
        nextStepLabel:
          matchingItems[0]?.nextStepLabel ??
          "Open the cleanup focus and resolve the next touch.",
        meta: [
          `${count} item(s) in scope`,
          nextLabel,
          activeCleanupFilter === track.key
            ? "Current cleanup focus"
            : "URL remembers this cleanup filter",
        ],
      };
    });
  const teamCleanupWorkbenchCards: ActivityWorkbenchCard[] =
    teamCleanupGroupConfig.map((group) => {
      const matchingItems = leadershipWorkbenchItems.filter(
        (item) => item.kindKey === group.key,
      );
      const count = leadershipQueue.counts.byKind[group.key];
      const nextItem = matchingItems[0] ?? null;

      return {
        key: group.key,
        label: group.label,
        description: group.description,
        count,
        tone:
          activeActivityView === "team_cleanup" &&
          activeLeadershipFilter === group.key
            ? "accent"
            : nextItem?.tone ?? getCountDrivenTone(count, "warning"),
        href: buildAgentNotificationsHref({
          pathname,
          activityView: "team_cleanup",
          cleanupFilter: activeCleanupFilter,
          filter: activeReminderFilter,
          noticeStreamFilter: activeNoticeStreamFilter,
          readState: activeReadState,
          leadershipFilter: group.key,
          anchor: "#team-cleanup-pressure",
        }),
        actionLabel:
          activeActivityView === "team_cleanup" &&
          activeLeadershipFilter === group.key
            ? "Stay on this team focus"
            : "Open this team focus",
        nextStepLabel:
          nextItem?.nextStepLabel ??
          "Open the team focus and decide where to intervene.",
        meta: [
          count > matchingItems.length && matchingItems.length > 0
            ? `${count} signal(s) in scope · showing ${matchingItems.length}`
            : `${count} signal(s) in scope`,
          nextItem
            ? `Next · ${nextItem.title} · ${nextItem.ownerLabel}`
            : "Route stays ready for future team cleanup",
          activeLeadershipFilter === group.key
            ? "Current team focus"
            : "URL remembers this team filter",
        ],
      };
    });
  const appointmentReminderWorkbenchCards: ActivityWorkbenchCard[] =
    appointmentReminderGroupConfig.map((group) => {
      const matchingCards = localNotifications.filter(
        (card) =>
          card.groupKey === group.key &&
          cardMatchesReadState(card, activeReadState),
      );
      const nextCard = matchingCards[0] ?? null;
      const hasUrgentPressure = matchingCards.some(
        (card) => card.pressureTone === "danger",
      );

      return {
        key: group.key,
        label: group.label,
        description: group.description,
        count: matchingCards.length,
        tone:
          activeActivityView === "appointment_reminders" &&
          activeReminderFilter === group.key
            ? "accent"
            : hasUrgentPressure
              ? "danger"
              : getCountDrivenTone(matchingCards.length, "warning"),
        href: buildAgentNotificationsHref({
          pathname,
          activityView: "appointment_reminders",
          cleanupFilter: activeCleanupFilter,
          filter: group.key,
          noticeStreamFilter: activeNoticeStreamFilter,
          readState: activeReadState,
          leadershipFilter: activeLeadershipFilter,
          anchor: "#appointment-reminder-pressure",
        }),
        actionLabel:
          activeActivityView === "appointment_reminders" &&
          activeReminderFilter === group.key
            ? "Stay on this reminder focus"
            : "Open this reminder focus",
        nextStepLabel:
          nextCard?.actionLabel ??
          "Open the reminder focus and resolve the next touch.",
        meta: [
          `${matchingCards.length} notice(s) in scope`,
          nextCard
            ? `Next · ${nextCard.title}`
            : "Route stays ready for future reminder pressure",
          activeReminderFilter === group.key
            ? "Current reminder focus"
            : "URL remembers this reminder filter",
        ],
      };
    });
  const generalNoticeWorkbenchCards: ActivityWorkbenchCard[] =
    generalNoticeLaneConfig.map((group) => {
      const matchingCards = localNotifications.filter(
        (card) =>
          card.groupKey === "general_notice" &&
          card.streamKey === group.key &&
          cardMatchesReadState(card, activeReadState),
      );
      const nextCard = matchingCards[0] ?? null;
      const unreadCount = matchingCards.filter(
        (card) => card.readStateMutable && card.isUnread,
      ).length;

      return {
        key: group.key,
        label: group.label,
        description: group.description,
        count: matchingCards.length,
        tone:
          activeActivityView === "general_notices" &&
          activeNoticeStreamFilter === group.key
            ? "accent"
            : unreadCount > 0
              ? "warning"
              : getCountDrivenTone(matchingCards.length, "accent"),
        href: buildAgentNotificationsHref({
          pathname,
          activityView: "general_notices",
          cleanupFilter: activeCleanupFilter,
          filter: activeReminderFilter,
          noticeStreamFilter: group.key,
          readState: activeReadState,
          leadershipFilter: activeLeadershipFilter,
          anchor: "#notice-stream",
        }),
        actionLabel:
          activeActivityView === "general_notices" &&
          activeNoticeStreamFilter === group.key
            ? "Stay on this notice lane"
            : "Open this notice lane",
        nextStepLabel:
          nextCard?.actionLabel ??
          "Open the notice lane and review the next notice.",
        meta: [
          `${matchingCards.length} notice(s) in scope`,
          nextCard
            ? `Next · ${nextCard.title}`
            : "Route stays ready for future notice follow-through",
          activeNoticeStreamFilter === group.key
            ? "Current notice-lane focus"
            : "URL remembers this lane filter",
        ],
      };
    });
  const primaryAction: ActivityPrimaryAction | null =
    activeActivityView === "personal_cleanup"
      ? nextPersonalCleanupItem
        ? {
            key: nextPersonalCleanupItem.id,
            label: nextPersonalCleanupItem.title,
            description: nextPersonalCleanupItem.description,
            href: nextPersonalCleanupItem.href,
            tone: nextPersonalCleanupItem.tone,
            badgeLabel: nextPersonalCleanupItem.kindLabel,
            meta: [
              `Owner · ${nextPersonalCleanupItem.ownerLabel}`,
              `Scope · ${nextPersonalCleanupItem.scopeLabel}`,
              nextPersonalCleanupItem.sortLabel,
            ],
            ctaLabel: nextPersonalCleanupItem.actionLabel,
          }
        : visibleDuplicatePairs.length
          ? {
              key: "duplicate-review",
              label: "Review duplicate queue",
              description:
                "Merge duplicate dossiers before the next send or appointment so tracked history, follow-up, and handoff context stay on one surviving record.",
              href: duplicateReviewHref,
              tone: "accent",
              badgeLabel: "Duplicate review",
              meta: [
                `${visibleDuplicatePairs.length} duplicate pair(s) in this slice`,
                "Foundation cleanup before next touch",
              ],
              ctaLabel: "Review duplicate queue",
            }
          : null
      : activeActivityView === "team_cleanup"
        ? nextTeamCleanupItem
          ? {
              key: nextTeamCleanupItem.id,
              label: nextTeamCleanupItem.title,
              description: nextTeamCleanupItem.description,
              href: nextTeamCleanupItem.href,
              tone: nextTeamCleanupItem.tone,
              badgeLabel: nextTeamCleanupItem.kindLabel,
              meta: [
                `Owner · ${nextTeamCleanupItem.ownerLabel}`,
                `Scope · ${nextTeamCleanupItem.scopeLabel}`,
                `Context · ${nextTeamCleanupItem.contextLabel}`,
              ],
              ctaLabel: nextTeamCleanupItem.actionLabel,
            }
          : null
        : activeActivityView === "appointment_reminders"
          ? nextAppointmentReminderCard
            ? {
                key: nextAppointmentReminderCard.id,
                label: nextAppointmentReminderCard.title,
                description: nextAppointmentReminderCard.body,
                href: buildNotificationOpenHref(nextAppointmentReminderCard),
                tone: nextAppointmentReminderCard.pressureTone,
                badgeLabel: nextAppointmentReminderCard.groupLabel,
                meta: [
                  `Owner · ${nextAppointmentReminderCard.ownerLabel}`,
                  `Scope · ${nextAppointmentReminderCard.scopeLabel}`,
                  `Read state · ${nextAppointmentReminderCard.readStateLabel}`,
                ],
                ctaLabel: getNotificationOpenLabel(nextAppointmentReminderCard),
              }
            : null
          : activeActivityView === "general_notices"
            ? nextGeneralNoticeCard
              ? {
                  key: nextGeneralNoticeCard.id,
                  label: nextGeneralNoticeCard.title,
                  description: nextGeneralNoticeCard.body,
                  href: buildNotificationOpenHref(nextGeneralNoticeCard),
                  tone: nextGeneralNoticeCard.pressureTone,
                  badgeLabel: nextGeneralNoticeCard.streamLabel,
                  meta: [
                    `Owner · ${nextGeneralNoticeCard.ownerLabel}`,
                    `Scope · ${nextGeneralNoticeCard.scopeLabel}`,
                    `Read state · ${nextGeneralNoticeCard.readStateLabel}`,
                  ],
                  ctaLabel: getNotificationOpenLabel(nextGeneralNoticeCard),
                }
              : null
            : nextAppointmentReminderCard
              ? {
                  key: nextAppointmentReminderCard.id,
                  label: nextAppointmentReminderCard.title,
                  description: nextAppointmentReminderCard.body,
                  href: buildNotificationOpenHref(nextAppointmentReminderCard),
                  tone: nextAppointmentReminderCard.pressureTone,
                  badgeLabel: nextAppointmentReminderCard.groupLabel,
                  meta: [
                    "Recommended next pass",
                    `Owner · ${nextAppointmentReminderCard.ownerLabel}`,
                    `Read state · ${nextAppointmentReminderCard.readStateLabel}`,
                  ],
                  ctaLabel: getNotificationOpenLabel(
                    nextAppointmentReminderCard,
                  ),
                }
              : nextPersonalCleanupItem
                ? {
                    key: nextPersonalCleanupItem.id,
                    label: nextPersonalCleanupItem.title,
                    description: nextPersonalCleanupItem.description,
                    href: nextPersonalCleanupItem.href,
                    tone: nextPersonalCleanupItem.tone,
                    badgeLabel: nextPersonalCleanupItem.kindLabel,
                    meta: [
                      "Recommended next pass",
                      `Owner · ${nextPersonalCleanupItem.ownerLabel}`,
                      nextPersonalCleanupItem.sortLabel,
                    ],
                    ctaLabel: nextPersonalCleanupItem.actionLabel,
                  }
                : nextTeamCleanupItem
                  ? {
                      key: nextTeamCleanupItem.id,
                      label: nextTeamCleanupItem.title,
                      description: nextTeamCleanupItem.description,
                      href: nextTeamCleanupItem.href,
                      tone: nextTeamCleanupItem.tone,
                      badgeLabel: nextTeamCleanupItem.kindLabel,
                      meta: [
                        "Leadership-visible pressure",
                        `Owner · ${nextTeamCleanupItem.ownerLabel}`,
                        `Context · ${nextTeamCleanupItem.contextLabel}`,
                      ],
                      ctaLabel: nextTeamCleanupItem.actionLabel,
                    }
                  : nextGeneralNoticeCard
                    ? {
                        key: nextGeneralNoticeCard.id,
                        label: nextGeneralNoticeCard.title,
                        description: nextGeneralNoticeCard.body,
                        href: buildNotificationOpenHref(nextGeneralNoticeCard),
                        tone: nextGeneralNoticeCard.pressureTone,
                        badgeLabel: nextGeneralNoticeCard.streamLabel,
                        meta: [
                          "Broader notice follow-through",
                          `Owner · ${nextGeneralNoticeCard.ownerLabel}`,
                          `Read state · ${nextGeneralNoticeCard.readStateLabel}`,
                        ],
                        ctaLabel: getNotificationOpenLabel(
                          nextGeneralNoticeCard,
                        ),
                      }
                    : visibleDuplicatePairs.length
                      ? {
                          key: "duplicate-review-all",
                          label: "Review duplicate queue",
                          description:
                            "Duplicate review is still open in this slice and should be resolved before the next follow-up or appointment touches the wrong dossier.",
                          href: duplicateReviewHref,
                          tone: "accent",
                          badgeLabel: "Duplicate review",
                          meta: [
                            `${visibleDuplicatePairs.length} duplicate pair(s) in this slice`,
                            "Foundation cleanup before next touch",
                          ],
                          ctaLabel: "Review duplicate queue",
                        }
                      : null;

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

  function selectReadVisibleNotifications() {
    setSelectedNotificationIds(
      mutableVisibleNotificationCards
        .filter((card) => !card.isUnread)
        .map((card) => card.id),
    );
  }

  function clearSelectedNotifications() {
    setSelectedNotificationIds([]);
  }

  function resetPersonalCleanupFocus() {
    updateFilters(
      activeActivityView,
      "all",
      activeReminderFilter,
      activeNoticeStreamFilter,
      activeReadState,
      activeLeadershipFilter,
    );
  }

  function resetTeamCleanupFocus() {
    updateFilters(
      activeActivityView,
      activeCleanupFilter,
      activeReminderFilter,
      activeNoticeStreamFilter,
      activeReadState,
      "all",
    );
  }

  function resetAppointmentReminderFocus() {
    updateFilters(
      activeActivityView,
      activeCleanupFilter,
      "all",
      activeNoticeStreamFilter,
      "all",
      activeLeadershipFilter,
    );
  }

  function resetGeneralNoticeFocus() {
    updateFilters(
      activeActivityView,
      activeCleanupFilter,
      activeReminderFilter,
      "all",
      "all",
      activeLeadershipFilter,
    );
  }

  async function handleCopyCurrentSliceLink() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${currentSliceHref}`,
      );
      setError("");
      setStatusMessage(
        "Copied the current activity slice link. Reopening it later will restore this same route view and filter state.",
      );
    } catch (copyError) {
      setStatusMessage("");
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Could not copy the current activity slice link.",
      );
    }
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

      applyLocalNotificationReadState(
        [notificationId],
        action === "mark_unread",
      );

      setSelectedNotificationIds((current) =>
        current.filter((id) => id !== notificationId),
      );
      setStatusMessage(
        action === "mark_read"
          ? "Marked 1 notice as read."
          : "Marked 1 notice as unread.",
      );
      startRouteTransition(() => {
        router.refresh();
      });
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
        readState?: "read" | "unread";
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
      applyLocalNotificationReadState(
        notificationIds,
        (body?.readState ??
          (action === "mark_all_read" ? "read" : "unread")) === "unread",
      );
      setSelectedNotificationIds([]);
      setStatusMessage(
        action === "mark_all_read"
          ? `Marked ${updatedCount} notice(s) as read.`
          : `Marked ${updatedCount} notice(s) as unread.`,
      );
      startRouteTransition(() => {
        router.refresh();
      });
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

  function renderNotificationCard(card: FrontOfficeActivityNotificationRecord) {
    const isSelected = selectedVisibleNotificationSet.has(card.id);
    const wasRecentlyOpened = recentlyOpenedNoticeId === card.id;

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
              <Badge
                tone={
                  !card.readStateMutable
                    ? "neutral"
                    : card.isUnread
                      ? "accent"
                      : "neutral"
                }
              >
                {!card.readStateMutable
                  ? "Shared open-only"
                  : card.isUnread
                    ? "Open marks read"
                    : "Already reviewed"}
              </Badge>
              {card.groupKey === "general_notice" ? (
                <Badge tone={streamBadgeTone(card.streamKey)}>
                  {card.streamLabel}
                </Badge>
              ) : null}
              {wasRecentlyOpened ? (
                <Badge tone="accent">Just opened</Badge>
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
            <span>Next step · {card.actionLabel}</span>
          </div>
          <p className="front-office-record-supporting">{card.whyNowLabel}</p>
        </div>

        <div className="office-notification-row-actions">
          {card.readStateMutable ? (
            <Button
              aria-pressed={isSelected}
              disabled={controlsBusy}
              onClick={() => toggleNotificationSelection(card.id)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isSelected ? "Selected for bulk" : "Add to bulk"}
            </Button>
          ) : null}
          <FrontOfficeLink
            className="office-button-secondary office-button-sm"
            href={buildNotificationOpenHref(card)}
          >
            {getNotificationOpenLabel(card)}
          </FrontOfficeLink>
          {card.readStateMutable ? (
            <Button
              disabled={
                isRouteTransitionPending ||
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

  function renderWorkbenchCards(cards: ActivityWorkbenchCard[]) {
    return (
      <div className="list-column front-office-record-list">
        {cards.map((card) => (
          <article
            className={`list-row front-office-record tone-${card.tone}`}
            key={card.key}
          >
            <div className="list-row-top front-office-record-head">
              <div>
                <strong>{card.label}</strong>
                <p>{card.description}</p>
              </div>
              <StatusBadge tone={card.tone}>{card.count}</StatusBadge>
            </div>
            <div className="list-row-meta front-office-record-meta">
              <span>Next step · {card.nextStepLabel}</span>
              {card.meta.map((metaLabel) => (
                <span key={`${card.key}-${metaLabel}`}>{metaLabel}</span>
              ))}
            </div>
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={card.href}
            >
              {card.actionLabel}
            </FrontOfficeLink>
          </article>
        ))}
      </div>
    );
  }

  return (
    <>
      <SectionCard
        className="office-list-card office-notification-toolbar"
        subtitle="Keep the office-wide cleanup workbench stable on one route: self-owned cleanup, visible-scope team cleanup, inbox-backed appointment reminders, and broader general notices. The active slice stays encoded in the URL so refreshes and reopen flows come back to the same pass."
        title="Workbench lanes & cleanup controls"
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

        <div
          className={styles.laneTabs}
          role="tablist"
          aria-label="Activity lanes"
        >
          {activityLaneTabs.map((area) => {
            const isActive = area.key === activeActivityView;
            const isStrong = area.tone === "warning" || area.tone === "danger";

            return (
              <button
                aria-selected={isActive}
                className={[
                  styles.laneTab,
                  isActive ? styles.laneTabActive : "",
                  isStrong ? styles.laneTabStrong : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={controlsBusy && !isActive}
                key={area.key}
                onClick={() =>
                  updateFilters(
                    area.key,
                    activeCleanupFilter,
                    activeReminderFilter,
                    activeNoticeStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                    area.key === "all"
                      ? undefined
                      : {
                          anchor: getActivityViewAnchor(area.key),
                          scroll: true,
                        },
                  )
                }
                role="tab"
                type="button"
              >
                <div className={styles.laneTabHeader}>
                  <div className={styles.laneTabLabel}>
                    <strong>{area.label}</strong>
                    <span>{area.ownerLabel}</span>
                  </div>
                  <StatusBadge tone={area.tone}>{area.count}</StatusBadge>
                </div>
                <p className={styles.laneTabDescription}>{area.description}</p>
                <div className={styles.laneTabMeta}>
                  <span>{area.pressureLabel}</span>
                  <span>{area.sliceLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.summaryPanel}>
          <div className={styles.summaryPanelHeader}>
            <div className={styles.summaryPanelCopy}>
              <span className={styles.summaryPanelEyebrow}>Current pass</span>
              <strong>{activeLaneTab.label}</strong>
              <p>{currentPassSummaryLabel}</p>
            </div>
            <StatusBadge tone={activeLaneTab.tone}>
              {currentFocusCount} item(s)
            </StatusBadge>
          </div>
          <div className={styles.summaryPanelPills}>
            <span className={styles.summaryPanelPill}>
              <strong>Route</strong>
              URL keeps this slice and its filters stable on reopen
            </span>
            <span className={styles.summaryPanelPill}>
              <strong>Scope</strong>
              {activeLaneTab.ownerLabel}
            </span>
            <span className={styles.summaryPanelPill}>
              <strong>Pressure</strong>
              {activeLaneTab.pressureLabel}
            </span>
            <span className={styles.summaryPanelPill}>
              <strong>Filter</strong>
              {activeLaneTab.sliceLabel}
            </span>
            {isOverviewMode ? (
              <span className={styles.summaryPanelPill}>
                <strong>Overview</strong>
                Preview-first lane slices keep this route readable before you
                open a full queue
              </span>
            ) : null}
            {showNotificationControls ? (
              <span className={styles.summaryPanelPill}>
                <strong>Personal notices</strong>
                {mutableVisibleNotificationIds.length} mutable
              </span>
            ) : null}
            {showNotificationControls && unreadVisibleNotificationCount > 0 ? (
              <span className={styles.summaryPanelPill}>
                <strong>Unread</strong>
                {unreadVisibleNotificationCount} in this slice
              </span>
            ) : null}
            {showNotificationControls && sharedVisibleNotificationCount > 0 ? (
              <span className={styles.summaryPanelPill}>
                <strong>Shared</strong>
                {sharedVisibleNotificationCount} open-only notice(s)
              </span>
            ) : null}
            {selectionActive ? (
              <span className={styles.summaryPanelPill}>
                <strong>Selection</strong>
                {selectedVisibleNotificationIds.length} notice(s) selected
              </span>
            ) : null}
          </div>
          <div className={styles.bulkPanelActions}>
            <FrontOfficeLink
              className="office-button-secondary office-button-sm"
              href={currentSliceHref}
            >
              Open current slice
            </FrontOfficeLink>
            <Button
              disabled={controlsBusy}
              onClick={() => {
                void handleCopyCurrentSliceLink();
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Copy slice link
            </Button>
          </div>
          {primaryAction ? (
            <div className="list-column front-office-record-list">
              <article
                className={`list-row front-office-record tone-${primaryAction.tone}`}
              >
                <div className="list-row-top front-office-record-head">
                  <div>
                    <strong>{primaryAction.label}</strong>
                    <p>{primaryAction.description}</p>
                  </div>
                  <StatusBadge tone={primaryAction.tone}>
                    {primaryAction.badgeLabel}
                  </StatusBadge>
                </div>
                <div className="list-row-meta front-office-record-meta">
                  {primaryAction.meta.map((metaLabel) => (
                    <span key={`${primaryAction.key}-${metaLabel}`}>
                      {metaLabel}
                    </span>
                  ))}
                </div>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={primaryAction.href}
                >
                  {primaryAction.ctaLabel}
                </FrontOfficeLink>
              </article>
            </div>
          ) : null}
        </div>

        {quickFocusShortcuts.length ? (
          <div className={styles.bulkPanel}>
            <div className={styles.bulkPanelHeader}>
              <strong>High-frequency shortcuts</strong>
              <p>
                Jump straight into the cleanup or reminder pass you reopen most
                often without rebuilding the route state by hand.
              </p>
            </div>
            <div className={styles.bulkPanelActions}>
              {quickFocusShortcuts.map((shortcut) => (
                <FrontOfficeLink
                  className="office-button-secondary office-button-sm"
                  href={shortcut.href}
                  key={shortcut.key}
                >
                  {shortcut.label} ({shortcut.count})
                </FrontOfficeLink>
              ))}
            </div>
          </div>
        ) : null}

        <FilterBar className="office-notification-filter-grid office-list-filters">
          {showPersonalCleanupSection ? (
            <FilterField label="Cleanup focus">
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    event.currentTarget.value as AgentCleanupFilter,
                    activeReminderFilter,
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

          {showNotificationTypeControl ? (
            <FilterField label={notificationFilterFieldLabel}>
              <SelectInput
                onChange={(event) =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    event.currentTarget.value as AgentReminderFilter,
                    activeNoticeStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeReminderFilter}
              >
                {visibleReminderFilterOptions.map((option) => {
                  const count =
                    option.value === "all"
                      ? appointmentReminderCount
                      : localNotifications.filter(
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
                    activeReminderFilter,
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
                      ? localNotifications.filter(
                          (card) => card.groupKey === "general_notice",
                        ).length
                      : localNotifications.filter(
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
                    activeReminderFilter,
                    activeNoticeStreamFilter,
                    event.currentTarget.value as AgentNotificationReadState,
                    activeLeadershipFilter,
                  )
                }
                value={activeReadState}
              >
                {readStateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                    activeReminderFilter,
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
        </FilterBar>

        {activeCleanupFilter !== "all" ||
        activeReminderFilter !== "all" ||
        activeNoticeStreamFilter !== "all" ||
        activeReadState !== "all" ||
        activeLeadershipFilter !== "all" ? (
          <div className={styles.bulkPanelActions}>
            {activeCleanupFilter !== "all" ? (
              <Button
                disabled={controlsBusy}
                onClick={() => resetPersonalCleanupFocus()}
                type="button"
                variant="secondary"
              >
                Clear cleanup filter
              </Button>
            ) : null}
            {activeReminderFilter !== "all" ? (
              <Button
                disabled={controlsBusy}
                onClick={() =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    "all",
                    activeNoticeStreamFilter,
                    activeReadState,
                    activeLeadershipFilter,
                  )
                }
                type="button"
                variant="secondary"
              >
                Clear reminder filter
              </Button>
            ) : null}
            {activeNoticeStreamFilter !== "all" ? (
              <Button
                disabled={controlsBusy}
                onClick={() => resetGeneralNoticeFocus()}
                type="button"
                variant="secondary"
              >
                Clear notice lane
              </Button>
            ) : null}
            {activeReadState !== "all" ? (
              <Button
                disabled={controlsBusy}
                onClick={() =>
                  updateFilters(
                    activeActivityView,
                    activeCleanupFilter,
                    activeReminderFilter,
                    activeNoticeStreamFilter,
                    "all",
                    activeLeadershipFilter,
                  )
                }
                type="button"
                variant="secondary"
              >
                Show all read states
              </Button>
            ) : null}
            {activeLeadershipFilter !== "all" ? (
              <Button
                disabled={controlsBusy}
                onClick={() => resetTeamCleanupFocus()}
                type="button"
                variant="secondary"
              >
                Clear team filter
              </Button>
            ) : null}
          </div>
        ) : null}

        {showNotificationControls ? (
          <div className={styles.bulkPanel}>
            <div className={styles.bulkPanelHeader}>
              <strong>{bulkSelectionSummary}</strong>
              <p>{bulkSelectionDetail}</p>
            </div>
            <div className={styles.bulkPanelMeta}>
              <Badge tone="accent">
                Unread {unreadVisibleNotificationCount}
              </Badge>
              <Badge tone="neutral">Read {readVisibleNotificationCount}</Badge>
              {sharedVisibleNotificationCount > 0 ? (
                <Badge tone="warning">
                  Shared open-only {sharedVisibleNotificationCount}
                </Badge>
              ) : null}
            </div>
            <div className={styles.bulkPanelActions}>
              <div className={styles.bulkActionGroup}>
                <Button
                  disabled={
                    controlsBusy || unreadVisibleNotificationCount === 0
                  }
                  onClick={selectUnreadVisibleNotifications}
                  type="button"
                  variant="secondary"
                >
                  Select unread
                </Button>
                <Button
                  disabled={controlsBusy || readVisibleNotificationCount === 0}
                  onClick={selectReadVisibleNotifications}
                  type="button"
                  variant="secondary"
                >
                  Select read
                </Button>
                <Button
                  disabled={
                    controlsBusy || mutableVisibleNotificationIds.length === 0
                  }
                  onClick={selectAllVisibleNotifications}
                  type="button"
                  variant="secondary"
                >
                  Select all personal
                </Button>
                <Button
                  disabled={controlsBusy || !selectionActive}
                  onClick={clearSelectedNotifications}
                  type="button"
                  variant="secondary"
                >
                  Clear selection
                </Button>
              </div>
              <div className={styles.bulkActionGroup}>
                <Button
                  disabled={
                    isRouteTransitionPending ||
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
                    ? `Mark selected read (${markReadTargetIds.length})`
                    : `Mark slice read (${markReadTargetIds.length})`}
                </Button>
                <Button
                  disabled={
                    isRouteTransitionPending ||
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
                    ? `Mark selected unread (${markUnreadTargetIds.length})`
                    : `Mark slice unread (${markUnreadTargetIds.length})`}
                </Button>
                <Button
                  disabled={controlsBusy}
                  onClick={() =>
                    updateFilters("all", "all", "all", "all", "all", "all")
                  }
                  type="button"
                  variant="secondary"
                >
                  Reset all filters
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.bulkPanelActions}>
            <Button
              disabled={controlsBusy}
              onClick={() =>
                updateFilters("all", "all", "all", "all", "all", "all")
              }
              type="button"
              variant="secondary"
            >
              Reset all filters
            </Button>
          </div>
        )}
      </SectionCard>

      {error || statusMessage ? (
        <div className={styles.feedbackStack}>
          {error ? (
            <div
              className={`${styles.feedbackMessage} ${styles.feedbackError}`}
            >
              <StatusBadge tone="danger">Update failed</StatusBadge>
              <p>{error}</p>
            </div>
          ) : null}
          {statusMessage ? (
            <div
              className={`${styles.feedbackMessage} ${styles.feedbackSuccess}`}
            >
              <StatusBadge tone="accent">Updated</StatusBadge>
              <p>{statusMessage}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPersonalCleanupSection ? (
        <SectionCard
          actions={
            nextPersonalCleanupItem ||
            visibleDuplicatePairs.length ||
            hiddenCleanupItemCount > 0 ? (
              <div className={styles.bulkActionGroup}>
                {nextPersonalCleanupItem ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={nextPersonalCleanupItem.href}
                  >
                    Open next cleanup
                  </FrontOfficeLink>
                ) : null}
                {visibleDuplicatePairs.length ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={duplicateReviewHref}
                  >
                    Open duplicate review lane
                  </FrontOfficeLink>
                ) : null}
                {isOverviewMode && hiddenCleanupItemCount > 0 ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={focusAreaCards[0]?.href ?? duplicateReviewHref}
                  >
                    Open full personal queue
                  </FrontOfficeLink>
                ) : null}
              </div>
            ) : null
          }
          className="office-list-card"
          id="cleanup-center"
          subtitle={
            isOverviewMode
              ? "Personal cleanup stays self-owned. Overview shows the first few cleanup items so the center stays scan-first; open the lane to work the full queue."
              : "Personal cleanup stays self-owned. Surface the loudest issue per client first, then reopen the same center directly into follow-up, writeback, send rescue, stale-dossier cleanup, or duplicate review."
          }
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
            {isOverviewMode && hiddenCleanupItemCount > 0 ? (
              <span>
                Previewing {displayedCleanupItems.length} of{" "}
                {filteredCleanupItems.length} cleanup item(s)
              </span>
            ) : null}
          </div>

          {!isOverviewMode &&
          (personalCleanupCount > 0 || activeCleanupFilter !== "all")
            ? renderWorkbenchCards(personalCleanupWorkbenchCards)
            : null}

          <div className="list-column front-office-record-list">
            {displayedCleanupItems.length ? (
              displayedCleanupItems.map((item) => (
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
                action={
                  activeCleanupFilter !== "all" ? (
                    <Button
                      onClick={resetPersonalCleanupFocus}
                      type="button"
                      variant="secondary"
                    >
                      Show all personal cleanup
                    </Button>
                  ) : undefined
                }
                description={
                  activeCleanupFilter === "duplicate_review"
                    ? "Use the Clients duplicate-review lane for this pass. The client cleanup queue above is intentionally muted while duplicate review is in focus."
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
          actions={
            nextTeamCleanupItem || hiddenLeadershipItemCount > 0 ? (
              <div className={styles.bulkActionGroup}>
                {nextTeamCleanupItem ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={nextTeamCleanupItem.href}
                  >
                    Open next team item
                  </FrontOfficeLink>
                ) : null}
                {isOverviewMode && hiddenLeadershipItemCount > 0 ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={
                      focusAreaCards.find((card) => card.key === "team_cleanup")
                        ?.href ??
                      "/agent/notifications?activityView=team_cleanup"
                    }
                  >
                    Open full team queue
                  </FrontOfficeLink>
                ) : null}
              </div>
            ) : null
          }
          className="office-list-card"
          id="team-cleanup-pressure"
          subtitle={
            isOverviewMode
              ? "Leadership cleanup stays visible-scope, not owner-blind. Overview keeps the first few team pressure items close while the full queue remains one click away."
              : "Leadership cleanup stays visible-scope, not owner-blind. This section keeps overdue shared tasks, stale dossiers, and quiet send trails together so leads and office admins can decide where to intervene next."
          }
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
            {!isOverviewMode && teamCleanupCount < totalTeamCleanupSignals ? (
              <span>
                Surfacing {teamCleanupCount} highest-pressure record(s) across{" "}
                {totalTeamCleanupSignals} total signal(s)
              </span>
            ) : null}
            {isOverviewMode && hiddenLeadershipItemCount > 0 ? (
              <span>
                Previewing {displayedLeadershipItems.length} of{" "}
                {filteredLeadershipItems.length} visible team item(s)
              </span>
            ) : null}
          </div>

          {!isOverviewMode &&
          (teamCleanupCount > 0 || activeLeadershipFilter !== "all")
            ? renderWorkbenchCards(teamCleanupWorkbenchCards)
            : null}

          {displayedLeadershipItems.length ? (
            <div className="office-notification-groups">
              {teamCleanupGroups.map((group) => (
                <section className="office-notification-group" key={group.key}>
                  <header className="office-notification-group-head">
                    <div className={styles.groupCopy}>
                      <strong>{group.label}</strong>
                      <p>{group.description}</p>
                    </div>
                    <StatusBadge tone="accent">
                      {group.items.length}
                    </StatusBadge>
                  </header>

                  <div className="list-column front-office-record-list">
                    {group.items.map((item) => (
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
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                activeLeadershipFilter !== "all" ? (
                  <Button
                    onClick={resetTeamCleanupFocus}
                    type="button"
                    variant="secondary"
                  >
                    Show all team cleanup
                  </Button>
                ) : undefined
              }
              description={
                activeLeadershipFilter === "all"
                  ? "No overdue task, stale-client, or quiet send-trail pressure is visible inside your leadership scope right now."
                  : "No team cleanup items match the current leadership-pressure filter."
              }
              title="Leadership queue is clear"
            />
          )}
        </SectionCard>
      ) : null}

      {showPersonalCleanupSection &&
      (activeCleanupFilter === "duplicate_review" ||
        (!isOverviewMode && activeCleanupFilter === "all")) ? (
        visibleDuplicatePairs.length ? (
          <div id="duplicate-review">
            <FrontOfficeClientDuplicatesCard
              duplicatePairs={visibleDuplicatePairs}
            />
          </div>
        ) : activeCleanupFilter === "duplicate_review" ? (
          <SectionCard
            className="office-list-card"
            id="duplicate-review"
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
          actions={
            nextAppointmentReminderCard ||
            hiddenAppointmentReminderCount > 0 ? (
              <div className={styles.bulkActionGroup}>
                {nextAppointmentReminderCard ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildNotificationOpenHref(
                      nextAppointmentReminderCard,
                    )}
                  >
                    Open next reminder
                  </FrontOfficeLink>
                ) : null}
                {isOverviewMode && hiddenAppointmentReminderCount > 0 ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={
                      focusAreaCards.find(
                        (card) => card.key === "appointment_reminders",
                      )?.href ??
                      "/agent/notifications?activityView=appointment_reminders"
                    }
                  >
                    Open full reminder lane
                  </FrontOfficeLink>
                ) : null}
              </div>
            ) : null
          }
          className="office-list-card"
          id="appointment-reminder-pressure"
          subtitle={
            isOverviewMode
              ? "Appointment reminders stay inbox-backed but separate from broader notices. Overview keeps only the first few reminder items visible so this page stays readable."
              : "Appointment reminders stay inbox-backed but separate from broader notices, so confirmation, reschedule, external follow-up, and near-term meeting pressure can be worked as one calendar-owned slice."
          }
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

          <div className="list-row-meta front-office-record-meta">
            <span>Calendar-owned inbox slice</span>
            {activeReminderFilter !== "all" ? (
              <span>{activeReminderFilterLabel} focus applied</span>
            ) : null}
            {isOverviewMode && hiddenAppointmentReminderCount > 0 ? (
              <span>
                Previewing {displayedAppointmentReminderCards.length} of{" "}
                {appointmentReminderCards.length} reminder notice(s)
              </span>
            ) : null}
          </div>

          {!isOverviewMode &&
          (appointmentReminderCount > 0 ||
            activeReminderFilter !== "all" ||
            activeReadState !== "all")
            ? renderWorkbenchCards(appointmentReminderWorkbenchCards)
            : null}

          {displayedAppointmentReminderCards.length ? (
            <div className="office-notification-groups">
              {appointmentReminderGroups.map((group) => (
                <section className="office-notification-group" key={group.key}>
                  <header className="office-notification-group-head">
                    <div className={styles.groupCopy}>
                      <strong>{group.label}</strong>
                      <p>{group.description}</p>
                    </div>
                    <StatusBadge tone="accent">
                      {group.items.length}
                    </StatusBadge>
                  </header>

                  <div className="office-notification-list">
                    {group.items.map((card) => renderNotificationCard(card))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                activeReminderFilter !== "all" || activeReadState !== "all" ? (
                  <Button
                    onClick={resetAppointmentReminderFocus}
                    type="button"
                    variant="secondary"
                  >
                    Show all reminder pressure
                  </Button>
                ) : undefined
              }
              description={
                activeReminderFilter === "all"
                  ? "Calendar-linked confirmation, reschedule, external follow-up, and near-term appointment reminders will appear here when that pressure enters the inbox layer."
                  : activeReadState === "all"
                    ? "No appointment reminder notices match the current filter."
                    : "No appointment reminder notices match the current reminder filter and read-state view."
              }
              title="No appointment reminder notices"
            />
          )}
        </SectionCard>
      ) : null}

      {showGeneralNoticeSection ? (
        <SectionCard
          actions={
            nextGeneralNoticeCard || hiddenGeneralNoticeCount > 0 ? (
              <div className={styles.bulkActionGroup}>
                {nextGeneralNoticeCard ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildNotificationOpenHref(nextGeneralNoticeCard)}
                  >
                    Open next notice
                  </FrontOfficeLink>
                ) : null}
                {isOverviewMode && hiddenGeneralNoticeCount > 0 ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={
                      focusAreaCards.find(
                        (card) => card.key === "general_notices",
                      )?.href ??
                      "/agent/notifications?activityView=general_notices"
                    }
                  >
                    Open full notice lane
                  </FrontOfficeLink>
                ) : null}
              </div>
            ) : null
          }
          className="office-list-card"
          id="notice-stream"
          subtitle={
            isOverviewMode
              ? "General notices stay separate from calendar pressure. Overview keeps this lane preview-sized so broader office context stays useful without taking over the page."
              : "General notices stay separate from calendar pressure and can be narrowed by whether the next step belongs in Front Office, Back Office, shared office visibility, or awareness only."
          }
          title="General notices"
        >
          <div className="list-row-meta front-office-record-meta">
            <span>{generalNoticeCards.length} notice(s) in this lane</span>
            {activeNoticeStreamFilter !== "all" ? (
              <span>{activeNoticeStreamFilterLabel} focus applied</span>
            ) : null}
            {isOverviewMode && hiddenGeneralNoticeCount > 0 ? (
              <span>
                Previewing {displayedGeneralNoticeCards.length} of{" "}
                {generalNoticeCards.length} general notice(s)
              </span>
            ) : null}
          </div>

          {!isOverviewMode &&
          (generalNoticeCount > 0 ||
            activeNoticeStreamFilter !== "all" ||
            activeReadState !== "all")
            ? renderWorkbenchCards(generalNoticeWorkbenchCards)
            : null}

          {displayedGeneralNoticeCards.length ? (
            <div className="office-notification-groups">
              {generalNoticeGroups.map((group) => (
                <section className="office-notification-group" key={group.key}>
                  <header className="office-notification-group-head">
                    <div className={styles.groupCopy}>
                      <strong>{group.label}</strong>
                      <p>{group.description}</p>
                    </div>
                    <StatusBadge tone={streamBadgeTone(group.key)}>
                      {group.items.length}
                    </StatusBadge>
                  </header>

                  <div className="office-notification-list">
                    {group.items.map((card) => renderNotificationCard(card))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                activeNoticeStreamFilter !== "all" ||
                activeReadState !== "all" ? (
                  <Button
                    onClick={resetGeneralNoticeFocus}
                    type="button"
                    variant="secondary"
                  >
                    Show all notice lanes
                  </Button>
                ) : undefined
              }
              description={
                activeNoticeStreamFilter !== "all"
                  ? `No general notices match ${activeNoticeStreamFilterLabel.toLowerCase()} right now.`
                  : activeReadState === "all"
                    ? "Broader Front Office notices will appear here after appointment reminder pressure has been handled or when non-calendar notices are available."
                    : "No general notices match the current read-state view."
              }
              title="No general notices"
            />
          )}
        </SectionCard>
      ) : null}
    </>
  );
}
