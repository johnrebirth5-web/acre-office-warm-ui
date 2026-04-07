"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import {
  Button,
  EmptyState,
  FormField,
  ListPageStatsGrid,
  QueueItem,
  StatCard,
  TextInput,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import {
  FrontOfficeClientActionGroup,
  FrontOfficeClientGuidanceQueue,
  frontOfficeClientDossierSectionIds,
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

type FollowUpQuickTemplate = {
  key: string;
  label: string;
  title: string;
  dueAt: string;
};

const FRONT_OFFICE_FOLLOW_UP_FORM_ID = "front-office-follow-up-form";
const FRONT_OFFICE_FOLLOW_UP_QUEUE_ID = "front-office-follow-up-queue";

function buildDefaultDueAt() {
  return buildDueAtFromToday(1);
}

function buildDueAtFromToday(days: number) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + days);
  return tomorrow.toISOString().slice(0, 10);
}

function getClientFirstName(fullName: string) {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName?.trim() || "Client";
}

function shiftDateValue(currentValue: string, days: number) {
  const baseDate = currentValue ? new Date(currentValue) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + Math.max(days, 1));
    return fallback.toISOString().slice(0, 10);
  }

  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function buildEmptyFormState(
  suggestion?: FrontOfficeClientDossierClientProps["suggestedFollowUp"],
): FollowUpFormState {
  return {
    title: suggestion?.title?.trim() || "",
    dueAt: suggestion?.dueAt || buildDefaultDueAt(),
  };
}

function buildFollowUpQuickTemplates(
  snapshot: FrontOfficeClientDetailSnapshot,
  suggestion?: FrontOfficeClientDossierClientProps["suggestedFollowUp"],
): FollowUpQuickTemplate[] {
  const firstName = getClientFirstName(snapshot.fullName);
  const nextAppointment = snapshot.appointments.find(
    (appointment) => appointment.statusValue === "scheduled",
  );
  const cueDueAt = snapshot.followUpCue.dueAtValue
    ? snapshot.followUpCue.dueAtValue.slice(0, 10)
    : "";
  const templates: FollowUpQuickTemplate[] = [];

  if (suggestion?.title?.trim()) {
    templates.push({
      key: "loaded",
      label: "Loaded suggestion",
      title: suggestion.title.trim(),
      dueAt: suggestion.dueAt || buildDefaultDueAt(),
    });
  }

  templates.push({
    key: "next-touch",
    label: "Next touch",
    title: `Follow up with ${firstName}`,
    dueAt: cueDueAt || buildDefaultDueAt(),
  });

  if (snapshot.leaseReminder.needsAttention) {
    templates.push({
      key: "lease",
      label: "Lease timing",
      title: `Check ${firstName}'s lease renewal or move timing`,
      dueAt:
        snapshot.leaseReminder.reminderAtValue || cueDueAt || buildDefaultDueAt(),
    });
  }

  if (nextAppointment) {
    templates.push({
      key: "appointment",
      label: "Appointment prep",
      title: `Confirm logistics for ${nextAppointment.title}`,
      dueAt:
        nextAppointment.startsAtValue.slice(0, 10) ||
        buildDefaultDueAt(),
    });
  }

  if (
    snapshot.workflow.nextStepKey === "capture_showing_feedback" ||
    snapshot.followUpCue.key === "viewing_feedback_due"
  ) {
    templates.push({
      key: "feedback",
      label: "Viewing feedback",
      title: `Capture ${firstName}'s showing feedback`,
      dueAt: cueDueAt || buildDefaultDueAt(),
    });
  }

  return templates.slice(0, 4);
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
  const activeTasks = props.snapshot.followUpTasks.filter((task) => !task.isResolved);
  const resolvedTasks = props.snapshot.followUpTasks.filter((task) => task.isResolved);
  const quickTemplates = buildFollowUpQuickTemplates(
    props.snapshot,
    props.suggestedFollowUp,
  );
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

  function applyTemplate(template: FollowUpQuickTemplate) {
    setFormState({
      title: template.title,
      dueAt: template.dueAt,
    });
  }

  function applyDueAtPreset(days: number) {
    setFormState((current) => ({
      ...current,
      dueAt: buildDueAtFromToday(days),
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
      <FrontOfficeClientGuidanceQueue
        items={[
          {
            key: "workflow",
            label: props.snapshot.workflow.pressureLabel,
            tone: props.snapshot.workflow.pressureTone,
            title: props.snapshot.workflow.nextStepTitle,
            description: props.snapshot.workflow.nextStepDescription,
            context: `${currentRailItem.stepLabel} · ${currentRailItem.ownershipLabel}`,
            meta: <span>{props.snapshot.workflow.pressureDescription}</span>,
            actions: [
              {
                href: props.snapshot.workflow.actionHref,
                label: props.snapshot.workflow.actionLabel,
              },
            ],
          },
          {
            key: "cue",
            label: props.snapshot.followUpCue.label,
            tone: props.snapshot.followUpCue.tone,
            title: "Follow-up is the active execution lane",
            description: props.snapshot.followUpCue.description,
            context: props.snapshot.followUpCue.dueLabel,
            meta: (
              <span>
                {props.snapshot.summary.openTaskCount} open ·{" "}
                {props.snapshot.summary.overdueTaskCount} overdue
              </span>
            ),
            actions: [
              {
                href: props.snapshot.followUpCue.action.href,
                label: props.snapshot.followUpCue.action.label,
                opensInNewTab: props.snapshot.followUpCue.action.opensInNewTab,
              },
            ],
          },
          {
            key: "boundary",
            label: props.snapshot.nextStepRail.decisionLabel,
            tone: props.snapshot.nextStepRail.decisionTone,
            title: props.snapshot.nextStepRail.decisionTitle,
            description: props.snapshot.nextStepRail.decisionDescription,
            meta: <span>{props.snapshot.nextStepRail.decisionMetaLabel}</span>,
            actions: primaryRailActions,
          },
        ]}
      />

      <ListPageStatsGrid>
        <StatCard
          hint="shared Front Office follow-up tasks still open on this dossier"
          label="Open queue"
          tone="accent"
          value={props.snapshot.summary.openTaskCount}
        />
        <StatCard
          hint="tasks that need action or re-dating right now"
          label="Overdue"
          tone={
            props.snapshot.summary.overdueTaskCount > 0 ? "accent" : "default"
          }
          value={props.snapshot.summary.overdueTaskCount}
        />
        <StatCard
          hint="latest next-touch timing driving workflow pressure"
          label="Next touch"
          value={props.snapshot.followUpCue.dueLabel}
        />
        <StatCard
          hint="resolved follow-up tasks still visible for context"
          label="Resolved"
          value={props.snapshot.summary.completedTaskCount}
        />
      </ListPageStatsGrid>

      <div className="front-office-placeholder-note">
        <strong>Create or reset the next touch</strong>
        <p>
          Keep this in Front Office even when a formal Back Office record
          exists. The goal here is to make the next client move explicit,
          without recreating formal transaction or admin work.
        </p>
        {props.suggestedFollowUp?.sourceLabel ? (
          <p className="front-office-calendar-feedback is-success">
            {props.suggestedFollowUp.sourceLabel}
          </p>
        ) : null}
        {quickTemplates.length ? (
          <div className="list-row-meta front-office-record-meta">
            {quickTemplates.map((template) => (
              <button
                className="office-inline-link"
                key={template.key}
                onClick={() => applyTemplate(template)}
                type="button"
              >
                {template.label}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="front-office-calendar-form"
          id={FRONT_OFFICE_FOLLOW_UP_FORM_ID}
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
              helper="Recommended so stale pressure and the next-touch rail stay honest."
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

          <div className="list-row-meta front-office-record-meta">
            <button
              className="office-inline-link"
              onClick={() => applyDueAtPreset(0)}
              type="button"
            >
              Due today
            </button>
            <button
              className="office-inline-link"
              onClick={() => applyDueAtPreset(1)}
              type="button"
            >
              Tomorrow
            </button>
            <button
              className="office-inline-link"
              onClick={() => applyDueAtPreset(3)}
              type="button"
            >
              In 3 days
            </button>
            <button
              className="office-inline-link"
              onClick={() => applyDueAtPreset(7)}
              type="button"
            >
              Next week
            </button>
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
            {activeTasks.length ? (
              <a
                className="office-button-secondary"
                href={`#${FRONT_OFFICE_FOLLOW_UP_QUEUE_ID}`}
              >
                Review queue
              </a>
            ) : null}
          </div>
        </form>
      </div>

      <div className="front-office-placeholder-note">
        <strong>Follow-up queue</strong>
        <p>
          Completing or rescheduling tasks here updates the same Front Office
          next-touch clock. Offer, contract, signature, and other formal admin
          work still belongs on the shared Back Office record.
        </p>
      </div>

      <div className="office-list-page-stack" id={FRONT_OFFICE_FOLLOW_UP_QUEUE_ID}>
        <div className="office-queue-list">
          {activeTasks.length ? (
            activeTasks.map((task) => (
              <QueueItem
                action={
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
                          { dueAt: shiftDateValue(task.dueAtValue, 1) },
                          task.dueAtValue
                            ? "Follow-up moved to tomorrow."
                            : "Follow-up scheduled for tomorrow.",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Tomorrow
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        void handleTaskUpdate(
                          task.id,
                          { dueAt: shiftDateValue(task.dueAtValue, 7) },
                          "Follow-up pushed out by one week.",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Next week
                    </Button>
                  </div>
                }
                badgeLabel={task.statusLabel}
                badgeTone={task.tone}
                context={task.queueLabel}
                description={task.dueLabel}
                key={task.id}
                meta={<span>{task.helperLabel}</span>}
                title={task.title}
              />
            ))
          ) : (
            <EmptyState
              description="Create the first follow-up here so this client never falls out of the execution queue."
              title="No active follow-up tasks"
            />
          )}
        </div>

        {resolvedTasks.length ? (
          <div className="office-list-page-stack">
            <div className="front-office-placeholder-note">
              <strong>Recently resolved</strong>
              <p>
                Keep the last completed or canceled tasks visible here so the
                next touch does not repeat work the dossier already closed.
              </p>
            </div>
            <div className="office-queue-list">
              {resolvedTasks.map((task) => (
                <QueueItem
                  badgeLabel={task.statusLabel}
                  badgeTone={task.tone}
                  context={task.queueLabel}
                  description={task.dueLabel}
                  key={task.id}
                  meta={<span>{task.helperLabel}</span>}
                  title={task.title}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
