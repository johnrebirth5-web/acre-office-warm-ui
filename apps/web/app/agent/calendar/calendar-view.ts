export const calendarViewValues = [
  "all",
  "reply_due",
  "confirmation_pending",
  "touch_due",
  "missing_next_touch",
  "reschedule_requested",
  "bridge_logged",
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
    routeCopy: "Full calendar workbench",
  },
  reply_due: {
    description:
      "Focus on appointments that are still waiting on an outside reply or fresh response.",
    label: "Needs reply",
    routeCopy: "Reply due workbench",
  },
  confirmation_pending: {
    description:
      "Focus on scheduled appointments that still need an explicit confirmation back from the outside party.",
    label: "Awaiting confirmation",
    routeCopy: "Confirmation workbench",
  },
  touch_due: {
    description:
      "Focus on appointments where the saved next external touch is already due or overdue.",
    label: "Touch due",
    routeCopy: "Touch-due workbench",
  },
  missing_next_touch: {
    description:
      "Focus on appointments that still need a saved next-touch deadline before the outside thread stays readable.",
    label: "Missing next touch",
    routeCopy: "Next-touch workbench",
  },
  reschedule_requested: {
    description:
      "Focus on appointments where the outside conversation already asked for a time change or reset.",
    label: "Reschedule requested",
    routeCopy: "Reschedule workbench",
  },
  bridge_logged: {
    description:
      "Focus on appointments where Acre already logged the bridge and the next writeback step is to reopen the saved plan.",
    label: "Bridge logged",
    routeCopy: "Bridge workbench",
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

export function deriveCalendarViewFromRoute(input: {
  coordination: string;
  followUp: string;
  status: string;
}) {
  if (input.coordination === "confirmation_pending") {
    return "confirmation_pending" as const;
  }

  if (input.coordination === "reschedule_requested") {
    return "reschedule_requested" as const;
  }

  if (
    input.coordination === "bridge_logged" ||
    input.coordination === "writeback_pending"
  ) {
    return "bridge_logged" as const;
  }

  if (input.followUp === "next_touch_missing") {
    return "missing_next_touch" as const;
  }

  if (input.followUp === "touch_due") {
    return "touch_due" as const;
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
    case "touch_due":
      return {
        appointmentId: "",
        calendarView,
        coordination: "all",
        followUp: "touch_due",
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
