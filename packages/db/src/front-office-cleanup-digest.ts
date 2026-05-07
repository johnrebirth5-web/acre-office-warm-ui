import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import { formatDateTimeLabel, resolveTimeZone } from "./date-time";
import {
  activityLogActions,
  recordActivityLogEvent,
  type ActivityLogPayload,
} from "./activity-log";

const frontOfficeCleanupDigestWindowDays = 7;
const frontOfficeCleanupDigestMaxItemsPerSection = 5;

const frontOfficeCleanupDigestNotificationTypes = [
  "appointment_due_soon",
  "appointment_external_touch_due",
  "incoming_update_pending_review",
  "task_review_requested",
  "task_second_review_requested",
  "task_rejected",
  "offer_created",
  "offer_received",
  "offer_expiring_soon",
  "follow_up",
  "follow_up_assigned",
  "follow_up_overdue",
  "onboarding_assigned",
  "onboarding_due_soon",
] as const;

type FrontOfficeCleanupDigestTone =
  | "neutral"
  | "accent"
  | "warning"
  | "danger";

type FrontOfficeCleanupDigestItemKind =
  | "notification"
  | "follow_up_task"
  | "client_reminder"
  | "appointment_continuity";

export type FrontOfficeCleanupDigestItem = {
  id: string;
  kind: FrontOfficeCleanupDigestItemKind;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  actionDetail: string;
  destinationLabel: string;
  dueAtLabel: string;
  tone: FrontOfficeCleanupDigestTone;
};

export type FrontOfficeCleanupDigestSection = {
  key:
    | "notifications"
    | "follow_up_tasks"
    | "client_reminders"
    | "appointment_continuity";
  label: string;
  summary: string;
  count: number;
  items: FrontOfficeCleanupDigestItem[];
};

export type FrontOfficeCleanupDigestWorkflowStep = {
  key:
    | "follow_up_tasks"
    | "client_reminders"
    | "appointment_writeback"
    | "unread_notifications";
  label: string;
  detail: string;
  href: string;
  actionLabel: string;
  count: number;
  tone: FrontOfficeCleanupDigestTone;
  mode: "manual";
};

export type FrontOfficeCleanupDigestWorkflow = {
  label: string;
  detail: string;
  runMode: "manual_operator_pass";
  schedulerState: "runner_contract_ready";
  providerSyncState: "none";
  primaryStepKey: FrontOfficeCleanupDigestWorkflowStep["key"] | null;
  steps: FrontOfficeCleanupDigestWorkflowStep[];
};

export type FrontOfficeCleanupDigest = {
  generatedAt: string;
  generatedAtLabel: string;
  scopeLabel: string;
  timeZone: string;
  windowLabel: string;
  cutoffAt: string;
  summary: {
    totalCount: number;
    urgentCount: number;
    dueSoonCount: number;
    notificationCount: number;
    followUpTaskCount: number;
    clientReminderCount: number;
    appointmentCount: number;
  };
  nextActionLabel: string;
  nextActionDetail: string;
  workflow: FrontOfficeCleanupDigestWorkflow;
  sections: FrontOfficeCleanupDigestSection[];
};

export type FrontOfficeCleanupDigestRunSummary = {
  scopeLabel: string;
  generatedAtLabel: string;
  timeZone: string;
  windowLabel: string;
  totalCount: number;
  urgentCount: number;
  dueSoonCount: number;
  notificationCount: number;
  followUpTaskCount: number;
  clientReminderCount: number;
  appointmentCount: number;
  nextActionLabel: string;
  nextActionDetail: string;
};

export type FrontOfficeCleanupDigestDeliveryDraft = {
  subject: string;
  summaryText: string;
  body: string;
  runSummary: FrontOfficeCleanupDigestRunSummary;
};

export type FrontOfficeCleanupDigestOutputMode = "report" | "dry-run" | "json";

export type FrontOfficeCleanupDigestRunnerContract = {
  runMode: "manual-only";
  outputMode: FrontOfficeCleanupDigestOutputMode;
  schedulerState: "not-involved";
  deliveryMode: "draft-only";
  sideEffectPolicy: "none";
  scopeLabel: string;
  generatedAtLabel: string;
  windowLabel: string;
};

export type BuildFrontOfficeCleanupDigestInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
  now?: Date;
};

type CleanupNotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  createdAt: Date;
};

type CleanupFollowUpTaskRecord = {
  id: string;
  title: string;
  status: string;
  dueAt: Date;
  client: {
    id: string;
    fullName: string;
    ownerMembership: {
      officeId: string | null;
    } | null;
  } | null;
};

type CleanupClientRecord = {
  id: string;
  fullName: string;
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
  ownerMembership: {
    officeId: string | null;
  } | null;
};

type CleanupAppointmentRecord = {
  id: string;
  title: string;
  startsAt: Date;
  clientId: string | null;
  client: {
    id: string;
    fullName: string;
    ownerMembership: {
      officeId: string | null;
    } | null;
  } | null;
  metadata: Record<string, unknown> | null;
};

type CleanupAppointmentBridgeLog = {
  entityId: string;
  createdAt: Date;
};

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function isWithinOfficeScope(
  officeId: string | null | undefined,
  candidateOfficeId: string | null | undefined,
) {
  if (!officeId) {
    return true;
  }

  return candidateOfficeId == null || candidateOfficeId === officeId;
}

function startOfDigestWindow(now: Date, windowDays: number) {
  const cutoffAt = new Date(now);
  cutoffAt.setDate(cutoffAt.getDate() + windowDays);

  return cutoffAt;
}

function startOfRecentWindow(now: Date, windowDays: number) {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);

  return windowStart;
}

function getDetailWithLabels(labels: string[]) {
  return labels.filter((label) => label.trim().length > 0).join(" · ");
}

function getUrgencyTone(
  dueAt: Date | null | undefined,
  now: Date,
  cutoffAt: Date,
) {
  if (!dueAt) {
    return "warning" as const;
  }

  if (dueAt.getTime() <= now.getTime()) {
    return "danger" as const;
  }

  if (dueAt.getTime() <= cutoffAt.getTime()) {
    return "warning" as const;
  }

  return "neutral" as const;
}

function sortItemsByUrgency(
  left: FrontOfficeCleanupDigestItem,
  right: FrontOfficeCleanupDigestItem,
) {
  const toneRank: Record<FrontOfficeCleanupDigestTone, number> = {
    danger: 0,
    warning: 1,
    accent: 2,
    neutral: 3,
  };

  const leftRank = toneRank[left.tone];
  const rightRank = toneRank[right.tone];

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.dueAtLabel.localeCompare(right.dueAtLabel);
}

function pickNextAction(
  sections: FrontOfficeCleanupDigestSection[],
  summary: FrontOfficeCleanupDigest["summary"],
) {
  const getFirstItemDetail = (
    sectionKey: FrontOfficeCleanupDigestSection["key"],
  ) => {
    const section = sections.find((candidate) => candidate.key === sectionKey);
    const item = section?.items[0];

    return item ? `${item.title}: ${item.detail}` : section?.summary;
  };
  const firstNonEmptySection = sections.find((section) => section.count > 0);

  if (!firstNonEmptySection) {
    return {
      label: "No cleanup items queued",
      detail:
        "There are no unread cleanup notifications, overdue follow-up tasks, client reminders, or appointment continuity items in this digest.",
    };
  }

  if (summary.followUpTaskCount > 0) {
    return {
      label: "Start with follow-up tasks",
      detail:
        getFirstItemDetail("follow_up_tasks") ?? firstNonEmptySection.summary,
    };
  }

  if (summary.clientReminderCount > 0) {
    return {
      label: "Review client reminders",
      detail:
        getFirstItemDetail("client_reminders") ??
        firstNonEmptySection.summary,
    };
  }

  if (summary.appointmentCount > 0) {
    return {
      label: "Reconcile appointment continuity",
      detail:
        getFirstItemDetail("appointment_continuity") ??
        firstNonEmptySection.summary,
    };
  }

  return {
    label: "Clear unread cleanup notifications",
    detail:
      firstNonEmptySection.items[0]?.detail ?? firstNonEmptySection.summary,
  };
}

export function buildFrontOfficeCleanupDigestRunSummary(
  digest: FrontOfficeCleanupDigest,
): FrontOfficeCleanupDigestRunSummary {
  return {
    scopeLabel: digest.scopeLabel,
    generatedAtLabel: digest.generatedAtLabel,
    timeZone: digest.timeZone,
    windowLabel: digest.windowLabel,
    totalCount: digest.summary.totalCount,
    urgentCount: digest.summary.urgentCount,
    dueSoonCount: digest.summary.dueSoonCount,
    notificationCount: digest.summary.notificationCount,
    followUpTaskCount: digest.summary.followUpTaskCount,
    clientReminderCount: digest.summary.clientReminderCount,
    appointmentCount: digest.summary.appointmentCount,
    nextActionLabel: digest.nextActionLabel,
    nextActionDetail: digest.nextActionDetail,
  };
}

export function buildFrontOfficeCleanupDigestDeliveryDraft(
  digest: FrontOfficeCleanupDigest,
): FrontOfficeCleanupDigestDeliveryDraft {
  const runSummary = buildFrontOfficeCleanupDigestRunSummary(digest);

  return {
    subject: `${runSummary.scopeLabel}: ${runSummary.totalCount} item(s), ${runSummary.urgentCount} urgent, ${runSummary.dueSoonCount} due soon`,
    summaryText: `${runSummary.scopeLabel} · ${runSummary.windowLabel} · ${runSummary.totalCount} item(s), ${runSummary.urgentCount} urgent, ${runSummary.dueSoonCount} due soon`,
    body: renderFrontOfficeCleanupDigestReport(digest),
    runSummary,
  };
}

export function buildFrontOfficeCleanupDigestRunnerContract(
  digest: FrontOfficeCleanupDigest,
  outputMode: FrontOfficeCleanupDigestOutputMode,
): FrontOfficeCleanupDigestRunnerContract {
  return {
    runMode: "manual-only",
    outputMode,
    schedulerState: "not-involved",
    deliveryMode: "draft-only",
    sideEffectPolicy: "none",
    scopeLabel: digest.scopeLabel,
    generatedAtLabel: digest.generatedAtLabel,
    windowLabel: digest.windowLabel,
  };
}

export function buildFrontOfficeCleanupDigestRunActivityPayload(input: {
  officeId?: string | null;
  objectLabel?: string;
  contextHref?: string | null;
  runSummary: FrontOfficeCleanupDigestRunSummary;
}): ActivityLogPayload {
  return {
    officeId: input.officeId ?? null,
    objectLabel: input.objectLabel ?? input.runSummary.scopeLabel,
    contextHref: input.contextHref ?? undefined,
    details: [
      "Mode: Manual-only",
      "Scheduler: Not involved",
      "Provider sync: None",
      `Scope: ${input.runSummary.scopeLabel}`,
      `Window: ${input.runSummary.windowLabel}`,
      `Generated: ${input.runSummary.generatedAtLabel}`,
      `Summary: ${input.runSummary.totalCount} item(s), ${input.runSummary.urgentCount} urgent, ${input.runSummary.dueSoonCount} due soon`,
      `Next action: ${input.runSummary.nextActionLabel}`,
      `Next detail: ${input.runSummary.nextActionDetail}`,
    ],
  };
}

export function buildFrontOfficeCleanupDigestInternalMailThreadOpenedActivityPayload(
  input: {
    officeId?: string | null;
    objectLabel?: string;
    contextHref?: string | null;
    runSummary: FrontOfficeCleanupDigestRunSummary;
  },
): ActivityLogPayload {
  return {
    officeId: input.officeId ?? null,
    objectLabel:
      input.objectLabel ??
      `${input.runSummary.scopeLabel} internal mail thread`,
    contextHref: input.contextHref ?? undefined,
    details: [
      "Mode: Manual-only",
      "Scheduler: Not involved",
      "Provider sync: None",
      `Scope: ${input.runSummary.scopeLabel}`,
      `Window: ${input.runSummary.windowLabel}`,
      `Thread: Internal mail continuity`,
      `Summary: ${input.runSummary.totalCount} item(s), ${input.runSummary.urgentCount} urgent, ${input.runSummary.dueSoonCount} due soon`,
      `Next action: ${input.runSummary.nextActionLabel}`,
      `Next detail: ${input.runSummary.nextActionDetail}`,
    ],
  };
}

export async function recordFrontOfficeCleanupDigestRunActivity(
  writer: Parameters<typeof recordActivityLogEvent>[0],
  input: {
    organizationId: string;
    membershipId: string;
    officeId?: string | null;
    runSummary: FrontOfficeCleanupDigestRunSummary;
    contextHref?: string | null;
    objectLabel?: string;
  },
) {
  await recordActivityLogEvent(writer, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "front_office_cleanup_digest",
    entityId: randomUUID(),
    action: activityLogActions.frontOfficeCleanupDigestRun,
    payload: buildFrontOfficeCleanupDigestRunActivityPayload({
      officeId: input.officeId ?? null,
      objectLabel: input.objectLabel,
      contextHref: input.contextHref ?? "/agent/notifications",
      runSummary: input.runSummary,
    }),
  });
}

export async function recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity(
  writer: Parameters<typeof recordActivityLogEvent>[0],
  input: {
    organizationId: string;
    membershipId: string;
    officeId?: string | null;
    runSummary: FrontOfficeCleanupDigestRunSummary;
    threadId: string;
    threadSubject: string;
    contextHref?: string | null;
  },
) {
  await recordActivityLogEvent(writer, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "front_office_cleanup_digest",
    entityId: input.threadId,
    action: activityLogActions.frontOfficeCleanupDigestThreadOpened,
    payload: buildFrontOfficeCleanupDigestInternalMailThreadOpenedActivityPayload(
      {
        officeId: input.officeId ?? null,
        objectLabel: input.threadSubject,
        contextHref: input.contextHref ?? `/office/mail?threadId=${encodeURIComponent(input.threadId)}`,
        runSummary: input.runSummary,
      },
    ),
  });
}

export function renderFrontOfficeCleanupDigestDeliveryDraft(
  draft: FrontOfficeCleanupDigestDeliveryDraft,
) {
  return [
    `Subject: ${draft.subject}`,
    `Summary: ${draft.summaryText}`,
    "",
    draft.body,
  ].join("\n");
}

export function renderFrontOfficeCleanupDigestRunnerContract(
  contract: FrontOfficeCleanupDigestRunnerContract,
) {
  return [
    "Runner contract",
    `Run mode: ${contract.runMode}`,
    `Output mode: ${contract.outputMode}`,
    `Scheduler: ${contract.schedulerState}`,
    `Delivery mode: ${contract.deliveryMode}`,
    `Side effects: ${contract.sideEffectPolicy}`,
    `Scope: ${contract.scopeLabel}`,
    `Window: ${contract.windowLabel}`,
    `Generated: ${contract.generatedAtLabel}`,
  ];
}

export function renderFrontOfficeCleanupDigestDryRunOutput(
  digest: FrontOfficeCleanupDigest,
  outputMode: FrontOfficeCleanupDigestOutputMode = "dry-run",
) {
  return [
    ...renderFrontOfficeCleanupDigestRunnerContract(
      buildFrontOfficeCleanupDigestRunnerContract(digest, outputMode),
    ),
    "",
    "Report",
    renderFrontOfficeCleanupDigestReport(digest),
  ].join("\n");
}

export function renderFrontOfficeCleanupDigestRunSummary(
  summary: FrontOfficeCleanupDigestRunSummary,
) {
  return [
    summary.scopeLabel,
    `Generated: ${summary.generatedAtLabel}`,
    `Window: ${summary.windowLabel} · ${summary.timeZone}`,
    `Summary: ${summary.totalCount} item(s), ${summary.urgentCount} urgent, ${summary.dueSoonCount} due soon`,
    `Next action: ${summary.nextActionLabel}`,
    `  ${summary.nextActionDetail}`,
  ];
}

export function renderFrontOfficeCleanupDigestWorkflow(
  workflow: FrontOfficeCleanupDigestWorkflow,
) {
  const lines = [
    workflow.label,
    `  ${workflow.detail}`,
    `  Run mode: ${workflow.runMode}`,
    `  Scheduler: ${workflow.schedulerState}`,
    `  Provider sync: ${workflow.providerSyncState}`,
  ];

  if (!workflow.steps.length) {
    lines.push("  No active workflow steps.");
    return lines;
  }

  for (const [index, step] of workflow.steps.entries()) {
    lines.push(
      `  ${index + 1}. [${step.tone}] ${step.label} (${step.count})`,
    );
    lines.push(`     ${step.detail}`);
    lines.push(`     Action: ${step.actionLabel}`);
    lines.push(`     Link: ${step.href}`);
  }

  return lines;
}

export function renderFrontOfficeCleanupDigestSection(
  section: FrontOfficeCleanupDigestSection,
) {
  const lines = [`${section.label} (${section.count})`, `  ${section.summary}`];

  if (section.items.length === 0) {
    lines.push("  No items.");
    return lines;
  }

  for (const item of section.items) {
    lines.push(`  - [${item.tone}] ${item.title}`);
    lines.push(`    ${item.detail}`);
    lines.push(`    Action: ${item.actionLabel}`);
    lines.push(`    Destination: ${item.destinationLabel}`);
    lines.push(`    Due: ${item.dueAtLabel}`);
    lines.push(`    Link: ${item.href}`);
  }

  return lines;
}

export function renderFrontOfficeCleanupDigestReport(
  digest: FrontOfficeCleanupDigest,
) {
  const lines = renderFrontOfficeCleanupDigestRunSummary(
    buildFrontOfficeCleanupDigestRunSummary(digest),
  );

  lines.push("");
  lines.push(...renderFrontOfficeCleanupDigestWorkflow(digest.workflow));

  for (const section of digest.sections) {
    lines.push("");
    lines.push(...renderFrontOfficeCleanupDigestSection(section));
  }

  return lines.join("\n");
}

function formatSectionSummary(count: number, noun: string) {
  if (count === 0) {
    return `No ${noun.toLowerCase()} due right now.`;
  }

  if (count === 1) {
    return `1 ${noun} needs attention.`;
  }

  return `${count} ${noun.toLowerCase()} items need attention.`;
}

function mapNotificationLabel(type: string) {
  switch (type) {
    case "appointment_due_soon":
      return "Appointment due soon";
    case "appointment_external_touch_due":
      return "Appointment touch due";
    case "incoming_update_pending_review":
      return "Incoming update review";
    case "task_review_requested":
      return "Task review requested";
    case "task_second_review_requested":
      return "Task second review requested";
    case "task_rejected":
      return "Task rejected";
    case "offer_created":
      return "Offer created";
    case "offer_received":
      return "Offer received";
    case "offer_expiring_soon":
      return "Offer expiring soon";
    case "follow_up":
      return "Follow-up due";
    case "follow_up_assigned":
      return "Follow-up assigned";
    case "follow_up_overdue":
      return "Follow-up overdue";
    case "onboarding_assigned":
      return "Onboarding assigned";
    case "onboarding_due_soon":
      return "Onboarding due soon";
    default:
      return "Cleanup notification";
  }
}

function mapNotificationTone(type: string): FrontOfficeCleanupDigestTone {
  switch (type) {
    case "follow_up_overdue":
    case "appointment_external_touch_due":
    case "offer_expiring_soon":
    case "task_rejected":
      return "danger";
    case "appointment_due_soon":
    case "incoming_update_pending_review":
    case "task_review_requested":
    case "task_second_review_requested":
    case "follow_up":
    case "follow_up_assigned":
    case "onboarding_due_soon":
      return "warning";
    default:
      return "accent";
  }
}

type CleanupDigestCalendarView =
  | "reply_due"
  | "confirmation_pending"
  | "confirmed"
  | "touch_due"
  | "touch_scheduled"
  | "missing_next_touch"
  | "reschedule_requested"
  | "writeback_pending";

function readAppointmentWorkflowState(metadata: Record<string, unknown> | null) {
  const status = typeof metadata?.status === "string" ? metadata.status : null;
  const note = typeof metadata?.note === "string" ? metadata.note : null;
  const nextActionAt =
    typeof metadata?.nextActionAt === "string" &&
    metadata.nextActionAt.trim().length > 0
      ? new Date(metadata.nextActionAt)
      : null;

  return {
    status,
    note,
    nextActionAt:
      nextActionAt && !Number.isNaN(nextActionAt.getTime())
        ? nextActionAt
        : null,
  };
}

function getAppointmentCleanupCalendarView(input: {
  bridgeOpenedAt: Date | null;
  workflowStatus: string | null;
  workflowNextActionAt: Date | null;
  startsAt: Date;
  now: Date;
}): CleanupDigestCalendarView {
  switch (input.workflowStatus) {
    case "needs_follow_up":
      return "reply_due";
    case "confirmation_pending":
      return "confirmation_pending";
    case "confirmed":
      return "confirmed";
    case "reschedule_requested":
      return "reschedule_requested";
  }

  if (input.workflowNextActionAt) {
    return input.workflowNextActionAt.getTime() <= input.now.getTime()
      ? "touch_due"
      : "touch_scheduled";
  }

  if (input.bridgeOpenedAt) {
    return "writeback_pending";
  }

  return "missing_next_touch";
}

function buildAppointmentWritebackHref(input: {
  appointmentId: string;
  clientId?: string | null;
  calendarView: CleanupDigestCalendarView;
}) {
  const params = new URLSearchParams();

  params.set("calendarView", input.calendarView);
  params.set("appointmentId", input.appointmentId);

  if (input.clientId) {
    params.set("clientId", input.clientId);
  }

  return `/agent/calendar?${params.toString()}#calendar-writeback-section`;
}

function mapAppointmentTone(appointment: {
  bridgeOpenedAt: Date | null;
  workflowStatus: string | null;
  workflowNextActionAt: Date | null;
  startsAt: Date;
  now: Date;
}) {
  if (appointment.workflowStatus === "reschedule_requested") {
    return "danger" as const;
  }

  if (appointment.workflowStatus === "needs_follow_up") {
    return "warning" as const;
  }

  if (appointment.workflowStatus === "confirmation_pending") {
    return "warning" as const;
  }

  if (
    appointment.workflowNextActionAt &&
    appointment.workflowNextActionAt.getTime() <= appointment.now.getTime()
  ) {
    return "danger" as const;
  }

  if (appointment.bridgeOpenedAt) {
    return "warning" as const;
  }

  if (appointment.startsAt.getTime() <= appointment.now.getTime()) {
    return "warning" as const;
  }

  return "accent" as const;
}

function buildAppointmentDetail(input: {
  bridgeOpenedAt: Date | null;
  workflowStatus: string | null;
  workflowNote: string | null;
  workflowNextActionAt: Date | null;
  timeZone: string;
}) {
  const labels = [
    input.bridgeOpenedAt
      ? `Bridge opened: ${formatDateTimeLabel(input.bridgeOpenedAt, {
          timeZone: input.timeZone,
        })}`
      : "No bridge opened yet",
    input.workflowStatus
      ? `Writeback state: ${input.workflowStatus.replace(/_/g, " ")}`
      : "No saved writeback yet",
    input.workflowNextActionAt
      ? `Next touch: ${formatDateTimeLabel(input.workflowNextActionAt, {
          timeZone: input.timeZone,
        })}`
      : "No next touch saved",
    input.workflowNote ? `Note: ${input.workflowNote}` : "",
  ];

  return getDetailWithLabels(labels);
}

function buildNotificationItems(
  notifications: CleanupNotificationRecord[],
  timeZone: string,
): FrontOfficeCleanupDigestItem[] {
  return notifications.map<FrontOfficeCleanupDigestItem>((notification) => ({
    id: notification.id,
    kind: "notification",
    title: mapNotificationLabel(notification.type),
    detail: notification.body,
    href: notification.actionUrl?.trim()
      ? notification.actionUrl
      : `/office/notifications/${notification.id}/open`,
    actionLabel: "Open notice",
    actionDetail:
      "Open the unread signal, decide whether it belongs in Front Office execution or formal Back Office workflow, then return to the digest pass.",
    destinationLabel: "Unread notice",
    dueAtLabel: formatDateTimeLabel(notification.createdAt, {
      timeZone,
    }),
    tone: mapNotificationTone(notification.type),
  }));
}

function buildFollowUpTaskItems(
  tasks: CleanupFollowUpTaskRecord[],
  officeId: string | null | undefined,
  now: Date,
  cutoffAt: Date,
  timeZone: string,
): FrontOfficeCleanupDigestItem[] {
  return tasks
    .filter((task) =>
      isWithinOfficeScope(officeId, task.client?.ownerMembership?.officeId ?? null),
    )
    .map<FrontOfficeCleanupDigestItem>((task) => ({
      id: task.id,
      kind: "follow_up_task",
      title: task.title,
      detail: getDetailWithLabels([
        task.client?.fullName ? `Client: ${task.client.fullName}` : "Client: Unassigned",
        `Status: ${task.status}`,
      ]),
      href: task.client?.id ? `/agent/clients/${task.client.id}` : "/agent/clients",
      actionLabel: "Open follow-up",
      actionDetail:
        "Open the client record, complete or reschedule the follow-up, and keep the next reminder clock current.",
      destinationLabel: "Client follow-up",
      dueAtLabel: formatDateTimeLabel(task.dueAt, { timeZone }),
      tone: getUrgencyTone(task.dueAt, now, cutoffAt),
    }))
    .slice(0, frontOfficeCleanupDigestMaxItemsPerSection)
    .sort(sortItemsByUrgency);
}

function buildClientReminderItems(
  clients: CleanupClientRecord[],
  officeId: string | null | undefined,
  now: Date,
  cutoffAt: Date,
  timeZone: string,
): FrontOfficeCleanupDigestItem[] {
  return clients
    .filter((client) =>
      isWithinOfficeScope(
        officeId,
        client.ownerMembership?.officeId ?? null,
      ),
    )
    .map<FrontOfficeCleanupDigestItem>((client) => {
      const reminderAt = client.nextFollowUpAt ?? client.leaseReminderAt;

      return {
        id: client.id,
        kind: "client_reminder",
        title: client.fullName,
        detail: getDetailWithLabels([
          client.nextFollowUpAt
            ? `Next follow-up: ${formatDateTimeLabel(client.nextFollowUpAt, {
                timeZone,
              })}`
            : "",
          client.leaseReminderAt
            ? `Lease reminder: ${formatDateTimeLabel(client.leaseReminderAt, {
                timeZone,
              })}`
            : "",
        ]),
        href: `/agent/clients/${client.id}`,
        actionLabel: "Open client reminder",
        actionDetail:
          "Open the lightweight client page, record the latest touch, and adjust the next reminder if the outside conversation changed.",
        destinationLabel: "Client reminder",
        dueAtLabel: formatDateTimeLabel(reminderAt, { timeZone }),
        tone: getUrgencyTone(reminderAt, now, cutoffAt),
      };
    })
    .slice(0, frontOfficeCleanupDigestMaxItemsPerSection)
    .sort(sortItemsByUrgency);
}

function buildAppointmentItems(
  appointments: CleanupAppointmentRecord[],
  bridgeLogsByAppointmentId: Map<string, CleanupAppointmentBridgeLog[]>,
  officeId: string | null | undefined,
  now: Date,
  timeZone: string,
): FrontOfficeCleanupDigestItem[] {
  return appointments
    .filter((appointment) =>
      isWithinOfficeScope(
        officeId,
        appointment.client?.ownerMembership?.officeId ?? null,
      ),
    )
    .map<FrontOfficeCleanupDigestItem & { _hasPressure: boolean }>((appointment) => {
      const workflow = readAppointmentWorkflowState(appointment.metadata);
      const bridgeLogs = bridgeLogsByAppointmentId.get(appointment.id) ?? [];
      const bridgeOpenedAt = bridgeLogs.at(0)?.createdAt ?? null;
      const calendarView = getAppointmentCleanupCalendarView({
        bridgeOpenedAt,
        workflowStatus: workflow.status,
        workflowNextActionAt: workflow.nextActionAt,
        startsAt: appointment.startsAt,
        now,
      });
      const workflowHasPressure = Boolean(
        workflow.status ||
          workflow.nextActionAt ||
          bridgeOpenedAt ||
          appointment.startsAt.getTime() <= now.getTime(),
      );

      return {
        id: appointment.id,
        kind: "appointment_continuity",
        title: appointment.title,
        detail: buildAppointmentDetail({
          bridgeOpenedAt,
          workflowStatus: workflow.status,
          workflowNote: workflow.note,
          workflowNextActionAt: workflow.nextActionAt,
          timeZone,
        }),
        href: buildAppointmentWritebackHref({
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          calendarView,
        }),
        actionLabel: "Open writeback",
        actionDetail:
          "Open the calendar writeback section, then save the confirmation, reschedule request, or next promised external touch in Acre.",
        destinationLabel: "Calendar writeback",
        dueAtLabel: formatDateTimeLabel(appointment.startsAt, { timeZone }),
        tone: mapAppointmentTone({
          bridgeOpenedAt,
          workflowStatus: workflow.status,
          workflowNextActionAt: workflow.nextActionAt,
          startsAt: appointment.startsAt,
          now,
        }),
        _hasPressure: workflowHasPressure,
      };
    })
    .filter((item) => item._hasPressure)
    .map(({ _hasPressure, ...item }) => item)
    .slice(0, frontOfficeCleanupDigestMaxItemsPerSection)
    .sort(sortItemsByUrgency);
}

function pickWorkflowTone(section: FrontOfficeCleanupDigestSection) {
  if (section.items.some((item) => item.tone === "danger")) {
    return "danger" as const;
  }

  if (section.items.some((item) => item.tone === "warning")) {
    return "warning" as const;
  }

  return section.count > 0 ? ("accent" as const) : ("neutral" as const);
}

function buildFrontOfficeCleanupDigestWorkflow(
  sections: FrontOfficeCleanupDigestSection[],
): FrontOfficeCleanupDigestWorkflow {
  const sectionByKey = new Map(sections.map((section) => [section.key, section]));
  const followUpSection = sectionByKey.get("follow_up_tasks");
  const clientReminderSection = sectionByKey.get("client_reminders");
  const appointmentSection = sectionByKey.get("appointment_continuity");
  const notificationSection = sectionByKey.get("notifications");
  const steps: FrontOfficeCleanupDigestWorkflowStep[] = [];

  if (followUpSection?.count) {
    steps.push({
      key: "follow_up_tasks",
      label: "Follow-up pass",
      detail:
        "Work due follow-up first so client clocks stop drifting while the rest of the digest stays visible.",
      href: "/agent/notifications?activityView=personal_cleanup&cleanupFilter=follow_up",
      actionLabel: "Open follow-up pass",
      count: followUpSection.count,
      tone: pickWorkflowTone(followUpSection),
      mode: "manual",
    });
  }

  if (clientReminderSection?.count) {
    steps.push({
      key: "client_reminders",
      label: "Client reminder pass",
      detail:
        "Open the client queue and update the current reminder or last-touch record after the outside conversation.",
      href: "/agent/clients?clientView=follow_first",
      actionLabel: "Open client queue",
      count: clientReminderSection.count,
      tone: pickWorkflowTone(clientReminderSection),
      mode: "manual",
    });
  }

  if (appointmentSection?.count) {
    steps.push({
      key: "appointment_writeback",
      label: "Appointment writeback pass",
      detail:
        "Reconcile external calendar, email, or call results back into Acre as confirmation, reschedule, or next-touch checkpoints.",
      href:
        appointmentSection.items[0]?.href ??
        "/agent/calendar?calendarView=writeback_pending#calendar-writeback-section",
      actionLabel: "Open writeback pass",
      count: appointmentSection.count,
      tone: pickWorkflowTone(appointmentSection),
      mode: "manual",
    });
  }

  if (notificationSection?.count) {
    steps.push({
      key: "unread_notifications",
      label: "Unread notice pass",
      detail:
        "Clear unread workflow signals after the follow-up and appointment checkpoints have a saved next move.",
      href: "/agent/notifications?activityView=general_notices&readState=unread",
      actionLabel: "Open unread notices",
      count: notificationSection.count,
      tone: pickWorkflowTone(notificationSection),
      mode: "manual",
    });
  }

  return {
    label: "Manual cleanup pass",
    detail: steps.length
      ? "Run the digest, then work the listed passes in order. Acre records the manual run, but it does not schedule, auto-send, or provider-sync anything."
      : "No active cleanup pass is needed right now. The runner contract is still ready for a future scheduler.",
    runMode: "manual_operator_pass",
    schedulerState: "runner_contract_ready",
    providerSyncState: "none",
    primaryStepKey: steps[0]?.key ?? null,
    steps,
  };
}

export async function buildFrontOfficeCleanupDigest(
  input: BuildFrontOfficeCleanupDigestInput,
): Promise<FrontOfficeCleanupDigest> {
  const timeZone = resolveTimeZone(input.timeZone ?? null);
  const generatedAt = input.now ?? new Date();
  const cutoffAt = startOfDigestWindow(
    generatedAt,
    frontOfficeCleanupDigestWindowDays,
  );
  const recentWindowStart = startOfRecentWindow(
    generatedAt,
    frontOfficeCleanupDigestWindowDays,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);

  const [notifications, followUpTasks, clients, appointments, bridgeLogs] =
    await Promise.all([
      prisma.notification.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: input.viewerMembershipId,
          readAt: null,
          type: {
            in: [...frontOfficeCleanupDigestNotificationTypes],
          },
          ...(officeScopeFilter ? officeScopeFilter : {}),
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          actionUrl: true,
          createdAt: true,
        },
        take: frontOfficeCleanupDigestMaxItemsPerSection,
      }),
      prisma.followUpTask.findMany({
        where: {
          organizationId: input.organizationId,
          status: {
            not: "completed",
          },
          dueAt: {
            not: null,
            lte: cutoffAt,
          },
        },
        orderBy: [{ dueAt: "asc" }],
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          client: {
            select: {
              id: true,
              fullName: true,
              ownerMembership: {
                select: {
                  officeId: true,
                },
              },
            },
          },
        },
      }),
      prisma.client.findMany({
        where: {
          organizationId: input.organizationId,
          OR: [
            {
              nextFollowUpAt: {
                not: null,
                lte: cutoffAt,
              },
            },
            {
              leaseReminderAt: {
                not: null,
                lte: cutoffAt,
              },
            },
          ],
        },
        orderBy: [
          { nextFollowUpAt: "asc" },
          { leaseReminderAt: "asc" },
          { fullName: "asc" },
        ],
        select: {
          id: true,
          fullName: true,
          nextFollowUpAt: true,
          leaseReminderAt: true,
          ownerMembership: {
            select: {
              officeId: true,
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          organizationId: input.organizationId,
          startsAt: {
            gte: recentWindowStart,
          },
        },
        orderBy: [{ startsAt: "asc" }],
        select: {
          id: true,
          title: true,
          startsAt: true,
          client: {
            select: {
              id: true,
              fullName: true,
              ownerMembership: {
                select: {
                  officeId: true,
                },
              },
            },
          },
          metadata: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: "appointment",
          action: "appointment.bridge_opened",
          createdAt: {
            gte: recentWindowStart,
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

  const notificationItems = buildNotificationItems(notifications, timeZone);
  const followUpTaskItems = buildFollowUpTaskItems(
    followUpTasks as CleanupFollowUpTaskRecord[],
    input.officeId ?? null,
    generatedAt,
    cutoffAt,
    timeZone,
  );
  const clientReminderItems = buildClientReminderItems(
    clients as CleanupClientRecord[],
    input.officeId ?? null,
    generatedAt,
    cutoffAt,
    timeZone,
  );
  const bridgeLogsByAppointmentId = new Map<string, CleanupAppointmentBridgeLog[]>();

  for (const bridgeLog of bridgeLogs as CleanupAppointmentBridgeLog[]) {
    const existing = bridgeLogsByAppointmentId.get(bridgeLog.entityId) ?? [];
    existing.push(bridgeLog);
    bridgeLogsByAppointmentId.set(bridgeLog.entityId, existing);
  }

  const appointmentItems = buildAppointmentItems(
    appointments as CleanupAppointmentRecord[],
    bridgeLogsByAppointmentId,
    input.officeId ?? null,
    generatedAt,
    timeZone,
  );

  const sections: FrontOfficeCleanupDigestSection[] = [
    {
      key: "notifications",
      label: "Unread notifications",
      summary: formatSectionSummary(notificationItems.length, "Notification"),
      count: notificationItems.length,
      items: notificationItems.sort(sortItemsByUrgency),
    },
    {
      key: "follow_up_tasks",
      label: "Follow-up tasks",
      summary: formatSectionSummary(
        followUpTaskItems.length,
        "Follow-up task",
      ),
      count: followUpTaskItems.length,
      items: followUpTaskItems,
    },
    {
      key: "client_reminders",
      label: "Client reminders",
      summary: formatSectionSummary(
        clientReminderItems.length,
        "Client reminder",
      ),
      count: clientReminderItems.length,
      items: clientReminderItems,
    },
    {
      key: "appointment_continuity",
      label: "Appointment continuity",
      summary: formatSectionSummary(
        appointmentItems.length,
        "Appointment continuity item",
      ),
      count: appointmentItems.length,
      items: appointmentItems,
    },
  ];

  const summary = {
    totalCount: sections.reduce((count, section) => count + section.count, 0),
    urgentCount: sections.reduce(
      (count, section) =>
        count +
        section.items.filter((item) => item.tone === "danger").length,
      0,
    ),
    dueSoonCount: sections.reduce(
      (count, section) =>
        count +
        section.items.filter((item) => item.tone === "warning").length,
      0,
    ),
    notificationCount: notificationItems.length,
    followUpTaskCount: followUpTaskItems.length,
    clientReminderCount: clientReminderItems.length,
    appointmentCount: appointmentItems.length,
  };

  const nextAction = pickNextAction(sections, summary);
  const workflow = buildFrontOfficeCleanupDigestWorkflow(sections);

  return {
    generatedAt: generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeLabel(generatedAt, { timeZone }),
    scopeLabel: input.officeId
      ? "Office cleanup digest"
      : "Organization cleanup digest",
    timeZone,
    windowLabel: `Next ${frontOfficeCleanupDigestWindowDays} days`,
    cutoffAt: cutoffAt.toISOString(),
    summary,
    nextActionLabel: nextAction.label,
    nextActionDetail: nextAction.detail,
    workflow,
    sections,
  };
}
