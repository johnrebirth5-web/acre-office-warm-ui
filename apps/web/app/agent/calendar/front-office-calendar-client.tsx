"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type {
  FrontOfficeAppointmentBridgeAction,
  FrontOfficeAppointmentExternalWorkflowStatus,
  FrontOfficeAppointmentsSnapshot,
} from "@acre/db";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { useI18n } from "../../../lib/i18n/client";
import {
  calendarViewValues,
  deriveCalendarViewFromRoute,
  getCalendarViewForWritebackReentry,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "./calendar-view";

type FrontOfficeCalendarClientProps = {
  initialClientId?: string;
  initialListingId?: string;
  snapshot: FrontOfficeAppointmentsSnapshot;
  timeZone?: string | null;
};

type AppointmentTouchPreset =
  FrontOfficeCalendarClientProps["snapshot"]["appointments"][number]["touchPresets"][number];

type AppointmentFormState = {
  title: string;
  type: string;
  clientId: string;
  listingId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  meetingUrl: string;
  contactLabel: string;
  notes: string;
};

type AppointmentWritebackDraft = {
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  note: string;
  nextActionAt: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
  actionHref?: string;
  actionLabel?: string;
} | null;

type BridgeActionResponse = {
  action: FrontOfficeAppointmentBridgeAction;
  actionLabel: string;
  checkpoint: FrontOfficeAppointmentCheckpointSummary;
  continuity?: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
  };
  manualOnlyDetail?: string;
  followUpDetail?: string;
  followUpCadenceLabel?: string;
  followUpCadenceDetail?: string;
  suggestedWriteback?: {
    status: FrontOfficeAppointmentExternalWorkflowStatus;
    label: string;
    detail: string;
    nextActionAtLabel: string;
    nextActionAtValue: string;
  } | null;
  result:
    | {
        kind: "redirect";
        href: string;
      }
    | {
        kind: "calendar_export";
        fileName: string;
        content: string;
      };
  error?: string;
  hint?: string;
};

type AppointmentMailThreadSuccessResponse = {
  thread: {
    id: string;
    subject: string;
  };
  threadHref: string;
  actionLabel: string;
  actionTargetLabel: string | null;
  actionTargetUrl: string | null;
  manualOnlyDetail: string;
  continuity: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
    returnToUrl: string | null;
  };
  error?: never;
  hint?: never;
};

type AppointmentMailThreadErrorResponse = {
  error: string;
  hint?: string;
  thread?: never;
  threadHref?: never;
  actionLabel?: never;
  manualOnlyDetail?: never;
  continuity?: never;
};

type AppointmentMailThreadResponse =
  | AppointmentMailThreadSuccessResponse
  | AppointmentMailThreadErrorResponse
  | null;

type FrontOfficeAppointmentCheckpointSummary = {
  label: string;
  detail: string;
  nextStep: string;
  sourceNote: string;
};

type BridgeOutcomeState = {
  appointmentId: string;
  actionLabel: string;
  manualOnlyDetail: string;
  followUpDetail: string;
  followUpCadenceLabel: string;
  followUpCadenceDetail: string;
  resultKind: BridgeActionResponse["result"]["kind"];
  checkpoint: FrontOfficeAppointmentCheckpointSummary;
  continuity: BridgeActionResponse["continuity"] | null;
  suggestedWriteback: BridgeActionResponse["suggestedWriteback"];
};

type AppointmentMutationResponse = {
  appointment?: {
    id: string;
    title?: string;
  };
  checkpoint?: FrontOfficeAppointmentCheckpointSummary;
  continuity?: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
  };
  error?: string;
  hint?: string;
} | null;

type AppointmentCue = {
  label: string;
  tone: "neutral" | "accent" | "success" | "warning" | "danger";
};

type FilterState = {
  clientId: string;
  calendarView: CalendarViewKey;
  listingId: string;
  type: string;
  status: string;
  coordination: string;
  followUp: string;
  appointmentId: string;
  returnTo: string;
};

type FilterUpdate = Partial<FilterState>;

type FocusState =
  | {
      mode: "default" | "locked_in_queue" | "locked_outside_queue";
      appointment: FrontOfficeAppointmentsSnapshot["appointments"][number];
    }
  | {
      mode: "missing" | "empty";
      appointment: null;
    };

type AgendaSection = {
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  appointments: FrontOfficeAppointmentsSnapshot["appointments"];
};

const externalStatusOptions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
}> = [
  { value: "idle", label: "External follow-up idle" },
  { value: "needs_follow_up", label: "Reply due" },
  { value: "confirmation_pending", label: "Confirmation pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "reschedule_requested", label: "Reschedule requested" },
];

const statusFilterOptions = [
  { value: "all", label: "All Acre statuses" },
  { value: "scheduled", label: "Scheduled only" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
  { value: "no_show", label: "No-show" },
];

const calendarViewOptions = calendarViewValues.map((value) => ({
  value,
  label: getCalendarViewConfig(value).label,
}));

const coordinationFilterOptions = [
  { value: "all", label: "All coordination states" },
  { value: "needs_follow_up", label: "Reply due" },
  { value: "confirmation_pending", label: "Confirmation pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "reschedule_requested", label: "Reschedule requested" },
  { value: "touch_due", label: "Touch due" },
  { value: "bridge_logged", label: "Draft opened" },
  { value: "writeback_pending", label: "Update not saved" },
];

const followUpFilterOptions = [
  { value: "all", label: "All follow-up rhythms" },
  { value: "response_waiting", label: "Reply due" },
  { value: "touch_due", label: "Touch due now" },
  { value: "next_touch_missing", label: "Missing next touch" },
  { value: "touch_scheduled", label: "Touch scheduled" },
  { value: "confirmed", label: "Confirmed" },
];

const statusFilterValueSet = new Set(
  statusFilterOptions.map((option) => option.value),
);
const coordinationFilterValueSet = new Set(
  coordinationFilterOptions.map((option) => option.value),
);
const followUpFilterValueSet = new Set(
  followUpFilterOptions.map((option) => option.value),
);

function getAgendaDateKey(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
  const parts = formatter.formatToParts(value);
  const partMap = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = partMap.get("year");
  const month = partMap.get("month");
  const day = partMap.get("day");

  if (!year || !month || !day) {
    return value.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function buildAgendaDateKeys(
  startValue: Date,
  timeZone: string,
  count: number,
) {
  const dateKeys: string[] = [];
  const firstKey = getAgendaDateKey(startValue, timeZone);
  let cursor = new Date(`${firstKey}T12:00:00Z`);

  for (let index = 0; index < count; index += 1) {
    dateKeys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dateKeys;
}

function formatAgendaDateLabel(
  dateKey: string,
  options: {
    locale: string;
    timeZone: string;
    isToday: boolean;
    isTomorrow: boolean;
  },
) {
  if (options.isToday) {
    return options.locale === "zh-CN" ? "今天" : "Today";
  }

  if (options.isTomorrow) {
    return options.locale === "zh-CN" ? "明天" : "Tomorrow";
  }

  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));

  return new Intl.DateTimeFormat(options.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: options.timeZone,
  }).format(date);
}

function formatAgendaTimeLabel(
  value: string,
  options: {
    locale: string;
    timeZone: string;
  },
) {
  return new Intl.DateTimeFormat(options.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timeZone,
  }).format(new Date(value));
}

function buildAgendaSections(input: {
  appointments: FrontOfficeAppointmentsSnapshot["appointments"];
  locale: string;
  timeZone: string;
  calendarView: "day" | "week";
}) {
  const sectionCount = input.calendarView === "week" ? 7 : 1;
  const agendaDateKeys = buildAgendaDateKeys(
    new Date(),
    input.timeZone,
    sectionCount,
  );
  const dateKeySet = new Set(agendaDateKeys);
  const groupedAppointments = new Map<
    string,
    FrontOfficeAppointmentsSnapshot["appointments"]
  >();

  for (const appointment of input.appointments) {
    const dateKey = getAgendaDateKey(
      new Date(appointment.startsAtValue),
      input.timeZone,
    );

    if (!dateKeySet.has(dateKey)) {
      continue;
    }

    const existing = groupedAppointments.get(dateKey) ?? [];
    existing.push(appointment);
    groupedAppointments.set(dateKey, existing);
  }

  return agendaDateKeys.map((dateKey, index) => {
    const appointmentsForDay = (groupedAppointments.get(dateKey) ?? []).slice();
    appointmentsForDay.sort((left, right) => {
      if (left.startsAtValue !== right.startsAtValue) {
        return left.startsAtValue.localeCompare(right.startsAtValue);
      }

      return left.title.localeCompare(right.title);
    });

    return {
      dateKey,
      label: formatAgendaDateLabel(dateKey, {
        locale: input.locale,
        timeZone: input.timeZone,
        isToday: index === 0,
        isTomorrow: index === 1,
      }),
      isToday: index === 0,
      isTomorrow: index === 1,
      appointments: appointmentsForDay,
    } satisfies AgendaSection;
  });
}

const quickWritebackActions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
  description: string;
}> = [
  {
    value: "needs_follow_up",
    label: "Reply due",
    description:
      "Keep the appointment active, but flag that another outbound reply is still needed.",
  },
  {
    value: "confirmation_pending",
    label: "Confirmation pending",
    description:
      "Save that the outside reply has not come back yet without claiming a confirmed sync.",
  },
  {
    value: "confirmed",
    label: "Confirmed / clear touch",
    description:
      "Mark the outside plan confirmed and clear the current checkpoint deadline.",
  },
  {
    value: "reschedule_requested",
    label: "Reschedule requested",
    description:
      "Capture that the outside conversation moved into time-change mode.",
  },
];

function buildDefaultStartValue() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  const timeZoneOffsetMs = nextHour.getTimezoneOffset() * 60_000;
  return new Date(nextHour.getTime() - timeZoneOffsetMs)
    .toISOString()
    .slice(0, 16);
}

function formatDateTimeLocalValue(value: Date) {
  const timeZoneOffsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - timeZoneOffsetMs)
    .toISOString()
    .slice(0, 16);
}

function buildDefaultEndValue(startValue = buildDefaultStartValue()) {
  const startDate = new Date(startValue);

  if (Number.isNaN(startDate.getTime())) {
    return "";
  }

  startDate.setHours(startDate.getHours() + 1);
  return formatDateTimeLocalValue(startDate);
}

function normalizeHttpUrlInput(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    return normalized;
  }

  if (/^[^\s/]+\.[^\s]+(?:\/.*)?$/i.test(normalized)) {
    return `https://${normalized}`;
  }

  return normalized;
}

function isValidHttpUrl(value: string) {
  const candidate = normalizeHttpUrlInput(value);

  if (!candidate) {
    return true;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildEmptyFormState(
  initialClientId?: string,
  initialListingId?: string,
): AppointmentFormState {
  const startsAt = buildDefaultStartValue();

  return {
    title: "",
    type: "showing",
    clientId: initialClientId ?? "",
    listingId: initialListingId ?? "",
    startsAt,
    endsAt: buildDefaultEndValue(startsAt),
    location: "",
    meetingUrl: "",
    contactLabel: "",
    notes: "",
  };
}

function validateAppointmentFormState(formState: AppointmentFormState) {
  const startIso = toIsoDateTime(formState.startsAt);

  if (!startIso) {
    return "Choose a valid start time before scheduling the appointment.";
  }

  const endIso = formState.endsAt ? toIsoDateTime(formState.endsAt) : "";

  if (formState.endsAt && !endIso) {
    return "Choose a valid end time or clear the field.";
  }

  if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
    return "End time cannot be earlier than start time.";
  }

  if (formState.meetingUrl && !isValidHttpUrl(formState.meetingUrl)) {
    return "Meeting link must be a valid Zoom, Meet, Teams, or other http(s) URL.";
  }

  if (
    (formState.type === "showing" &&
      !formState.clientId &&
      !formState.listingId &&
      !formState.contactLabel.trim()) ||
    ((formState.type === "consultation" ||
      formState.type === "client_meeting") &&
      !formState.clientId &&
      !formState.contactLabel.trim()) ||
    (formState.type === "open_house" && !formState.listingId)
  ) {
    return "Attach the client, listing, or outside contact that this appointment is coordinating before you save it.";
  }

  return null;
}

function buildAppointmentCueList(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
) {
  const cues: AppointmentCue[] = [];

  if (appointment.statusValue !== "scheduled") {
    return cues;
  }

  if (appointment.externalStatusValue === "confirmation_pending") {
    cues.push({ label: "Confirmation pending", tone: "accent" });
  }

  if (appointment.externalStatusValue === "reschedule_requested") {
    cues.push({ label: "Reschedule requested", tone: "danger" });
  }

  if (appointment.isExternalTouchDue) {
    cues.push({ label: "Touch due", tone: "danger" });
  } else if (
    appointment.requiresExternalResponse &&
    appointment.externalNextActionAtValue
  ) {
    cues.push({ label: "Touch scheduled", tone: "accent" });
  }

  if (appointment.needsNextTouchPlan) {
    cues.push({ label: "Missing next touch", tone: "warning" });
  }

  if (
    appointment.hasBridgeActivity &&
    appointment.externalStatusValue === "idle"
  ) {
    cues.push({ label: "Update not saved", tone: "warning" });
  }

  if (
    appointment.externalStatusValue === "confirmed" &&
    !appointment.externalNextActionAtValue
  ) {
    cues.push({ label: "Externally confirmed", tone: "success" });
  }

  if (appointment.reminderLabel === "Starts within 2h") {
    cues.push({ label: "Starts soon", tone: "warning" });
  }

  return cues.slice(0, 4);
}

function toIsoDateTime(value: string) {
  if (!value.trim()) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function buildWritebackDraft(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
): AppointmentWritebackDraft {
  return {
    status: appointment.externalStatusValue,
    note: appointment.externalNote,
    nextActionAt: appointment.externalNextActionAtValue,
  };
}

function didWritebackChange(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  draft: AppointmentWritebackDraft,
) {
  return (
    draft.status !== appointment.externalStatusValue ||
    draft.note.trim() !== appointment.externalNote ||
    draft.nextActionAt !== appointment.externalNextActionAtValue
  );
}

function downloadCalendarExport(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

function buildCalendarHref(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  update: FilterUpdate,
) {
  const params = new URLSearchParams(searchParams.toString());

  const nextClientId = update.clientId;
  if (nextClientId !== undefined) {
    if (nextClientId) {
      params.set("clientId", nextClientId);
    } else {
      params.delete("clientId");
    }
  }

  const nextCalendarView = update.calendarView;
  if (nextCalendarView !== undefined) {
    if (nextCalendarView && nextCalendarView !== "all") {
      params.set("calendarView", nextCalendarView);
    } else {
      params.delete("calendarView");
    }
  }

  const nextListingId = update.listingId;
  if (nextListingId !== undefined) {
    if (nextListingId) {
      params.set("listingId", nextListingId);
    } else {
      params.delete("listingId");
    }
  }

  const nextType = update.type;
  if (nextType !== undefined) {
    if (nextType) {
      params.set("type", nextType);
    } else {
      params.delete("type");
    }
  }

  const nextStatus = update.status;
  if (nextStatus !== undefined) {
    if (nextStatus && nextStatus !== "all") {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }
  }

  const nextCoordination = update.coordination;
  if (nextCoordination !== undefined) {
    if (nextCoordination && nextCoordination !== "all") {
      params.set("coordination", nextCoordination);
    } else {
      params.delete("coordination");
    }
  }

  const nextFollowUp = update.followUp;
  if (nextFollowUp !== undefined) {
    if (nextFollowUp && nextFollowUp !== "all") {
      params.set("followUp", nextFollowUp);
    } else {
      params.delete("followUp");
    }
  }

  const nextAppointmentId = update.appointmentId;
  if (nextAppointmentId !== undefined) {
    if (nextAppointmentId) {
      params.set("appointmentId", nextAppointmentId);
    } else {
      params.delete("appointmentId");
    }
  }

  const nextReturnTo = update.returnTo;
  if (nextReturnTo !== undefined) {
    if (nextReturnTo) {
      params.set("returnTo", nextReturnTo);
    } else {
      params.delete("returnTo");
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function appendReturnToHref(href: string, returnTo: string) {
  const trimmedHref = href.trim();

  if (!trimmedHref.startsWith("/")) {
    return href;
  }

  try {
    const parsed = new URL(trimmedHref, "http://acre.local");

    if (returnTo) {
      parsed.searchParams.set("returnTo", returnTo);
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return href;
  }
}

function readFilterState(searchParams: ReadonlyURLSearchParams): FilterState {
  return {
    clientId: searchParams.get("clientId")?.trim() ?? "",
    calendarView: resolveCalendarView(searchParams.get("calendarView")?.trim()),
    listingId: searchParams.get("listingId")?.trim() ?? "",
    type: searchParams.get("type")?.trim() ?? "",
    status: searchParams.get("status")?.trim() ?? "all",
    coordination: searchParams.get("coordination")?.trim() ?? "all",
    followUp: searchParams.get("followUp")?.trim() ?? "all",
    appointmentId: searchParams.get("appointmentId")?.trim() ?? "",
    returnTo: searchParams.get("returnTo")?.trim() ?? "",
  };
}

function readWritebackDraft(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  drafts: Record<string, AppointmentWritebackDraft>,
) {
  return drafts[appointment.id] ?? buildWritebackDraft(appointment);
}

function sanitizeScopedValue(value: string, options: Array<{ value: string }>) {
  return options.some((option) => option.value === value) ? value : "";
}

function sanitizeEnumValue(
  value: string,
  allowedValues: Set<string>,
  fallbackValue: string,
) {
  return allowedValues.has(value) ? value : fallbackValue;
}

function sanitizeReturnTo(value: string) {
  const trimmed = value.trim();

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

function normalizeFilterState(
  rawFilterState: FilterState,
  snapshot: FrontOfficeAppointmentsSnapshot,
): FilterState {
  const normalizedCoordination = sanitizeEnumValue(
    rawFilterState.coordination,
    coordinationFilterValueSet,
    "all",
  );
  const normalizedFollowUp = sanitizeEnumValue(
    rawFilterState.followUp,
    followUpFilterValueSet,
    "all",
  );
  const normalizedStatus = sanitizeEnumValue(
    rawFilterState.status,
    statusFilterValueSet,
    "all",
  );
  const explicitCalendarView = resolveCalendarView(rawFilterState.calendarView);
  const derivedCalendarView =
    explicitCalendarView !== "all"
      ? explicitCalendarView
      : deriveCalendarViewFromRoute({
          coordination: normalizedCoordination,
          followUp: normalizedFollowUp,
          status: normalizedStatus,
        });

  return {
    clientId: sanitizeScopedValue(
      rawFilterState.clientId,
      snapshot.clientOptions,
    ),
    calendarView: derivedCalendarView,
    listingId: sanitizeScopedValue(
      rawFilterState.listingId,
      snapshot.listingOptions,
    ),
    type: sanitizeScopedValue(rawFilterState.type, snapshot.typeOptions),
    status: normalizedStatus,
    coordination: normalizedCoordination,
    followUp: normalizedFollowUp,
    appointmentId: rawFilterState.appointmentId,
    returnTo: sanitizeReturnTo(rawFilterState.returnTo),
  };
}

function readOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function readReturnToLabel(returnTo: string) {
  if (!returnTo) {
    return "";
  }

  const pathname = returnTo.split("?")[0]?.split("#")[0] ?? returnTo;

  if (pathname.startsWith("/agent/clients/")) {
    return "Back to client page";
  }

  if (pathname.startsWith("/agent/listings")) {
    return "Return to listing output";
  }

  if (pathname.startsWith("/agent/notifications")) {
    return "Return to activity center";
  }

  if (pathname.startsWith("/agent/dashboard")) {
    return "Return to dashboard";
  }

  if (pathname.startsWith("/office/transactions")) {
    return "Back to formal workflow";
  }

  return "Back to previous view";
}

function hasActiveQueueFilters(filterState: FilterState) {
  return Boolean(
    filterState.clientId ||
    filterState.calendarView !== "all" ||
    filterState.listingId ||
    filterState.type ||
    filterState.status !== "all" ||
    filterState.coordination !== "all" ||
    filterState.followUp !== "all",
  );
}

function resolveFocusState(
  snapshot: FrontOfficeAppointmentsSnapshot,
  filterState: FilterState,
): FocusState {
  if (snapshot.selectedAppointment) {
    return {
      appointment: snapshot.selectedAppointment,
      mode: snapshot.appointments.some(
        (appointment) => appointment.id === snapshot.selectedAppointment?.id,
      )
        ? "locked_in_queue"
        : "locked_outside_queue",
    };
  }

  if (!snapshot.appointments.length) {
    return filterState.appointmentId
      ? { appointment: null, mode: "missing" }
      : { appointment: null, mode: "empty" };
  }

  if (!filterState.appointmentId) {
    return {
      appointment: snapshot.appointments[0],
      mode: "default",
    };
  }

  const lockedAppointment = snapshot.appointments.find(
    (appointment) => appointment.id === filterState.appointmentId,
  );

  if (lockedAppointment) {
    return {
      appointment: lockedAppointment,
      mode: "locked_in_queue",
    };
  }

  return {
    appointment: null,
    mode: "missing",
  };
}

export function FrontOfficeCalendarClient(
  props: FrontOfficeCalendarClientProps,
) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const resolvedTimeZone = props.timeZone ?? "America/New_York";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const externalStatusOptions = [
    {
      value: "idle" as const,
      label: isZh ? "外部跟进空闲" : "External follow-up idle",
    },
    {
      value: "needs_follow_up" as const,
      label: isZh ? "待回复" : "Reply due",
    },
    {
      value: "confirmation_pending" as const,
      label: isZh ? "待确认" : "Confirmation pending",
    },
    {
      value: "confirmed" as const,
      label: isZh ? "已确认" : "Confirmed",
    },
    {
      value: "reschedule_requested" as const,
      label: isZh ? "请求改期" : "Reschedule requested",
    },
  ];
  const statusFilterOptions = [
    { value: "all", label: isZh ? "全部 Acre 状态" : "All Acre statuses" },
    { value: "scheduled", label: isZh ? "仅已安排" : "Scheduled only" },
    { value: "completed", label: isZh ? "已完成" : "Completed" },
    { value: "canceled", label: isZh ? "已取消" : "Canceled" },
    { value: "no_show", label: isZh ? "未到场" : "No-show" },
  ];
  const coordinationFilterOptions = [
    { value: "all", label: isZh ? "全部协调状态" : "All coordination states" },
    { value: "needs_follow_up", label: isZh ? "待回复" : "Reply due" },
    {
      value: "confirmation_pending",
      label: isZh ? "待确认" : "Confirmation pending",
    },
    { value: "confirmed", label: isZh ? "已确认" : "Confirmed" },
    {
      value: "reschedule_requested",
      label: isZh ? "请求改期" : "Reschedule requested",
    },
    { value: "touch_due", label: isZh ? "触达已到期" : "Touch due" },
    { value: "bridge_logged", label: isZh ? "已打开草稿" : "Draft opened" },
    {
      value: "writeback_pending",
      label: isZh ? "待保存更新" : "Update not saved",
    },
  ];
  const followUpFilterOptions = [
    { value: "all", label: isZh ? "全部跟进节奏" : "All follow-up rhythms" },
    { value: "response_waiting", label: isZh ? "待回复" : "Reply due" },
    { value: "touch_due", label: isZh ? "现在触达" : "Touch due now" },
    {
      value: "next_touch_missing",
      label: isZh ? "缺少下次触达" : "Missing next touch",
    },
    {
      value: "touch_scheduled",
      label: isZh ? "已安排触达" : "Touch scheduled",
    },
    { value: "confirmed", label: isZh ? "已确认" : "Confirmed" },
  ];
  const quickWritebackActions = [
    {
      value: "needs_follow_up" as const,
      label: isZh ? "待回复" : "Reply due",
      description: isZh
        ? "保持预约继续活跃，但明确标记还需要再发出一次外部回复。"
        : "Keep the appointment active, but flag that another outbound reply is still needed.",
    },
    {
      value: "confirmation_pending" as const,
      label: isZh ? "待确认" : "Confirmation pending",
      description: isZh
        ? "保存“外部回复尚未返回”的状态，但不假装已经完成同步确认。"
        : "Save that the outside reply has not come back yet without claiming a confirmed sync.",
    },
    {
      value: "confirmed" as const,
      label: isZh ? "已确认 / 清除触达" : "Confirmed / clear touch",
      description: isZh
        ? "把外部计划标记为已确认，并清除当前检查点截止时间。"
        : "Mark the outside plan confirmed and clear the current checkpoint deadline.",
    },
    {
      value: "reschedule_requested" as const,
      label: isZh ? "请求改期" : "Reschedule requested",
      description: isZh
        ? "记录外部对话已经进入调整时间的状态。"
        : "Capture that the outside conversation moved into time-change mode.",
    },
  ];
  const rawFilterState = readFilterState(searchParams);
  const filterState = normalizeFilterState(rawFilterState, props.snapshot);
  const focusState = resolveFocusState(props.snapshot, filterState);
  const focusedAppointment = focusState.appointment;
  const currentSearch = searchParams.toString();
  const currentHref = currentSearch ? `${pathname}?${currentSearch}` : pathname;
  const normalizedHref = buildCalendarHref(pathname, searchParams, filterState);
  const defaultClientId = props.initialClientId || "";
  const defaultListingId = props.initialListingId || "";
  const defaultClientIdRef = useRef(defaultClientId);
  const defaultListingIdRef = useRef(defaultListingId);
  const [formState, setFormState] = useState<AppointmentFormState>(() =>
    buildEmptyFormState(defaultClientId, defaultListingId),
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bridgeState, setBridgeState] = useState<{
    appointmentId: string;
    action: FrontOfficeAppointmentBridgeAction;
  } | null>(null);
  const [bridgeOutcome, setBridgeOutcome] = useState<BridgeOutcomeState | null>(
    null,
  );
  const [writebackDrafts, setWritebackDrafts] = useState<
    Record<string, AppointmentWritebackDraft>
  >({});
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;
  const focusedWritebackDraft = focusedAppointment
    ? readWritebackDraft(focusedAppointment, writebackDrafts)
    : null;
  const focusedCueList = focusedAppointment
    ? buildAppointmentCueList(focusedAppointment)
    : [];
  const latestBridgeHistory = focusedAppointment?.bridgeHistory[0] ?? null;
  const latestWritebackHistory =
    focusedAppointment?.writebackHistory[0] ?? null;
  const selectedClientOption = props.snapshot.clientOptions.find(
    (option) => option.value === filterState.clientId,
  );
  const selectedClientLabel = filterState.clientId
    ? (selectedClientOption?.label ??
      (focusedAppointment?.clientId === filterState.clientId
        ? focusedAppointment.clientLabel
        : "Scoped client outside quick list"))
    : "";
  const selectedListingOption = props.snapshot.listingOptions.find(
    (option) => option.value === filterState.listingId,
  );
  const selectedListingLabel = filterState.listingId
    ? (selectedListingOption?.label ??
      (focusedAppointment?.listingId === filterState.listingId
        ? focusedAppointment.listingLabel
        : "Scoped listing outside quick list"))
    : "";
  const selectedTypeLabel = filterState.type
    ? readOptionLabel(props.snapshot.typeOptions, filterState.type)
    : "";
  const selectedStatusLabel =
    filterState.status !== "all"
      ? readOptionLabel(statusFilterOptions, filterState.status)
      : "";
  const selectedCoordinationLabel =
    filterState.coordination !== "all"
      ? readOptionLabel(coordinationFilterOptions, filterState.coordination)
      : "";
  const selectedFollowUpLabel =
    filterState.followUp !== "all"
      ? readOptionLabel(followUpFilterOptions, filterState.followUp)
      : "";
  const activeCalendarViewConfig = getCalendarViewConfig(
    filterState.calendarView,
  );
  const agendaViewMode =
    filterState.calendarView === "day" || filterState.calendarView === "week"
      ? filterState.calendarView
      : null;
  const agendaSections = agendaViewMode
    ? buildAgendaSections({
        appointments: props.snapshot.appointments,
        calendarView: agendaViewMode,
        locale,
        timeZone: resolvedTimeZone,
      })
    : [];
  const agendaAppointmentCount = agendaSections.reduce(
    (count, section) => count + section.appointments.length,
    0,
  );
  const agendaWindowTitle =
    agendaViewMode === "day"
      ? isZh
        ? "今日议程"
        : "Today agenda"
      : agendaViewMode === "week"
        ? isZh
          ? "本周议程"
          : "Week agenda"
        : "";
  const agendaWindowSubtitle = agendaViewMode
    ? isZh
      ? "按时间先后排列，并按日期分组显示。外部草稿、保存的更新和下一步都会保留在同一条预约记录里。"
      : "Appointments are ordered by start time and grouped by date. External drafts, updates, and next steps stay on the same appointment record."
    : "";
  const hasQueueFilters = hasActiveQueueFilters(filterState);
  const returnToLabel = readReturnToLabel(filterState.returnTo);
  const routeStateMeta = [
    `Calendar view · ${activeCalendarViewConfig.label}`,
    selectedClientLabel
      ? `Client · ${selectedClientLabel}`
      : "Client · all visible",
    selectedListingLabel
      ? `Listing · ${selectedListingLabel}`
      : "Listing · all visible",
    selectedTypeLabel ? `Type · ${selectedTypeLabel}` : "Type · all visible",
    selectedStatusLabel ? `Acre · ${selectedStatusLabel}` : null,
    selectedCoordinationLabel
      ? `Coordination · ${selectedCoordinationLabel}`
      : null,
    selectedFollowUpLabel ? `Follow-up · ${selectedFollowUpLabel}` : null,
    filterState.appointmentId
      ? `Focus · ${
          focusedAppointment?.title ??
          (focusState.mode === "missing"
            ? "requested appointment unavailable"
            : "locked appointment")
        }`
      : "Focus · auto",
    returnToLabel ? `Return · ${returnToLabel}` : null,
  ].filter(Boolean) as string[];
  const routeStateHeading =
    focusState.mode === "missing"
      ? "This view still points to an appointment that is no longer available."
      : focusState.mode === "locked_outside_queue"
        ? `${activeCalendarViewConfig.routeCopy} with a pinned appointment`
        : filterState.appointmentId
          ? `${activeCalendarViewConfig.routeCopy} with a specific appointment pinned`
          : hasQueueFilters
            ? `${activeCalendarViewConfig.routeCopy} with saved filters`
            : activeCalendarViewConfig.routeCopy;
  const routeStateDescriptionParts = [
    activeCalendarViewConfig.description,
    selectedClientLabel
      ? `Client context is scoped to ${selectedClientLabel}.`
      : "Client context is not narrowed yet.",
    selectedListingLabel
      ? `Listing context is scoped to ${selectedListingLabel}.`
      : "Listing context is not narrowed yet.",
    focusState.mode === "missing"
      ? "Clear the pinned appointment or return to the previous page if this link is stale."
      : filterState.appointmentId
        ? "The selected appointment stays in the URL so the same record can reopen below."
        : "The detail panel defaults to the next visible appointment until you pin a specific record.",
    returnToLabel
      ? `${returnToLabel} stays preserved while you adjust filters here.`
      : "If another page sends you here, Acre will preserve the return path while your filters change.",
  ];

  function buildAppointmentFocusHref(
    appointmentId: string,
    calendarView?: CalendarViewKey,
  ) {
    return buildCalendarHref(pathname, searchParams, {
      appointmentId,
      ...(calendarView ? { calendarView } : {}),
    });
  }

  function navigateToCalendarView(calendarView: CalendarViewKey) {
    if (calendarView === "day" || calendarView === "week") {
      navigateWithFilters({
        calendarView,
      });
      return;
    }

    navigateWithFilters(getCalendarViewRoutePatch(calendarView));
  }

  function buildContextAwareHref(baseHref: string, appointmentId: string) {
    return appendReturnToHref(
      baseHref,
      buildAppointmentFocusHref(appointmentId),
    );
  }

  useEffect(() => {
    if (normalizedHref !== currentHref) {
      router.replace(normalizedHref, { scroll: false });
    }
  }, [currentHref, normalizedHref, router]);

  useEffect(() => {
    const previousDefaultClientId = defaultClientIdRef.current;

    if (previousDefaultClientId === defaultClientId) {
      return;
    }

    setFormState((current) => {
      if (!current.clientId || current.clientId === previousDefaultClientId) {
        return {
          ...current,
          clientId: defaultClientId,
        };
      }

      return current;
    });

    defaultClientIdRef.current = defaultClientId;
  }, [defaultClientId]);

  useEffect(() => {
    const previousDefaultListingId = defaultListingIdRef.current;

    if (previousDefaultListingId === defaultListingId) {
      return;
    }

    setFormState((current) => {
      if (
        !current.listingId ||
        current.listingId === previousDefaultListingId
      ) {
        return {
          ...current,
          listingId: defaultListingId,
        };
      }

      return current;
    });

    defaultListingIdRef.current = defaultListingId;
  }, [defaultListingId]);

  function navigateWithFilters(update: FilterUpdate) {
    const nextState = {
      ...filterState,
      ...update,
    };
    const nextCalendarView =
      update.calendarView ??
      (filterState.calendarView === "day" || filterState.calendarView === "week"
        ? filterState.calendarView
        : deriveCalendarViewFromRoute({
            coordination: nextState.coordination,
            followUp: nextState.followUp,
            status: nextState.status,
          }));

    startTransition(() => {
      router.replace(
        buildCalendarHref(pathname, searchParams, {
          ...update,
          calendarView: nextCalendarView,
        }),
        { scroll: false },
      );
    });
  }

  function handleFieldChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: name === "meetingUrl" ? normalizeHttpUrlInput(value) : value,
      ...(name === "startsAt" &&
      (!current.endsAt ||
        current.endsAt === buildDefaultEndValue(current.startsAt))
        ? {
            endsAt: buildDefaultEndValue(value),
          }
        : {}),
    }));
  }

  function handleWritebackDraftChange(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    field: keyof AppointmentWritebackDraft,
    value: string,
  ) {
    setWritebackDrafts((current) => {
      const existing =
        current[appointment.id] ?? buildWritebackDraft(appointment);
      const nextDraft: AppointmentWritebackDraft = {
        ...existing,
        [field]: value,
      };

      if (field === "status" && value === "idle") {
        nextDraft.note = "";
        nextDraft.nextActionAt = "";
      }

      return {
        ...current,
        [appointment.id]: nextDraft,
      };
    });
  }

  function loadSuggestedBridgeWriteback(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    suggestion: BridgeActionResponse["suggestedWriteback"],
  ) {
    if (!suggestion || appointment.statusValue !== "scheduled") {
      return;
    }

    setWritebackDrafts((current) => ({
      ...current,
      [appointment.id]: {
        status: suggestion.status,
        note: "",
        nextActionAt: suggestion.nextActionAtValue,
      },
    }));
    setFeedback({
      tone: "success",
      message: `${suggestion.label} loaded into the update form. Save it when ready to keep the next checkpoint visible in Acre.`,
    });
    scrollToWritebackSection();
  }

  function applyTouchPresetDraft(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    preset: AppointmentTouchPreset,
  ) {
    setWritebackDrafts((current) => {
      const existing = readWritebackDraft(appointment, current);
      const nextStatus =
        existing.status === "idle" ? preset.suggestedStatus : existing.status;

      return {
        ...current,
        [appointment.id]: {
          ...existing,
          status: nextStatus,
          nextActionAt: preset.nextActionAtValue,
        },
      };
    });
    setFeedback({
      tone: "success",
      message: `${preset.label} loaded into the update form. Save when ready.`,
    });
  }

  function clearSavedWritebackDraft(appointmentId: string) {
    setWritebackDrafts((current) => {
      const next = { ...current };
      delete next[appointmentId];
      return next;
    });
  }

  function resetForm() {
    setFeedback(null);
    setFormState(
      buildEmptyFormState(
        filterState.clientId || defaultClientId,
        filterState.listingId || defaultListingId,
      ),
    );
  }

  function clearFocusLock() {
    navigateWithFilters({
      appointmentId: "",
    });
  }

  function clearQueueFilters() {
    navigateWithFilters({
      clientId: "",
      calendarView: "all",
      listingId: "",
      type: "",
      status: "all",
      coordination: "all",
      followUp: "all",
      appointmentId: "",
    });
  }

  function scrollToScheduleForm() {
    document
      .getElementById("calendar-schedule-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToWritebackSection() {
    document
      .getElementById("calendar-writeback-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function refreshIntoAppointmentFocus(
    appointmentId: string,
    calendarView?: CalendarViewKey,
    onComplete?: () => void,
  ) {
    startTransition(() => {
      router.replace(buildAppointmentFocusHref(appointmentId, calendarView), {
        scroll: false,
      });
      router.refresh();
      onComplete?.();
    });
  }

  function getCalendarViewAfterMutation(suggestedView?: CalendarViewKey) {
    if (agendaViewMode) {
      return agendaViewMode;
    }

    return suggestedView ?? undefined;
  }

  function renderAgendaAppointmentRow(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    sectionLabel: string,
  ) {
    const isFocused = focusedAppointment?.id === appointment.id;
    const appointmentCueList = buildAppointmentCueList(appointment);
    const startTimeLabel = formatAgendaTimeLabel(appointment.startsAtValue, {
      locale,
      timeZone: resolvedTimeZone,
    });

    return (
      <article
        className={`list-row front-office-record${isFocused ? " tone-accent" : ""}`}
        key={appointment.id}
      >
        <div className="list-row-top front-office-record-head">
          <div>
            <strong>
              {startTimeLabel} · {appointment.title}
            </strong>
            <p>{appointment.startsAtLabel}</p>
          </div>
          <div className="front-office-calendar-badges">
            <Badge tone="neutral">{sectionLabel}</Badge>
            <Badge tone={appointment.typeTone}>{appointment.typeLabel}</Badge>
            <StatusBadge tone={appointment.statusTone}>
              {appointment.statusLabel}
            </StatusBadge>
            <StatusBadge tone={appointment.externalStatusTone}>
              {appointment.externalStatusLabel}
            </StatusBadge>
            <StatusBadge tone={appointment.calendarLaneTone}>
              {appointment.calendarLaneLabel}
            </StatusBadge>
          </div>
        </div>

        <div className="list-row-meta front-office-record-meta">
          <span>{appointment.clientLabel}</span>
          <span>{appointment.listingLabel}</span>
          <span>{appointment.locationLabel}</span>
          <span>{appointment.externalNextActionAtLabel}</span>
          <span>{appointment.nextTouchPressureLabel}</span>
          <span>{appointment.bridgeLoggedAtLabel}</span>
          <span>{appointment.latestCoordinationLabel}</span>
          <span>{appointment.latestCoordinationDetail}</span>
        </div>

        <p>{appointment.notesLabel}</p>
        <p className="front-office-record-supporting">
          {appointment.nextTouchPressureDetail}
        </p>
        <p className="front-office-record-supporting">
          {appointment.calendarLaneDetail}
        </p>
        <p className="front-office-record-supporting">
          {isZh ? "下一步：" : "Next move: "}
          {appointment.coordinationNextStep}
        </p>
        {appointmentCueList.length ? (
          <div className="front-office-calendar-badges">
            {appointmentCueList.map((cue) => (
              <Badge key={`${appointment.id}-${cue.label}`} tone={cue.tone}>
                {cue.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="front-office-calendar-actions">
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={buildCalendarHref(pathname, searchParams, {
              appointmentId: appointment.id,
            })}
          >
            {isFocused
              ? isZh
                ? "下方面板已聚焦"
                : "Focused below"
              : isZh
                ? "在焦点面板中打开"
                : "Open in focus panel"}
          </FrontOfficeLink>
          {appointment.clientHref ? (
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={buildContextAwareHref(
                appointment.clientHref,
                appointment.id,
              )}
            >
              {isZh ? "客户页" : "Client page"}
            </FrontOfficeLink>
          ) : null}
          {appointment.listingOutputHref ? (
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={buildContextAwareHref(
                appointment.listingOutputHref,
                appointment.id,
              )}
            >
              {isZh ? "房源输出" : "Listing output"}
            </FrontOfficeLink>
          ) : null}
          {appointment.statusValue === "scheduled" ? (
            <button
              className="office-button-secondary office-inline-action-sm"
              disabled={bridgeState?.appointmentId === appointment.id}
              onClick={() => handleBridgeAction(appointment, "google_calendar")}
              type="button"
            >
              {bridgeState?.appointmentId === appointment.id &&
              bridgeState.action === "google_calendar"
                ? "Opening..."
                : isZh
                  ? "Google 草稿"
                  : "Google draft"}
            </button>
          ) : null}
          {appointment.statusValue === "scheduled" &&
          appointment.externalStatusValue !== "confirmed" ? (
            <button
              className="office-button-secondary office-inline-action-sm"
              disabled={isBusy}
              onClick={() =>
                handleQuickWritebackAction(appointment, "confirmed")
              }
              type="button"
            >
              {isZh ? "在 Acre 中确认" : "Confirm in Acre"}
            </button>
          ) : null}
          {appointment.statusValue === "scheduled" &&
          appointment.touchPresets[0] ? (
            <button
              className="office-button-secondary office-inline-action-sm"
              disabled={isBusy}
              onClick={() =>
                handleTouchPresetSave(appointment, appointment.touchPresets[0])
              }
              title={`${appointment.touchPresets[0].detail} Saved for ${appointment.touchPresets[0].nextActionAtLabel}.`}
              type="button"
            >
              {appointment.touchPresets[0].label}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  function findTouchPresetForStatus(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    externalStatus: FrontOfficeAppointmentExternalWorkflowStatus,
  ) {
    return (
      appointment.touchPresets.find(
        (preset) => preset.suggestedStatus === externalStatus,
      ) ?? null
    );
  }

  function primeWritebackDraftAfterBridge(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  ) {
    if (
      appointment.statusValue !== "scheduled" ||
      appointment.externalStatusValue !== "idle" ||
      appointment.externalNextActionAtValue
    ) {
      return null;
    }

    const preset = findTouchPresetForStatus(
      appointment,
      "confirmation_pending",
    );

    if (!preset) {
      return null;
    }

    let didPrimeDraft = false;
    setWritebackDrafts((current) => {
      if (current[appointment.id]) {
        return current;
      }

      didPrimeDraft = true;
      return {
        ...current,
        [appointment.id]: {
          status: preset.suggestedStatus,
          note: "",
          nextActionAt: preset.nextActionAtValue,
        },
      };
    });

    return didPrimeDraft ? preset.label : null;
  }

  function primeWritebackDraftFromBridgeSuggestion(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    suggestion: BridgeActionResponse["suggestedWriteback"],
  ) {
    if (!suggestion || appointment.statusValue !== "scheduled") {
      return null;
    }

    let didPrimeDraft = false;
    setWritebackDrafts((current) => {
      if (current[appointment.id]) {
        return current;
      }

      didPrimeDraft = true;
      return {
        ...current,
        [appointment.id]: {
          status: suggestion.status,
          note: "",
          nextActionAt: suggestion.nextActionAtValue,
        },
      };
    });

    return didPrimeDraft ? suggestion.label : null;
  }

  function buildApiErrorMessage(
    payload: { error?: string; hint?: string } | null | undefined,
    fallbackMessage: string,
  ) {
    const baseMessage = payload?.error ?? fallbackMessage;
    return payload?.hint ? `${baseMessage} ${payload.hint}` : baseMessage;
  }

  function formatBridgeContinuation(
    continuity?:
      | (FrontOfficeAppointmentCheckpointSummary & {
          returnToLabel?: string;
          returnToDetail?: string;
        })
      | null,
  ) {
    if (!continuity) {
      return null;
    }

    return [
      continuity.label,
      continuity.detail,
      continuity.nextStep,
      continuity.returnToLabel,
      continuity.returnToDetail,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const validationError = validateAppointmentFormState(formState);

    if (validationError) {
      setFeedback({
        tone: "error",
        message: validationError,
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/agent/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formState,
          startsAt: toIsoDateTime(formState.startsAt),
          endsAt: formState.endsAt ? toIsoDateTime(formState.endsAt) : "",
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMutationResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not save the appointment.",
          ),
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: payload?.appointment?.title?.trim()
          ? `${payload.appointment.title} scheduled. Acre will keep the new appointment pinned below while the calendar refreshes.`
          : "Appointment scheduled. Acre will keep it pinned below while the calendar refreshes.",
      });
      setFormState(
        buildEmptyFormState(
          filterState.clientId || defaultClientId,
          filterState.listingId || defaultListingId,
        ),
      );
      refreshIntoAppointmentFocus(
        payload?.appointment?.id ?? "",
        undefined,
        () => {
          setIsSaving(false);
        },
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not save the appointment.",
      });
      setIsSaving(false);
    }
  }

  async function handleStatusUpdate(
    appointmentId: string,
    status: "completed" | "no_show" | "canceled",
  ) {
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/agent/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMutationResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not update the appointment.",
          ),
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: "Appointment status updated.",
      });
      refreshIntoAppointmentFocus(
        payload?.appointment?.id ?? appointmentId,
        undefined,
        () => {
          setIsSaving(false);
        },
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not update the appointment.",
      });
      setIsSaving(false);
    }
  }

  async function handleExternalStatusUpdate(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  ) {
    const draft = readWritebackDraft(appointment, writebackDrafts);

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/agent/appointments/${appointment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            externalStatus: draft.status,
            externalNote: draft.note.trim(),
            externalNextActionAt: draft.nextActionAt
              ? toIsoDateTime(draft.nextActionAt)
              : "",
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMutationResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not update the external appointment state.",
          ),
        });
        setIsSaving(false);
        return;
      }

      const checkpointContinuation = formatBridgeContinuation(
        payload?.continuity ?? payload?.checkpoint ?? null,
      );

      setFeedback({
        tone: "success",
        message: checkpointContinuation
          ? `Appointment update saved. ${checkpointContinuation}`
          : draft.nextActionAt
            ? `Appointment update saved. Acre will keep ${appointment.title} pinned with the saved next-step date in view.`
            : "Appointment update saved.",
      });
      clearSavedWritebackDraft(appointment.id);
      refreshIntoAppointmentFocus(
        payload?.appointment?.id ?? appointment.id,
        getCalendarViewAfterMutation(
          getCalendarViewForWritebackReentry({
            status: draft.status,
            hasBridgeActivity: appointment.hasBridgeActivity,
            nextActionAtValue: draft.nextActionAt,
          }) ?? undefined,
        ),
        () => {
          setIsSaving(false);
        },
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not update the external appointment state.",
      });
      setIsSaving(false);
    }
  }

  async function handleQuickWritebackAction(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    externalStatus: FrontOfficeAppointmentExternalWorkflowStatus,
  ) {
    const draft = readWritebackDraft(appointment, writebackDrafts);
    const suggestedPreset =
      externalStatus === "confirmed"
        ? null
        : !draft.nextActionAt
          ? findTouchPresetForStatus(appointment, externalStatus)
          : null;
    const nextActionAt =
      externalStatus === "confirmed"
        ? ""
        : draft.nextActionAt || suggestedPreset?.nextActionAtValue || "";

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/agent/appointments/${appointment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            externalStatus,
            externalNote: draft.note.trim(),
            externalNextActionAt: nextActionAt
              ? toIsoDateTime(nextActionAt)
              : "",
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMutationResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not update the external appointment state.",
          ),
        });
        setIsSaving(false);
        return;
      }

      const checkpointContinuation = formatBridgeContinuation(
        payload?.continuity ?? payload?.checkpoint ?? null,
      );

      setFeedback({
        tone: "success",
        message: checkpointContinuation
          ? `Quick coordination checkpoint saved. ${checkpointContinuation}`
          : externalStatus === "confirmed"
            ? "Confirmation update saved and the current promised checkpoint was cleared."
            : suggestedPreset
              ? `Quick coordination checkpoint saved with ${suggestedPreset.label} loaded as the next checkpoint.`
              : "Quick coordination checkpoint saved.",
      });
      clearSavedWritebackDraft(appointment.id);
      refreshIntoAppointmentFocus(
        payload?.appointment?.id ?? appointment.id,
        getCalendarViewAfterMutation(
          getCalendarViewForWritebackReentry({
            status: externalStatus,
            hasBridgeActivity: appointment.hasBridgeActivity,
            nextActionAtValue: nextActionAt,
          }) ?? undefined,
        ),
        () => {
          setIsSaving(false);
        },
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not update the external appointment state.",
      });
      setIsSaving(false);
    }
  }

  async function handleTouchPresetSave(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    preset: AppointmentTouchPreset,
  ) {
    const draft = readWritebackDraft(appointment, writebackDrafts);

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/agent/appointments/${appointment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            externalStatus:
              draft.status === "idle" ? preset.suggestedStatus : draft.status,
            externalNote: draft.note.trim(),
            externalNextActionAt: toIsoDateTime(preset.nextActionAtValue),
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMutationResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not save the follow-up rhythm preset.",
          ),
        });
        setIsSaving(false);
        return;
      }

      const checkpointContinuation = formatBridgeContinuation(
        payload?.continuity ?? payload?.checkpoint ?? null,
      );

      setFeedback({
        tone: "success",
        message: checkpointContinuation
          ? `Checkpoint preset saved. ${checkpointContinuation}`
          : `${preset.label} saved to Acre as the next promised checkpoint.`,
      });
      clearSavedWritebackDraft(appointment.id);
      refreshIntoAppointmentFocus(
        payload?.appointment?.id ?? appointment.id,
        getCalendarViewAfterMutation(
          getCalendarViewForWritebackReentry({
            status:
              draft.status === "idle" ? preset.suggestedStatus : draft.status,
            hasBridgeActivity: appointment.hasBridgeActivity,
            nextActionAtValue: preset.nextActionAtValue,
          }) ?? undefined,
        ),
        () => {
          setIsSaving(false);
        },
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not save the follow-up rhythm preset.",
      });
      setIsSaving(false);
    }
  }

  async function tryOpenAppointmentMailThread(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  ) {
    try {
      const response = await fetch(
        `/api/agent/appointments/${appointment.id}/mail-thread`,
        {
          cache: "no-store",
          method: "POST",
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AppointmentMailThreadResponse;

      if (!response.ok || !payload?.threadHref) {
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 409
        ) {
          return false;
        }

        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not open the Acre email draft.",
          ),
        });
        return true;
      }

      const opened = window.open(
        payload.threadHref,
        "_blank",
        "noopener,noreferrer",
      );

      if (!opened) {
        window.location.assign(payload.threadHref);
      }

      const returnLinkLabel =
        payload.actionTargetLabel ??
        payload.continuity?.returnToLabel ??
        "Back to appointment";

      setFeedback({
        tone: "success",
        message: [
          `${payload.actionLabel ?? "Email draft"} opened.`,
          payload.continuity?.detail ??
            "Acre prepared the appointment brief and logged the action here so the next step stays visible on this appointment.",
          payload.manualOnlyDetail ?? "The external email still stays manual.",
          payload.continuity?.nextStep ??
            "Open the draft, review the brief, then return to the appointment and save the next step.",
          payload.continuity?.returnToDetail ?? null,
          (payload.continuity?.returnToUrl ?? payload.actionTargetUrl)
            ? `Return link preserved: ${returnLinkLabel}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
        actionHref:
          payload.continuity?.returnToUrl ??
          payload.actionTargetUrl ??
          undefined,
        actionLabel: returnLinkLabel,
      });
      return true;
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not open the Acre email draft.",
      });
      return true;
    }
  }

  async function handleBridgeAction(
    appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
    action: FrontOfficeAppointmentBridgeAction,
  ) {
    setFeedback(null);
    setBridgeState({
      appointmentId: appointment.id,
      action,
    });

    if (action === "email_brief") {
      const shouldFallbackToExternalBrief =
        await tryOpenAppointmentMailThread(appointment);

      if (!shouldFallbackToExternalBrief) {
        return;
      }
    }

    try {
      const response = await fetch(
        `/api/agent/appointments/${appointment.id}/bridge?action=${action}&format=json`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as BridgeActionResponse | null;

      if (!response.ok || !payload) {
        setFeedback({
          tone: "error",
          message: buildApiErrorMessage(
            payload,
            "Could not open the external draft.",
          ),
        });
        return;
      }

      const checkpoint = payload.checkpoint;
      const continuity =
        payload.continuity ??
        (checkpoint
          ? {
              ...checkpoint,
              returnToLabel: "Back to appointment",
              returnToDetail:
                "Return to the same appointment after the draft or export finishes, then save the next step in Acre.",
            }
          : null);

      if (payload.result.kind === "redirect") {
        const opened = window.open(
          payload.result.href,
          "_blank",
          "noopener,noreferrer",
        );

        if (!opened) {
          window.location.assign(payload.result.href);
        }
      } else {
        downloadCalendarExport(payload.result.fileName, payload.result.content);
      }

      const primedPresetLabel =
        primeWritebackDraftFromBridgeSuggestion(
          appointment,
          payload.suggestedWriteback,
        ) ?? primeWritebackDraftAfterBridge(appointment);

      setFeedback({
        tone: "success",
        message: [
          `${payload.actionLabel} opened.`,
          continuity ? `Checkpoint: ${continuity.label}.` : null,
          continuity?.detail ??
            checkpoint?.detail ??
            payload.followUpCadenceDetail ??
            payload.followUpDetail ??
            null,
          continuity?.nextStep ??
            checkpoint?.nextStep ??
            payload.followUpDetail ??
            null,
          continuity?.returnToDetail ?? null,
          primedPresetLabel
            ? `${primedPresetLabel} is already loaded as the next saved step.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setBridgeOutcome({
        appointmentId: appointment.id,
        actionLabel: payload.actionLabel,
        manualOnlyDetail:
          payload.manualOnlyDetail ?? "This action was recorded here only.",
        followUpDetail:
          payload.followUpDetail ?? "Save the checkpoint form below.",
        followUpCadenceLabel:
          checkpoint?.label ??
          payload.followUpCadenceLabel ??
          payload.suggestedWriteback?.label ??
          payload.actionLabel,
        followUpCadenceDetail:
          checkpoint?.nextStep ??
          payload.followUpCadenceDetail ??
          payload.followUpDetail ??
          "Save the checkpoint form below.",
        resultKind: payload.result.kind,
        checkpoint: checkpoint ?? {
          label:
            payload.followUpCadenceLabel ??
            payload.suggestedWriteback?.label ??
            payload.actionLabel,
          detail:
            payload.followUpCadenceDetail ??
            payload.followUpDetail ??
            "Save the checkpoint form below.",
          nextStep: payload.followUpDetail ?? "Save the checkpoint form below.",
          sourceNote:
            payload.manualOnlyDetail ?? "This action was recorded here only.",
        },
        continuity,
        suggestedWriteback: payload.suggestedWriteback ?? null,
      });
      refreshIntoAppointmentFocus(
        appointment.id,
        getCalendarViewAfterMutation(
          getCalendarViewForWritebackReentry({
            status:
              payload.suggestedWriteback?.status ??
              (appointment.externalStatusValue === "idle"
                ? "idle"
                : appointment.externalStatusValue),
            hasBridgeActivity: true,
            nextActionAtValue: payload.suggestedWriteback?.nextActionAtValue,
          }) ?? "bridge_logged",
        ),
      );
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not open the external draft.",
      });
    } finally {
      setBridgeState(null);
    }
  }

  return (
    <>
      <SectionCard
        className="office-list-card"
        subtitle={
          isZh
            ? "无需离开 Front Office 就能安排带看、咨询和客户会面。共享办公室事项仍会继续显示在仪表盘里。"
            : "Schedule showings, consultations, and client meetings without leaving Front Office. Shared office events still remain visible on the dashboard."
        }
        title={isZh ? "安排预约" : "Schedule appointment"}
      >
        <form
          className="front-office-calendar-form"
          id="calendar-schedule-form"
          onSubmit={handleSubmit}
        >
          <div className="office-form-grid">
            <FormField
              className="office-form-grid-span-2"
              label={isZh ? "标题" : "Title"}
              helper={
                isZh
                  ? "可选。留空时会根据类型 + 客户或房源自动命名。"
                  : "Optional. Leave blank to auto-name from type + client or listing."
              }
            >
              <TextInput
                name="title"
                onChange={handleFieldChange}
                placeholder={
                  isZh
                    ? "带看 · 张三 · 123 Main St"
                    : "Showing · John Doe · 123 Main St"
                }
                value={formState.title}
              />
            </FormField>

            <FormField label={isZh ? "类型" : "Type"}>
              <SelectInput
                name="type"
                onChange={handleFieldChange}
                value={formState.type}
              >
                {props.snapshot.typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label={isZh ? "客户" : "Client"}>
              <SelectInput
                name="clientId"
                onChange={handleFieldChange}
                value={formState.clientId}
              >
                <option value="">
                  {isZh ? "未关联客户" : "No client linked"}
                </option>
                {props.snapshot.clientOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField
              className="office-form-grid-span-2"
              label={isZh ? "房源" : "Listing"}
            >
              <SelectInput
                name="listingId"
                onChange={handleFieldChange}
                value={formState.listingId}
              >
                <option value="">
                  {isZh ? "未关联房源" : "No listing linked"}
                </option>
                {props.snapshot.listingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label={isZh ? "开始" : "Start"}>
              <TextInput
                name="startsAt"
                onChange={handleFieldChange}
                type="datetime-local"
                value={formState.startsAt}
              />
            </FormField>

            <FormField label={isZh ? "结束" : "End"}>
              <TextInput
                name="endsAt"
                onChange={handleFieldChange}
                type="datetime-local"
                value={formState.endsAt}
              />
            </FormField>

            <FormField
              label={isZh ? "地点" : "Location"}
              helper={
                isZh
                  ? "街道地址、大楼或场地名称。"
                  : "Street address, building, or venue name."
              }
            >
              <TextInput
                name="location"
                onChange={handleFieldChange}
                placeholder="123 Main St, Brooklyn"
                value={formState.location}
              />
            </FormField>

            <FormField
              label={isZh ? "会议链接" : "Meeting link"}
              helper={
                isZh
                  ? "粘贴完整 URL，或像 meet.google.com/abc 这样的 host。Acre 会为草稿工具和 ICS 导出做规范化。"
                  : "Paste the full URL or a host like meet.google.com/abc. Acre will normalize it for the draft tools and ICS export."
              }
            >
              <TextInput
                name="meetingUrl"
                onChange={handleFieldChange}
                placeholder="https://meet.google.com/..."
                value={formState.meetingUrl}
              />
            </FormField>

            <FormField
              label={isZh ? "外部联系人" : "External contact"}
              helper={
                isZh
                  ? "如果参加者不是已关联的客户记录，就填这里。若你希望启用邮件简报和 Acre 邮件草稿，也请在这里带上邮箱。"
                  : "Use this if the attendee is not the linked client record. Include an email here if you want the email brief and Acre email draft available."
              }
            >
              <TextInput
                name="contactLabel"
                onChange={handleFieldChange}
                placeholder="Leasing office · leasing@example.com · 212-555-0199"
                value={formState.contactLabel}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-2"
              label={isZh ? "内部备注" : "Internal notes"}
            >
              <TextareaInput
                name="notes"
                onChange={handleFieldChange}
                placeholder={
                  isZh
                    ? "停车说明、门禁码、准备备注或后续跟进提醒。"
                    : "Parking instructions, gate code, prep notes, or follow-up reminders."
                }
                rows={4}
                value={formState.notes}
              />
            </FormField>
          </div>

          {feedback ? (
            <div
              className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
            >
              <p>{feedback.message}</p>
              {feedback.actionHref ? (
                <div className="front-office-calendar-actions">
                  <FrontOfficeLink
                    className="office-button-secondary office-inline-action-sm"
                    href={feedback.actionHref}
                  >
                    {feedback.actionLabel ??
                      (isZh ? "返回预约" : "Return to appointment")}
                  </FrontOfficeLink>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="office-form-actions">
            <button className="office-button" disabled={isBusy} type="submit">
              {isBusy
                ? isZh
                  ? "保存中..."
                  : "Saving..."
                : isZh
                  ? "安排预约"
                  : "Schedule appointment"}
            </button>
            <button
              className="office-button-secondary"
              disabled={isBusy}
              onClick={resetForm}
              type="button"
            >
              {isZh ? "重置表单" : "Reset form"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={
          isZh
            ? "日历视图和筛选条件都会保留在链接里，因此你可以直接重新打开同一段外部协调视图，而不必重建整个页面。"
            : "Calendar view and filters stay in the link so you can reopen the same external-coordination view without rebuilding the page."
        }
        title={isZh ? "队列筛选" : "Queue filters"}
      >
        <div className="office-form-grid">
          <FormField label={isZh ? "日历视图" : "Calendar view"}>
            <SelectInput
              onChange={(event) =>
                navigateToCalendarView(resolveCalendarView(event.target.value))
              }
              value={filterState.calendarView}
            >
              {calendarViewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "客户" : "Client"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  clientId: event.target.value,
                  listingId: filterState.listingId,
                  appointmentId: "",
                })
              }
              value={filterState.clientId}
            >
              <option value="">
                {isZh ? "全部可见客户" : "All visible clients"}
              </option>
              {filterState.clientId && !selectedClientOption ? (
                <option value={filterState.clientId}>
                  {selectedClientLabel}
                </option>
              ) : null}
              {props.snapshot.clientOptions.map((option) => (
                <option key={`filter-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "房源" : "Listing"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  listingId: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.listingId}
            >
              <option value="">
                {isZh ? "全部可见房源" : "All visible listings"}
              </option>
              {filterState.listingId && !selectedListingOption ? (
                <option value={filterState.listingId}>
                  {selectedListingLabel}
                </option>
              ) : null}
              {props.snapshot.listingOptions.map((option) => (
                <option key={`listing-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "预约类型" : "Appointment type"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  type: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.type}
            >
              <option value="">
                {isZh ? "全部预约类型" : "All appointment types"}
              </option>
              {props.snapshot.typeOptions.map((option) => (
                <option key={`type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "Acre 状态" : "Acre status"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  status: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.status}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "跟进节奏" : "Follow-up rhythm"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  followUp: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.followUp}
            >
              {followUpFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "协调状态" : "Coordination state"}>
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  coordination: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.coordination}
            >
              {coordinationFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <div className="front-office-ai-explainability is-compact">
          <div className="front-office-ai-explainability-block">
            <span className="front-office-ai-explainability-kicker">
              {isZh ? "当前筛选" : "Current filters"}
            </span>
            <strong>{routeStateHeading}</strong>
            <p>{routeStateDescriptionParts.join(" ")}</p>
            <div className="front-office-record-meta">
              {routeStateMeta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="front-office-ai-explainability-card">
            <span className="front-office-ai-explainability-kicker">
              {isZh ? "保存的返回路径" : "Saved return path"}
            </span>
            <strong>
              {returnToLabel ||
                (isZh
                  ? "当前没有附带返回路径"
                  : "No return path is currently attached")}
            </strong>
            <p>
              {isZh ? (
                <>
                  预约焦点和当前筛选条件都会保留在 URL 里。如果别的 Front Office
                  页面带来了安全的相对
                  <code>returnTo</code>
                  ，这里会在你继续细化队列时把它保留下来。
                </>
              ) : (
                <>
                  Appointment focus and active filters stay in the URL. If a
                  safe relative <code>returnTo</code> comes in from another
                  Front Office page, this view keeps it while you refine the
                  queue.
                </>
              )}
            </p>
            <div className="front-office-calendar-actions">
              {filterState.returnTo ? (
                <FrontOfficeLink
                  className="office-button-secondary office-inline-action-sm"
                  href={filterState.returnTo}
                >
                  {returnToLabel}
                </FrontOfficeLink>
              ) : null}
              {filterState.appointmentId ? (
                <Button
                  disabled={isBusy}
                  onClick={clearFocusLock}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "取消固定预约" : "Clear pinned appointment"}
                </Button>
              ) : null}
              {hasQueueFilters ? (
                <Button
                  disabled={isBusy}
                  onClick={clearQueueFilters}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "清除队列筛选" : "Clear queue filters"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="front-office-calendar-badges">
          <Badge tone="accent">
            {isZh
              ? `显示 ${props.snapshot.filteredSummary.appointmentCount} 条`
              : `Showing ${props.snapshot.filteredSummary.appointmentCount}`}
          </Badge>
          <Badge tone="warning">
            {isZh
              ? `待回复 ${props.snapshot.filteredSummary.awaitingReplyCount}`
              : `Reply due ${props.snapshot.filteredSummary.awaitingReplyCount}`}
          </Badge>
          <Badge tone="accent">
            {isZh ? "待确认 " : "Confirmation pending "}
            {props.snapshot.filteredSummary.confirmationPendingCount}
          </Badge>
          <Badge tone="danger">
            {isZh
              ? `触达已到期 ${props.snapshot.filteredSummary.touchDueCount}`
              : `Touch due ${props.snapshot.filteredSummary.touchDueCount}`}
          </Badge>
          <Badge tone="accent">
            {isZh
              ? `已安排触达 ${props.snapshot.filteredSummary.touchScheduledCount}`
              : `Touch scheduled ${props.snapshot.filteredSummary.touchScheduledCount}`}
          </Badge>
          <Badge tone="danger">
            {isZh
              ? `改期 ${props.snapshot.filteredSummary.rescheduleRequestedCount}`
              : `Reschedule ${props.snapshot.filteredSummary.rescheduleRequestedCount}`}
          </Badge>
          <Badge tone="warning">
            {isZh ? "缺少下次触达 " : "Missing next touch "}
            {props.snapshot.filteredSummary.missingTouchPlanCount}
          </Badge>
          <Badge tone="success">
            {isZh
              ? `已确认 ${props.snapshot.filteredSummary.confirmedCount}`
              : `Confirmed ${props.snapshot.filteredSummary.confirmedCount}`}
          </Badge>
          <Badge tone="warning">
            {isZh
              ? `已打开草稿 ${props.snapshot.filteredSummary.bridgePendingCount}`
              : `Draft opened ${props.snapshot.filteredSummary.bridgePendingCount}`}
          </Badge>
          <Badge tone="warning">
            {isZh ? "待保存更新" : "Update not saved"}{" "}
            {props.snapshot.filteredSummary.writebackPendingCount}
          </Badge>
        </div>

        <div className="front-office-calendar-actions">
          <Button
            onClick={() => navigateToCalendarView("day")}
            size="sm"
            variant={
              filterState.calendarView === "day" ? "primary" : "secondary"
            }
          >
            {isZh ? "日视图" : "Day agenda"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("week")}
            size="sm"
            variant={
              filterState.calendarView === "week" ? "primary" : "secondary"
            }
          >
            {isZh ? "周视图" : "Week agenda"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("reply_due")}
            size="sm"
            variant={
              filterState.calendarView === "reply_due" ? "primary" : "secondary"
            }
          >
            {isZh ? "待回复" : "Reply due"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("confirmation_pending")}
            size="sm"
            variant={
              filterState.calendarView === "confirmation_pending"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "待确认" : "Confirmation pending"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("touch_due")}
            size="sm"
            variant={
              filterState.calendarView === "touch_due" ? "primary" : "secondary"
            }
          >
            {isZh ? "触达已到期" : "Touch due"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("touch_scheduled")}
            size="sm"
            variant={
              filterState.calendarView === "touch_scheduled"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "已安排触达" : "Touch scheduled"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("missing_next_touch")}
            size="sm"
            variant={
              filterState.calendarView === "missing_next_touch"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "缺少下次触达" : "Missing next touch"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("reschedule_requested")}
            size="sm"
            variant={
              filterState.calendarView === "reschedule_requested"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "请求改期" : "Reschedule requested"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("confirmed")}
            size="sm"
            variant={
              filterState.calendarView === "confirmed" ? "primary" : "secondary"
            }
          >
            {isZh ? "外部已确认" : "Externally confirmed"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("bridge_logged")}
            size="sm"
            variant={
              filterState.calendarView === "bridge_logged"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "已打开草稿" : "Draft opened"}
          </Button>
          <Button
            onClick={() => navigateToCalendarView("writeback_pending")}
            size="sm"
            variant={
              filterState.calendarView === "writeback_pending"
                ? "primary"
                : "secondary"
            }
          >
            {isZh ? "待保存更新" : "Update not saved"}
          </Button>
        </div>

        <div className="office-form-actions">
          <button
            className="office-button-secondary"
            disabled={isBusy || !hasQueueFilters}
            onClick={clearQueueFilters}
            type="button"
          >
            {isZh ? "清除筛选" : "Clear filters"}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={
          isZh
            ? "在这个焦点面板里查看外部草稿、更新下一步状态，并让承诺中的下一次触达保持清晰可见。"
            : "Use the focused panel to review external drafts, update the next step, and keep the promised follow-up clearly visible."
        }
        title={isZh ? "焦点预约" : "Focus appointment"}
      >
        {focusedAppointment ? (
          <>
            <div className="front-office-ai-explainability is-compact">
              <div className="front-office-ai-explainability-block">
                <span className="front-office-ai-explainability-kicker">
                  Focus context
                </span>
                <strong>
                  {focusState.mode === "default"
                    ? "The detail panel is following the next visible appointment by default."
                    : focusState.mode === "locked_outside_queue"
                      ? "This appointment is pinned even though the current filters hide it."
                      : "This appointment is pinned directly in the URL."}
                </strong>
                <p>
                  {selectedClientLabel
                    ? `Client filter is currently ${selectedClientLabel}. `
                    : "The client filter is still broad. "}
                  {filterState.appointmentId
                    ? "This appointment stays pinned until you clear it."
                    : "Pin a specific appointment if you want a durable link back to this same detail panel."}
                </p>
                <div className="front-office-record-meta">
                  <span>{focusedAppointment.clientLabel}</span>
                  <span>{focusedAppointment.typeLabel}</span>
                  <span>{focusedAppointment.startsAtLabel}</span>
                </div>
              </div>
              <div className="front-office-ai-explainability-card">
                <span className="front-office-ai-explainability-kicker">
                  Saved return link
                </span>
                <strong>
                  {returnToLabel || "No return link was supplied"}
                </strong>
                <p>
                  {returnToLabel
                    ? "Use the saved return link to step back without losing the filters you reopened here."
                    : "Direct visits can still move through the client page, listing output, or a pinned appointment link from here."}
                </p>
                <div className="front-office-calendar-actions">
                  {filterState.returnTo ? (
                    <FrontOfficeLink
                      className="office-button-secondary office-inline-action-sm"
                      href={filterState.returnTo}
                    >
                      {returnToLabel}
                    </FrontOfficeLink>
                  ) : null}
                  {filterState.appointmentId ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearFocusLock}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "取消固定预约" : "Clear pinned appointment"}
                    </Button>
                  ) : null}
                  {hasQueueFilters ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearQueueFilters}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "清除队列筛选" : "Clear queue filters"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <article className="list-row front-office-record tone-accent">
              <div className="list-row-top front-office-record-head">
                <div>
                  <strong>{focusedAppointment.title}</strong>
                  <p>{focusedAppointment.startsAtLabel}</p>
                </div>
                <div className="front-office-calendar-badges">
                  <Badge tone={focusedAppointment.typeTone}>
                    {focusedAppointment.typeLabel}
                  </Badge>
                  <StatusBadge tone={focusedAppointment.statusTone}>
                    {focusedAppointment.statusLabel}
                  </StatusBadge>
                  <Badge tone={focusedAppointment.reminderTone}>
                    {focusedAppointment.reminderLabel}
                  </Badge>
                  <StatusBadge tone={focusedAppointment.externalStatusTone}>
                    {focusedAppointment.externalStatusLabel}
                  </StatusBadge>
                  <StatusBadge tone={focusedAppointment.coordinationTone}>
                    {focusedAppointment.coordinationLabel}
                  </StatusBadge>
                  <Badge tone={focusedAppointment.calendarLaneTone}>
                    {focusedAppointment.calendarLaneLabel}
                  </Badge>
                  <Badge tone={focusedAppointment.nextTouchPressureTone}>
                    {focusedAppointment.nextTouchPressureLabel}
                  </Badge>
                </div>
              </div>

              <div className="list-row-meta front-office-record-meta">
                <span>
                  {isZh
                    ? `结束 ${focusedAppointment.endsAtLabel}`
                    : `Ends ${focusedAppointment.endsAtLabel}`}
                </span>
                <span>{focusedAppointment.clientLabel}</span>
                <span>{focusedAppointment.clientEmailLabel}</span>
                <span>{focusedAppointment.contactLabel}</span>
                <span>{focusedAppointment.listingLabel}</span>
                <span>{focusedAppointment.locationLabel}</span>
                <span>{focusedAppointment.bridgeLoggedAtLabel}</span>
              </div>

              <p>{focusedAppointment.notesLabel}</p>
              <p className="front-office-record-supporting">
                {focusedAppointment.calendarLaneDetail}
              </p>
              <p className="front-office-record-supporting">
                {isZh ? "下一步：" : "Next move: "}
                {focusedAppointment.coordinationNextStep}
              </p>
              {focusedCueList.length ? (
                <div className="front-office-calendar-badges">
                  {focusedCueList.map((cue) => (
                    <Badge
                      key={`${focusedAppointment.id}-${cue.label}`}
                      tone={cue.tone}
                    >
                      {cue.label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </article>

            <div className="office-queue-list">
              <QueueItem
                badgeLabel={focusedAppointment.calendarLaneLabel}
                badgeTone={focusedAppointment.calendarLaneTone}
                description={focusedAppointment.calendarLaneDetail}
                meta={
                  <>
                    <span>{focusedAppointment.bridgeStatusLabel}</span>
                    <span>{focusedAppointment.latestCoordinationDetail}</span>
                  </>
                }
                title={isZh ? "协调状态" : "Coordination status"}
              />
              <QueueItem
                badgeLabel={focusedAppointment.nextTouchPressureLabel}
                badgeTone={focusedAppointment.nextTouchPressureTone}
                description={focusedAppointment.nextTouchPressureDetail}
                meta={
                  <>
                    <span>{focusedAppointment.externalNextActionAtLabel}</span>
                    <span>
                      {isZh ? "下一步：" : "Next move: "}
                      {focusedAppointment.coordinationNextStep}
                    </span>
                  </>
                }
                title={isZh ? "下一步状态" : "Next step status"}
              />
            </div>

            <div className="front-office-calendar-actions">
              {focusedAppointment.clientHref ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={buildContextAwareHref(
                    focusedAppointment.clientHref,
                    focusedAppointment.id,
                  )}
                >
                  {isZh ? "打开客户页" : "Open client page"}
                </FrontOfficeLink>
              ) : null}
              {focusedAppointment.listingOutputHref ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={buildContextAwareHref(
                    focusedAppointment.listingOutputHref,
                    focusedAppointment.id,
                  )}
                >
                  {isZh ? "打开房源输出" : "Open listing output"}
                </FrontOfficeLink>
              ) : null}
              {filterState.appointmentId ? (
                <Button
                  disabled={isBusy}
                  onClick={clearFocusLock}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "取消固定预约" : "Clear pinned appointment"}
                </Button>
              ) : null}
            </div>

            {focusedAppointment.statusValue === "scheduled" ? (
              <>
                <div className="front-office-ai-explainability is-compact">
                  <div className="front-office-ai-explainability-card">
                    <span className="front-office-ai-explainability-kicker">
                      {isZh ? "外部草稿" : "External draft"}
                    </span>
                    <strong>{focusedAppointment.bridgeActionLabel}</strong>
                    <p>
                      {isZh
                        ? "Google、Outlook、ICS 和邮件动作都只会从这条预约打开草稿或导出，并把这次动作记录在这里。下一步仍然是回到这条预约，把待回复、待确认、改期或已安排触达等状态更新回 Acre。"
                        : "Google, Outlook, ICS, and email actions only open drafts or exports from this appointment and record that action here. The next move is still to return to this appointment and save the reply, confirmation, reschedule, or next-touch update back into Acre."}
                    </p>
                    <div className="front-office-record-meta">
                      <span>{focusedAppointment.bridgeStatusLabel}</span>
                      <span>{focusedAppointment.bridgeLoggedAtLabel}</span>
                    </div>
                  </div>
                  <div className="front-office-ai-explainability-card">
                    <span className="front-office-ai-explainability-kicker">
                      {isZh ? "下一步状态" : "Next step status"}
                    </span>
                    <strong>{focusedAppointment.externalStatusLabel}</strong>
                    <p>
                      {isZh
                        ? "快捷协调动作和已保存的更新只会更新 Acre 可读的预约记录。下一步是把承诺中的下一次触达继续保留在这条预约里。它们不会自动发邮件，也不会替你安排外部日历事件。"
                        : "Quick coordination actions and saved updates only change Acre's readable appointment record. The next move is to keep the promised next step visible on this same appointment. They do not auto-send email or schedule outside calendar events for you."}
                    </p>
                    <div className="front-office-record-meta">
                      <span>{focusedAppointment.followUpPlanLabel}</span>
                      <span>
                        {focusedAppointment.externalNextActionAtLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="front-office-calendar-actions">
                  <p className="front-office-record-supporting">
                    {isZh
                      ? "这些动作会在新标签页里打开草稿或导出。下面的历史会记录你从 Acre 打开了什么，下一步仍然是回到这里，把更新写回这条预约。"
                      : "These actions open a draft or export in a new tab. The history below records what you opened from Acre, and the next move is still to return here and save the update on this appointment."}
                  </p>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={
                      bridgeState?.appointmentId === focusedAppointment.id
                    }
                    onClick={() =>
                      handleBridgeAction(focusedAppointment, "google_calendar")
                    }
                    type="button"
                  >
                    {bridgeState?.appointmentId === focusedAppointment.id &&
                    bridgeState.action === "google_calendar"
                      ? "Opening..."
                      : isZh
                        ? "打开 Google 草稿"
                        : "Open Google draft"}
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={
                      bridgeState?.appointmentId === focusedAppointment.id
                    }
                    onClick={() =>
                      handleBridgeAction(focusedAppointment, "outlook_calendar")
                    }
                    type="button"
                  >
                    {bridgeState?.appointmentId === focusedAppointment.id &&
                    bridgeState.action === "outlook_calendar"
                      ? "Opening..."
                      : isZh
                        ? "打开 Outlook 草稿"
                        : "Open Outlook draft"}
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={
                      bridgeState?.appointmentId === focusedAppointment.id
                    }
                    onClick={() =>
                      handleBridgeAction(focusedAppointment, "ics_download")
                    }
                    type="button"
                  >
                    {bridgeState?.appointmentId === focusedAppointment.id &&
                    bridgeState.action === "ics_download"
                      ? "Preparing..."
                      : isZh
                        ? "下载 ICS"
                        : "Download ICS"}
                  </button>
                  {focusedAppointment.emailBriefHref ? (
                    <button
                      className="office-button-secondary office-inline-action-sm"
                      disabled={
                        bridgeState?.appointmentId === focusedAppointment.id
                      }
                      onClick={() =>
                        handleBridgeAction(focusedAppointment, "email_brief")
                      }
                      type="button"
                    >
                      {bridgeState?.appointmentId === focusedAppointment.id &&
                      bridgeState.action === "email_brief"
                        ? "Opening..."
                        : isZh
                          ? "打开 Acre 邮件草稿"
                          : "Open Acre email draft"}
                    </button>
                  ) : (
                    <p className="front-office-record-supporting">
                      {isZh
                        ? "这条预约还没有保存邮件目标，因此 Acre 邮件草稿暂时不可用。"
                        : "No email target is saved on this appointment yet, so the Acre email draft is not available."}
                    </p>
                  )}
                </div>

                {bridgeOutcome &&
                bridgeOutcome.appointmentId === focusedAppointment.id ? (
                  <QueueItem
                    action={
                      <div className="front-office-calendar-actions">
                        <Button
                          disabled={isBusy}
                          onClick={scrollToWritebackSection}
                          size="sm"
                          variant="secondary"
                        >
                          {isZh ? "跳到更新表单" : "Jump to update form"}
                        </Button>
                        {bridgeOutcome.suggestedWriteback ? (
                          <Button
                            disabled={isBusy}
                            onClick={() =>
                              loadSuggestedBridgeWriteback(
                                focusedAppointment,
                                bridgeOutcome.suggestedWriteback,
                              )
                            }
                            size="sm"
                            variant="secondary"
                          >
                            {isZh
                              ? "载入建议检查点"
                              : "Load suggested checkpoint"}
                          </Button>
                        ) : null}
                      </div>
                    }
                    badgeLabel={
                      bridgeOutcome.continuity?.label ??
                      bridgeOutcome.checkpoint.label ??
                      bridgeOutcome.followUpCadenceLabel ??
                      bridgeOutcome.suggestedWriteback?.label ??
                      bridgeOutcome.actionLabel
                    }
                    badgeTone={
                      bridgeOutcome.resultKind === "calendar_export"
                        ? "accent"
                        : "warning"
                    }
                    description={
                      bridgeOutcome.continuity?.detail ??
                      bridgeOutcome.checkpoint.detail
                    }
                    meta={
                      <>
                        <span>
                          {bridgeOutcome.continuity?.sourceNote ??
                            bridgeOutcome.checkpoint.sourceNote}
                        </span>
                        <span>
                          {isZh ? "下一步：" : "Next move: "}
                          {bridgeOutcome.continuity?.nextStep ??
                            bridgeOutcome.checkpoint.nextStep}
                        </span>
                        <span>
                          {bridgeOutcome.continuity?.returnToLabel ??
                            (isZh ? "返回预约" : "Back to appointment")}
                        </span>
                        <span>
                          {bridgeOutcome.continuity?.returnToDetail ??
                            (isZh
                              ? "在草稿或导出完成后跳回同一条预约，然后把下一步保存到 Acre。"
                              : "Return to the same appointment after the draft or export finishes, then save the next step in Acre.")}
                        </span>
                        <span>
                          {bridgeOutcome.resultKind === "calendar_export"
                            ? "ICS export logged"
                            : "Draft opened in a new tab"}
                        </span>
                      </>
                    }
                    title={isZh ? "打开草稿后" : "After opening the draft"}
                  />
                ) : null}

                <div className="front-office-calendar-writeback">
                  <div className="front-office-calendar-writeback-head">
                    <span className="front-office-calendar-writeback-label">
                      Quick updates
                    </span>
                    <p className="front-office-record-supporting">
                      These quick actions only update Acre and keep the next
                      step visible on this same appointment. They do not send
                      mail or change Google or Outlook for you.
                    </p>
                  </div>
                  <div className="front-office-calendar-actions">
                    {quickWritebackActions.map((action) => (
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        key={`${focusedAppointment.id}-${action.value}`}
                        onClick={() =>
                          handleQuickWritebackAction(
                            focusedAppointment,
                            action.value,
                          )
                        }
                        title={action.description}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {focusedAppointment.touchPresets.length ? (
                  <div className="front-office-calendar-writeback">
                    <div className="front-office-calendar-writeback-head">
                      <span className="front-office-calendar-writeback-label">
                        Saved next-step presets
                      </span>
                      <p className="front-office-record-supporting">
                        Use these to save a suggested status plus next-step
                        details directly into Acre. They do not send mail or
                        update Google or Outlook in the background.
                      </p>
                    </div>
                    <div className="front-office-calendar-actions">
                      {focusedAppointment.touchPresets.map((preset) => (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={isBusy}
                          key={`${focusedAppointment.id}-${preset.id}`}
                          onClick={() =>
                            handleTouchPresetSave(focusedAppointment, preset)
                          }
                          title={`${preset.detail} Saved for ${preset.nextActionAtLabel}.`}
                          type="button"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div
                  className="front-office-calendar-writeback"
                  id="calendar-writeback-section"
                >
                  <div className="front-office-calendar-writeback-head">
                    <span className="front-office-calendar-writeback-label">
                      {isZh ? "下一步状态" : "Next step status"}
                    </span>
                    <div className="front-office-calendar-badges">
                      <StatusBadge tone={focusedAppointment.coordinationTone}>
                        {focusedAppointment.coordinationLabel}
                      </StatusBadge>
                      <Badge tone={focusedAppointment.bridgeStatusTone}>
                        {focusedAppointment.bridgeStatusLabel}
                      </Badge>
                    </div>
                    <p className="front-office-record-supporting">
                      {isZh
                        ? "把 Acre 外部发生了什么，以及下一次回复、确认、改期或触达应该何时重新回到这条预约记录里，都保存下来。"
                        : "Save what happened outside Acre and when the next reply, confirmation, reschedule, or follow-up should come back into view on this appointment."}
                    </p>
                  </div>
                  <div className="front-office-calendar-writeback-fields">
                    <SelectInput
                      className="front-office-calendar-writeback-select"
                      onChange={(event) =>
                        handleWritebackDraftChange(
                          focusedAppointment,
                          "status",
                          event.target.value,
                        )
                      }
                      value={focusedWritebackDraft?.status ?? "idle"}
                    >
                      {externalStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                    <TextInput
                      className="front-office-calendar-writeback-next-touch"
                      disabled={focusedWritebackDraft?.status === "idle"}
                      onChange={(event) =>
                        handleWritebackDraftChange(
                          focusedAppointment,
                          "nextActionAt",
                          event.target.value,
                        )
                      }
                      placeholder={
                        isZh ? "下一次外部联系" : "Next external touch"
                      }
                      type="datetime-local"
                      value={focusedWritebackDraft?.nextActionAt ?? ""}
                    />
                    <TextareaInput
                      className="front-office-calendar-writeback-note"
                      disabled={focusedWritebackDraft?.status === "idle"}
                      onChange={(event) =>
                        handleWritebackDraftChange(
                          focusedAppointment,
                          "note",
                          event.target.value,
                        )
                      }
                      placeholder={
                        isZh
                          ? "Acre 外部刚发生了什么，接下来你还在等什么？"
                          : "What happened outside Acre, and what are you waiting on next?"
                      }
                      rows={2}
                      value={focusedWritebackDraft?.note ?? ""}
                    />
                    <div className="front-office-calendar-actions">
                      {focusedAppointment.touchPresets.map((preset) => (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={isBusy}
                          key={`${focusedAppointment.id}-draft-${preset.id}`}
                          onClick={() =>
                            applyTouchPresetDraft(focusedAppointment, preset)
                          }
                          title={`${preset.detail} Loaded for ${preset.nextActionAtLabel}.`}
                          type="button"
                        >
                          {isZh ? "载入" : "Load"} {preset.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="office-button-secondary office-inline-action-sm"
                      disabled={
                        isBusy ||
                        !didWritebackChange(
                          focusedAppointment,
                          focusedWritebackDraft ??
                            buildWritebackDraft(focusedAppointment),
                        )
                      }
                      onClick={() =>
                        handleExternalStatusUpdate(focusedAppointment)
                      }
                      type="button"
                    >
                      {isZh ? "保存更新" : "Save update"}
                    </button>
                  </div>
                </div>

                <div className="front-office-calendar-actions">
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleStatusUpdate(focusedAppointment.id, "completed")
                    }
                    type="button"
                  >
                    {isZh ? "标记完成" : "Mark complete"}
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleStatusUpdate(focusedAppointment.id, "no_show")
                    }
                    type="button"
                  >
                    {isZh ? "未到场" : "No-show"}
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleStatusUpdate(focusedAppointment.id, "canceled")
                    }
                    type="button"
                  >
                    {isZh ? "取消预约" : "Cancel"}
                  </button>
                </div>
              </>
            ) : (
              <p className="front-office-record-supporting">
                {isZh
                  ? "这条预约在 Acre 中已经不再处于已安排状态，因此除非你重新创建预约或在别处重新打开计划，否则这里的外部协调控件会保持只读。"
                  : "This appointment is no longer scheduled in Acre, so the external coordination controls stay read-only here unless you create a new appointment or reopen the plan elsewhere."}
              </p>
            )}

            <div className="office-queue-list">
              <QueueItem
                badgeLabel={`${focusedAppointment.bridgeHistory.length}`}
                badgeTone={
                  focusedAppointment.hasBridgeActivity ? "accent" : "neutral"
                }
                description={
                  latestBridgeHistory
                    ? `${latestBridgeHistory.label} · ${latestBridgeHistory.detail}`
                    : isZh
                      ? "从 Acre 打开 Google、Outlook、ICS 或邮件简报来开始外部草稿；如果你有邮件权限，Acre 会先尝试准备邮件草稿，再回退到外部草稿。"
                      : "Open Google, Outlook, ICS, or the email brief from Acre to start an external draft; if you have mail access, Acre will try to prepare the email draft first and then fall back to the outside draft."
                }
                meta={
                  latestBridgeHistory ? (
                    <>
                      <span>{latestBridgeHistory.actorLabel}</span>
                      <span>{latestBridgeHistory.createdAtLabel}</span>
                    </>
                  ) : (
                    <span>
                      {isZh ? "还没有草稿历史" : "No draft history yet"}
                    </span>
                  )
                }
                title={isZh ? "草稿历史" : "Draft history"}
              />
              <QueueItem
                badgeLabel={`${focusedAppointment.writebackHistory.length}`}
                badgeTone={
                  focusedAppointment.hasWritebackHistory ? "success" : "neutral"
                }
                description={
                  latestWritebackHistory
                    ? `${latestWritebackHistory.label} · ${latestWritebackHistory.detail}`
                    : isZh
                      ? "使用快捷动作或保存更新表单，来创建第一条协调历史记录。"
                      : "Use a quick action or save the update form to create the first coordination history entry."
                }
                meta={
                  latestWritebackHistory ? (
                    <>
                      <span>{latestWritebackHistory.actorLabel}</span>
                      <span>{latestWritebackHistory.createdAtLabel}</span>
                    </>
                  ) : (
                    <span>
                      {isZh ? "还没有更新历史" : "No update history yet"}
                    </span>
                  )
                }
                title={isZh ? "更新历史" : "Update history"}
              />
            </div>

            <div>
              <div className="front-office-calendar-writeback-head">
                <span className="front-office-calendar-writeback-label">
                  {isZh ? "协调时间线" : "Coordination timeline"}
                </span>
                <p className="front-office-record-supporting">
                  {isZh
                    ? "这条预约最近的草稿打开和保存更新都会合并成一条可读的时间线。"
                    : "The latest draft opens and saved updates on this appointment are combined into one readable chronology."}
                </p>
              </div>
              <div className="list-column front-office-record-list">
                {focusedAppointment.coordinationHistory.length ? (
                  focusedAppointment.coordinationHistory.map((item) => (
                    <article
                      className="list-row front-office-record"
                      key={item.id}
                    >
                      <div className="list-row-top front-office-record-head">
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                        </div>
                        <StatusBadge tone={item.tone}>
                          {item.kind === "bridge"
                            ? isZh
                              ? "草稿"
                              : "Draft"
                            : isZh
                              ? "更新"
                              : "Update"}
                        </StatusBadge>
                      </div>
                      <div className="list-row-meta front-office-record-meta">
                        <span>{item.actorLabel}</span>
                        <span>{item.createdAtLabel}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    description={
                      isZh
                        ? "打开一次草稿，或保存一次更新，来为这条预约启动协调时间线。"
                        : "Open a draft or save an update to start the coordination timeline for this appointment."
                    }
                    title={
                      isZh ? "还没有协调历史" : "No coordination history yet"
                    }
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            action={
              <div className="front-office-calendar-actions">
                {focusState.mode === "missing" ? (
                  <Button
                    disabled={isBusy}
                    onClick={clearFocusLock}
                    size="sm"
                    variant="secondary"
                  >
                    {isZh ? "取消固定预约" : "Clear pinned appointment"}
                  </Button>
                ) : null}
                {hasQueueFilters ? (
                  <Button
                    disabled={isBusy}
                    onClick={clearQueueFilters}
                    size="sm"
                    variant="secondary"
                  >
                    {isZh ? "清除队列筛选" : "Clear queue filters"}
                  </Button>
                ) : null}
                <Button
                  onClick={scrollToScheduleForm}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "跳到预约表单" : "Jump to schedule form"}
                </Button>
                {filterState.returnTo ? (
                  <FrontOfficeLink
                    className="office-button-secondary office-inline-action-sm"
                    href={filterState.returnTo}
                  >
                    {returnToLabel}
                  </FrontOfficeLink>
                ) : null}
              </div>
            }
            description={
              focusState.mode === "missing"
                ? isZh
                  ? "这个保存的链接仍然指向一条预约记录，但 Acre 已经无法在你当前可见的 Front Office 范围里解析它。取消固定预约，或退回来源页面。"
                  : "This saved link still points to an appointment, but Acre can no longer resolve it in your visible Front Office scope. Clear the pinned appointment or step back to the source page."
                : selectedClientLabel
                  ? isZh
                    ? `${selectedClientLabel} 当前没有焦点预约。可以使用上方表单在这个客户上下文里创建第一次带看、咨询或会面。`
                    : `No appointment is currently in focus for ${selectedClientLabel}. Use the schedule form above to create the first showing, consultation, or meeting in this client context.`
                  : isZh
                    ? "从下面的队列里挑一条预约，或者如果这个切片还是空的，就用上方表单创建。"
                    : "Pick an appointment from the queue below, or use the schedule form above if this slice is still empty."
            }
            title={
              focusState.mode === "missing"
                ? isZh
                  ? "无法解析当前焦点预约"
                  : "Focused appointment could not be resolved"
                : selectedClientLabel
                  ? isZh
                    ? `${selectedClientLabel} 当前没有焦点预约`
                    : `No focused appointment for ${selectedClientLabel}`
                  : isZh
                    ? "当前没有焦点预约"
                    : "No focused appointment"
            }
          />
        )}
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={
          agendaViewMode
            ? agendaWindowSubtitle
            : isZh
              ? `当前筛选下显示 ${props.snapshot.filteredSummary.appointmentCount} 条预约，紧凑队列会优先强调信号密度，而不是把草稿工具直接内联进来。`
              : `Showing ${props.snapshot.filteredSummary.appointmentCount} appointments in the current filtered view, with the compact queue focused on signal density instead of inline draft tools.`
        }
        title={
          agendaViewMode
            ? agendaWindowTitle
            : isZh
              ? "即将到来的预约"
              : "Upcoming appointments"
        }
      >
        {agendaViewMode ? (
          <div className="front-office-calendar-agenda">
            <div className="front-office-ai-explainability is-compact">
              <div className="front-office-ai-explainability-block">
                <span className="front-office-ai-explainability-kicker">
                  {isZh ? "时间视角" : "Time view"}
                </span>
                <strong>
                  {agendaViewMode === "day"
                    ? isZh
                      ? "今天的预约按开始时间排列。"
                      : "Today's appointments are ordered by start time."
                    : isZh
                      ? "本周的预约按日期分组、按开始时间排列。"
                      : "This week's appointments are grouped by date and ordered by start time."}
                </strong>
                <p>{agendaWindowSubtitle}</p>
                <div className="front-office-record-meta">
                  <span>
                    {isZh
                      ? `显示 ${agendaAppointmentCount} 条预约`
                      : `Showing ${agendaAppointmentCount} appointments`}
                  </span>
                  <span>
                    {isZh
                      ? `当前视角：${agendaWindowTitle}`
                      : `Current view: ${agendaWindowTitle}`}
                  </span>
                  <span>
                    {isZh
                      ? "草稿、更新和时间线仍留在同一条预约上"
                      : "Draft, update, and timeline controls stay on the same appointment"}
                  </span>
                </div>
              </div>
              <div className="front-office-ai-explainability-card">
                <span className="front-office-ai-explainability-kicker">
                  {isZh ? "时间窗口" : "Time window"}
                </span>
                <strong>
                  {agendaSections.length
                    ? `${agendaSections[0]?.label ?? ""}${agendaViewMode === "week" && agendaSections.length > 1 ? ` → ${agendaSections[agendaSections.length - 1]?.label ?? ""}` : ""}`
                    : isZh
                      ? "当前没有可展示的时间段"
                      : "No time window is currently available"}
                </strong>
                <p>
                  {agendaViewMode === "day"
                    ? isZh
                      ? "这是一个真实的单日议程视角，不是概念示意。你仍然可以在同一页打开草稿、载入更新和保存检查点。"
                      : "This is a real single-day agenda view, not just placeholder copy. You can still open draft actions, load updates, and save checkpoints from the same page."
                    : isZh
                      ? "这是一个真实的七日议程视角，不是概念示意。你仍然可以在同一页打开草稿、载入更新和保存检查点。"
                      : "This is a real seven-day agenda view, not just placeholder copy. You can still open draft actions, load updates, and save checkpoints from the same page."}
                </p>
              </div>
            </div>
            <div className="front-office-calendar-agenda-sections">
              {agendaSections.map((section) => (
                <section
                  className="front-office-calendar-agenda-section"
                  key={section.dateKey}
                >
                  <div className="front-office-calendar-writeback-head">
                    <span className="front-office-calendar-writeback-label">
                      {section.label}
                    </span>
                    <p className="front-office-record-supporting">
                      {section.appointments.length
                        ? isZh
                          ? `这一段有 ${section.appointments.length} 条预约按时间排列。`
                          : `${section.appointments.length} appointments are ordered by time in this section.`
                        : isZh
                          ? "这一段目前没有预约。"
                          : "No appointments fall into this section yet."}
                    </p>
                  </div>
                  {section.appointments.length ? (
                    <div className="list-column front-office-record-list">
                      {section.appointments.map((appointment) =>
                        renderAgendaAppointmentRow(appointment, section.label),
                      )}
                    </div>
                  ) : (
                    <EmptyState
                      description={
                        isZh
                          ? "这个时间段里还没有预约。"
                          : "There are no appointments in this time slot yet."
                      }
                      title={isZh ? "空时间段" : "Empty time slot"}
                    />
                  )}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="list-column front-office-record-list">
            {props.snapshot.appointments.length ? (
              props.snapshot.appointments.map((appointment) => {
                const isFocused = focusedAppointment?.id === appointment.id;
                const appointmentCueList = buildAppointmentCueList(appointment);

                return (
                  <article
                    className={`list-row front-office-record${isFocused ? " tone-accent" : ""}`}
                    key={appointment.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{appointment.title}</strong>
                        <p>{appointment.startsAtLabel}</p>
                      </div>
                      <div className="front-office-calendar-badges">
                        <Badge tone={appointment.typeTone}>
                          {appointment.typeLabel}
                        </Badge>
                        <StatusBadge tone={appointment.statusTone}>
                          {appointment.statusLabel}
                        </StatusBadge>
                        <Badge tone={appointment.reminderTone}>
                          {appointment.reminderLabel}
                        </Badge>
                        <StatusBadge tone={appointment.externalStatusTone}>
                          {appointment.externalStatusLabel}
                        </StatusBadge>
                        <StatusBadge tone={appointment.calendarLaneTone}>
                          {appointment.calendarLaneLabel}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="list-row-meta front-office-record-meta">
                      <span>{appointment.clientLabel}</span>
                      <span>{appointment.listingLabel}</span>
                      <span>{appointment.locationLabel}</span>
                      <span>{appointment.externalNextActionAtLabel}</span>
                      <span>{appointment.nextTouchPressureLabel}</span>
                      <span>{appointment.bridgeLoggedAtLabel}</span>
                      <span>{appointment.latestCoordinationLabel}</span>
                      <span>{appointment.latestCoordinationDetail}</span>
                    </div>

                    <p>{appointment.notesLabel}</p>
                    <p className="front-office-record-supporting">
                      {appointment.nextTouchPressureDetail}
                    </p>
                    <p className="front-office-record-supporting">
                      {appointment.calendarLaneDetail}
                    </p>
                    <p className="front-office-record-supporting">
                      {isZh ? "下一步：" : "Next move: "}
                      {appointment.coordinationNextStep}
                    </p>
                    {appointmentCueList.length ? (
                      <div className="front-office-calendar-badges">
                        {appointmentCueList.map((cue) => (
                          <Badge
                            key={`${appointment.id}-${cue.label}`}
                            tone={cue.tone}
                          >
                            {cue.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="front-office-calendar-actions">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={buildCalendarHref(pathname, searchParams, {
                          appointmentId: appointment.id,
                        })}
                      >
                        {isFocused
                          ? isZh
                            ? "下方面板已聚焦"
                            : "Focused below"
                          : isZh
                            ? "在焦点面板中打开"
                            : "Open in focus panel"}
                      </FrontOfficeLink>
                      {appointment.clientHref ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={buildContextAwareHref(
                            appointment.clientHref,
                            appointment.id,
                          )}
                        >
                          {isZh ? "客户页" : "Client page"}
                        </FrontOfficeLink>
                      ) : null}
                      {appointment.listingOutputHref ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={buildContextAwareHref(
                            appointment.listingOutputHref,
                            appointment.id,
                          )}
                        >
                          {isZh ? "房源输出" : "Listing output"}
                        </FrontOfficeLink>
                      ) : null}
                      {appointment.statusValue === "scheduled" ? (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={
                            bridgeState?.appointmentId === appointment.id
                          }
                          onClick={() =>
                            handleBridgeAction(appointment, "google_calendar")
                          }
                          type="button"
                        >
                          {bridgeState?.appointmentId === appointment.id &&
                          bridgeState.action === "google_calendar"
                            ? "Opening..."
                            : isZh
                              ? "Google 草稿"
                              : "Google draft"}
                        </button>
                      ) : null}
                      {appointment.statusValue === "scheduled" &&
                      appointment.externalStatusValue !== "confirmed" ? (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={isBusy}
                          onClick={() =>
                            handleQuickWritebackAction(appointment, "confirmed")
                          }
                          type="button"
                        >
                          {isZh ? "在 Acre 中确认" : "Confirm in Acre"}
                        </button>
                      ) : null}
                      {appointment.statusValue === "scheduled" &&
                      appointment.touchPresets[0] ? (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={isBusy}
                          onClick={() =>
                            handleTouchPresetSave(
                              appointment,
                              appointment.touchPresets[0],
                            )
                          }
                          title={`${appointment.touchPresets[0].detail} Saved for ${appointment.touchPresets[0].nextActionAtLabel}.`}
                          type="button"
                        >
                          {appointment.touchPresets[0].label}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState
                action={
                  <div className="front-office-calendar-actions">
                    {hasQueueFilters ? (
                      <Button
                        disabled={isBusy}
                        onClick={clearQueueFilters}
                        size="sm"
                        variant="secondary"
                      >
                        {isZh ? "清除队列筛选" : "Clear queue filters"}
                      </Button>
                    ) : null}
                    {filterState.appointmentId ? (
                      <Button
                        disabled={isBusy}
                        onClick={clearFocusLock}
                        size="sm"
                        variant="secondary"
                      >
                        {isZh ? "取消固定预约" : "Clear pinned appointment"}
                      </Button>
                    ) : null}
                    <Button
                      onClick={scrollToScheduleForm}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "跳到预约表单" : "Jump to schedule form"}
                    </Button>
                    {filterState.returnTo ? (
                      <FrontOfficeLink
                        className="office-button-secondary office-inline-action-sm"
                        href={filterState.returnTo}
                      >
                        {returnToLabel}
                      </FrontOfficeLink>
                    ) : null}
                  </div>
                }
                description={
                  focusState.mode === "locked_outside_queue"
                    ? isZh
                      ? "上面固定的预约仍然可读，但当前队列筛选让这个列表保持为空。"
                      : "The appointment pinned above is still readable, but the current queue filters leave this list empty."
                    : selectedClientLabel
                      ? isZh
                        ? `${selectedClientLabel} 在这个路由切片里暂时还没有可见预约。`
                        : `There are no visible appointments for ${selectedClientLabel} in this route slice yet.`
                      : hasQueueFilters
                        ? isZh
                          ? "当前路由筛选暂时匹配不到任何可见预约。"
                          : "The current route filters do not match any visible appointments right now."
                        : isZh
                          ? "用上面的表单安排第一次带看、咨询或客户会面。"
                          : "Schedule the first showing, consultation, or client meeting from the form above."
                }
                title={
                  selectedClientLabel && !props.snapshot.appointments.length
                    ? isZh
                      ? `${selectedClientLabel} 当前没有排入队列的预约`
                      : `No appointments queued for ${selectedClientLabel}`
                    : isZh
                      ? "这个队列里还没有预约"
                      : "No appointments in this queue"
                }
              />
            )}
          </div>
        )}
      </SectionCard>
    </>
  );
}
