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
  { value: "all", label: "总览" },
  { value: "personal_cleanup", label: "我的跟进" },
  { value: "team_cleanup", label: "团队跟进" },
  { value: "appointment_reminders", label: "预约" },
  { value: "general_notices", label: "通知" },
];

export function getActivityViewFocusLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "你的逾期跟进和重复记录审查";
    case "team_cleanup":
      return "团队逾期跟进和沉默动态";
    case "appointment_reminders":
      return "预约确认、改期和下一步";
    case "general_notices":
      return "通知、办公室更新和正式工作流事项";
    default:
      return "跟进、预约、团队压力和通知";
  }
}

export function getActivityViewSectionTargetLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "我的跟进";
    case "team_cleanup":
      return "团队跟进";
    case "appointment_reminders":
      return "预约";
    case "general_notices":
      return "通知";
    default:
      return "动态";
  }
}

export function getActivityViewNextMoveLabel(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "先处理最逾期的跟进，必要时再回到提醒或通知。";
    case "team_cleanup":
      return "先处理最紧急的团队事项，再回到自己的跟进。";
    case "appointment_reminders":
      return "打开预约并记录下一步。";
    case "general_notices":
      return "打开通知，判断它需要经纪人处理还是正式工作流处理。";
    default:
      return "从最紧急的事项开始，然后保持当前筛选继续处理。";
  }
}

export function getActivityViewOperatorCue(activityView: AgentActivityView) {
  switch (activityView) {
    case "personal_cleanup":
      return "先完成自己的逾期跟进，再回到提醒或通知。";
    case "team_cleanup":
      return "团队需要协助时使用这个视图，而不是只看自己的队列。";
    case "appointment_reminders":
      return "在确认、改期或下一步记录完成前，保持预约打开。";
    case "general_notices":
      return "用通知区分需要直接处理的事项和只需看见的更新。";
    default:
      return "先查看最紧急的区域，处理时保持当前筛选不变。";
  }
}

export function getActivityViewTriageOrderLabel(
  activityView: AgentActivityView,
) {
  switch (activityView) {
    case "personal_cleanup":
      return "先清理自己的逾期跟进，再扩大视图。";
    case "team_cleanup":
      return "先处理团队压力，再回到自己的工作。";
    case "appointment_reminders":
      return "先完成预约更新，再切回通知。";
    case "general_notices":
      return "先查看通知，再回到预约跟进。";
    default:
      return "我的跟进 -> 团队压力 -> 预约 -> 通知。";
  }
}

export const cleanupFilterOptions: Array<{
  value: AgentCleanupFilter;
  label: string;
}> = [
  { value: "all", label: "全部个人清理" },
  { value: "follow_up", label: "跟进已到期" },
  { value: "appointment_writeback", label: "预约跟进" },
  { value: "send_risk", label: "分享风险" },
  { value: "stale_client", label: "沉默客户" },
  { value: "duplicate_review", label: "重复记录审查" },
];

export const personalCleanupTrackConfig: Array<{
  key: Exclude<AgentCleanupFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "follow_up",
    label: "跟进已到期",
    description: "你自己客户中已经到期的跟进。",
  },
  {
    key: "appointment_writeback",
    label: "预约跟进",
    description:
      "仍需要确认、改期或保存下一步的预约更新。",
  },
  {
    key: "send_risk",
    label: "分享风险",
    description:
      "已追踪分享从未打开，或最后一次信号后陷入沉默。",
  },
  {
    key: "stale_client",
    label: "沉默客户",
    description:
      "沉默时间已经足够长、需要重新唤回的客户。",
  },
  {
    key: "duplicate_review",
    label: "重复记录审查",
    description:
      "可能重复的记录，需要在更多工作落到错误客户档案前处理。",
  },
];

export const notificationFilterOptions: Array<{
  value: AgentNotificationFilter;
  label: string;
}> = [
  { value: "all", label: "全部通知" },
  { value: "confirmation_due", label: "待确认" },
  { value: "reschedule_due", label: "改期跟进" },
  { value: "external_touch_due", label: "外部触达已到期" },
  { value: "appointment_soon", label: "预约即将开始" },
  { value: "general_notice", label: "一般通知" },
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
  { value: "all", label: "全部通知" },
  { value: "front_office", label: "经纪人动作" },
  { value: "back_office", label: "正式工作流" },
  { value: "shared_notice", label: "办公室更新" },
  { value: "reference", label: "仅参考" },
];

export const leadershipCleanupFilterOptions: Array<{
  value: AgentLeadershipCleanupFilter;
  label: string;
}> = [
  { value: "all", label: "全部团队压力" },
  { value: "overdue_task", label: "逾期任务" },
  { value: "engagement_risk", label: "分享风险" },
  { value: "stale_client", label: "沉默 15 天以上" },
];

export const readStateOptions: Array<{
  value: AgentNotificationReadState;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "unread", label: "仅未读" },
  { value: "read", label: "仅已读" },
];

export const appointmentReminderGroupConfig: Array<{
  key: Exclude<AgentReminderFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "confirmation_due",
    label: "待确认",
    description: "正在等待明确确认截止时间的预约。",
  },
  {
    key: "reschedule_due",
    label: "改期跟进",
    description:
      "客户要求调整会议时间，现在需要下一次跟进触达。",
  },
  {
    key: "external_touch_due",
    label: "外部触达已到期",
    description:
      "跟进压力来自承诺的下一次触达，而不只是会议开始时间。",
  },
  {
    key: "appointment_soon",
    label: "预约即将开始",
    description:
      "近期会议因日历承诺临近而浮到前面。",
  },
];

export const generalNoticeLaneConfig: Array<{
  key: Exclude<AgentNotificationStreamFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "front_office",
    label: "经纪人动作",
    description: "下一步仍由经纪人处理时使用这些通知。",
  },
  {
    key: "back_office",
    label: "正式工作流",
    description:
      "下一步属于正式交易或运营工作流时使用这些通知。",
  },
  {
    key: "shared_notice",
    label: "办公室更新",
    description:
      "用于办公室范围更新，不放入你的个人跟进列表。",
  },
  {
    key: "reference",
    label: "仅参考",
    description:
      "用于你可能需要看到、但不需要转成任务的信息。",
  },
];

export const teamCleanupGroupConfig: Array<{
  key: Exclude<AgentLeadershipCleanupFilter, "all">;
  label: string;
  description: string;
}> = [
  {
    key: "overdue_task",
    label: "逾期任务",
    description:
      "已经超过承诺到期时间的共享跟进任务。",
  },
  {
    key: "engagement_risk",
    label: "分享风险",
    description:
      "已追踪分享保持未打开，或打开一次后陷入沉默。",
  },
  {
    key: "stale_client",
    label: "沉默 15 天以上客户",
    description: "活动停滞到需要负责人关注的客户。",
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
