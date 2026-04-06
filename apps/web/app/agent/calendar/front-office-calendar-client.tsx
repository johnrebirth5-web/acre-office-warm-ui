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

type FrontOfficeCalendarClientProps = {
  initialClientId?: string;
  snapshot: FrontOfficeAppointmentsSnapshot;
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
} | null;

type BridgeActionResponse = {
  action: FrontOfficeAppointmentBridgeAction;
  actionLabel: string;
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
};

type FilterState = {
  clientId: string;
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

const externalStatusOptions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
}> = [
  { value: "idle", label: "External follow-up idle" },
  { value: "needs_follow_up", label: "Needs follow-up" },
  { value: "confirmation_pending", label: "Awaiting confirmation" },
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

const coordinationFilterOptions = [
  { value: "all", label: "All coordination states" },
  { value: "needs_follow_up", label: "Needs follow-up" },
  { value: "confirmation_pending", label: "Awaiting confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "reschedule_requested", label: "Reschedule requested" },
  { value: "touch_due", label: "Touch due" },
  { value: "bridge_logged", label: "Bridge opened" },
  { value: "writeback_pending", label: "Bridge opened, writeback pending" },
];

const followUpFilterOptions = [
  { value: "all", label: "All follow-up rhythms" },
  { value: "response_waiting", label: "Needs outside reply" },
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

const quickWritebackActions: Array<{
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
  description: string;
}> = [
  {
    value: "needs_follow_up",
    label: "Needs follow-up",
    description:
      "Keep the appointment active, but flag that another outbound touch is still needed.",
  },
  {
    value: "confirmation_pending",
    label: "Awaiting confirmation",
    description:
      "Save that the outside reply has not come back yet without claiming a confirmed sync.",
  },
  {
    value: "confirmed",
    label: "Confirmed + clear touch",
    description:
      "Mark the outside plan confirmed and clear the current next-touch deadline.",
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

function buildEmptyFormState(initialClientId?: string): AppointmentFormState {
  return {
    title: "",
    type: "showing",
    clientId: initialClientId ?? "",
    listingId: "",
    startsAt: buildDefaultStartValue(),
    endsAt: "",
    location: "",
    meetingUrl: "",
    contactLabel: "",
    notes: "",
  };
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

function readFilterState(searchParams: ReadonlyURLSearchParams): FilterState {
  return {
    clientId: searchParams.get("clientId")?.trim() ?? "",
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

function sanitizeScopedValue(
  value: string,
  options: Array<{ value: string }>,
) {
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
  return {
    clientId: rawFilterState.clientId,
    type: sanitizeScopedValue(rawFilterState.type, snapshot.typeOptions),
    status: sanitizeEnumValue(rawFilterState.status, statusFilterValueSet, "all"),
    coordination: sanitizeEnumValue(
      rawFilterState.coordination,
      coordinationFilterValueSet,
      "all",
    ),
    followUp: sanitizeEnumValue(
      rawFilterState.followUp,
      followUpFilterValueSet,
      "all",
    ),
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
    return "Return to client dossier";
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
    return "Return to Back Office";
  }

  return "Return to previous view";
}

function hasActiveQueueFilters(filterState: FilterState) {
  return Boolean(
    filterState.clientId ||
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

  return {
    appointment:
      snapshot.appointments.find(
        (appointment) => appointment.id === filterState.appointmentId,
      ) ?? null,
    mode: snapshot.appointments.some(
      (appointment) => appointment.id === filterState.appointmentId,
    )
      ? "locked_in_queue"
      : "missing",
  };
}

export function FrontOfficeCalendarClient(
  props: FrontOfficeCalendarClientProps,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawFilterState = readFilterState(searchParams);
  const filterState = normalizeFilterState(rawFilterState, props.snapshot);
  const focusState = resolveFocusState(props.snapshot, filterState);
  const focusedAppointment = focusState.appointment;
  const currentSearch = searchParams.toString();
  const currentHref = currentSearch ? `${pathname}?${currentSearch}` : pathname;
  const normalizedHref = buildCalendarHref(pathname, searchParams, filterState);
  const defaultClientId = props.initialClientId || "";
  const defaultClientIdRef = useRef(defaultClientId);
  const [formState, setFormState] = useState<AppointmentFormState>(() =>
    buildEmptyFormState(defaultClientId),
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bridgeState, setBridgeState] = useState<{
    appointmentId: string;
    action: FrontOfficeAppointmentBridgeAction;
  } | null>(null);
  const [writebackDrafts, setWritebackDrafts] = useState<
    Record<string, AppointmentWritebackDraft>
  >({});
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;
  const focusedWritebackDraft = focusedAppointment
    ? readWritebackDraft(focusedAppointment, writebackDrafts)
    : null;
  const latestBridgeHistory = focusedAppointment?.bridgeHistory[0] ?? null;
  const latestWritebackHistory = focusedAppointment?.writebackHistory[0] ?? null;
  const selectedClientOption = props.snapshot.clientOptions.find(
    (option) => option.value === filterState.clientId,
  );
  const selectedClientLabel = filterState.clientId
    ? selectedClientOption?.label ??
      (focusedAppointment?.clientId === filterState.clientId
        ? focusedAppointment.clientLabel
        : "Scoped client outside quick list")
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
  const hasQueueFilters = hasActiveQueueFilters(filterState);
  const returnToLabel = readReturnToLabel(filterState.returnTo);
  const routeStateMeta = [
    selectedClientLabel ? `Client · ${selectedClientLabel}` : "Client · all visible",
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
            ? "requested appointment missing"
            : "locked appointment")
        }`
      : "Focus · auto",
    returnToLabel ? `Return · ${returnToLabel}` : null,
  ].filter(Boolean) as string[];
  const routeStateHeading =
    focusState.mode === "missing"
      ? "The route still carries an appointment deep link that Acre can no longer resolve."
      : focusState.mode === "locked_outside_queue"
        ? "A pinned appointment is being kept readable even though the queue filters hide it."
        : filterState.appointmentId
          ? "This route keeps a specific appointment pinned while the queue stays visible below."
        : hasQueueFilters
          ? "This calendar slice is pinned by route filters and will reopen in the same state."
          : "This route is showing the full visible Front Office calendar queue.";
  const routeStateDescriptionParts = [
    selectedClientLabel
      ? `Client context is scoped to ${selectedClientLabel}.`
      : "Client context is not narrowed yet.",
    focusState.mode === "missing"
      ? "Clear the focus lock or return to the source page if this deep link is stale."
      : filterState.appointmentId
        ? "The appointment focus stays in the URL so the same record can reopen below."
        : "The detail panel defaults to the next visible appointment until you lock a specific record.",
    returnToLabel
      ? `${returnToLabel} stays preserved while you adjust filters inside this shell.`
      : "If another page sends you here with a relative return path, Acre will preserve it while the shell state changes.",
  ];

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

  function navigateWithFilters(update: FilterUpdate) {
    startTransition(() => {
      router.replace(buildCalendarHref(pathname, searchParams, update), {
        scroll: false,
      });
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
      [name]: value,
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
      message: `${preset.label} loaded into the writeback form. Save when ready.`,
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
    setFormState(buildEmptyFormState(defaultClientId));
  }

  function clearFocusLock() {
    navigateWithFilters({
      appointmentId: "",
    });
  }

  function clearQueueFilters() {
    navigateWithFilters({
      clientId: "",
      type: "",
      status: "all",
      coordination: "all",
      followUp: "all",
    });
  }

  function scrollToScheduleForm() {
    document
      .getElementById("calendar-schedule-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Could not save the appointment.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          "Appointment scheduled. Your dashboard and calendar will refresh now.",
      });
      setFormState(buildEmptyFormState(defaultClientId));
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Could not update the appointment.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: "Appointment status updated.",
      });
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message:
            payload?.error ??
            "Could not update the external appointment state.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: "Appointment external writeback updated.",
      });
      clearSavedWritebackDraft(appointment.id);
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
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
    const nextActionAt =
      externalStatus === "confirmed" ? "" : draft.nextActionAt;

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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message:
            payload?.error ??
            "Could not update the external appointment state.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          externalStatus === "confirmed"
            ? "Confirmed writeback saved and the current next-touch deadline was cleared."
            : "Quick coordination action saved.",
      });
      clearSavedWritebackDraft(appointment.id);
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message:
            payload?.error ??
            "Could not save the follow-up rhythm preset.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: `${preset.label} saved to Acre as the next coordination checkpoint.`,
      });
      clearSavedWritebackDraft(appointment.id);
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not save the follow-up rhythm preset.",
      });
      setIsSaving(false);
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
          message: payload?.error ?? "Could not open the external bridge.",
        });
        return;
      }

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

      setFeedback({
        tone: "success",
        message: `${payload.actionLabel} opened. Acre will refresh so the latest bridge trail stays visible on this appointment.`,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not open the external bridge.",
      });
    } finally {
      setBridgeState(null);
    }
  }

  return (
    <>
      <SectionCard
        className="office-list-card"
        subtitle="Schedule showings, consultations, and client meetings without leaving Front Office. Shared office events still remain visible on the dashboard."
        title="Schedule appointment"
      >
        <form
          className="front-office-calendar-form"
          id="calendar-schedule-form"
          onSubmit={handleSubmit}
        >
          <div className="office-form-grid">
            <FormField
              className="office-form-grid-span-2"
              label="Title"
              helper="Optional. Leave blank to auto-name from type + client or listing."
            >
              <TextInput
                name="title"
                onChange={handleFieldChange}
                placeholder="Showing · John Doe · 123 Main St"
                value={formState.title}
              />
            </FormField>

            <FormField label="Type">
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

            <FormField label="Client">
              <SelectInput
                name="clientId"
                onChange={handleFieldChange}
                value={formState.clientId}
              >
                <option value="">No client linked</option>
                {props.snapshot.clientOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField className="office-form-grid-span-2" label="Listing">
              <SelectInput
                name="listingId"
                onChange={handleFieldChange}
                value={formState.listingId}
              >
                <option value="">No listing linked</option>
                {props.snapshot.listingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Start">
              <TextInput
                name="startsAt"
                onChange={handleFieldChange}
                type="datetime-local"
                value={formState.startsAt}
              />
            </FormField>

            <FormField label="End">
              <TextInput
                name="endsAt"
                onChange={handleFieldChange}
                type="datetime-local"
                value={formState.endsAt}
              />
            </FormField>

            <FormField
              label="Location"
              helper="Street address, building, or venue name."
            >
              <TextInput
                name="location"
                onChange={handleFieldChange}
                placeholder="123 Main St, Brooklyn"
                value={formState.location}
              />
            </FormField>

            <FormField label="Meeting link">
              <TextInput
                name="meetingUrl"
                onChange={handleFieldChange}
                placeholder="https://meet.google.com/..."
                value={formState.meetingUrl}
              />
            </FormField>

            <FormField
              label="External contact"
              helper="Use this if the attendee is not the linked client record."
            >
              <TextInput
                name="contactLabel"
                onChange={handleFieldChange}
                placeholder="Leasing office · 212-555-0199"
                value={formState.contactLabel}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-2"
              label="Internal notes"
            >
              <TextareaInput
                name="notes"
                onChange={handleFieldChange}
                placeholder="Parking instructions, gate code, prep notes, or follow-up reminders."
                rows={4}
                value={formState.notes}
              />
            </FormField>
          </div>

          {feedback ? (
            <p
              className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
            >
              {feedback.message}
            </p>
          ) : null}

          <div className="office-form-actions">
            <button className="office-button" disabled={isBusy} type="submit">
              {isBusy ? "Saving..." : "Schedule appointment"}
            </button>
            <button
              className="office-button-secondary"
              disabled={isBusy}
              onClick={resetForm}
              type="button"
            >
              Reset form
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Filters stay in the route so you can reopen the same external-coordination slice without rebuilding the view."
        title="Queue filters"
      >
        <div className="office-form-grid">
          <FormField label="Client">
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  clientId: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.clientId}
            >
              <option value="">All visible clients</option>
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

          <FormField label="Appointment type">
            <SelectInput
              onChange={(event) =>
                navigateWithFilters({
                  type: event.target.value,
                  appointmentId: "",
                })
              }
              value={filterState.type}
            >
              <option value="">All appointment types</option>
              {props.snapshot.typeOptions.map((option) => (
                <option key={`type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Acre status">
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

          <FormField label="Follow-up rhythm">
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

          <FormField label="Coordination state">
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
              Route state
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
              Deep link shell
            </span>
            <strong>
              {returnToLabel || "No return path is currently attached"}
            </strong>
            <p>
              Appointment focus and active filters stay in the URL. If a safe
              relative <code>returnTo</code> comes in from another Front Office
              page, this shell keeps it while you refine the queue.
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
                  Clear focus lock
                </Button>
              ) : null}
              {hasQueueFilters ? (
                <Button
                  disabled={isBusy}
                  onClick={clearQueueFilters}
                  size="sm"
                  variant="secondary"
                >
                  Clear queue filters
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="front-office-calendar-badges">
          <Badge tone="accent">
            Showing {props.snapshot.filteredSummary.appointmentCount}
          </Badge>
          <Badge tone="warning">
            Awaiting reply {props.snapshot.filteredSummary.awaitingReplyCount}
          </Badge>
          <Badge tone="danger">
            Touch due {props.snapshot.filteredSummary.touchDueCount}
          </Badge>
          <Badge tone="warning">
            Missing next touch{" "}
            {props.snapshot.filteredSummary.missingTouchPlanCount}
          </Badge>
          <Badge tone="success">
            Confirmed {props.snapshot.filteredSummary.confirmedCount}
          </Badge>
          <Badge tone="warning">
            Bridge pending {props.snapshot.filteredSummary.bridgePendingCount}
          </Badge>
        </div>

        <div className="front-office-calendar-actions">
          <Button
            onClick={() =>
              navigateWithFilters({
                followUp: "response_waiting",
                coordination: "all",
                appointmentId: "",
              })
            }
            size="sm"
            variant={
              filterState.followUp === "response_waiting" ? "primary" : "secondary"
            }
          >
            Needs reply
          </Button>
          <Button
            onClick={() =>
              navigateWithFilters({
                followUp: "touch_due",
                coordination: "all",
                appointmentId: "",
              })
            }
            size="sm"
            variant={filterState.followUp === "touch_due" ? "primary" : "secondary"}
          >
            Touch due
          </Button>
          <Button
            onClick={() =>
              navigateWithFilters({
                followUp: "next_touch_missing",
                coordination: "all",
                appointmentId: "",
              })
            }
            size="sm"
            variant={
              filterState.followUp === "next_touch_missing"
                ? "primary"
                : "secondary"
            }
          >
            Missing next touch
          </Button>
          <Button
            onClick={() =>
              navigateWithFilters({
                followUp: "confirmed",
                coordination: "all",
                appointmentId: "",
              })
            }
            size="sm"
            variant={filterState.followUp === "confirmed" ? "primary" : "secondary"}
          >
            Confirmed
          </Button>
          <Button
            onClick={() =>
              navigateWithFilters({
                coordination: "writeback_pending",
                followUp: "all",
                appointmentId: "",
              })
            }
            size="sm"
            variant={
              filterState.coordination === "writeback_pending"
                ? "primary"
                : "secondary"
            }
          >
            Bridge pending
          </Button>
        </div>

        <div className="office-form-actions">
          <button
            className="office-button-secondary"
            disabled={isBusy || !hasQueueFilters}
            onClick={clearQueueFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Use the focused panel to review the latest bridge activity, update the writeback, and keep the promised next touch readable without implying provider-owned sync."
        title="Focus appointment"
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
                      ? "This appointment is pinned from the route even though the current queue slice hides it."
                      : "This appointment is pinned directly in the route state."}
                </strong>
                <p>
                  {selectedClientLabel
                    ? `Client scope is currently ${selectedClientLabel}. `
                    : "The client scope is still broad. "}
                  {filterState.appointmentId
                    ? "The appointmentId remains in the URL until you clear the focus lock."
                    : "Lock a specific appointment to create a durable deep link back to this same detail panel."}
                </p>
                <div className="front-office-record-meta">
                  <span>{focusedAppointment.clientLabel}</span>
                  <span>{focusedAppointment.typeLabel}</span>
                  <span>{focusedAppointment.startsAtLabel}</span>
                </div>
              </div>
              <div className="front-office-ai-explainability-card">
                <span className="front-office-ai-explainability-kicker">
                  Navigation shell
                </span>
                <strong>
                  {returnToLabel || "No upstream return path was supplied"}
                </strong>
                <p>
                  {returnToLabel
                    ? "Use the preserved return path to step back without losing the calendar slice you reopened here."
                    : "Direct visits can still move through the client dossier, listing output, or a new route-locked focus link from this shell."}
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
                      Clear focus lock
                    </Button>
                  ) : null}
                  {hasQueueFilters ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearQueueFilters}
                      size="sm"
                      variant="secondary"
                    >
                      Clear queue filters
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
                </div>
              </div>

              <div className="list-row-meta front-office-record-meta">
                <span>Ends {focusedAppointment.endsAtLabel}</span>
                <span>{focusedAppointment.clientLabel}</span>
                <span>{focusedAppointment.clientEmailLabel}</span>
                <span>{focusedAppointment.contactLabel}</span>
                <span>{focusedAppointment.listingLabel}</span>
                <span>{focusedAppointment.locationLabel}</span>
                <span>{focusedAppointment.bridgeLoggedAtLabel}</span>
              </div>

              <p>{focusedAppointment.notesLabel}</p>
              <p className="front-office-record-supporting">
                {focusedAppointment.coordinationDetail}
              </p>
              <p className="front-office-record-supporting">
                Next step: {focusedAppointment.coordinationNextStep}
              </p>
            </article>

            <div className="office-queue-list">
              <QueueItem
                badgeLabel={focusedAppointment.externalStatusLabel}
                badgeTone={focusedAppointment.externalStatusTone}
                description={focusedAppointment.externalStatusDetail}
                meta={
                  <>
                    <span>{focusedAppointment.bridgeStatusLabel}</span>
                    <span>{focusedAppointment.latestCoordinationDetail}</span>
                  </>
                }
                title="What Acre knows"
              />
              <QueueItem
                badgeLabel={focusedAppointment.followUpPlanLabel}
                badgeTone={focusedAppointment.followUpPlanTone}
                description={focusedAppointment.followUpPlanDetail}
                meta={
                  <>
                    <span>{focusedAppointment.externalNextActionAtLabel}</span>
                    <span>Next step: {focusedAppointment.coordinationNextStep}</span>
                  </>
                }
                title="Follow-up rhythm"
              />
            </div>

            <div className="front-office-calendar-actions">
              {focusedAppointment.clientHref ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={focusedAppointment.clientHref}
                >
                  Open client dossier
                </FrontOfficeLink>
              ) : null}
              {focusedAppointment.listingOutputHref ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={focusedAppointment.listingOutputHref}
                >
                  Open listing output
                </FrontOfficeLink>
              ) : null}
              {filterState.appointmentId ? (
                <Button
                  disabled={isBusy}
                  onClick={clearFocusLock}
                  size="sm"
                  variant="secondary"
                >
                  Clear focus lock
                </Button>
              ) : null}
            </div>

            {focusedAppointment.statusValue === "scheduled" ? (
              <>
                <div className="front-office-ai-explainability is-compact">
                  <div className="front-office-ai-explainability-card">
                    <span className="front-office-ai-explainability-kicker">
                      Bridge shell
                    </span>
                    <strong>{focusedAppointment.bridgeActionLabel}</strong>
                    <p>
                      Google, Outlook, ICS, and email actions only open drafts
                      or exports from this appointment and log that bridge trail
                      here. Acre is not claiming provider-owned sync.
                    </p>
                    <div className="front-office-record-meta">
                      <span>{focusedAppointment.bridgeStatusLabel}</span>
                      <span>{focusedAppointment.bridgeLoggedAtLabel}</span>
                    </div>
                  </div>
                  <div className="front-office-ai-explainability-card">
                    <span className="front-office-ai-explainability-kicker">
                      Writeback shell
                    </span>
                    <strong>{focusedAppointment.externalStatusLabel}</strong>
                    <p>
                      Quick coordination actions and saved writebacks only update
                      Acre&apos;s readable coordination record. They do not
                      auto-send email, create background jobs, or schedule
                      provider events for you.
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
                    Bridge actions open a draft or export in a new tab. The
                    history below records that you opened the bridge from Acre,
                    but it does not claim the outside calendar or inbox synced
                    back automatically.
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
                        : "Draft client email"}
                    </button>
                  ) : (
                    <p className="front-office-record-supporting">
                      Client email is missing, so the email brief is not
                      available yet.
                    </p>
                  )}
                </div>

                <div className="front-office-calendar-writeback">
                  <div className="front-office-calendar-writeback-head">
                    <span className="front-office-calendar-writeback-label">
                      Quick coordination actions
                    </span>
                    <p className="front-office-record-supporting">
                      These quick actions update Acre&apos;s writeback only.
                      They do not send mail, change Google or Outlook, or claim
                      any background sync.
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
                        Follow-up rhythm presets
                      </span>
                      <p className="front-office-record-supporting">
                        Use these to save a suggested status plus next-touch
                        checkpoint directly into Acre. They do not send mail or
                        update Google / Outlook in the background.
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

                <div className="front-office-calendar-writeback">
                  <div className="front-office-calendar-writeback-head">
                    <span className="front-office-calendar-writeback-label">
                      Coordination writeback
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
                      Save what happened outside Acre and when the next external
                      touch should come back into view on this same appointment
                      record.
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
                      placeholder="Next external touch"
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
                      placeholder="What happened outside Acre, and what are you waiting on next?"
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
                          Load {preset.label}
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
                      Save writeback
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
                    Mark complete
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleStatusUpdate(focusedAppointment.id, "no_show")
                    }
                    type="button"
                  >
                    No-show
                  </button>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleStatusUpdate(focusedAppointment.id, "canceled")
                    }
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="front-office-record-supporting">
                This appointment is no longer scheduled in Acre, so the external
                coordination controls stay read-only here unless you create a
                new appointment or reopen the plan elsewhere.
              </p>
            )}

            <div className="office-queue-list">
              <QueueItem
                badgeLabel={`${focusedAppointment.bridgeHistory.length}`}
                badgeTone={focusedAppointment.hasBridgeActivity ? "accent" : "neutral"}
                description={
                  latestBridgeHistory
                    ? `${latestBridgeHistory.label} · ${latestBridgeHistory.detail}`
                    : "Open Google, Outlook, ICS, or the email brief from Acre to start the bridge trail."
                }
                meta={
                  latestBridgeHistory ? (
                    <>
                      <span>{latestBridgeHistory.actorLabel}</span>
                      <span>{latestBridgeHistory.createdAtLabel}</span>
                    </>
                  ) : (
                    <span>No bridge history yet</span>
                  )
                }
                title="Bridge trail"
              />
              <QueueItem
                badgeLabel={`${focusedAppointment.writebackHistory.length}`}
                badgeTone={
                  focusedAppointment.hasWritebackHistory ? "success" : "neutral"
                }
                description={
                  latestWritebackHistory
                    ? `${latestWritebackHistory.label} · ${latestWritebackHistory.detail}`
                    : "Use a quick action or save the writeback form to create the first coordination history entry."
                }
                meta={
                  latestWritebackHistory ? (
                    <>
                      <span>{latestWritebackHistory.actorLabel}</span>
                      <span>{latestWritebackHistory.createdAtLabel}</span>
                    </>
                  ) : (
                    <span>No writeback history yet</span>
                  )
                }
                title="Writeback trail"
              />
            </div>

            <div>
              <div className="front-office-calendar-writeback-head">
                <span className="front-office-calendar-writeback-label">
                  Coordination timeline
                </span>
                <p className="front-office-record-supporting">
                  The latest bridge opens and writeback saves on this
                  appointment, combined into one readable chronology.
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
                          {item.kind === "bridge" ? "Bridge" : "Writeback"}
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
                    description="Open a bridge or save a writeback to start the coordination timeline for this appointment."
                    title="No coordination history yet"
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
                    Clear focus lock
                  </Button>
                ) : null}
                {hasQueueFilters ? (
                  <Button
                    disabled={isBusy}
                    onClick={clearQueueFilters}
                    size="sm"
                    variant="secondary"
                  >
                    Clear queue filters
                  </Button>
                ) : null}
                <Button onClick={scrollToScheduleForm} size="sm" variant="secondary">
                  Jump to schedule form
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
                ? "The URL still carries an appointmentId, but Acre can no longer resolve that record in your visible Front Office scope. Clear the focus lock or step back to the source page."
                : selectedClientLabel
                  ? `No appointment is currently in focus for ${selectedClientLabel}. Use the schedule form above to create the first showing, consultation, or meeting in this client context.`
                  : "Pick an appointment from the queue below, or use the schedule form above if this slice is still empty."
            }
            title={
              focusState.mode === "missing"
                ? "Focused appointment could not be resolved"
                : selectedClientLabel
                  ? `No focused appointment for ${selectedClientLabel}`
                  : "No focused appointment"
            }
          />
        )}
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={`Showing ${props.snapshot.filteredSummary.appointmentCount} appointments in the current route state, with the compact queue focused on signal density instead of inline bridge forms.`}
        title="Upcoming appointments"
      >
        <div className="list-column front-office-record-list">
          {props.snapshot.appointments.length ? (
            props.snapshot.appointments.map((appointment) => {
              const isFocused = focusedAppointment?.id === appointment.id;

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
                      <StatusBadge tone={appointment.followUpPlanTone}>
                        {appointment.followUpPlanLabel}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="list-row-meta front-office-record-meta">
                    <span>{appointment.clientLabel}</span>
                    <span>{appointment.listingLabel}</span>
                    <span>{appointment.locationLabel}</span>
                    <span>{appointment.externalNextActionAtLabel}</span>
                    <span>{appointment.bridgeLoggedAtLabel}</span>
                    <span>{appointment.latestCoordinationLabel}</span>
                    <span>{appointment.latestCoordinationDetail}</span>
                  </div>

                  <p>{appointment.notesLabel}</p>
                  <p className="front-office-record-supporting">
                    {appointment.followUpPlanDetail}
                  </p>
                  <p className="front-office-record-supporting">
                    {appointment.coordinationDetail}
                  </p>
                  <p className="front-office-record-supporting">
                    Next step: {appointment.coordinationNextStep}
                  </p>

                  <div className="front-office-calendar-actions">
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={buildCalendarHref(pathname, searchParams, {
                        appointmentId: appointment.id,
                      })}
                    >
                      {isFocused ? "Focused below" : "Open in focus panel"}
                    </FrontOfficeLink>
                    {appointment.clientHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={appointment.clientHref}
                      >
                        Client dossier
                      </FrontOfficeLink>
                    ) : null}
                    {appointment.listingOutputHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={appointment.listingOutputHref}
                      >
                        Listing output
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
                        Confirm in Acre
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
                      Clear queue filters
                    </Button>
                  ) : null}
                  {filterState.appointmentId ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearFocusLock}
                      size="sm"
                      variant="secondary"
                    >
                      Clear focus lock
                    </Button>
                  ) : null}
                  <Button onClick={scrollToScheduleForm} size="sm" variant="secondary">
                    Jump to schedule form
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
                  ? "The appointment pinned above is still readable, but the current queue filters leave this list empty."
                  : selectedClientLabel
                    ? `There are no visible appointments for ${selectedClientLabel} in this route slice yet.`
                    : hasQueueFilters
                      ? "The current route filters do not match any visible appointments right now."
                      : "Schedule the first showing, consultation, or client meeting from the form above."
              }
              title={
                selectedClientLabel && !props.snapshot.appointments.length
                  ? `No appointments queued for ${selectedClientLabel}`
                  : "No appointments in this queue"
              }
            />
          )}
        </div>
      </SectionCard>
    </>
  );
}
