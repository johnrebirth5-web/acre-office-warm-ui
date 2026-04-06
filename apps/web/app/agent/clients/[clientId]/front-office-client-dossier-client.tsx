"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import { Button, EmptyState, FormField, QueueItem, TextInput } from "@acre/ui";
import { useRouter } from "next/navigation";
import {
  FrontOfficeClientActionGroup,
  frontOfficeClientDossierSectionIds,
  getFrontOfficeClientDossierSectionHref,
} from "./front-office-client-dossier-shared";

type FrontOfficeClientDossierClientProps = {
  snapshot: FrontOfficeClientDetailSnapshot;
  suggestedFollowUp?: {
    title: string;
    dueAt?: string;
    sourceLabel?: string | null;
  } | null;
};

type FollowUpFormState = {
  title: string;
  dueAt: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type FollowUpTaskUpdatePayload = {
  status?: string;
  dueAt?: string | null;
};

function buildDefaultDueAt() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function buildEmptyFormState(
  suggestion?: FrontOfficeClientDossierClientProps["suggestedFollowUp"],
): FollowUpFormState {
  return {
    title: suggestion?.title?.trim() || "",
    dueAt: suggestion?.dueAt || buildDefaultDueAt(),
  };
}

function buildNextDueDateValue(currentValue: string) {
  const baseDate = currentValue ? new Date(currentValue) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString().slice(0, 10);
  }

  baseDate.setDate(baseDate.getDate() + 1);
  return baseDate.toISOString().slice(0, 10);
}

export function FrontOfficeClientDossierClient(
  props: FrontOfficeClientDossierClientProps,
) {
  const router = useRouter();
  const [formState, setFormState] =
    useState<FollowUpFormState>(() => buildEmptyFormState(props.suggestedFollowUp));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;
  const currentRailItem =
    props.snapshot.nextStepRail.items.find((item) => item.isCurrent) ??
    props.snapshot.nextStepRail.items[0];
  const primaryRailActions = [
    {
      href: `#${frontOfficeClientDossierSectionIds.nextStepRail}`,
      label: "Open next-step rail",
    },
    {
      href: props.snapshot.nextStepRail.primaryActionHref,
      label: props.snapshot.nextStepRail.primaryActionLabel,
      opensInNewTab: props.snapshot.nextStepRail.primaryActionOpensInNewTab,
    },
  ];

  useEffect(() => {
    setFormState(buildEmptyFormState(props.suggestedFollowUp));
  }, [props.suggestedFollowUp?.dueAt, props.suggestedFollowUp?.title]);

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

  async function handleTaskUpdate(
    taskId: string,
    payload: FollowUpTaskUpdatePayload,
    successMessage: string,
  ) {
    setFeedback(null);
    setIsSaving(true);
    setActiveTaskId(taskId);

    try {
      const response = await fetch(
        `/api/agent/clients/${props.snapshot.id}/follow-up-tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: body?.error ?? "Could not update the follow-up task.",
        });
        setIsSaving(false);
        setActiveTaskId(null);
        return;
      }

      setFeedback({
        tone: "success",
        message: successMessage,
      });
      startTransition(() => {
        router.refresh();
        setIsSaving(false);
        setActiveTaskId(null);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not update the follow-up task.",
      });
      setIsSaving(false);
      setActiveTaskId(null);
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="front-office-placeholder-note">
        <strong>{props.snapshot.nextStepRail.decisionTitle}</strong>
        <p>
          {props.snapshot.nextStepRail.decisionDescription}
        </p>
        <div className="list-row-meta front-office-record-meta">
          <span>{props.snapshot.nextStepRail.decisionLabel}</span>
          <span>{currentRailItem.stepLabel} · {currentRailItem.ownershipLabel}</span>
          <span>{props.snapshot.workflow.pressureLabel}</span>
          <span>{props.snapshot.nextStepRail.decisionMetaLabel}</span>
        </div>
        <FrontOfficeClientActionGroup actions={primaryRailActions} />
      </div>

      <div className="front-office-placeholder-note">
        <strong>Execution chain</strong>
        <p>
          Review the matching dossier block first, then use the second jump
          only when the work needs calendar scheduling, listing output, or the
          shared Back Office record.
        </p>
      </div>

      <div className="office-queue-list">
        {props.snapshot.nextStepRail.items.map((item) => (
          <QueueItem
            action={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: getFrontOfficeClientDossierSectionHref(item.id),
                    label: "Review dossier block",
                  },
                  {
                    href: item.actionHref,
                    label: item.actionLabel,
                    opensInNewTab: item.actionOpensInNewTab,
                  },
                ]}
              />
            }
            badgeLabel={item.statusLabel}
            badgeTone={item.statusTone}
            context={`${item.stepLabel} · ${item.ownershipLabel}`}
            description={item.description}
            key={item.id}
            meta={
              <span>
                {item.isCurrent ? "Current focus · " : ""}
                {item.metaLabel}
              </span>
            }
            title={item.title}
          />
        ))}
      </div>

      <div className="front-office-placeholder-note">
        <strong>Create follow-up</strong>
        <p>
          This stays in Front Office even when a Back Office file already
          exists. Use it to keep the next client touch explicit without
          inventing a second formal transaction checklist.
        </p>
        {props.suggestedFollowUp?.sourceLabel ? (
          <p className="front-office-calendar-feedback is-success">
            {props.suggestedFollowUp.sourceLabel}
          </p>
        ) : null}

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
              action={
                task.statusValue === "completed" ||
                task.statusValue === "canceled" ? null : (
                  <div className="front-office-follow-up-actions">
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        void handleTaskUpdate(
                          task.id,
                          { status: "completed" },
                          "Follow-up completed. Workflow pressure has been recalculated.",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {activeTaskId === task.id ? "Saving..." : "Mark complete"}
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        void handleTaskUpdate(
                          task.id,
                          { dueAt: buildNextDueDateValue(task.dueAtValue) },
                          task.dueAtValue
                            ? "Follow-up pushed forward by one day."
                            : "Follow-up scheduled for tomorrow.",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {task.dueAtValue ? "Push +1 day" : "Due tomorrow"}
                    </Button>
                  </div>
                )
              }
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
