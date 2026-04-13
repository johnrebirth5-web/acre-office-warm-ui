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
  { value: "all", label: "Overview" },
  { value: "personal_cleanup", label: "My follow-ups" },
  { value: "team_cleanup", label: "Team follow-ups" },
  { value: "appointment_reminders", label: "Appointments" },
  { value: "general_notices", label: "Notices" },
];

export function getActivityViewFocusLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Your overdue follow-up and duplicate review";
    case "team_cleanup":
      return "Team overdue follow-up and quiet activity";
    case "appointment_reminders":
      return "Appointment confirmations, reschedules, and next steps";
    case "general_notices":
      return "Notices, office updates, and formal workflow items";
    default:
      return "Follow-up, appointments, team pressure, and notices";
  }
}

export function getActivityViewSectionTargetLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "My follow-ups";
    case "team_cleanup":
      return "Team follow-ups";
    case "appointment_reminders":
      return "Appointments";
    case "general_notices":
      return "Notices";
    default:
      return "Activity";
  }
}

export function getActivityViewNextMoveLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Handle the most overdue follow-up first, then return to reminders or notices if needed.";
    case "team_cleanup":
      return "Address the most urgent team item, then return to your own follow-up.";
    case "appointment_reminders":
      return "Open the appointment and record the next step.";
    case "general_notices":
      return "Open the notice and decide whether it needs agent work or formal workflow.";
    default:
      return "Start with the most urgent item, then keep the same filters in place.";
  }
}

export function getActivityViewOperatorCue(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "Finish your own overdue follow-up first, then come back to reminders or notices.";
    case "team_cleanup":
      return "Use this view when the team needs help, not just for your own queue.";
    case "appointment_reminders":
      return "Keep the appointment open until the confirmation, reschedule, or next step is recorded.";
    case "general_notices":
      return "Use notices to separate direct action from updates that only need visibility.";
    default:
      return "Review the most urgent area first, then keep the current filters steady while you work.";
  }
}

export function getActivityViewTriageOrderLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "Clear your overdue follow-up before widening the view.";
    case "team_cleanup":
      return "Handle team pressure before returning to your own work.";
    case "appointment_reminders":
      return "Finish the appointment update before switching back to notices.";
    case "general_notices":
      return "Review notices before circling back to appointment follow-up.";
    default:
      return "My follow-up -> team pressure -> appointments -> notices.";
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
  { value: "stale_client", label: "Stale clients" },
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
      "Follow-up that is already due for your own clients.",
  },
  {
    key: "appointment_writeback",
    label: "Appointment writeback",
    description:
      "Appointment updates that still need confirmation, reschedule, or a saved next step.",
  },
  {
    key: "send_risk",
    label: "Send-trail risk",
    description:
      "Tracked sends that never opened or went quiet after the last signal.",
  },
  {
    key: "stale_client",
    label: "Stale clients",
    description:
      "Clients that have gone quiet long enough to need a recovery pass.",
  },
  {
    key: "duplicate_review",
    label: "Duplicate review",
    description:
      "Possible duplicates that should be resolved before more work lands on the wrong client record.",
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
  { value: "all", label: "All notices" },
  { value: "front_office", label: "Agent actions" },
  { value: "back_office", label: "Formal workflow" },
  { value: "shared_notice", label: "Office updates" },
  { value: "reference", label: "Reference only" },
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
    label: "Agent actions",
    description:
      "Use these when the next step still belongs with the agent.",
  },
  {
    key: "back_office",
    label: "Formal workflow",
    description:
      "Use these when the next action belongs in the formal transaction or operations workflow.",
  },
  {
    key: "shared_notice",
    label: "Office updates",
    description:
      "Use these for office-wide updates that do not belong in your personal follow-up list.",
  },
  {
    key: "reference",
    label: "Reference only",
    description:
      "Use these for information you may want to see without turning it into a task.",
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
    label: "15+ day stale clients",
    description:
      "Clients with enough inactivity to need leadership attention.",
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
      return "Move to appointments or duplicate review once your overdue follow-up is under control.";
    case "team_cleanup":
      return "Return to your own follow-up once team pressure settles.";
    case "appointment_reminders":
      return "Return to notices after the appointment update is saved.";
    case "general_notices":
      return "Return to appointments if the next step belongs on the calendar.";
    default:
      return "Follow the most urgent area first, then return to this overview.";
  }
}

export function getActivityViewNextMoveChipLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "Clear follow-up first";
    case "team_cleanup":
      return "Handle team pressure";
    case "appointment_reminders":
      return "Record next touch";
    case "general_notices":
      return "Review next notice";
    default:
      return "Open top item";
  }
}
