"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import { Button, FormField, QueueItem, TextInput } from "@acre/ui";
import { useRouter } from "next/navigation";

type FrontOfficeClientLeaseReminderClientProps = {
  snapshot: FrontOfficeClientDetailSnapshot;
};

type LeaseReminderFormState = {
  leaseEndDate: string;
  leaseReminderAt: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

function buildInitialFormState(
  snapshot: FrontOfficeClientDetailSnapshot,
): LeaseReminderFormState {
  return {
    leaseEndDate: snapshot.leaseReminder.leaseEndDateValue,
    leaseReminderAt: snapshot.leaseReminder.reminderAtValue,
  };
}

export function FrontOfficeClientLeaseReminderClient(
  props: FrontOfficeClientLeaseReminderClientProps,
) {
  const router = useRouter();
  const [formState, setFormState] = useState<LeaseReminderFormState>(() =>
    buildInitialFormState(props.snapshot),
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;

  function handleFieldChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/agent/clients/${props.snapshot.id}/lease-reminder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formState),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Could not save the lease reminder.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          "Lease reminder saved. The dossier and dashboard will refresh with the new renewal timing.",
      });
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not save the lease reminder.",
      });
      setIsSaving(false);
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="office-queue-list">
        <QueueItem
          badgeLabel={props.snapshot.leaseReminder.statusLabel}
          badgeTone={props.snapshot.leaseReminder.statusTone}
          description={props.snapshot.leaseReminder.helperText}
          meta={
            <span>
              Lease end: {props.snapshot.leaseReminder.leaseEndDateLabel} ·
              Reminder: {props.snapshot.leaseReminder.reminderAtLabel}
            </span>
          }
          title="Renewal / remarketing window"
        />
      </div>

      <div className="front-office-placeholder-note">
        <strong>Set lease reminder</strong>
        <p>
          Capture the lease end and reminder date here so renewal,
          remarketing, and move planning stay visible in Front Office.
        </p>

        <form
          className="front-office-calendar-form"
          id="front-office-lease-reminder-form"
          onSubmit={handleSubmit}
        >
          <div className="office-form-grid">
            <FormField
              helper="Optional, but recommended so Acre can anchor the renewal window to a real lease date."
              label="Lease end date"
            >
              <TextInput
                name="leaseEndDate"
                onChange={handleFieldChange}
                type="date"
                value={formState.leaseEndDate}
              />
            </FormField>

            <FormField
              helper="Leave blank to let Acre auto-schedule the reminder 45 days before lease end."
              label="Lease reminder date"
            >
              <TextInput
                name="leaseReminderAt"
                onChange={handleFieldChange}
                type="date"
                value={formState.leaseReminderAt}
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

          <div className="front-office-calendar-actions">
            <Button disabled={isBusy} type="submit">
              {isBusy ? "Saving..." : "Save lease reminder"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
