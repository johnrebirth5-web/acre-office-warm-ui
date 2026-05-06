import type { FrontOfficeAppointmentExternalWorkflowStatus } from "@acre/db";

export const calendarViewValues = [
  "all",
  "month",
  "day",
  "week",
  "reply_due",
  "confirmation_pending",
  "confirmed",
  "touch_due",
  "touch_scheduled",
  "missing_next_touch",
  "reschedule_requested",
  "bridge_logged",
  "writeback_pending",
] as const;

export type CalendarViewKey = (typeof calendarViewValues)[number];

const calendarViewValueSet = new Set(calendarViewValues);

export type CalendarViewRoutePatch = {
  appointmentId?: string;
  calendarView?: CalendarViewKey;
  coordination?: string;
  followUp?: string;
  status?: string;
};

export type CalendarViewConfig = {
  description: string;
  label: string;
  routeCopy: string;
};

const calendarViewConfigs: Record<CalendarViewKey, CalendarViewConfig> = {
  all: {
    description:
      "Use the full appointment queue, then narrow by coordination or follow-up only when the next move becomes clear.",
    label: "All appointments",
    routeCopy: "All appointments",
  },
  month: {
    description:
      "Use the Event Hub month board to balance shared office events with your appointment commitments.",
    label: "Month board",
    routeCopy: "Month board",
  },
  day: {
    description:
      "Use the Event Hub day board to read appointments and shared events in one daily stack.",
    label: "Day board",
    routeCopy: "Day board",
  },
  week: {
    description:
      "Use the Event Hub week board to keep appointments and shared events visible in one sweep.",
    label: "Week board",
    routeCopy: "Week board",
  },
  reply_due: {
    description:
      "Focus on appointments that are still waiting on an outside reply or fresh response.",
    label: "Needs reply",
    routeCopy: "Needs reply",
  },
  confirmation_pending: {
    description:
      "Focus on scheduled appointments that still need an explicit confirmation back from the outside party.",
    label: "Awaiting confirmation",
    routeCopy: "Awaiting confirmation",
  },
  confirmed: {
    description:
      "Focus on appointments that are already confirmed outside Acre and only need a last-touch checkpoint or a clean confirmed record before start time.",
    label: "Externally confirmed",
    routeCopy: "Confirmed",
  },
  touch_due: {
    description:
      "Focus on appointments where the saved next external touch is already due or overdue.",
    label: "Touch due",
    routeCopy: "Touch due",
  },
  touch_scheduled: {
    description:
      "Focus on appointments where the next external touch is already saved but is not due yet.",
    label: "Touch scheduled",
    routeCopy: "Touch scheduled",
  },
  missing_next_touch: {
    description:
      "Focus on appointments that still need a saved next-touch deadline before the outside thread stays readable.",
    label: "Missing next touch",
    routeCopy: "Missing next touch",
  },
  reschedule_requested: {
    description:
      "Focus on appointments where the outside conversation already asked for a time change or reset.",
    label: "Reschedule requested",
    routeCopy: "Reschedule requested",
  },
  bridge_logged: {
    description:
      "Focus on appointments where an external draft or export was already opened and the next step still needs to be saved here.",
    label: "Draft opened",
    routeCopy: "Draft opened",
  },
  writeback_pending: {
    description:
      "Focus on appointments where an external draft was opened, but no confirmation, reschedule, or next step has been saved yet.",
    label: "Update not saved",
    routeCopy: "Update not saved",
  },
};

const calendarViewZhConfigs: Record<CalendarViewKey, CalendarViewConfig> = {
  all: {
    description:
      "先使用完整预约队列；只有下一步明确后，再按协调或跟进缩小范围。",
    label: "全部预约",
    routeCopy: "全部预约",
  },
  month: {
    description:
      "使用 Event Hub 月视图，平衡共享办公室活动和你的预约承诺。",
    label: "月视图",
    routeCopy: "月视图",
  },
  day: {
    description:
      "使用 Event Hub 日视图，在同一天堆栈中查看预约和共享活动。",
    label: "日视图",
    routeCopy: "日视图",
  },
  week: {
    description:
      "使用 Event Hub 周视图，一次性看清预约和共享活动。",
    label: "周视图",
    routeCopy: "周视图",
  },
  reply_due: {
    description:
      "聚焦仍在等待外部回复或新回应的预约。",
    label: "需要回复",
    routeCopy: "需要回复",
  },
  confirmation_pending: {
    description:
      "聚焦已安排但仍需要外部明确确认的预约。",
    label: "等待确认",
    routeCopy: "等待确认",
  },
  confirmed: {
    description:
      "聚焦 Acre 外部已确认、只需要开始前最后触达检查或干净确认记录的预约。",
    label: "外部已确认",
    routeCopy: "已确认",
  },
  touch_due: {
    description:
      "聚焦已保存的下一次外部触达已经到期或逾期的预约。",
    label: "触达已到期",
    routeCopy: "触达已到期",
  },
  touch_scheduled: {
    description:
      "聚焦下一次外部触达已保存但尚未到期的预约。",
    label: "触达已安排",
    routeCopy: "触达已安排",
  },
  missing_next_touch: {
    description:
      "聚焦仍需保存下一次触达截止时间，才能让外部线程保持清晰的预约。",
    label: "缺少下次触达",
    routeCopy: "缺少下次触达",
  },
  reschedule_requested: {
    description:
      "聚焦外部对话已要求改期或重新安排的预约。",
    label: "请求改期",
    routeCopy: "请求改期",
  },
  bridge_logged: {
    description:
      "聚焦已打开外部草稿或导出，但下一步仍需在这里保存的预约。",
    label: "草稿已打开",
    routeCopy: "草稿已打开",
  },
  writeback_pending: {
    description:
      "聚焦外部草稿已打开，但确认、改期或下一步尚未保存的预约。",
    label: "更新未保存",
    routeCopy: "更新未保存",
  },
};

export function resolveCalendarView(value: string | null | undefined) {
  return calendarViewValueSet.has(value as CalendarViewKey)
    ? (value as CalendarViewKey)
    : "all";
}

export function getCalendarViewConfig(calendarView: CalendarViewKey, isZh = false) {
  return (isZh ? calendarViewZhConfigs : calendarViewConfigs)[calendarView];
}

export function getCalendarViewForExternalWorkflowStatus(
  status: FrontOfficeAppointmentExternalWorkflowStatus,
) {
  switch (status) {
    case "needs_follow_up":
      return "reply_due" as const;
    case "confirmation_pending":
      return "confirmation_pending" as const;
    case "confirmed":
      return "confirmed" as const;
    case "reschedule_requested":
      return "reschedule_requested" as const;
    default:
      return null;
  }
}

export function getCalendarViewForWritebackReentry(input: {
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  hasBridgeActivity?: boolean;
  nextActionAtValue?: string | null;
}) {
  const hasNextActionAt = Boolean(input.nextActionAtValue?.trim());

  if (input.hasBridgeActivity && !hasNextActionAt) {
    return "writeback_pending" as const;
  }

  if (input.status !== "confirmed" && hasNextActionAt) {
    return "touch_scheduled" as const;
  }

  return getCalendarViewForExternalWorkflowStatus(input.status);
}

export function deriveCalendarViewFromRoute(input: {
  coordination: string;
  followUp: string;
  status: string;
}) {
  if (input.coordination === "confirmation_pending") {
    return "confirmation_pending" as const;
  }

  if (input.coordination === "confirmed" || input.followUp === "confirmed") {
    return "confirmed" as const;
  }

  if (input.coordination === "reschedule_requested") {
    return "reschedule_requested" as const;
  }

  if (input.coordination === "writeback_pending") {
    return "writeback_pending" as const;
  }

  if (input.coordination === "bridge_logged") {
    return "bridge_logged" as const;
  }

  if (input.followUp === "next_touch_missing") {
    return "missing_next_touch" as const;
  }

  if (input.followUp === "touch_due") {
    return "touch_due" as const;
  }

  if (input.followUp === "touch_scheduled") {
    return "touch_scheduled" as const;
  }

  if (input.followUp === "response_waiting") {
    return "reply_due" as const;
  }

  if (input.status !== "all") {
    return "all" as const;
  }

  return "all" as const;
}

export function getCalendarViewRoutePatch(
  calendarView: CalendarViewKey,
): CalendarViewRoutePatch {
  switch (calendarView) {
    case "month":
    case "day":
    case "week":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "all",
        status: "all",
      };
    case "reply_due":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "response_waiting",
        status: "all",
      };
    case "confirmation_pending":
      return {
        appointmentId: "",
        calendarView,
        coordination: "confirmation_pending",
        followUp: "all",
        status: "all",
      };
    case "confirmed":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "confirmed",
        status: "all",
      };
    case "touch_due":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "touch_due",
        status: "all",
      };
    case "touch_scheduled":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "touch_scheduled",
        status: "all",
      };
    case "missing_next_touch":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "next_touch_missing",
        status: "all",
      };
    case "reschedule_requested":
      return {
        appointmentId: "",
        calendarView,
        coordination: "reschedule_requested",
        followUp: "all",
        status: "all",
      };
    case "bridge_logged":
      return {
        appointmentId: "",
        calendarView,
        coordination: "bridge_logged",
        followUp: "all",
        status: "all",
      };
    case "writeback_pending":
      return {
        appointmentId: "",
        calendarView,
        coordination: "writeback_pending",
        followUp: "all",
        status: "all",
      };
    case "all":
    default:
      return {
        appointmentId: "",
        calendarView: "all",
        coordination: "all",
        followUp: "all",
        status: "all",
      };
  }
}
