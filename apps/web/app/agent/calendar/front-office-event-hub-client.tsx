"use client";

import type {
  FrontOfficeEventCalendarView,
  FrontOfficeEventHubSnapshot,
  FrontOfficeSharedEventRecord,
} from "@acre/db";
import { Badge, Button } from "@acre/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import styles from "./event-hub.module.css";

type FrontOfficeEventHubClientProps = {
  snapshot: FrontOfficeEventHubSnapshot;
  timeZone?: string | null;
  isZh?: boolean;
};

type EventFormState = {
  title: string;
  description: string;
  eventType: "activity" | "meeting" | "training" | "admin" | "broker_tour" | "other";
  visibility: "all_agents" | "office_only" | "invite_only";
  startsAt: string;
  endsAt: string;
  area: string;
  location: string;
  isOnline: boolean;
  meetingUrl: string;
  meetingPassword: string;
  isMandatory: boolean;
  recurrenceRule: "" | "weekly_thursday" | "monthly_first_friday";
};

type TimelineItem = {
  id: string;
  kind: "appointment" | "event";
  startsAtValue: string;
  dayKey: string;
  title: string;
  badgeLabel: string;
  badgeTone: "neutral" | "accent" | "success" | "warning" | "danger";
  primaryMeta: string;
  secondaryMeta: string;
  href: string;
};

const emptyFormState: EventFormState = {
  title: "",
  description: "",
  eventType: "activity",
  visibility: "all_agents",
  startsAt: "",
  endsAt: "",
  area: "",
  location: "",
  isOnline: false,
  meetingUrl: "",
  meetingPassword: "",
  isMandatory: false,
  recurrenceRule: "",
};

function toDayKey(value: string) {
  return value.slice(0, 10);
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDayHeader(value: string, timeZone?: string | null) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function formatBoardTime(value: string, timeZone?: string | null) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  });
}

function getDayDateNumber(dayKey: string) {
  return dayKey.slice(8, 10).replace(/^0/, "") || "0";
}

function getWeekdayLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function getViewLabel(view: FrontOfficeEventCalendarView, isZh?: boolean) {
  if (view === "month") {
    return isZh ? "月视图" : "Month";
  }

  if (view === "week") {
    return isZh ? "周视图" : "Week";
  }

  return isZh ? "日视图" : "Day";
}

function getBoardTitle(view: FrontOfficeEventCalendarView, isZh?: boolean) {
  if (view === "month") {
    return isZh ? "事件月历看板" : "Event month board";
  }

  if (view === "week") {
    return isZh ? "事件周历看板" : "Event week board";
  }

  return isZh ? "事件日历看板" : "Event day board";
}

function getShiftLabel(
  view: FrontOfficeEventCalendarView,
  step: -1 | 1,
  isZh?: boolean,
) {
  if (view === "month") {
    return step < 0
      ? isZh
        ? "上个月"
        : "Prev month"
      : isZh
        ? "下个月"
        : "Next month";
  }

  if (view === "week") {
    return step < 0
      ? isZh
        ? "上一周"
        : "Prev week"
      : isZh
        ? "下一周"
        : "Next week";
  }

  return step < 0
    ? isZh
      ? "前一天"
      : "Prev day"
    : isZh
      ? "后一天"
      : "Next day";
}

function toMonthInputValue(value: string) {
  return value.slice(0, 7);
}

function toFocusDateFromMonthInput(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  return `${value}-01`;
}

function shiftFocusDate(
  focusDate: string,
  view: FrontOfficeEventCalendarView,
  step: number,
) {
  const current = new Date(`${focusDate}T12:00:00`);

  if (view === "month") {
    return new Date(current.getFullYear(), current.getMonth() + step, 1)
      .toISOString()
      .slice(0, 10);
  }

  if (view === "week") {
    return new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + step * 7,
      12,
    )
      .toISOString()
      .slice(0, 10);
  }

  return new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() + step,
    12,
  )
    .toISOString()
    .slice(0, 10);
}

function buildDateRange(startValue: string, endValue: string) {
  const days: string[] = [];
  const cursor = new Date(startValue);
  const end = new Date(endValue);

  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function buildTimelineItems(snapshot: FrontOfficeEventHubSnapshot): TimelineItem[] {
  return [
    ...snapshot.appointments.map((appointment) => ({
      id: appointment.id,
      kind: "appointment" as const,
      startsAtValue: appointment.startsAtValue,
      dayKey: toDayKey(appointment.startsAtValue),
      title: appointment.title,
      badgeLabel: appointment.typeLabel,
      badgeTone: appointment.typeTone,
      primaryMeta: `${formatBoardTime(appointment.startsAtValue)} · ${appointment.statusLabel}`,
      secondaryMeta:
        appointment.clientLabel ||
        appointment.listingLabel ||
        appointment.locationLabel,
      href: appointment.href,
    })),
    ...snapshot.sharedEvents.events.map((event) => ({
      id: event.id,
      kind: "event" as const,
      startsAtValue: event.startsAtValue,
      dayKey: toDayKey(event.startsAtValue),
      title: event.title,
      badgeLabel: event.isMandatory ? "Mandatory" : event.eventTypeLabel,
      badgeTone: event.isMandatory ? "warning" : event.eventTypeTone,
      primaryMeta: `${formatBoardTime(event.startsAtValue)} · ${event.visibilityLabel}`,
      secondaryMeta: event.locationLabel,
      href: event.openHref,
    })),
  ].sort(
    (left, right) =>
      new Date(left.startsAtValue).getTime() - new Date(right.startsAtValue).getTime(),
  );
}

function prefillFormStateFromEvent(event: FrontOfficeSharedEventRecord): EventFormState {
  return {
    title: event.title,
    description: event.description,
    eventType: event.eventTypeValue,
    visibility: event.visibilityValue,
    startsAt: toDateTimeLocalValue(event.startsAtValue),
    endsAt: toDateTimeLocalValue(event.endsAtValue),
    area: event.areaLabel === "Area pending" ? "" : event.areaLabel,
    location:
      event.locationDisclosure || event.locationLabel === event.areaLabel
        ? ""
        : event.locationLabel,
    isOnline: event.isOnline,
    meetingUrl: event.meetingHref ?? "",
    meetingPassword: event.meetingPassword ?? "",
    isMandatory: event.isMandatory,
    recurrenceRule: event.recurrenceRuleValue ?? "",
  };
}

export function FrontOfficeEventHubClient({
  snapshot,
  timeZone,
  isZh,
}: FrontOfficeEventHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    snapshot.sharedEvents.selectedEvent?.id ??
      snapshot.sharedEvents.upcoming[0]?.id ??
      snapshot.sharedEvents.events[0]?.id ??
      null,
  );
  const [formState, setFormState] = useState<EventFormState>(emptyFormState);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [assistText, setAssistText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error" | null>(
    null,
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    setSelectedEventId(
      snapshot.sharedEvents.selectedEvent?.id ??
        snapshot.sharedEvents.upcoming[0]?.id ??
        snapshot.sharedEvents.events[0]?.id ??
        null,
    );
  }, [
    snapshot.sharedEvents.events,
    snapshot.sharedEvents.selectedEvent?.id,
    snapshot.sharedEvents.upcoming,
  ]);

  const timelineItems = buildTimelineItems(snapshot);
  const timelineByDay = new Map<string, TimelineItem[]>();

  for (const item of timelineItems) {
    const existing = timelineByDay.get(item.dayKey) ?? [];
    existing.push(item);
    timelineByDay.set(item.dayKey, existing);
  }

  const visibleDays = buildDateRange(
    snapshot.sharedEvents.window.startsAtValue,
    snapshot.sharedEvents.window.endsAtValue,
  );
  const selectedEvent =
    snapshot.sharedEvents.events.find((event) => event.id === selectedEventId) ??
    snapshot.sharedEvents.upcoming.find((event) => event.id === selectedEventId) ??
    snapshot.sharedEvents.selectedEvent ??
    null;
  const focusMonth = new Date(`${snapshot.focusDate}T12:00:00`).getMonth();
  const todayKey = snapshot.todayDate;

  function setFeedback(
    tone: "info" | "error" | null,
    message?: string | null,
  ) {
    setFeedbackTone(tone);
    setFeedbackMessage(message?.trim() ?? "");
  }

  function buildHref(
    patch: Record<string, string | null | undefined>,
    keysToClear?: string[],
  ) {
    const params = new URLSearchParams(searchParams.toString());

    for (const key of keysToClear ?? []) {
      params.delete(key);
    }

    for (const [key, value] of Object.entries(patch)) {
      if (!value) {
        params.delete(key);
        continue;
      }

      params.set(key, value);
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function navigateToEventHubView(view: FrontOfficeEventCalendarView) {
    startRouting(() => {
      router.push(
        buildHref({
          calendarView: view,
          focusDate: snapshot.focusDate,
          eventId: selectedEventId ?? undefined,
          appointmentId: null,
        }),
      );
    });
  }

  function navigateFocus(step: number) {
    startRouting(() => {
      router.push(
        buildHref({
          calendarView: snapshot.view,
          focusDate: shiftFocusDate(snapshot.focusDate, snapshot.view, step),
          eventId: selectedEventId ?? undefined,
          appointmentId: null,
        }),
      );
    });
  }

  function jumpToToday() {
    startRouting(() => {
      router.push(
        buildHref({
          calendarView: snapshot.view,
          focusDate: new Date().toISOString().slice(0, 10),
          eventId: selectedEventId ?? undefined,
          appointmentId: null,
        }),
      );
    });
  }

  function jumpToMonth(monthValue: string) {
    const nextFocusDate = toFocusDateFromMonthInput(monthValue);

    if (!nextFocusDate) {
      return;
    }

    startRouting(() => {
      router.push(
        buildHref({
          calendarView: snapshot.view,
          focusDate: nextFocusDate,
          eventId: selectedEventId ?? undefined,
          appointmentId: null,
        }),
      );
    });
  }

  function openAppointment(href: string) {
    startRouting(() => {
      router.push(href);
    });
  }

  function selectEvent(event: FrontOfficeSharedEventRecord) {
    setSelectedEventId(event.id);
    startRouting(() => {
      router.replace(
        buildHref({
          calendarView: snapshot.view,
          focusDate: snapshot.focusDate,
          eventId: event.id,
          appointmentId: null,
        }),
      );
    });
  }

  function updateFormState<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetEditor() {
    setEditingEventId(null);
    setFormState(emptyFormState);
    setAssistText("");
  }

  async function handleAssistParse() {
    if (!assistText.trim()) {
      setFeedback("error", "Paste the raw event note before running AI assist.");
      return;
    }

    setIsParsing(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/agent/events/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText: assistText,
        }),
      });
      const payload = (await response.json()) as {
        draft?: Partial<EventFormState> & {
          startsAt?: string | null;
          endsAt?: string | null;
          recurrenceHint?: EventFormState["recurrenceRule"] | null;
        } | null;
        error?: string;
        source?: string;
      };

      if (payload.error && !payload.draft) {
        setFeedback("error", payload.error);
        return;
      }

      if (!payload.draft) {
        setFeedback(
          "info",
          "OpenAI draft assist is unavailable right now, so the editor stays manual.",
        );
        return;
      }

      setFormState((current) => ({
        ...current,
        title: payload.draft?.title ?? current.title,
        description: payload.draft?.description ?? current.description,
        eventType: payload.draft?.eventType ?? current.eventType,
        startsAt:
          toDateTimeLocalValue(payload.draft?.startsAt ?? null) ||
          current.startsAt,
        endsAt:
          toDateTimeLocalValue(payload.draft?.endsAt ?? null) || current.endsAt,
        area: payload.draft?.area ?? current.area,
        location: payload.draft?.location ?? current.location,
        isOnline:
          typeof payload.draft?.isOnline === "boolean"
            ? payload.draft.isOnline
            : current.isOnline,
        meetingUrl: payload.draft?.meetingUrl ?? current.meetingUrl,
        meetingPassword:
          payload.draft?.meetingPassword ?? current.meetingPassword,
        recurrenceRule:
          payload.draft?.recurrenceHint ?? current.recurrenceRule,
      }));
      setFeedback(
        "info",
        payload.source === "openai"
          ? "AI assist filled the editor. Please review before saving."
          : "The editor stayed manual.",
      );
    } catch (error) {
      setFeedback(
        "error",
        error instanceof Error ? error.message : "Could not parse the event note.",
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSaveEvent() {
    if (!formState.title.trim() || !formState.startsAt) {
      setFeedback("error", "Title and start time are required.");
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(
        editingEventId ? `/api/agent/events/${editingEventId}` : "/api/agent/events",
        {
          method: editingEventId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formState.title,
            description: formState.description,
            eventType: formState.eventType,
            visibility: formState.visibility,
            startsAt: fromDateTimeLocalValue(formState.startsAt),
            endsAt: fromDateTimeLocalValue(formState.endsAt),
            area: formState.area,
            location: formState.location,
            isOnline: formState.isOnline,
            meetingUrl: formState.meetingUrl,
            meetingPassword: formState.meetingPassword,
            isMandatory: formState.isMandatory,
            recurrenceRule: formState.recurrenceRule || null,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        eventId?: string;
        createdCount?: number;
        id?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save the event.");
      }

      const nextEventId = payload.eventId ?? payload.id ?? editingEventId;

      resetEditor();
      setFeedback(
        "info",
        editingEventId
          ? "Shared event updated."
          : payload.createdCount && payload.createdCount > 1
            ? `Series created with ${payload.createdCount} event instances.`
            : "Shared event created.",
      );

      startRouting(() => {
        router.push(
          buildHref({
            calendarView: snapshot.view,
            focusDate: snapshot.focusDate,
            eventId: nextEventId ?? undefined,
          }),
        );
        router.refresh();
      });
    } catch (error) {
      setFeedback(
        "error",
        error instanceof Error ? error.message : "Could not save the event.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRsvp(status: "going" | "maybe" | "declined") {
    if (!selectedEvent) {
      return;
    }

    setIsResponding(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/agent/events/${selectedEvent.id}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update the RSVP.");
      }

      setFeedback("info", "RSVP updated.");
      startRouting(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback(
        "error",
        error instanceof Error ? error.message : "Could not update the RSVP.",
      );
    } finally {
      setIsResponding(false);
    }
  }

  const feedbackClassName = feedbackTone === "error" ? "is-error" : "is-neutral";

  return (
    <div className={styles.hub}>
      <section className={`office-list-card ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>
              {isZh ? "工作台控制" : "Board controls"}
            </span>
            <h3>{getBoardTitle(snapshot.view, isZh)}</h3>
            <p>
              {isZh
                ? "在这里按月、周、日查看 shared event 和 appointment，并且可以直接跳到目标月份。"
                : "Review shared events and appointments by month, week, or day, then jump directly to the month you want."}
            </p>
          </div>

          <div className={styles.heroControls}>
            <label className={styles.monthJumpField}>
              <span className={styles.monthJumpLabel}>
                {isZh ? "跳到月份" : "Jump to month"}
              </span>
              <input
                className={`office-input ${styles.monthJumpInput}`}
                onChange={(event) => jumpToMonth(event.target.value)}
                type="month"
                value={toMonthInputValue(snapshot.focusDate)}
              />
            </label>

            <div className={styles.viewTabs}>
              {(["month", "week", "day"] as const).map((view) => (
                <Button
                  className={
                    snapshot.view === view ? styles.viewTabActive : undefined
                  }
                  key={view}
                  onClick={() => navigateToEventHubView(view)}
                  size="sm"
                  variant={snapshot.view === view ? "primary" : "secondary"}
                >
                  {getViewLabel(view, isZh)}
                </Button>
              ))}
            </div>

            <div className={styles.viewTabs}>
              <Button
                disabled={isRouting}
                onClick={() => navigateFocus(-1)}
                size="sm"
                variant="ghost"
              >
                {getShiftLabel(snapshot.view, -1, isZh)}
              </Button>
              <Button
                disabled={isRouting}
                onClick={jumpToToday}
                size="sm"
                variant="secondary"
              >
                {isZh ? "今天" : "Today"}
              </Button>
              <Button
                disabled={isRouting}
                onClick={() => navigateFocus(1)}
                size="sm"
                variant="ghost"
              >
                {getShiftLabel(snapshot.view, 1, isZh)}
              </Button>
            </div>
          </div>
        </div>

        <dl className={`office-kpi-strip ${styles.heroFacts}`}>
          <div className="office-kpi-strip-item office-kpi-strip-item-accent">
            <dt className="office-kpi-strip-label">{isZh ? "范围" : "Range"}</dt>
            <dd className="office-kpi-strip-value">{snapshot.rangeLabel}</dd>
          </div>
          <div className="office-kpi-strip-item">
            <dt className="office-kpi-strip-label">
              {isZh ? "共享活动" : "Shared events"}
            </dt>
            <dd className="office-kpi-strip-value">
              {snapshot.summary.sharedEventCount}
            </dd>
          </div>
          <div className="office-kpi-strip-item">
            <dt className="office-kpi-strip-label">Mandatory</dt>
            <dd className="office-kpi-strip-value">
              {snapshot.summary.mandatoryEventCount}
            </dd>
          </div>
          <div className="office-kpi-strip-item">
            <dt className="office-kpi-strip-label">
              {isZh ? "预约" : "Appointments"}
            </dt>
            <dd className="office-kpi-strip-value">
              {snapshot.summary.appointmentCount}
            </dd>
          </div>
          <div className="office-kpi-strip-item office-kpi-strip-item-muted">
            <dt className="office-kpi-strip-label">{isZh ? "今天" : "Today"}</dt>
            <dd className="office-kpi-strip-value">
              {snapshot.summary.todayCommitmentCount}
            </dd>
          </div>
        </dl>
      </section>

      {feedbackTone && feedbackMessage ? (
        <div className={`front-office-calendar-feedback ${feedbackClassName}`}>
          {feedbackMessage}
        </div>
      ) : null}

      <div className={styles.workspace}>
        <div className={styles.boardColumn}>
          <section className={`office-list-card ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h4>{isZh ? "混合看板" : "Combined board"}</h4>
                <p>
                  {snapshot.rangeLabel}
                  {" · "}
                  {isZh
                    ? "appointments 与 shared events 同屏展示"
                    : "Appointments and shared events on one canvas"}
                </p>
              </div>
              <div className={styles.boardLegend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendSwatch} />
                  {isZh ? "Appointment" : "Appointment"}
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendSwatch} ${styles.legendSwatchEvent}`}
                  />
                  {isZh ? "Shared event" : "Shared event"}
                </span>
              </div>
            </div>

            {snapshot.view === "day" ? (
              <div className={styles.agendaList}>
                {timelineItems.length ? (
                  timelineItems.map((item) => (
                    <button
                      className={`${styles.agendaItem} ${styles.calendarItem} ${
                        item.kind === "event"
                          ? styles.calendarItemEvent
                          : styles.calendarItemAppointment
                      } ${
                        item.kind === "event" && item.id === selectedEventId
                          ? styles.calendarItemActive
                          : ""
                      }`}
                      key={`${item.kind}-${item.id}`}
                      onClick={() =>
                        item.kind === "event"
                          ? selectEvent(
                              snapshot.sharedEvents.events.find(
                                (event) => event.id === item.id,
                              ) ??
                                snapshot.sharedEvents.upcoming.find(
                                  (event) => event.id === item.id,
                                )!
                            )
                          : openAppointment(item.href)
                      }
                      type="button"
                    >
                      <div className={styles.agendaTime}>
                        <strong>{formatBoardTime(item.startsAtValue, timeZone)}</strong>
                        <span>
                          {item.kind === "event"
                            ? isZh
                              ? "共享活动"
                              : "Shared event"
                            : isZh
                              ? "预约"
                              : "Appointment"}
                        </span>
                      </div>
                      <div className={styles.itemList}>
                        <div className={styles.calendarItemHeader}>
                          <strong>{item.title}</strong>
                          <Badge tone={item.badgeTone}>{item.badgeLabel}</Badge>
                        </div>
                        <div className={styles.calendarItemMeta}>
                          <span>{item.primaryMeta}</span>
                          <span>{item.secondaryMeta}</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    {isZh
                      ? "这一天还没有共享 event 或 appointment。"
                      : "No shared events or appointments land on this day yet."}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={`${styles.calendarGrid} ${styles.weekGrid}`}>
                  {visibleDays.slice(0, 7).map((dayKey) => (
                    <span className={styles.weekdayLabel} key={dayKey}>
                      {getWeekdayLabel(dayKey)}
                    </span>
                  ))}
                </div>

                <div
                  className={`${styles.calendarGrid} ${
                    snapshot.view === "month" ? styles.monthGrid : styles.weekGrid
                  }`}
                >
                  {visibleDays.map((dayKey) => {
                    const items = timelineByDay.get(dayKey) ?? [];
                    const renderItems =
                      snapshot.view === "month" ? items.slice(0, 3) : items;
                    const isOutsideFocusMonth =
                      new Date(`${dayKey}T12:00:00`).getMonth() !== focusMonth;

                    return (
                      <div
                        className={`${styles.dayCard} ${
                          snapshot.view === "month" && isOutsideFocusMonth
                            ? styles.dayCardMuted
                            : ""
                        } ${dayKey === todayKey ? styles.dayCardToday : ""}`}
                        key={dayKey}
                      >
                        <div className={styles.dayHeader}>
                          <strong>{getDayDateNumber(dayKey)}</strong>
                          <span>{formatDayHeader(dayKey, timeZone)}</span>
                        </div>

                        <div className={styles.itemList}>
                          {renderItems.map((item) => (
                            <button
                              className={`${styles.calendarItem} ${
                                item.kind === "event"
                                  ? styles.calendarItemEvent
                                  : styles.calendarItemAppointment
                              } ${
                                item.kind === "event" && item.id === selectedEventId
                                  ? styles.calendarItemActive
                                  : ""
                              }`}
                              key={`${item.kind}-${item.id}`}
                              onClick={() =>
                                item.kind === "event"
                                  ? selectEvent(
                                      snapshot.sharedEvents.events.find(
                                        (event) => event.id === item.id,
                                      ) ??
                                        snapshot.sharedEvents.upcoming.find(
                                          (event) => event.id === item.id,
                                        )!
                                    )
                                  : openAppointment(item.href)
                              }
                              type="button"
                            >
                              <div className={styles.calendarItemHeader}>
                                <strong>{item.title}</strong>
                                <Badge tone={item.badgeTone}>{item.badgeLabel}</Badge>
                              </div>
                              <div className={styles.calendarItemMeta}>
                                <span>{item.primaryMeta}</span>
                                <span>{item.secondaryMeta}</span>
                              </div>
                            </button>
                          ))}

                          {snapshot.view === "month" && items.length > renderItems.length ? (
                            <div className={styles.queueMeta}>
                              +{items.length - renderItems.length}{" "}
                              {isZh ? "条更多事项" : "more items"}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        <div className={styles.detailColumn}>
          <section className={`office-list-card ${styles.detailCard}`}>
            {selectedEvent ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailMeta}>
                    <Badge tone={selectedEvent.eventTypeTone}>
                      {selectedEvent.eventTypeLabel}
                    </Badge>
                    <Badge tone={selectedEvent.isMandatory ? "warning" : "neutral"}>
                      {selectedEvent.mandatoryLabel}
                    </Badge>
                    <Badge tone="accent">{selectedEvent.visibilityLabel}</Badge>
                    {selectedEvent.isRecurring ? (
                      <Badge tone="neutral">
                        {selectedEvent.recurrenceRuleLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <h4>{selectedEvent.title}</h4>
                  <p>{selectedEvent.description || (isZh ? "暂无描述。" : "No description yet.")}</p>
                </div>

                <dl className={styles.detailList}>
                  <div>
                    <dt>{isZh ? "开始时间" : "Starts"}</dt>
                    <dd>{selectedEvent.startsAtLabel}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "结束时间" : "Ends"}</dt>
                    <dd>{selectedEvent.endsAtLabel}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "地点" : "Location"}</dt>
                    <dd>{selectedEvent.locationLabel}</dd>
                    {selectedEvent.locationDisclosure ? (
                      <p>{selectedEvent.locationDisclosure}</p>
                    ) : null}
                  </div>
                  <div>
                    <dt>{isZh ? "RSVP" : "RSVP"}</dt>
                    <dd>
                      {selectedEvent.userRsvpLabel}
                      {" · "}
                      {selectedEvent.attendeeLabel}
                    </dd>
                  </div>
                  {selectedEvent.isOnline ? (
                    <div>
                      <dt>{isZh ? "会议入口" : "Meeting room"}</dt>
                      <dd>
                        {selectedEvent.meetingHref ? (
                          <a
                            className={styles.detailLink}
                            href={selectedEvent.meetingHref}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {isZh ? "打开会议链接" : "Open meeting link"}
                          </a>
                        ) : (
                          selectedEvent.meetingDisclosure ||
                          (isZh ? "暂无会议链接。" : "No meeting link yet.")
                        )}
                      </dd>
                      {selectedEvent.meetingPassword ? (
                        <p>
                          {isZh ? "会议密码：" : "Meeting password: "}
                          {selectedEvent.meetingPassword}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </dl>

                <div className={styles.detailActions}>
                  <Button
                    disabled={
                      isResponding ||
                      !selectedEvent.canRsvp ||
                      selectedEvent.userRsvpStatus === "going"
                    }
                    onClick={() => handleRsvp("going")}
                    variant="primary"
                  >
                    {isZh ? "Going" : "Going"}
                  </Button>
                  <Button
                    disabled={
                      isResponding ||
                      !selectedEvent.canRsvp ||
                      selectedEvent.userRsvpStatus === "maybe"
                    }
                    onClick={() => handleRsvp("maybe")}
                    variant="secondary"
                  >
                    {isZh ? "Maybe" : "Maybe"}
                  </Button>
                  <Button
                    disabled={
                      isResponding ||
                      !selectedEvent.canRsvp ||
                      selectedEvent.userRsvpStatus === "declined"
                    }
                    onClick={() => handleRsvp("declined")}
                    variant="ghost"
                  >
                    {selectedEvent.isPast
                      ? isZh
                        ? "已结束"
                        : "Ended"
                      : isZh
                        ? "Decline"
                        : "Decline"}
                  </Button>
                  {snapshot.canManageEvents ? (
                    <Button
                      onClick={() => {
                        setEditingEventId(selectedEvent.id);
                        setFormState(prefillFormStateFromEvent(selectedEvent));
                        setAssistText(selectedEvent.description);
                        setFeedback(
                          "info",
                          "Selected event loaded into the editor.",
                        );
                      }}
                      variant="secondary"
                    >
                      {isZh ? "载入编辑器" : "Load into editor"}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.detailEmpty}>
                <strong>
                  {isZh ? "还没有选中 shared event" : "No shared event selected"}
                </strong>
                <p>
                  {isZh
                    ? "从月/周/日看板或右侧 upcoming 列表里点一个 event，就能在这里看 RSVP、mandatory 和 meeting gate。"
                    : "Pick an event from the board or the upcoming list to inspect RSVP, mandatory, and meeting-room gates."}
                </p>
              </div>
            )}
          </section>

          <section className={`office-list-card ${styles.queueCard}`}>
            <div className={styles.panelHeader}>
              <div>
                <h4>{isZh ? "Mandatory 队列" : "Mandatory queue"}</h4>
                <p>
                  {isZh
                    ? "必须参加的 shared event 会固定出现在这里。"
                    : "Required shared events stay pinned here."}
                </p>
              </div>
            </div>

            <div className={styles.queueList}>
              {snapshot.sharedEvents.mandatory.length ? (
                snapshot.sharedEvents.mandatory.map((event) => (
                  <button
                    className={`${styles.calendarItem} ${styles.calendarItemEvent} ${
                      event.id === selectedEventId ? styles.calendarItemActive : ""
                    }`}
                    key={event.id}
                    onClick={() => selectEvent(event)}
                    type="button"
                  >
                    <div className={styles.calendarItemHeader}>
                      <strong>{event.title}</strong>
                      <Badge tone="warning">{event.mandatoryLabel}</Badge>
                    </div>
                    <div className={styles.calendarItemMeta}>
                      <span>{event.startsAtLabel}</span>
                      <span>{event.locationLabel}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>
                  {isZh
                    ? "当前窗口里没有 mandatory shared event。"
                    : "No mandatory shared events are pending right now."}
                </div>
              )}
            </div>
          </section>

          <section className={`office-list-card ${styles.queueCard}`}>
            <div className={styles.panelHeader}>
              <div>
                <h4>{isZh ? "Upcoming shared events" : "Upcoming shared events"}</h4>
                <p>
                  {isZh
                    ? "重复活动按 series 去重，只保留下一场。"
                    : "Recurring series are deduped to the next upcoming occurrence."}
                </p>
              </div>
            </div>

            <div className={styles.queueList}>
              {snapshot.sharedEvents.upcoming.length ? (
                snapshot.sharedEvents.upcoming.slice(0, 6).map((event) => (
                  <button
                    className={`${styles.calendarItem} ${styles.calendarItemEvent} ${
                      event.id === selectedEventId ? styles.calendarItemActive : ""
                    }`}
                    key={event.id}
                    onClick={() => selectEvent(event)}
                    type="button"
                  >
                    <div className={styles.calendarItemHeader}>
                      <strong>{event.title}</strong>
                      <Badge tone={event.eventTypeTone}>{event.eventTypeLabel}</Badge>
                    </div>
                    <div className={styles.calendarItemMeta}>
                      <span>{event.startsAtLabel}</span>
                      <span>{event.locationLabel}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>
                  {isZh
                    ? "未来 30 天还没有共享活动。"
                    : "No shared events are visible in the next 30 days."}
                </div>
              )}
            </div>
          </section>

          {snapshot.canManageEvents ? (
            <section
              className={`office-list-card front-office-calendar-form ${styles.panel} ${styles.formPanel}`}
            >
              <div className={styles.panelHeader}>
                <div>
                  <h4>
                    {editingEventId
                      ? isZh
                        ? "编辑 shared event"
                        : "Edit shared event"
                      : isZh
                        ? "创建 shared event"
                        : "Create shared event"}
                  </h4>
                  <p className={styles.formIntro}>
                    {isZh
                      ? "先用 AI 把原始活动文案拆成 review-first 草稿，再决定要不要保存成 series。"
                      : "Use AI to turn a raw event note into a review-first draft, then decide whether this becomes a recurring series."}
                  </p>
                </div>
              </div>

              <div className={styles.assistCard}>
                <label htmlFor="event-assist-note">
                  {isZh ? "AI 草稿入口" : "AI draft intake"}
                </label>
                <textarea
                  className="office-textarea"
                  id="event-assist-note"
                  onChange={(event) => setAssistText(event.target.value)}
                  placeholder={
                    isZh
                      ? "粘贴活动文案、邮件、群消息或会议安排……"
                      : "Paste the event note, email copy, chat thread, or meeting brief..."
                  }
                  value={assistText}
                />
                <div className={styles.formActions}>
                  <Button
                    disabled={isParsing}
                    onClick={handleAssistParse}
                    variant="secondary"
                  >
                    {isParsing
                      ? isZh
                        ? "解析中…"
                        : "Parsing..."
                      : isZh
                        ? "AI 解析"
                        : "AI parse"}
                  </Button>
                  <Button onClick={resetEditor} variant="ghost">
                    {isZh ? "清空编辑器" : "Clear editor"}
                  </Button>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="event-title">{isZh ? "标题" : "Title"}</label>
                  <input
                    className="office-input"
                    id="event-title"
                    onChange={(event) => updateFormState("title", event.target.value)}
                    value={formState.title}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-type">{isZh ? "类型" : "Type"}</label>
                  <select
                    className="office-select"
                    id="event-type"
                    onChange={(event) =>
                      updateFormState(
                        "eventType",
                        event.target.value as EventFormState["eventType"],
                      )
                    }
                    value={formState.eventType}
                  >
                    <option value="activity">Activity</option>
                    <option value="meeting">Meeting</option>
                    <option value="training">Training</option>
                    <option value="admin">Admin</option>
                    <option value="broker_tour">Broker Tour</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="event-description">
                    {isZh ? "描述" : "Description"}
                  </label>
                  <textarea
                    className="office-textarea"
                    id="event-description"
                    onChange={(event) =>
                      updateFormState("description", event.target.value)
                    }
                    value={formState.description}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-visibility">
                    {isZh ? "可见范围" : "Visibility"}
                  </label>
                  <select
                    className="office-select"
                    id="event-visibility"
                    onChange={(event) =>
                      updateFormState(
                        "visibility",
                        event.target.value as EventFormState["visibility"],
                      )
                    }
                    value={formState.visibility}
                  >
                    <option value="all_agents">All agents</option>
                    <option value="office_only">Office only</option>
                    <option value="invite_only">Invite only</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-recurrence">
                    {isZh ? "重复规则" : "Recurrence"}
                  </label>
                  <select
                    className="office-select"
                    id="event-recurrence"
                    onChange={(event) =>
                      updateFormState(
                        "recurrenceRule",
                        event.target.value as EventFormState["recurrenceRule"],
                      )
                    }
                    value={formState.recurrenceRule}
                  >
                    <option value="">{isZh ? "单次" : "One-time"}</option>
                    <option value="weekly_thursday">Every Thursday</option>
                    <option value="monthly_first_friday">First Friday</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-startsAt">
                    {isZh ? "开始时间" : "Starts at"}
                  </label>
                  <input
                    className="office-input"
                    id="event-startsAt"
                    onChange={(event) =>
                      updateFormState("startsAt", event.target.value)
                    }
                    type="datetime-local"
                    value={formState.startsAt}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-endsAt">
                    {isZh ? "结束时间" : "Ends at"}
                  </label>
                  <input
                    className="office-input"
                    id="event-endsAt"
                    onChange={(event) => updateFormState("endsAt", event.target.value)}
                    type="datetime-local"
                    value={formState.endsAt}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-area">{isZh ? "区域" : "Area"}</label>
                  <input
                    className="office-input"
                    id="event-area"
                    onChange={(event) => updateFormState("area", event.target.value)}
                    value={formState.area}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-location">
                    {isZh ? "精确地点" : "Precise location"}
                  </label>
                  <input
                    className="office-input"
                    id="event-location"
                    onChange={(event) =>
                      updateFormState("location", event.target.value)
                    }
                    value={formState.location}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-meetingUrl">
                    {isZh ? "会议链接" : "Meeting URL"}
                  </label>
                  <input
                    className="office-input"
                    id="event-meetingUrl"
                    onChange={(event) =>
                      updateFormState("meetingUrl", event.target.value)
                    }
                    value={formState.meetingUrl}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-meetingPassword">
                    {isZh ? "会议密码" : "Meeting password"}
                  </label>
                  <input
                    className="office-input"
                    id="event-meetingPassword"
                    onChange={(event) =>
                      updateFormState("meetingPassword", event.target.value)
                    }
                    value={formState.meetingPassword}
                  />
                </div>
              </div>

              <div className={styles.toggleGrid}>
                <div className={styles.toggleRow}>
                  <label htmlFor="event-online">
                    {isZh ? "线上活动" : "Online event"}
                  </label>
                  <input
                    checked={formState.isOnline}
                    id="event-online"
                    onChange={(event) =>
                      updateFormState("isOnline", event.target.checked)
                    }
                    type="checkbox"
                  />
                </div>
                <div className={styles.toggleRow}>
                  <label htmlFor="event-mandatory">
                    {isZh ? "Mandatory" : "Mandatory"}
                  </label>
                  <input
                    checked={formState.isMandatory}
                    id="event-mandatory"
                    onChange={(event) =>
                      updateFormState("isMandatory", event.target.checked)
                    }
                    type="checkbox"
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <Button disabled={isSaving} onClick={handleSaveEvent}>
                  {isSaving
                    ? isZh
                      ? "保存中…"
                      : "Saving..."
                    : editingEventId
                      ? isZh
                        ? "更新活动"
                        : "Update event"
                      : isZh
                        ? "创建活动"
                        : "Create event"}
                </Button>
                <Button onClick={resetEditor} variant="secondary">
                  {editingEventId
                    ? isZh
                      ? "退出编辑"
                      : "Exit edit mode"
                    : isZh
                      ? "重置表单"
                      : "Reset form"}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
