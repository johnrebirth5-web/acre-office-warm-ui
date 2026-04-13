import type { FrontOfficeAppointmentExternalWorkflowStatus } from "@acre/db";

export const calendarViewValues = [
  "all",
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
  day: {
    description:
      "Use a true day agenda: appointments stay ordered by start time so today's calendar reads like a schedule.",
    label: "Day agenda",
    routeCopy: "Day agenda",
  },
  week: {
    description:
      "Use a true week agenda: appointments stay grouped by date and ordered by start time so the calendar feels like a weekly schedule.",
    label: "Week agenda",
    routeCopy: "Week agenda",
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
    label: "Writeback pending",
    routeCopy: "Writeback pending",
  },
};

export function resolveCalendarView(value: string | null | undefined) {
  return calendarViewValueSet.has(value as CalendarViewKey)
    ? (value as CalendarViewKey)
    : "all";
}

export function getCalendarViewConfig(calendarView: CalendarViewKey) {
  return calendarViewConfigs[calendarView];
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
    case "day":
    case "week":
      return {
        calendarView,
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
