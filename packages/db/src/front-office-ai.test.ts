import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus } from "@prisma/client";
import {
  buildFrontOfficeAiAcceptedActionBreakdown,
  buildFrontOfficeAiAcceptedActionBreakdownWindows,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiSuggestionInsight,
  mapFrontOfficeAiAcceptedActionOutcome,
  rankFrontOfficeAiQueueHistoryCandidates,
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

test("accepted action breakdown ranks kinds by positive outcomes first", () => {
  const historyIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: [
      {
        clientId: "client-1",
        suggestionKind: "content_rescue",
        actionType: "tracked_send_created",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        followUpTask: null,
        sendRecord: {
          openCount: 1,
          lastOpenedAt: new Date("2026-04-01T13:00:00.000Z"),
          sentAt: new Date("2026-04-01T12:00:00.000Z"),
        },
      },
      {
        clientId: "client-2",
        suggestionKind: "content_rescue",
        actionType: "follow_up_created",
        createdAt: new Date("2026-03-31T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.completed,
          dueAt: new Date("2026-04-01T12:00:00.000Z"),
        },
        sendRecord: null,
      },
      {
        clientId: "client-3",
        suggestionKind: "lease",
        actionType: "follow_up_created",
        createdAt: new Date("2026-03-30T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.queued,
          dueAt: new Date("2026-04-03T12:00:00.000Z"),
        },
        sendRecord: null,
      },
    ],
    now: new Date("2026-04-02T12:00:00.000Z"),
  });

  const breakdown = buildFrontOfficeAiAcceptedActionBreakdown({
    historyIndex,
    limit: 2,
  });

  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0]?.label, "Content follow-up");
  assert.equal(breakdown[0]?.summary, "2 accepted · 2 positive");
  assert.equal(breakdown[1]?.label, "Lease timing");
});

test("accepted action breakdown windows separate last 7d from last 90d", () => {
  const now = new Date("2026-04-02T12:00:00.000Z");
  const windows = buildFrontOfficeAiAcceptedActionBreakdownWindows({
    actions: [
      {
        clientId: "client-1",
        suggestionKind: "warm_engagement",
        actionType: "tracked_send_created",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        followUpTask: null,
        sendRecord: {
          openCount: 1,
          lastOpenedAt: new Date("2026-04-01T14:00:00.000Z"),
          sentAt: new Date("2026-04-01T12:00:00.000Z"),
        },
      },
      {
        clientId: "client-2",
        suggestionKind: "lease",
        actionType: "follow_up_created",
        createdAt: new Date("2026-02-10T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.completed,
          dueAt: new Date("2026-02-11T12:00:00.000Z"),
        },
        sendRecord: null,
      },
    ],
    now,
    windows: [7, 90],
    limit: 3,
  });

  assert.equal(windows.length, 2);
  assert.equal(windows[0]?.label, "Last 7d");
  assert.equal(windows[0]?.summary, "1 accepted · 1 positive");
  assert.equal(windows[0]?.items[0]?.label, "Warm engagement");
  assert.equal(windows[1]?.label, "Last 90d");
  assert.equal(windows[1]?.summary, "2 accepted · 2 positive");
});

test("queue ranking promotes stronger outcomes and adds review guard explainability", () => {
  const historyIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: [
      {
        clientId: "client-1",
        suggestionKind: "content_rescue",
        actionType: "tracked_send_created",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        followUpTask: null,
        sendRecord: {
          openCount: 1,
          lastOpenedAt: new Date("2026-04-01T13:00:00.000Z"),
          sentAt: new Date("2026-04-01T12:00:00.000Z"),
        },
      },
      {
        clientId: "client-2",
        suggestionKind: "lease",
        actionType: "follow_up_created",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        followUpTask: {
          status: TaskStatus.queued,
          dueAt: new Date("2026-04-01T10:00:00.000Z"),
        },
        sendRecord: null,
      },
    ],
    now: new Date("2026-04-02T12:00:00.000Z"),
  });

  const ranked = rankFrontOfficeAiQueueHistoryCandidates({
    historyIndex,
    candidates: [
      {
        id: "lease",
        clientId: "client-2",
        suggestionKind: "lease",
        helperLabel: "Overdue · lease reminder",
        openDossierHref: "/agent/clients/client-2#front-office-ai-suggestions",
        basePriority: 4,
        sortAt: new Date("2026-04-02T09:00:00.000Z"),
      },
      {
        id: "content",
        clientId: "client-1",
        suggestionKind: "content_rescue",
        helperLabel: "No open on shortlist",
        openDossierHref: "/agent/clients/client-1#front-office-ai-suggestions",
        basePriority: 6,
        sortAt: new Date("2026-04-01T09:00:00.000Z"),
      },
    ],
  });

  assert.equal(ranked[0]?.id, "lease");
  assert.deepEqual(ranked[0]?.whyNowSignals, ["Overdue · lease reminder"]);
  assert.equal(ranked[0]?.allowsDirectFollowUpCreation, false);
  assert.equal(
    ranked[0]?.openDossierHref,
    "/agent/clients/client-2#front-office-follow-up-form",
  );
  assert.ok(
    ranked[0]?.rankingSignals.some((signal) =>
      signal.startsWith("Escalation"),
    ),
  );
  assert.equal(ranked[1]?.id, "content");
  assert.equal(ranked[1]?.allowsDirectFollowUpCreation, true);
  assert.ok(
    ranked[1]?.rankingSignals.some((signal) =>
      signal.startsWith("Momentum"),
    ),
  );
});
