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
import { useRouter } from "next/navigation";
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

export function FrontOfficeCalendarClient(
  props: FrontOfficeCalendarClientProps,
) {
  const router = useRouter();
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
      const existing = current[appointment.id] ?? buildWritebackDraft(appointment);
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
    const draft = writebackDrafts[appointment.id] ?? buildWritebackDraft(appointment);

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/agent/appointments/${appointment.id}`, {
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
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message:
            payload?.error ?? "Could not update the external appointment state.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message: "Appointment external writeback updated.",
      });
      setWritebackDrafts((current) => {
        const next = { ...current };
        delete next[appointment.id];
        return next;
      });
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
      const payload = (await response.json().catch(() => null)) as
        | BridgeActionResponse
        | null;

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
        subtitle="Upcoming items stay compact here so you can see the latest bridge action, the current writeback read, and the next external touch without leaving the queue."
        title="Upcoming appointments"
      >
        <div className="list-column front-office-record-list">
          {props.snapshot.appointments.length ? (
            props.snapshot.appointments.map((appointment) => {
              const writebackDraft =
                writebackDrafts[appointment.id] ??
                buildWritebackDraft(appointment);
              const writebackChanged = didWritebackChange(
                appointment,
                writebackDraft,
              );
              const isScheduled = appointment.statusValue === "scheduled";
              const activeBridgeAction =
                bridgeState?.appointmentId === appointment.id
                  ? bridgeState.action
                  : null;

              return (
                <article
                  className="list-row front-office-record"
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
                  </div>

                  <p>{appointment.notesLabel}</p>
                  <p className="front-office-record-supporting">
                    {appointment.coordinationDetail}
                  </p>
                  <p className="front-office-record-supporting">
                    Next step: {appointment.coordinationNextStep}
                  </p>

                  {isScheduled ? (
                    <div className="front-office-calendar-actions">
                      <p className="front-office-record-supporting">
                        Open the outside draft or export in a new tab, then keep
                        the confirmation trail readable here with the writeback
                        fields below.
                      </p>
                      {appointment.listingOutputHref ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={appointment.listingOutputHref}
                        >
                          Open listing output
                        </FrontOfficeLink>
                      ) : null}
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={activeBridgeAction !== null}
                        onClick={() =>
                          handleBridgeAction(appointment, "google_calendar")
                        }
                        type="button"
                      >
                        {activeBridgeAction === "google_calendar"
                          ? "Opening..."
                          : "Open Google draft"}
                      </button>
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={activeBridgeAction !== null}
                        onClick={() =>
                          handleBridgeAction(appointment, "outlook_calendar")
                        }
                        type="button"
                      >
                        {activeBridgeAction === "outlook_calendar"
                          ? "Opening..."
                          : "Open Outlook draft"}
                      </button>
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={activeBridgeAction !== null}
                        onClick={() =>
                          handleBridgeAction(appointment, "ics_download")
                        }
                        type="button"
                      >
                        {activeBridgeAction === "ics_download"
                          ? "Preparing..."
                          : "Download ICS"}
                      </button>
                      {appointment.emailBriefHref ? (
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={activeBridgeAction !== null}
                          onClick={() =>
                            handleBridgeAction(appointment, "email_brief")
                          }
                          type="button"
                        >
                          {activeBridgeAction === "email_brief"
                            ? "Opening..."
                            : "Draft client email"}
                        </button>
                      ) : (
                        <p className="front-office-record-supporting">
                          Client email is missing, so the email brief is not
                          available yet.
                        </p>
                      )}
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        onClick={() =>
                          handleStatusUpdate(appointment.id, "completed")
                        }
                        type="button"
                      >
                        Mark complete
                      </button>
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        onClick={() =>
                          handleStatusUpdate(appointment.id, "no_show")
                        }
                        type="button"
                      >
                        No-show
                      </button>
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        onClick={() =>
                          handleStatusUpdate(appointment.id, "canceled")
                        }
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  {isScheduled ? (
                    <div className="front-office-calendar-writeback">
                      <div className="front-office-calendar-writeback-head">
                        <span className="front-office-calendar-writeback-label">
                          Coordination writeback
                        </span>
                        <div className="front-office-calendar-badges">
                          <StatusBadge tone={appointment.coordinationTone}>
                            {appointment.coordinationLabel}
                          </StatusBadge>
                          <Badge tone={appointment.bridgeStatusTone}>
                            {appointment.bridgeStatusLabel}
                          </Badge>
                        </div>
                        <p className="front-office-record-supporting">
                          This is still the same appointment record, not a
                          separate sync layer. Save what happened outside Acre
                          and when you want the next external touch to come back
                          into view.
                        </p>
                      </div>
                      <div className="front-office-calendar-writeback-fields">
                        <SelectInput
                          className="front-office-calendar-writeback-select"
                          onChange={(event) =>
                            handleWritebackDraftChange(
                              appointment,
                              "status",
                              event.target.value,
                            )
                          }
                          value={writebackDraft.status}
                        >
                          {externalStatusOptions.map((option) => (
                            <option
                              key={`${appointment.id}-${option.value}`}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </SelectInput>
                        <TextInput
                          className="front-office-calendar-writeback-next-touch"
                          disabled={writebackDraft.status === "idle"}
                          onChange={(event) =>
                            handleWritebackDraftChange(
                              appointment,
                              "nextActionAt",
                              event.target.value,
                            )
                          }
                          placeholder="Next external touch"
                          type="datetime-local"
                          value={writebackDraft.nextActionAt}
                        />
                        <TextareaInput
                          className="front-office-calendar-writeback-note"
                          disabled={writebackDraft.status === "idle"}
                          onChange={(event) =>
                            handleWritebackDraftChange(
                              appointment,
                              "note",
                              event.target.value,
                            )
                          }
                          placeholder="What happened outside Acre, and what are you waiting on next?"
                          rows={2}
                          value={writebackDraft.note}
                        />
                        <button
                          className="office-button-secondary office-inline-action-sm"
                          disabled={isBusy || !writebackChanged}
                          onClick={() => handleExternalStatusUpdate(appointment)}
                          type="button"
                        >
                          Save writeback
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <EmptyState
              description="Schedule the first showing, consultation, or client meeting from the form above."
              title="No appointments yet"
            />
          )}
        </div>
      </SectionCard>
    </>
  );
}
