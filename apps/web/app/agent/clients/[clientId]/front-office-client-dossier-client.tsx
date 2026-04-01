"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import { Button, EmptyState, FormField, QueueItem, TextInput } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../../_components/front-office-link";

type FrontOfficeClientDossierClientProps = {
  snapshot: FrontOfficeClientDetailSnapshot;
};

type FollowUpFormState = {
  title: string;
  dueAt: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

function buildDefaultDueAt() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function buildEmptyFormState(): FollowUpFormState {
  return {
    title: "",
    dueAt: buildDefaultDueAt(),
  };
}

export function FrontOfficeClientDossierClient(
  props: FrontOfficeClientDossierClientProps,
) {
  const router = useRouter();
  const [formState, setFormState] =
    useState<FollowUpFormState>(buildEmptyFormState);
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
        `/api/agent/clients/${props.snapshot.id}/follow-up-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formState.title,
            dueAt: formState.dueAt,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Could not create the follow-up task.",
        });
        setIsSaving(false);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          "Follow-up created. The dossier will refresh with the new task and next-touch signal.",
      });
      setFormState(buildEmptyFormState());
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not create the follow-up task.",
      });
      setIsSaving(false);
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="office-queue-list">
        <QueueItem
          badgeLabel={props.snapshot.workflow.pressureLabel}
          badgeTone={props.snapshot.workflow.pressureTone}
          description={props.snapshot.workflow.pressureDescription}
          title="Workflow pressure"
        />
        <QueueItem
          action={
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.workflow.actionHref}
            >
              {props.snapshot.workflow.actionLabel}
            </FrontOfficeLink>
          }
          badgeLabel="Suggested next step"
          badgeTone={props.snapshot.workflow.nextStepTone}
          description={props.snapshot.workflow.nextStepDescription}
          title={props.snapshot.workflow.nextStepTitle}
        />
      </div>

      <div className="front-office-placeholder-note">
        <strong>Create follow-up</strong>
        <p>
          This writes into the shared follow-up queue and keeps the
          dossier&apos;s next-touch signal current for Front Office and Back
          Office views.
        </p>

        <form
          className="front-office-calendar-form"
          id="front-office-follow-up-form"
          onSubmit={handleSubmit}
        >
          <div className="office-form-grid">
            <FormField
              className="office-form-grid-span-2"
              helper="Use a direct action title so the next move is obvious in the queue."
              label="Task title"
            >
              <TextInput
                name="title"
                onChange={handleFieldChange}
                placeholder="Call client after viewing feedback"
                value={formState.title}
              />
            </FormField>

            <FormField
              helper="Optional, but recommended so stale pressure stays accurate."
              label="Due date"
            >
              <TextInput
                name="dueAt"
                onChange={handleFieldChange}
                type="date"
                value={formState.dueAt}
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
            <Button disabled={isBusy || !formState.title.trim()} type="submit">
              {isBusy ? "Saving..." : "Create follow-up"}
            </Button>
          </div>
        </form>
      </div>

      <div className="office-queue-list">
        {props.snapshot.followUpTasks.length ? (
          props.snapshot.followUpTasks.map((task) => (
            <QueueItem
              badgeLabel={task.statusLabel}
              badgeTone={task.tone}
              description={task.dueLabel}
              key={task.id}
              meta={<span>{task.assigneeLabel}</span>}
              title={task.title}
            />
          ))
        ) : (
          <EmptyState
            description="Create the first follow-up here so this client never falls out of the execution queue."
            title="No follow-up tasks yet"
          />
        )}
      </div>
    </div>
  );
}
