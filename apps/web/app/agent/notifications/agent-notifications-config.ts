import type {
  FrontOfficeActivityCleanupItem,
  FrontOfficeActivityNotificationRecord,
  FrontOfficeDashboardSnapshot,
} from "@acre/db";

export type AgentNotificationFilter =
  | "all"
  | FrontOfficeActivityNotificationRecord["groupKey"];

export type AgentReminderFilter = Exclude<
  AgentNotificationFilter,
  "general_notice"
>;

export type AgentCleanupFilter =
  | "all"
  | FrontOfficeActivityCleanupItem["kindKey"]
  | "duplicate_review";

export type AgentNotificationStreamFilter =
  | "all"
  | FrontOfficeActivityNotificationRecord["streamKey"];

export type AgentActivityView =
  | "all"
  | "personal_cleanup"
  | "team_cleanup"
  | "appointment_reminders"
  | "general_notices";

export type AgentNotificationReadState = "all" | "unread" | "read";

export type AgentNotificationFeedback =
  | "opened_marked_read"
  | "reopened_notice"
  | "opened_shared_notice";

export type AgentLeadershipCleanupFilter =
  | "all"
  | FrontOfficeDashboardSnapshot["leadershipQueue"]["items"][number]["kindKey"];

export const activityViewOptions: Array<{
  value: AgentActivityView;
  label: string;
}> = [
  { value: "all", label: "Cleanup overview" },
  { value: "personal_cleanup", label: "Personal cleanup" },
  { value: "team_cleanup", label: "Team cleanup workbench" },
  { value: "appointment_reminders", label: "Calendar writeback" },
  { value: "general_notices", label: "Notice routing" },
];

export function getActivityViewFocusLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Self-owned cleanup, duplicate review, and send rescue";
    case "team_cleanup":
      return "Visible-scope leadership cleanup and send-trail risk";
    case "appointment_reminders":
      return "Calendar writeback, confirmations, reschedules, and reminder pressure";
    case "general_notices":
      return "Front Office actions, Back Office handoff, shared notices, and awareness-only items";
    default:
      return "Full command surface with cleanup, reminders, team pressure, and notices";
  }
}

export function getActivityViewNextMoveLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Resolve the loudest cleanup item, then reopen reminders or notices if they become louder.";
    case "team_cleanup":
      return "Intervene on the loudest visible-scope item, then return to personal cleanup.";
    case "appointment_reminders":
      return "Open the calendar writeback lane and record the next touch.";
    case "general_notices":
      return "Open the notice lane and route the next move to FO or BO.";
    default:
      return "Open the loudest lane first, then keep the current slice stable in the URL.";
  }
}

export function getActivityViewOperatorCue(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Work owner-owned cleanup first, then reopen reminders or notices once the drift is under control.";
    case "team_cleanup":
      return "Use visible-scope intervention only when a lead or office admin decision is needed.";
    case "appointment_reminders":
      return "Keep the lane on calendar writeback until confirmation, reschedule, or promised touch is handled.";
    case "general_notices":
      return "Route the next move to FO, BO, shared visibility, or awareness-only handling.";
    default:
      return "Triage the loudest lane first, then keep the route stable until the pass is closed.";
  }
}

export function getActivityViewTriageOrderLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "Resolve owner cleanup before widening the route.";
    case "team_cleanup":
      return "Handle visible-scope pressure before returning to owner cleanup.";
    case "appointment_reminders":
      return "Finish calendar writeback before reopening broader notices.";
    case "general_notices":
      return "Route notices before circling back to calendar pressure.";
    default:
      return "Personal cleanup → team pressure → calendar writeback → notice routing.";
  }
}

export const cleanupFilterOptions: Array<{
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

export const personalCleanupTrackConfig: Array<{
  key: Exclude<AgentCleanupFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "follow_up",
    label: "Follow-up due",
    description:
      "Client-owned next touches that have already become due inside your personal FO queue.",
  },
  {
    key: "appointment_writeback",
    label: "Appointment writeback",
    description:
      "Confirmation, reschedule, and promised external-touch cleanup that still needs owner follow-through.",
  },
  {
    key: "send_risk",
    label: "Send-trail risk",
    description:
      "Tracked sends in your own queue that never opened or went quiet after the last signal.",
  },
  {
    key: "stale_client",
    label: "Stale dossiers",
    description:
      "Self-owned dossiers that have gone stale enough to need an explicit recovery pass.",
  },
  {
    key: "duplicate_review",
    label: "Duplicate review",
    description:
      "Foundation cleanup that should be resolved before the next send, task, or appointment touches the wrong dossier.",
  },
];

export const notificationFilterOptions: Array<{
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

export const reminderFilterOptions: Array<{
  value: AgentReminderFilter;
  label: string;
}> = notificationFilterOptions.filter(
  (option): option is { value: AgentReminderFilter; label: string } =>
    option.value !== "general_notice",
);

export const noticeStreamFilterOptions: Array<{
  value: AgentNotificationStreamFilter;
  label: string;
}> = [
  { value: "all", label: "All notice lanes" },
  { value: "front_office", label: "FO actions" },
  { value: "back_office", label: "BO handoff" },
  { value: "shared_notice", label: "Shared office notices" },
  { value: "reference", label: "Awareness only" },
];

export const leadershipCleanupFilterOptions: Array<{
  value: AgentLeadershipCleanupFilter;
  label: string;
}> = [
  { value: "all", label: "All team pressure" },
  { value: "overdue_task", label: "Overdue tasks" },
  { value: "engagement_risk", label: "Send-trail risk" },
  { value: "stale_client", label: "15+ day stale" },
];

export const readStateOptions: Array<{
  value: AgentNotificationReadState;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread only" },
  { value: "read", label: "Read only" },
];

export const appointmentReminderGroupConfig: Array<{
  key: Exclude<AgentReminderFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "confirmation_due",
    label: "Confirmation due",
    description: "Appointments waiting on an explicit confirmation deadline.",
  },
  {
    key: "reschedule_due",
    label: "Reschedule follow-up",
    description:
      "Clients asked to move the meeting and now need the next writeback touch.",
  },
  {
    key: "external_touch_due",
    label: "External touch due",
    description:
      "Follow-up pressure is coming from the promised next touch, not just the meeting start.",
  },
  {
    key: "appointment_soon",
    label: "Appointment soon",
    description:
      "Near-term meetings surfacing because the calendar commitment itself is approaching.",
  },
];

export const generalNoticeLaneConfig: Array<{
  key: Exclude<AgentNotificationStreamFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "front_office",
    label: "Front Office actions",
    description:
      "Use these when the next step still belongs in agent-side execution.",
  },
  {
    key: "back_office",
    label: "Back Office handoff",
    description:
      "Use these when the next action belongs in formal transaction or operations workflows.",
  },
  {
    key: "shared_notice",
    label: "Shared office notices",
    description:
      "These keep office-wide visibility close without turning them into personal follow-through mutations.",
  },
  {
    key: "reference",
    label: "Awareness only",
    description:
      "These are meant to stay visible and informative, not force a read-state workflow.",
  },
];

export const teamCleanupGroupConfig: Array<{
  key: Exclude<AgentLeadershipCleanupFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "overdue_task",
    label: "Overdue tasks",
    description:
      "Shared follow-up tasks that have already slipped past the promised due time.",
  },
  {
    key: "engagement_risk",
    label: "Send-trail risk",
    description:
      "Tracked sends that stayed unopened or opened once and then went quiet.",
  },
  {
    key: "stale_client",
    label: "15+ day stale dossiers",
    description:
      "Visible-scope dossiers with enough inactivity to need leadership attention.",
  },
];

export function resolveOptionValue<T extends string>(
  rawValue: string | null | undefined,
  options: Array<{
    value: T;
  }>,
  fallback: T,
) {
  return options.some((option) => option.value === rawValue)
    ? (rawValue as T)
    : fallback;
}

export function resolveReminderFilterValue(
  rawReminderFilter: string | null | undefined,
  rawNotificationFilter: string | null | undefined,
  fallback: AgentReminderFilter,
) {
  return resolveOptionValue(
    rawReminderFilter && rawReminderFilter !== "general_notice"
      ? rawReminderFilter
      : rawNotificationFilter && rawNotificationFilter !== "general_notice"
        ? rawNotificationFilter
        : null,
    reminderFilterOptions,
    fallback,
  );
}

export function resolveNoticeFeedback(rawValue: string | null | undefined) {
  const allowedValues = new Set<AgentNotificationFeedback>([
    "opened_marked_read",
    "reopened_notice",
    "opened_shared_notice",
  ]);

  return rawValue && allowedValues.has(rawValue as AgentNotificationFeedback)
    ? (rawValue as AgentNotificationFeedback)
    : null;
}

export function sanitizeNotificationReturnTo(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "";
  }

  try {
    const parsed = new URL(trimmed, "http://acre.local");
    const isAgentPath =
      parsed.pathname === "/agent" || parsed.pathname.startsWith("/agent/");
    const isOfficePath =
      parsed.pathname === "/office" || parsed.pathname.startsWith("/office/");

    if (!isAgentPath && !isOfficePath) {
      return "";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

export function buildAgentNotificationsHref(input: {
  pathname: string;
  activityView: AgentActivityView;
  cleanupFilter: AgentCleanupFilter;
  filter: AgentReminderFilter;
  noticeStreamFilter: AgentNotificationStreamFilter;
  readState: AgentNotificationReadState;
  leadershipFilter: AgentLeadershipCleanupFilter;
  anchor?: string;
}) {
  const params = new URLSearchParams();
  const routeNoticeFilter =
    input.activityView === "general_notices" ? "general_notice" : input.filter;

  if (input.activityView !== "all") {
    params.set("activityView", input.activityView);
  }

  if (input.cleanupFilter !== "all") {
    params.set("cleanupFilter", input.cleanupFilter);
  }

  if (input.filter !== "all") {
    params.set("appointmentFilter", input.filter);
  }

  if (routeNoticeFilter !== "all") {
    params.set("noticeFilter", routeNoticeFilter);
  }

  if (input.noticeStreamFilter !== "all") {
    params.set("noticeStreamFilter", input.noticeStreamFilter);
  }

  if (input.readState !== "all") {
    params.set("readState", input.readState);
  }

  if (input.leadershipFilter !== "all") {
    params.set("teamCleanupFilter", input.leadershipFilter);
  }

  const query = params.toString();
  const baseHref = query ? `${input.pathname}?${query}` : input.pathname;

  return input.anchor ? `${baseHref}${input.anchor}` : baseHref;
}

export function getActivityViewAnchor(activityView: AgentActivityView) {
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

export function getActivityViewBridgeLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Bridge to appointment reminders or duplicate review when the cleanup rail is clear.";
    case "team_cleanup":
      return "Bridge back to personal cleanup once the visible-scope lane is quiet.";
    case "appointment_reminders":
      return "Bridge to notice routing after the calendar writeback pass.";
    case "general_notices":
      return "Bridge back to appointment reminders if the next touch is calendar-owned.";
    default:
      return "Bridge into the highest-pressure lane, then return to this overview slice.";
  }
}
