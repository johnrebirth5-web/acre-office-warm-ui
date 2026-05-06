

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

import { FrontOfficeLink } from "../../_components/front-office-link";

import { useI18n } from "../../../../lib/i18n/client";

import {
  calendarViewValues,
  deriveCalendarViewFromRoute,
  getCalendarViewForWritebackReentry,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "../calendar-view";

import { AgendaSection, AppointmentCue, AppointmentFormState, AppointmentMailThreadErrorResponse, AppointmentMailThreadResponse, AppointmentMailThreadSuccessResponse, AppointmentMutationResponse, AppointmentTouchPreset, AppointmentWritebackDraft, BridgeActionResponse, BridgeOutcomeState, FeedbackState, FilterState, FilterUpdate, FocusState, FrontOfficeAppointmentCheckpointSummary, FrontOfficeCalendarClientProps } from "./types";

export const externalStatusOptions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
}> = [
  { value: "idle", label: "外部跟进空闲" },
  { value: "needs_follow_up", label: "待回复" },
  { value: "confirmation_pending", label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "reschedule_requested", label: "请求改期" },
];



export const statusFilterOptions = [
  { value: "all", label: "全部 Acre 状态" },
  { value: "scheduled", label: "仅已安排" },
  { value: "completed", label: "已完成" },
  { value: "canceled", label: "已取消" },
  { value: "no_show", label: "未到场" },
];



export const calendarViewOptions = calendarViewValues.map((value) => ({
  value,
  label: getCalendarViewConfig(value).label,
}));



export const coordinationFilterOptions = [
  { value: "all", label: "全部协调状态" },
  { value: "needs_follow_up", label: "待回复" },
  { value: "confirmation_pending", label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "reschedule_requested", label: "请求改期" },
  { value: "touch_due", label: "触达已到期" },
  { value: "bridge_logged", label: "草稿已打开" },
  { value: "writeback_pending", label: "更新未保存" },
];



export const followUpFilterOptions = [
  { value: "all", label: "全部跟进节奏" },
  { value: "response_waiting", label: "待回复" },
  { value: "touch_due", label: "现在需要触达" },
  { value: "next_touch_missing", label: "缺少下次触达" },
  { value: "touch_scheduled", label: "触达已安排" },
  { value: "confirmed", label: "已确认" },
];



export const statusFilterValueSet = new Set(
  statusFilterOptions.map((option) => option.value),
);


export const coordinationFilterValueSet = new Set(
  coordinationFilterOptions.map((option) => option.value),
);


export const followUpFilterValueSet = new Set(
  followUpFilterOptions.map((option) => option.value),
);



export function getAgendaDateKey(value: Date, timeZone: string) {
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



export function buildAgendaDateKeys(
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



export function formatAgendaDateLabel(
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



export function formatAgendaTimeLabel(
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



export function buildAgendaSections(input: {
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



export const quickWritebackActions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
  description: string;
}> = [
  {
    value: "needs_follow_up",
    label: "待回复",
    description:
      "保持预约为活动状态，同时标记仍需要再次外联回复。",
  },
  {
    value: "confirmation_pending",
    label: "待确认",
    description:
      "记录外部回复尚未回来，但不声称已经确认同步。",
  },
  {
    value: "confirmed",
    label: "已确认 / 清除触达",
    description:
      "将外部计划标记为已确认，并清除当前下一次触达提醒。",
  },
  {
    value: "reschedule_requested",
    label: "请求改期",
    description:
      "记录外部对话已经进入改期模式。",
  },
];



export function buildDefaultStartValue() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  const timeZoneOffsetMs = nextHour.getTimezoneOffset() * 60_000;
  return new Date(nextHour.getTime() - timeZoneOffsetMs)
    .toISOString()
    .slice(0, 16);
}



export function formatDateTimeLocalValue(value: Date) {
  const timeZoneOffsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - timeZoneOffsetMs)
    .toISOString()
    .slice(0, 16);
}



export function buildDefaultEndValue(startValue = buildDefaultStartValue()) {
  const startDate = new Date(startValue);

  if (Number.isNaN(startDate.getTime())) {
    return "";
  }

  startDate.setHours(startDate.getHours() + 1);
  return formatDateTimeLocalValue(startDate);
}



export function normalizeHttpUrlInput(value: string) {
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



export function isValidHttpUrl(value: string) {
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



export function buildEmptyFormState(
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



export function validateAppointmentFormState(formState: AppointmentFormState) {
  const startIso = toIsoDateTime(formState.startsAt);

  if (!startIso) {
    return "安排预约前请选择有效的开始时间。";
  }

  const endIso = formState.endsAt ? toIsoDateTime(formState.endsAt) : "";

  if (formState.endsAt && !endIso) {
    return "请选择有效的结束时间，或清空该字段。";
  }

  if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
    return "结束时间不能早于开始时间。";
  }

  if (formState.meetingUrl && !isValidHttpUrl(formState.meetingUrl)) {
    return "会议链接必须是有效的 Zoom、Meet、Teams 或其他 http(s) URL。";
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
    return "保存前请关联这个预约正在协调的客户、房源或外部联系人。";
  }

  return null;
}



export function buildAppointmentCueList(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
) {
  const cues: AppointmentCue[] = [];

  if (appointment.statusValue !== "scheduled") {
    return cues;
  }

  if (appointment.externalStatusValue === "confirmation_pending") {
    cues.push({ label: "待确认", tone: "accent" });
  }

  if (appointment.externalStatusValue === "reschedule_requested") {
    cues.push({ label: "请求改期", tone: "danger" });
  }

  if (appointment.isExternalTouchDue) {
    cues.push({ label: "触达已到期", tone: "danger" });
  } else if (
    appointment.requiresExternalResponse &&
    appointment.externalNextActionAtValue
  ) {
    cues.push({ label: "触达已安排", tone: "accent" });
  }

  if (appointment.needsNextTouchPlan) {
    cues.push({ label: "缺少下次触达", tone: "warning" });
  }

  if (
    appointment.hasBridgeActivity &&
    appointment.externalStatusValue === "idle"
  ) {
    cues.push({ label: "更新未保存", tone: "warning" });
  }

  if (
    appointment.externalStatusValue === "confirmed" &&
    !appointment.externalNextActionAtValue
  ) {
    cues.push({ label: "外部已确认", tone: "success" });
  }

  if (appointment.reminderLabel === "Starts within 2h") {
    cues.push({ label: "即将开始", tone: "warning" });
  }

  return cues.slice(0, 4);
}



export function toIsoDateTime(value: string) {
  if (!value.trim()) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}



export function buildWritebackDraft(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
): AppointmentWritebackDraft {
  return {
    status: appointment.externalStatusValue,
    note: appointment.externalNote,
    nextActionAt: appointment.externalNextActionAtValue,
  };
}



export function didWritebackChange(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  draft: AppointmentWritebackDraft,
) {
  return (
    draft.status !== appointment.externalStatusValue ||
    draft.note.trim() !== appointment.externalNote ||
    draft.nextActionAt !== appointment.externalNextActionAtValue
  );
}



export function downloadCalendarExport(fileName: string, content: string) {
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



export function buildCalendarHref(
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



export function appendReturnToHref(href: string, returnTo: string) {
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



export function readFilterState(searchParams: ReadonlyURLSearchParams): FilterState {
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



export function readWritebackDraft(
  appointment: FrontOfficeAppointmentsSnapshot["appointments"][number],
  drafts: Record<string, AppointmentWritebackDraft>,
) {
  return drafts[appointment.id] ?? buildWritebackDraft(appointment);
}



export function sanitizeScopedValue(value: string, options: Array<{ value: string }>) {
  return options.some((option) => option.value === value) ? value : "";
}



export function sanitizeEnumValue(
  value: string,
  allowedValues: Set<string>,
  fallbackValue: string,
) {
  return allowedValues.has(value) ? value : fallbackValue;
}



export function sanitizeReturnTo(value: string) {
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



export function normalizeFilterState(
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



export function readOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}



export function readReturnToLabel(returnTo: string) {
  if (!returnTo) {
    return "";
  }

  const pathname = returnTo.split("?")[0]?.split("#")[0] ?? returnTo;

  if (pathname.startsWith("/agent/clients/")) {
    return "Back to client page";
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



export function hasActiveQueueFilters(filterState: FilterState) {
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



export function resolveFocusState(
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
