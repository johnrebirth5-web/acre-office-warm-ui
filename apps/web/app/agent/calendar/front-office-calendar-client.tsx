"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type {
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

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

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

export function FrontOfficeCalendarClient(
  props: FrontOfficeCalendarClientProps,
) {
  const router = useRouter();
  const [formState, setFormState] = useState<AppointmentFormState>(() =>
    buildEmptyFormState(props.initialClientId),
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [externalStatusDrafts, setExternalStatusDrafts] = useState<
    Record<string, FrontOfficeAppointmentExternalWorkflowStatus>
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

  function handleExternalStatusDraftChange(
    appointmentId: string,
    value: FrontOfficeAppointmentExternalWorkflowStatus,
  ) {
    setExternalStatusDrafts((current) => ({
      ...current,
      [appointmentId]: value,
    }));
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

  async function handleExternalStatusUpdate(appointmentId: string) {
    const appointment = props.snapshot.appointments.find(
      (item) => item.id === appointmentId,
    );
    const nextExternalStatus =
      externalStatusDrafts[appointmentId] ?? appointment?.externalStatusValue;

    if (!appointment || !nextExternalStatus) {
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/agent/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          externalStatus: nextExternalStatus,
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
      setExternalStatusDrafts((current) => {
        const next = { ...current };
        delete next[appointmentId];
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
        subtitle="Upcoming items stay compact here so you can confirm, cancel, or close them without leaving the queue, while the reminder badge shows which appointments need near-term attention."
        title="Upcoming appointments"
      >
        <div className="list-column front-office-record-list">
          {props.snapshot.appointments.length ? (
            props.snapshot.appointments.map((appointment) => (
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
                  </div>
                </div>

                <div className="list-row-meta front-office-record-meta">
                  <span>{appointment.clientLabel}</span>
                  <span>{appointment.listingLabel}</span>
                  <span>{appointment.locationLabel}</span>
                  <span>{appointment.bridgeStatusLabel}</span>
                </div>

                <p>{appointment.notesLabel}</p>
                <p className="front-office-record-supporting">
                  {appointment.externalStatusDetail}
                </p>
                <p className="front-office-record-supporting">
                  {appointment.bridgeStatusDetail}
                </p>

                {appointment.statusLabel === "Scheduled" ? (
                  <div className="front-office-calendar-actions">
                    {appointment.listingOutputHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={appointment.listingOutputHref}
                      >
                        Open listing output
                      </FrontOfficeLink>
                    ) : null}
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={appointment.googleCalendarHref}
                    >
                      Google Calendar
                    </FrontOfficeLink>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={appointment.outlookCalendarHref}
                    >
                      Outlook
                    </FrontOfficeLink>
                    <a
                      className="office-inline-link front-office-inline-link"
                      href={appointment.icsHref}
                    >
                      Download ICS
                    </a>
                    {appointment.emailBriefHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={appointment.emailBriefHref}
                      >
                        Email client
                      </FrontOfficeLink>
                    ) : null}
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

                {appointment.statusLabel === "Scheduled" ? (
                  <div className="front-office-calendar-writeback">
                    <span className="front-office-calendar-writeback-label">
                      External writeback
                    </span>
                    <SelectInput
                      className="front-office-calendar-writeback-select"
                      onChange={(event) =>
                        handleExternalStatusDraftChange(
                          appointment.id,
                          event.target
                            .value as FrontOfficeAppointmentExternalWorkflowStatus,
                        )
                      }
                      value={
                        externalStatusDrafts[appointment.id] ??
                        appointment.externalStatusValue
                      }
                    >
                      {externalStatusOptions.map((option) => (
                        <option key={`${appointment.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                    <button
                      className="office-button-secondary office-inline-action-sm"
                      disabled={
                        isBusy ||
                        (externalStatusDrafts[appointment.id] ??
                          appointment.externalStatusValue) ===
                          appointment.externalStatusValue
                      }
                      onClick={() => handleExternalStatusUpdate(appointment.id)}
                      type="button"
                    >
                      Save writeback
                    </button>
                  </div>
                ) : null}
              </article>
            ))
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
