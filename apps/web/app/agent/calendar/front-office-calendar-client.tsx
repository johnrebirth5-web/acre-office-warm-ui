"use client";

import {
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
  EmptyState,
  FormField,
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
  status: string;
  coordination: string;
  appointmentId: string;
};

type FilterUpdate = Partial<FilterState>;

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

  const nextAppointmentId = update.appointmentId;
  if (nextAppointmentId !== undefined) {
    if (nextAppointmentId) {
      params.set("appointmentId", nextAppointmentId);
    } else {
      params.delete("appointmentId");
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function readFilterState(searchParams: ReadonlyURLSearchParams): FilterState {
  return {
    clientId: searchParams.get("clientId") ?? "",
    status: searchParams.get("status") ?? "all",
    coordination: searchParams.get("coordination") ?? "all",
    appointmentId: searchParams.get("appointmentId") ?? "",
  };
}

function focusAppointmentFromSnapshot(
  snapshot: FrontOfficeAppointmentsSnapshot,
  filterState: FilterState,
) {
  if (snapshot.selectedAppointment) {
    return snapshot.selectedAppointment;
  }

  if (!snapshot.appointments.length) {
    return null;
  }

  if (!filterState.appointmentId) {
    return snapshot.appointments[0];
  }

  return (
    snapshot.appointments.find(
      (appointment) => appointment.id === filterState.appointmentId,
    ) ?? snapshot.appointments[0]
  );
}

export function FrontOfficeCalendarClient(
  props: FrontOfficeCalendarClientProps,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterState = readFilterState(searchParams);
  const focusedAppointment = focusAppointmentFromSnapshot(
    props.snapshot,
    filterState,
  );
  const [formState, setFormState] = useState<AppointmentFormState>(() =>
    buildEmptyFormState(props.initialClientId),
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

  function clearSavedWritebackDraft(appointmentId: string) {
    setWritebackDrafts((current) => {
      const next = { ...current };
      delete next[appointmentId];
      return next;
    });
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
      setFormState(buildEmptyFormState(props.initialClientId));
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
    const draft =
      writebackDrafts[appointment.id] ?? buildWritebackDraft(appointment);

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
    const draft =
      writebackDrafts[appointment.id] ?? buildWritebackDraft(appointment);
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
        <form className="front-office-calendar-form" onSubmit={handleSubmit}>
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
              onClick={() => {
                setFeedback(null);
                setFormState(buildEmptyFormState(props.initialClientId));
              }}
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
              {props.snapshot.clientOptions.map((option) => (
                <option key={`filter-${option.value}`} value={option.value}>
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
          <Badge tone="success">
            Confirmed {props.snapshot.filteredSummary.confirmedCount}
          </Badge>
          <Badge tone="warning">
            Bridge pending {props.snapshot.filteredSummary.bridgePendingCount}
          </Badge>
        </div>

        <div className="office-form-actions">
          <button
            className="office-button-secondary"
            disabled={
              isBusy ||
              !filterState.clientId &&
              filterState.status === "all" &&
              filterState.coordination === "all" &&
              !filterState.appointmentId
            }
            onClick={() =>
              navigateWithFilters({
                clientId: "",
                status: "all",
                coordination: "all",
                appointmentId: "",
              })
            }
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
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={isBusy}
                  onClick={() =>
                    navigateWithFilters({
                      appointmentId: "",
                    })
                  }
                  type="button"
                >
                  Clear focus lock
                </button>
              ) : null}
            </div>

            {focusedAppointment.statusValue === "scheduled" ? (
              <>
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
                      value={
                        (
                          writebackDrafts[focusedAppointment.id] ??
                          buildWritebackDraft(focusedAppointment)
                        ).status
                      }
                    >
                      {externalStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                    <TextInput
                      className="front-office-calendar-writeback-next-touch"
                      disabled={
                        (
                          writebackDrafts[focusedAppointment.id] ??
                          buildWritebackDraft(focusedAppointment)
                        ).status === "idle"
                      }
                      onChange={(event) =>
                        handleWritebackDraftChange(
                          focusedAppointment,
                          "nextActionAt",
                          event.target.value,
                        )
                      }
                      placeholder="Next external touch"
                      type="datetime-local"
                      value={
                        (
                          writebackDrafts[focusedAppointment.id] ??
                          buildWritebackDraft(focusedAppointment)
                        ).nextActionAt
                      }
                    />
                    <TextareaInput
                      className="front-office-calendar-writeback-note"
                      disabled={
                        (
                          writebackDrafts[focusedAppointment.id] ??
                          buildWritebackDraft(focusedAppointment)
                        ).status === "idle"
                      }
                      onChange={(event) =>
                        handleWritebackDraftChange(
                          focusedAppointment,
                          "note",
                          event.target.value,
                        )
                      }
                      placeholder="What happened outside Acre, and what are you waiting on next?"
                      rows={2}
                      value={
                        (
                          writebackDrafts[focusedAppointment.id] ??
                          buildWritebackDraft(focusedAppointment)
                        ).note
                      }
                    />
                    <button
                      className="office-button-secondary office-inline-action-sm"
                      disabled={
                        isBusy ||
                        !didWritebackChange(
                          focusedAppointment,
                          writebackDrafts[focusedAppointment.id] ??
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
              <div>
                <div className="front-office-calendar-writeback-head">
                  <span className="front-office-calendar-writeback-label">
                    Bridge history
                  </span>
                  <p className="front-office-record-supporting">
                    The last few Google / Outlook / ICS / email bridge opens
                    from Acre for this appointment.
                  </p>
                </div>
                <div className="list-column front-office-record-list">
                  {focusedAppointment.bridgeHistory.length ? (
                    focusedAppointment.bridgeHistory.map((item) => (
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
                      description="Open Google, Outlook, ICS, or the email brief from Acre to start the bridge trail."
                      title="No bridge history yet"
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="front-office-calendar-writeback-head">
                  <span className="front-office-calendar-writeback-label">
                    Writeback history
                  </span>
                  <p className="front-office-record-supporting">
                    The latest saved confirmation, reschedule, note, and
                    next-touch changes on this same appointment record.
                  </p>
                </div>
                <div className="list-column front-office-record-list">
                  {focusedAppointment.writebackHistory.length ? (
                    focusedAppointment.writebackHistory.map((item) => (
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
                      description="Use a quick action or save the writeback form to create the first coordination history entry."
                      title="No writeback history yet"
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            description="Pick an appointment from the queue below, or clear filters if the current slice is empty."
            title="No focused appointment"
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
                      <Badge tone={appointment.bridgeStatusTone}>
                        {appointment.bridgeActionLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="list-row-meta front-office-record-meta">
                    <span>{appointment.clientLabel}</span>
                    <span>{appointment.listingLabel}</span>
                    <span>{appointment.locationLabel}</span>
                    <span>{appointment.externalNextActionAtLabel}</span>
                    <span>{appointment.bridgeLoggedAtLabel}</span>
                    <span>{appointment.bridgeHistory.length} bridge logs</span>
                    <span>
                      {appointment.writebackHistory.length} writebacks
                    </span>
                  </div>

                  <p>{appointment.notesLabel}</p>
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
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              description={
                focusedAppointment
                  ? "The current filters hide the queue, but the focused appointment stays readable above."
                  : "Schedule the first showing, consultation, or client meeting from the form above."
              }
              title="No appointments in this queue"
            />
          )}
        </div>
      </SectionCard>
    </>
  );
}
