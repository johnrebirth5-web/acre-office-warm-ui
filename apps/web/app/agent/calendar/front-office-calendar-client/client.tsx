
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
import { appendReturnToHref, buildAgendaDateKeys, buildAgendaSections, buildAppointmentCueList, buildCalendarHref, buildDefaultEndValue, buildDefaultStartValue, buildEmptyFormState, buildWritebackDraft, coordinationFilterOptions, coordinationFilterValueSet, didWritebackChange, downloadCalendarExport, externalStatusOptions, followUpFilterOptions, followUpFilterValueSet, formatAgendaDateLabel, formatAgendaTimeLabel, formatDateTimeLocalValue, getAgendaDateKey, hasActiveQueueFilters, isValidHttpUrl, normalizeFilterState, normalizeHttpUrlInput, quickWritebackActions, readFilterState, readOptionLabel, readReturnToLabel, readWritebackDraft, resolveFocusState, sanitizeEnumValue, sanitizeReturnTo, sanitizeScopedValue, statusFilterOptions, statusFilterValueSet, toIsoDateTime, validateAppointmentFormState } from "./helpers";
import {
  AppointmentsQueueCard,
  FocusAppointmentCard,
} from "./sections";

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
  const calendarViewOptions = calendarViewValues.map((value) => ({
    value,
    label: getCalendarViewConfig(value, isZh).label,
  }));
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
        ? "把外部计划标记为已确认，并清除当前的下次触达提醒。"
        : "Mark the outside plan confirmed and clear the current next-touch reminder.",
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
  const hasQueueFilters = hasActiveQueueFilters(filterState);
  const returnToLabel = readReturnToLabel(filterState.returnTo);
  const canSaveFocusedWriteback = focusedAppointment
    ? didWritebackChange(
        focusedAppointment,
        focusedWritebackDraft ?? buildWritebackDraft(focusedAppointment),
      )
    : false;

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
      message: `${suggestion.label} loaded into the update form. Save it when ready to keep the next step visible in Acre.`,
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
          ? `Quick update saved. ${checkpointContinuation}`
          : externalStatus === "confirmed"
            ? "Confirmation update saved and the current promised next step was cleared."
            : suggestedPreset
              ? `Quick update saved with ${suggestedPreset.label} loaded as the next step.`
              : "Quick update saved.",
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
          ? `Follow-up preset saved. ${checkpointContinuation}`
          : `${preset.label} saved to Acre as the next planned step.`,
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
        followUpDetail: payload.followUpDetail ?? "Save the update form below.",
        followUpCadenceLabel:
          checkpoint?.label ??
          payload.followUpCadenceLabel ??
          payload.suggestedWriteback?.label ??
          payload.actionLabel,
        followUpCadenceDetail:
          checkpoint?.nextStep ??
          payload.followUpCadenceDetail ??
          payload.followUpDetail ??
          "Save the update form below.",
        resultKind: payload.result.kind,
        checkpoint: checkpoint ?? {
          label:
            payload.followUpCadenceLabel ??
            payload.suggestedWriteback?.label ??
            payload.actionLabel,
          detail:
            payload.followUpCadenceDetail ??
            payload.followUpDetail ??
            "Save the update form below.",
          nextStep: payload.followUpDetail ?? "Save the update form below.",
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
          isZh ? "只填这次预约真正需要的字段。" : "Fill only the fields needed for this appointment."
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
          isZh ? "只保留能决定下一步的筛选。" : "Keep only the filters that change the next move."
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

      <FocusAppointmentCard
        applyTouchPresetDraft={applyTouchPresetDraft}
        bridgeOutcome={bridgeOutcome}
        bridgeState={bridgeState}
        buildContextAwareHref={buildContextAwareHref}
        canSaveFocusedWriteback={canSaveFocusedWriteback}
        clearFocusLock={clearFocusLock}
        clearQueueFilters={clearQueueFilters}
        externalStatusOptions={externalStatusOptions}
        feedback={feedback}
        filterReturnTo={filterState.returnTo}
        focusMode={focusState.mode}
        focusedAppointment={focusedAppointment}
        focusedCueList={focusedCueList}
        focusedWritebackDraft={focusedWritebackDraft}
        handleBridgeAction={handleBridgeAction}
        handleExternalStatusUpdate={handleExternalStatusUpdate}
        handleQuickWritebackAction={handleQuickWritebackAction}
        handleStatusUpdate={handleStatusUpdate}
        handleTouchPresetSave={handleTouchPresetSave}
        handleWritebackDraftChange={handleWritebackDraftChange}
        hasQueueFilters={hasQueueFilters}
        isBusy={isBusy}
        isZh={isZh}
        latestBridgeHistory={latestBridgeHistory}
        latestWritebackHistory={latestWritebackHistory}
        loadSuggestedBridgeWriteback={loadSuggestedBridgeWriteback}
        returnToLabel={returnToLabel}
        scrollToScheduleForm={scrollToScheduleForm}
        scrollToWritebackSection={scrollToWritebackSection}
        selectedClientLabel={selectedClientLabel}
      />

      <AppointmentsQueueCard
        agendaSections={agendaSections}
        agendaViewMode={agendaViewMode}
        appointmentCount={props.snapshot.filteredSummary.appointmentCount}
        appointments={props.snapshot.appointments}
        bridgeState={bridgeState}
        buildAppointmentCueList={buildAppointmentCueList}
        buildAppointmentFocusHref={buildAppointmentFocusHref}
        buildContextAwareHref={buildContextAwareHref}
        clearFocusLock={clearFocusLock}
        clearQueueFilters={clearQueueFilters}
        filterAppointmentId={filterState.appointmentId}
        filterReturnTo={filterState.returnTo}
        focusMode={focusState.mode}
        focusedAppointmentId={focusedAppointment?.id ?? null}
        handleBridgeAction={handleBridgeAction}
        handleQuickWritebackAction={handleQuickWritebackAction}
        handleTouchPresetSave={handleTouchPresetSave}
        hasQueueFilters={hasQueueFilters}
        isBusy={isBusy}
        isZh={isZh}
        renderAgendaAppointmentRow={renderAgendaAppointmentRow}
        returnToLabel={returnToLabel}
        scrollToScheduleForm={scrollToScheduleForm}
        selectedClientLabel={selectedClientLabel}
      />
    </>
  );
}
