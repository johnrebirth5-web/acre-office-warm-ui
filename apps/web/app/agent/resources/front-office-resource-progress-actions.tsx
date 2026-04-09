"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const interactionEndpoint = "/api/resources/interactions";
const progressMilestones = [
  {
    value: 25,
    label: "Log 25%",
  },
  {
    value: 50,
    label: "Log 50%",
  },
  {
    value: 100,
    label: "Mark complete",
  },
] as const;

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export function FrontOfficeResourceProgressActions(props: {
  resourceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  function handleProgressClick(progressPercent: 25 | 50 | 100) {
    startTransition(async () => {
      try {
        const response = await fetch(interactionEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "resource_progress",
            resourceId: props.resourceId,
            progressPercent,
          }),
          credentials: "same-origin",
        });

        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error || "Unable to log training progress right now.",
          );
        }

        setFeedback({
          tone: "success",
          message:
            progressPercent === 100
              ? "Completion logged."
              : `${progressPercent}% progress logged.`,
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to log training progress right now.",
        });
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {progressMilestones.map((milestone) => (
          <button
            className="office-button-secondary"
            disabled={isPending}
            key={milestone.value}
            onClick={() => handleProgressClick(milestone.value)}
            type="button"
          >
            {milestone.label}
          </button>
        ))}
      </div>
      <p className="office-form-helper" style={{ margin: 0 }}>
        Training progress stays manual and reviewable: log the milestone you
        actually reached after you watch the clip.
      </p>
      {feedback ? (
        <p
          className="office-form-helper"
          style={{
            margin: 0,
            color: feedback.tone === "error" ? "#b42318" : "#0f766e",
          }}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
