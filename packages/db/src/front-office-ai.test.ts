import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus } from "@prisma/client";
import {
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiSuggestionInsight,
  mapFrontOfficeAiAcceptedActionOutcome,
} from "./front-office-ai";

test("completed follow-up actions map to positive AI outcomes", () => {
  const outcome = mapFrontOfficeAiAcceptedActionOutcome({
    actionType: "follow_up_created",
    followUpTask: {
      status: TaskStatus.completed,
      dueAt: new Date("2026-04-01T12:00:00.000Z"),
    },
    sendRecord: null,
    now: new Date("2026-04-02T12:00:00.000Z"),
  });

  assert.equal(outcome.label, "Completed");
  assert.equal(outcome.tone, "success");
  assert.equal(outcome.positive, true);
  assert.equal(outcome.stalled, false);
});

test("unopened tracked sends become stalled after the safe threshold", () => {
  const outcome = mapFrontOfficeAiAcceptedActionOutcome({
    actionType: "tracked_send_created",
    followUpTask: null,
    sendRecord: {
      openCount: 0,
      lastOpenedAt: null,
      sentAt: new Date("2026-03-28T12:00:00.000Z"),
    },
    now: new Date("2026-04-02T12:00:00.000Z"),
  });

  assert.equal(outcome.label, "Still unopened");
  assert.equal(outcome.tone, "warning");
  assert.equal(outcome.positive, false);
  assert.equal(outcome.stalled, true);
});

test("history insight boosts proven kinds and suppresses duplicate follow-up creation when the latest accepted task stalled", () => {
  const historyIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: [
      {
        clientId: "client-1",
        suggestionKind: "lease",
        actionType: "tracked_send_created",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        followUpTask: null,
        sendRecord: {
          openCount: 2,
          lastOpenedAt: new Date("2026-04-01T13:00:00.000Z"),
          sentAt: new Date("2026-04-01T12:00:00.000Z"),
        },
      },
      {
        clientId: "client-2",
        suggestionKind: "lease",
        actionType: "follow_up_created",
        createdAt: new Date("2026-03-30T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.completed,
          dueAt: new Date("2026-03-31T12:00:00.000Z"),
        },
        sendRecord: null,
      },
      {
        clientId: "client-1",
        suggestionKind: "appointment",
        actionType: "follow_up_created",
        createdAt: new Date("2026-03-31T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.queued,
          dueAt: new Date("2026-04-01T12:00:00.000Z"),
        },
        sendRecord: null,
      },
    ],
    now: new Date("2026-04-02T12:00:00.000Z"),
  });

  const leaseInsight = buildFrontOfficeAiSuggestionInsight({
    historyIndex,
    clientId: "client-1",
    suggestionKind: "lease",
  });
  const appointmentInsight = buildFrontOfficeAiSuggestionInsight({
    historyIndex,
    clientId: "client-1",
    suggestionKind: "appointment",
  });

  assert.ok(leaseInsight.priorityAdjustment < 0);
  assert.equal(leaseInsight.suppressDirectFollowUpCreation, false);
  assert.ok(
    leaseInsight.historySignals.some((signal) =>
      signal.startsWith("Outcome signal"),
    ),
  );

  assert.ok(appointmentInsight.priorityAdjustment < 0);
  assert.equal(appointmentInsight.suppressDirectFollowUpCreation, true);
  assert.ok(
    appointmentInsight.historySignals.some((signal) =>
      signal.startsWith("Escalation"),
    ),
  );
});
