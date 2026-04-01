import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  IncomingUpdateStatus,
  SignatureRequestStatus,
  TaskStatus,
  TransactionTaskStatus,
} from "@prisma/client";
import { prisma } from "./client";
import {
  buildFrontOfficeHandoffCreateHref,
  buildFrontOfficeHandoffSummary,
  isFrontOfficeStageReadyForBackOffice,
} from "./front-office-contracts";
import { formatDateTimeLabel } from "./date-time";
import {
  defaultLeaseReminderLeadDays,
  resolveLeaseReminderDates,
} from "./lease-reminders";
import { listTransactionOffersSnapshot } from "./offers";

export type FrontOfficeClientDetailTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeClientDetailStageHistoryItem = {
  id: string;
  title: string;
  description: string;
  changedAtLabel: string;
  tone: FrontOfficeClientDetailTone;
};

export type FrontOfficeClientDetailAppointmentItem = {
  id: string;
  title: string;
  typeLabel: string;
  typeTone: FrontOfficeClientDetailTone;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  startsAtLabel: string;
  locationLabel: string;
  contextLabel: string;
  listingOutputHref: string;
};

export type FrontOfficeClientDetailTaskItem = {
  id: string;
  title: string;
  statusValue: TaskStatus;
  dueLabel: string;
  dueAtValue: string;
  statusLabel: string;
  tone: FrontOfficeClientDetailTone;
  assigneeLabel: string;
};

export type FrontOfficeClientDetailSendRecordItem = {
  id: string;
  title: string;
  channelLabel: string;
  stageLabel: string;
  appointmentLabel: string;
  sentAtLabel: string;
  engagementLabel: string;
  engagementTone: FrontOfficeClientDetailTone;
  lastActivityLabel: string;
  href: string;
};

export type FrontOfficeClientDetailHandoffItem = {
  id: string;
  stageLabel: string;
  statusLabel: string;
  tone: FrontOfficeClientDetailTone;
  summary: string;
  updatedAtLabel: string;
  href: string;
};

export type FrontOfficeClientDetailTransactionItem = {
  id: string;
  label: string;
  statusLabel: string;
  roleLabel: string;
  href: string;
};

export type FrontOfficeClientDetailNegotiationOfferItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  partyLabel: string;
  priceLabel: string;
  expirationLabel: string;
  updatedAtLabel: string;
  href: string;
};

export type FrontOfficeClientDetailNegotiation = {
  stageLabel: string;
  stageTone: FrontOfficeClientDetailTone;
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryTitle: string;
  boundaryDescription: string;
  boundaryMetaLabel: string;
  offerCount: number;
  expiringSoonCount: number;
  acceptedOfferLabel: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  offers: FrontOfficeClientDetailNegotiationOfferItem[];
};

export type FrontOfficeClientDetailInspectionItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  contextLabel: string;
  description: string;
  metaLabel: string;
  actionLabel: string;
  href: string;
};

export type FrontOfficeClientDetailInspection = {
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryTitle: string;
  boundaryDescription: string;
  boundaryMetaLabel: string;
  openTaskCount: number;
  overdueTaskCount: number;
  pendingSignatureCount: number;
  pendingIncomingUpdateCount: number;
  primaryActionLabel: string;
  primaryActionHref: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  items: FrontOfficeClientDetailInspectionItem[];
};

export type FrontOfficeClientDetailWorkflowSignal = {
  pressureLabel: string;
  pressureTone: FrontOfficeClientDetailTone;
  pressureDescription: string;
  nextStepTitle: string;
  nextStepTone: FrontOfficeClientDetailTone;
  nextStepDescription: string;
  actionLabel: string;
  actionHref: string;
};

export type FrontOfficeClientDetailLeaseReminder = {
  leaseEndDateValue: string;
  leaseEndDateLabel: string;
  reminderAtValue: string;
  reminderAtLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  helperText: string;
  isAutoScheduled: boolean;
  needsAttention: boolean;
};

export type FrontOfficeClientDetailPlaybookItem = {
  id: string;
  title: string;
  description: string;
};

export type FrontOfficeClientDetailPlaybookTemplate = {
  id: string;
  label: string;
  channelLabel: string;
  body: string;
};

export type FrontOfficeClientDetailPlaybookObjection = {
  id: string;
  objection: string;
  response: string;
};

export type FrontOfficeClientDetailPlaybook = {
  focusLabel: string;
  focusDescription: string;
  introScript: string;
  callChecklist: FrontOfficeClientDetailPlaybookItem[];
  conversationPrompts: FrontOfficeClientDetailPlaybookItem[];
  objectionHandling: FrontOfficeClientDetailPlaybookObjection[];
  messageTemplates: FrontOfficeClientDetailPlaybookTemplate[];
};

export type FrontOfficeClientDetailSnapshot = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  stage: string;
  stageTone: FrontOfficeClientDetailTone;
  sourceLabel: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  notesLabel: string;
  ownerLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  summary: {
    openTaskCount: number;
    upcomingAppointmentCount: number;
    stageHistoryCount: number;
    openHandoffCount: number;
  };
  engagement: {
    sendCount: number;
    openedSendCount: number;
    revisitCount: number;
    lastEngagementLabel: string;
  };
  leaseReminder: FrontOfficeClientDetailLeaseReminder;
  negotiation: FrontOfficeClientDetailNegotiation;
  inspection: FrontOfficeClientDetailInspection;
  workflow: FrontOfficeClientDetailWorkflowSignal;
  playbook: FrontOfficeClientDetailPlaybook;
  stageHistory: FrontOfficeClientDetailStageHistoryItem[];
  appointments: FrontOfficeClientDetailAppointmentItem[];
  followUpTasks: FrontOfficeClientDetailTaskItem[];
  sendRecords: FrontOfficeClientDetailSendRecordItem[];
  handoffs: FrontOfficeClientDetailHandoffItem[];
  linkedTransactions: FrontOfficeClientDetailTransactionItem[];
};

export type GetFrontOfficeClientDetailInput = {
  organizationId: string;
  viewerMembershipId: string;
  clientId: string;
  timeZone?: string | null;
};

function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  const minValue = Number(min ?? 0);
  const maxValue = Number(max ?? 0);

  if (minValue > 0 && maxValue > 0) {
    return `${formatCurrency(minValue)} - ${formatCurrency(maxValue)}`;
  }

  if (maxValue > 0) {
    return `Up to ${formatCurrency(maxValue)}`;
  }

  if (minValue > 0) {
    return `From ${formatCurrency(minValue)}`;
  }

  return "Budget not captured";
}

function formatDateLabel(
  value: Date | null | undefined,
  timeZone?: string | null,
) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function formatDateValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function pickEarliestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((earliest, value) => {
    if (!value) {
      return earliest;
    }

    if (!earliest || value.getTime() < earliest.getTime()) {
      return value;
    }

    return earliest;
  }, null);
}

function buildLeaseReminderSnapshot(input: {
  leaseEndDate: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
  timeZone?: string | null;
}): FrontOfficeClientDetailLeaseReminder {
  const leaseDates = resolveLeaseReminderDates({
    leaseEndDate: input.leaseEndDate,
    leaseReminderAt: input.leaseReminderAt,
  });
  const startOfToday = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate(),
  );
  const startOfTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1,
  );
  const fourteenDaysFromNow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 14,
  );

  if (!leaseDates.leaseReminderAt) {
    return {
      leaseEndDateValue: "",
      leaseEndDateLabel: leaseDates.leaseEndDate
        ? formatDateLabel(leaseDates.leaseEndDate, input.timeZone)
        : "No lease end date captured",
      reminderAtValue: "",
      reminderAtLabel: "Not scheduled",
      statusLabel: "No lease reminder",
      statusTone: "neutral",
      helperText:
        "Add the lease end date and reminder date when this client needs renewal, remarketing, or move planning to stay visible in Front Office.",
      isAutoScheduled: false,
      needsAttention: false,
    };
  }

  let statusLabel = "Reminder scheduled";
  let statusTone: FrontOfficeClientDetailTone = "success";
  let helperText = leaseDates.leaseEndDate
    ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}.`
    : "Lease reminder is on the calendar.";
  let needsAttention = false;

  if (leaseDates.leaseReminderAt.getTime() < startOfToday.getTime()) {
    statusLabel = "Reminder overdue";
    statusTone = "danger";
    helperText = leaseDates.leaseEndDate
      ? `Lease ended or will end ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Renewal or remarketing follow-up should already be underway.`
      : `This lease reminder slipped past ${formatDateLabel(leaseDates.leaseReminderAt, input.timeZone)}.`;
    needsAttention = true;
  } else if (
    leaseDates.leaseReminderAt.getTime() < startOfTomorrow.getTime()
  ) {
    statusLabel = "Reminder due today";
    statusTone = "warning";
    helperText = leaseDates.leaseEndDate
      ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Make the renewal or move-out touch today.`
      : "Make the lease follow-up today so this client does not go quiet.";
    needsAttention = true;
  } else if (
    leaseDates.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime()
  ) {
    statusLabel = "Reminder due soon";
    statusTone = "accent";
    helperText = leaseDates.leaseEndDate
      ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Use the next two weeks to confirm renewal, remarketing, or move plans.`
      : "A lease-related touch is coming up soon. Confirm the outreach plan before it is late.";
  }

  if (leaseDates.isAutoScheduled && leaseDates.leaseEndDate) {
    helperText = `${helperText} Acre auto-scheduled this reminder ${defaultLeaseReminderLeadDays} days before the lease end date.`;
  }

  return {
    leaseEndDateValue: formatDateValue(leaseDates.leaseEndDate),
    leaseEndDateLabel: leaseDates.leaseEndDate
      ? formatDateLabel(leaseDates.leaseEndDate, input.timeZone)
      : "No lease end date captured",
    reminderAtValue: formatDateValue(leaseDates.leaseReminderAt),
    reminderAtLabel: formatDateLabel(leaseDates.leaseReminderAt, input.timeZone),
    statusLabel,
    statusTone,
    helperText,
    isAutoScheduled: leaseDates.isAutoScheduled,
    needsAttention,
  };
}

function formatRelativeDueLabel(
  value: Date | null | undefined,
  now: Date,
  timeZone?: string | null,
) {
  if (!value) {
    return "No follow-up scheduled";
  }

  const dueTime = value.getTime();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();

  if (dueTime < startOfToday) {
    return `Overdue since ${formatDateLabel(value, timeZone)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateTimeLabel(value, { timeZone: timeZone ?? null })}`;
  }

  return `Next follow-up · ${formatDateLabel(value, timeZone)}`;
}

function mapClientStageTone(stage: string): FrontOfficeClientDetailTone {
  const normalized = stage.trim().toLowerCase();

  if (!normalized) {
    return "neutral";
  }

  if (normalized.includes("won")) {
    return "success";
  }

  if (normalized.includes("lost")) {
    return "danger";
  }

  if (
    normalized.includes("negotiation") ||
    normalized.includes("offer") ||
    normalized.includes("application")
  ) {
    return "warning";
  }

  if (
    normalized.includes("tour") ||
    normalized.includes("viewing") ||
    normalized.includes("contacted") ||
    normalized.includes("warm")
  ) {
    return "accent";
  }

  return "neutral";
}

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeClientDetailTone {
  switch (type) {
    case AppointmentType.showing:
    case AppointmentType.open_house:
      return "accent";
    case AppointmentType.consultation:
      return "success";
    case AppointmentType.client_meeting:
      return "warning";
    default:
      return "neutral";
  }
}

function mapAppointmentStatusTone(
  status: AppointmentStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case AppointmentStatus.completed:
      return "success";
    case AppointmentStatus.no_show:
      return "warning";
    case AppointmentStatus.canceled:
      return "danger";
    default:
      return "accent";
  }
}

function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatAppointmentStatusLabel(status: AppointmentStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapTaskTone(
  status: TaskStatus,
  dueAt: Date | null,
  now: Date,
): FrontOfficeClientDetailTone {
  if (status === TaskStatus.completed) {
    return "success";
  }

  if (!dueAt) {
    return "neutral";
  }

  if (dueAt.getTime() < now.getTime()) {
    return "warning";
  }

  return "accent";
}

function formatTaskStatusLabel(status: TaskStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTaskDueLabel(
  dueAt: Date | null,
  now: Date,
  timeZone?: string | null,
) {
  if (!dueAt) {
    return "No due date";
  }

  const dueTime = dueAt.getTime();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();

  if (dueTime < startOfToday) {
    return `Overdue · ${formatDateLabel(dueAt, timeZone)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateLabel(dueAt, timeZone)}`;
  }

  return `Due ${formatDateLabel(dueAt, timeZone)}`;
}

function formatFrontOfficeSendChannelLabel(channel: string) {
  switch (channel.trim().toLowerCase()) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    default:
      return "Direct link";
  }
}

function mapFrontOfficeSendEngagementTone(
  openCount: number,
): FrontOfficeClientDetailTone {
  if (openCount <= 0) {
    return "neutral";
  }

  if (openCount === 1) {
    return "success";
  }

  return "accent";
}

function buildFrontOfficeSendEngagementLabel(openCount: number) {
  if (openCount <= 0) {
    return "Not opened";
  }

  if (openCount === 1) {
    return "Opened";
  }

  return `Revisited ${openCount} times`;
}

function formatSendRecordStageLabel(value: string | null | undefined) {
  return value?.trim() || "Stage not captured";
}

function buildSendRecordAppointmentLabel(input: {
  title: string | null | undefined;
  startsAt: Date | null | undefined;
  timeZone?: string | null;
}) {
  if (!input.title?.trim() && !input.startsAt) {
    return "";
  }

  if (!input.startsAt) {
    return input.title?.trim() || "Appointment context";
  }

  if (!input.title?.trim()) {
    return `Appointment · ${formatDateTimeLabel(input.startsAt, {
      timeZone: input.timeZone ?? null,
    })}`;
  }

  return `${input.title.trim()} · ${formatDateTimeLabel(input.startsAt, {
    timeZone: input.timeZone ?? null,
  })}`;
}

function getClientFirstName(fullName: string) {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName?.trim() || "there";
}

function hasMeaningfulBudgetLabel(label: string) {
  return label.trim() !== "Budget not captured";
}

function hasMeaningfulAreasLabel(label: string) {
  return label.trim() !== "Areas not captured";
}

function hasMeaningfulIntentLabel(label: string) {
  return label.trim() !== "Intent not captured";
}

function buildPlaybookItem(
  id: string,
  title: string,
  description: string,
): FrontOfficeClientDetailPlaybookItem {
  return { id, title, description };
}

function buildPlaybookTemplate(
  id: string,
  label: string,
  channelLabel: string,
  body: string,
): FrontOfficeClientDetailPlaybookTemplate {
  return { id, label, channelLabel, body };
}

function buildPlaybookObjection(
  id: string,
  objection: string,
  response: string,
): FrontOfficeClientDetailPlaybookObjection {
  return { id, objection, response };
}

function buildFrontOfficePlaybook(input: {
  fullName: string;
  ownerLabel: string;
  stage: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  upcomingAppointmentCount: number;
}): FrontOfficeClientDetailPlaybook {
  const normalizedStage = input.stage.trim().toLowerCase();
  const firstName = getClientFirstName(input.fullName);
  const agentLabel =
    input.ownerLabel.trim() && input.ownerLabel !== "Unassigned"
      ? input.ownerLabel
      : "Acre";
  const budgetContext = hasMeaningfulBudgetLabel(input.budgetLabel)
    ? input.budgetLabel
    : "the right budget";
  const areaContext = hasMeaningfulAreasLabel(input.preferredAreasLabel)
    ? input.preferredAreasLabel
    : "the right neighborhoods";
  const intentContext = hasMeaningfulIntentLabel(input.intentLabel)
    ? input.intentLabel
    : "this move";
  const appointmentContext = input.upcomingAppointmentCount
    ? "There is already an appointment on the calendar, so this call should tighten the plan instead of reopening discovery."
    : "No appointment is booked yet, so the next touch should either narrow the search or book the next showing.";

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    return {
      focusLabel: "Offer / application coordination",
      focusDescription:
        "Use this conversation to lock the client-facing terms, document readiness, and deadlines before the formal Back Office file does the heavy lifting.",
      introScript: `Hi ${firstName}, this is ${agentLabel} from Acre. Before we push this fully into the formal Back Office workflow, I want to lock the exact terms, timeline, and supporting documents so nothing slows us down.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-property",
          "Confirm the exact property and target terms",
          "Repeat the address or listing, confirm the target price or rent range, and make sure both sides are talking about the same unit and timing.",
        ),
        buildPlaybookItem(
          "confirm-documents",
          "Check document readiness",
          "Confirm IDs, proof of funds, pre-approval, landlord package items, or any supporting paperwork that must be in hand today.",
        ),
        buildPlaybookItem(
          "confirm-decision-makers",
          "Lock the sign-off path",
          "Ask who needs to review or sign, and when each decision-maker will be available so the BO handoff is not blocked by missing approvals.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "terms-flexibility",
          "Price / term flexibility",
          "Ask where the client has room to move on price, closing, contingencies, lease length, or concessions.",
        ),
        buildPlaybookItem(
          "deadline-risk",
          "Deadline pressure",
          "Clarify what happens if a response or signature slips, and which deadlines are truly hard stops.",
        ),
        buildPlaybookItem(
          "bo-handoff-brief",
          "BO handoff brief",
          "Summarize what the Back Office team needs to know on day one: timeline, terms, blockers, and any personality or communication preferences.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "wait-before-submit",
          "I want to wait a little longer before we submit.",
          "Acknowledge the hesitation, then clarify what new information would materially change the decision so the team can either get that answer fast or agree on a deadline to decide.",
        ),
        buildPlaybookObjection(
          "nervous-about-paperwork",
          "The paperwork feels overwhelming.",
          "Break the process into the next two concrete actions only, tell them which documents matter first, and explain that the BO file will keep the formal checklist organized once this handoff is opened.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "docs-request-email",
          "Document request",
          "Email",
          `Subject: Next items for ${intentContext}\n\nHi ${firstName},\n\nTo keep this moving, please send the remaining documents for ${intentContext}. Right now I want to confirm the target terms, your availability to sign, and anything still outstanding on the paperwork side.\n\nOnce those items are in, I will push the formal file forward and keep you updated on the next deadline.\n\nThanks,\n${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "offer-recap-text",
          "Offer / application recap",
          "Text",
          `Hi ${firstName}, quick recap from our call: we are aligned on the target terms, the remaining documents, and the timing to move this into the formal process. Send anything outstanding when you can, and I will keep the next steps tight from there.\n\n- ${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    return {
      focusLabel: "Showing confirmation",
      focusDescription:
        "Confirm logistics and decision criteria before the tour, so the showing is about decision-making instead of basic coordination.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I am confirming the showing details and want to make sure we focus on the right features while you are there so the appointment gives us a real next step.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-logistics",
          "Confirm time, address, and access",
          "Repeat the appointment window, exact location, access instructions, and any building entry notes so nobody arrives uncertain.",
        ),
        buildPlaybookItem(
          "confirm-attendees",
          "Confirm who is attending",
          "Ask who will join the showing and whether any decision-maker still needs a separate walkthrough or recap afterward.",
        ),
        buildPlaybookItem(
          "confirm-day-of-plan",
          "Set the day-of communication plan",
          "Confirm the best number for day-of updates, parking or transit questions, and what to do if timing shifts.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "must-see-features",
          "Top 3 must-see features",
          "Ask what absolutely needs to feel right during the showing so you can steer the walkthrough around those priorities.",
        ),
        buildPlaybookItem(
          "deal-breakers",
          "Immediate pass triggers",
          "Ask what would make them rule the listing out on the spot so you can qualify the fit faster.",
        ),
        buildPlaybookItem(
          "backup-plan",
          "Backup options",
          "Confirm whether they want one or two fallback listings lined up if this showing misses.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "need-reschedule",
          "I may need to reschedule.",
          "Confirm whether timing or motivation changed. If the interest is still real, move the appointment before ending the call so the momentum stays intact.",
        ),
        buildPlaybookObjection(
          "want-more-options-first",
          "Can you just send a few more options first?",
          "Agree to send backups, but keep the current showing unless there is a real mismatch. The appointment gives cleaner feedback than another round of blind browsing.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "showing-confirmation-text",
          "Showing confirmation",
          "Text",
          `Hi ${firstName}, confirming our showing. I will send the final address and access notes before we meet. If anything changes on timing, text me here so I can adjust quickly.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "day-of-reminder-text",
          "Day-of reminder",
          "Text",
          `Hi ${firstName}, quick reminder for today's showing. I have the timing and access notes ready, and I will keep the walkthrough focused on the features that matter most to you.\n\n- ${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    return {
      focusLabel: "Feedback capture",
      focusDescription:
        "Memory is freshest right after the visit. Use this call to separate polite reactions from real intent and decide whether the next move is a second showing, shortlist, or BO-ready handoff.",
      introScript: `Hi ${firstName}, thanks again for seeing the property. I want to grab your reaction while it is still fresh so I can either narrow the shortlist or move quickly on the next step.`,
      callChecklist: [
        buildPlaybookItem(
          "likes-dislikes",
          "Capture what matched and what missed",
          "Ask for one thing they liked, one thing that felt off, and whether that issue is a deal-breaker or only a trade-off.",
        ),
        buildPlaybookItem(
          "price-readiness",
          "Test price or rent resistance",
          "Clarify whether hesitation is about price, condition, layout, timing, or another listing still in the mix.",
        ),
        buildPlaybookItem(
          "next-decision",
          "Leave the call with a concrete next action",
          "Do not end with 'let me know.' Set the next showing, recap list, or offer/application prep step before you hang up.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "compare-to-shortlist",
          "Compare against current shortlist",
          "Ask where this property ranks against everything else they have seen so far and why.",
        ),
        buildPlaybookItem(
          "decision-gap",
          "Name the gap to decision",
          "Ask what still needs to be true before they would seriously consider moving forward.",
        ),
        buildPlaybookItem(
          "timing-after-showing",
          "Lock the follow-up window",
          "Agree on when they will decide between this listing and the backups so the dossier does not drift after the tour.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "need-to-think",
          "We need to think about it.",
          "Acknowledge that, then ask what exactly needs review and when they will know. Convert a vague pause into a specific follow-up date or decision milestone.",
        ),
        buildPlaybookObjection(
          "price-too-high",
          "It feels too expensive.",
          "Ask whether the issue is the absolute price, the value compared with alternatives, or the monthly payment. That tells you whether to negotiate, replace, or nurture.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "feedback-follow-up-text",
          "Feedback follow-up",
          "Text",
          `Hi ${firstName}, thanks again for the showing today. Send me the top one or two things that felt strongest and the biggest hesitation, and I will line up the smartest next step from there.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "shortlist-recap-email",
          "Shortlist recap",
          "Email",
          `Subject: Today's showing recap\n\nHi ${firstName},\n\nThanks again for taking the time to tour the property. I want to keep the next move simple: reply with what felt strongest, what felt weakest, and whether you want to compare this against backup options before making a decision.\n\nOnce I have that, I will tighten the shortlist and set the right follow-up.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("lost")) {
    return {
      focusLabel: "Nurture re-entry",
      focusDescription:
        "A lost stage should still end with a respectful future touchpoint instead of silence. Keep the relationship warm without pretending the urgency still exists.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I know the timing may not be right today, but I wanted to keep a light touchpoint open in case the plan changes and you want to restart quickly.`,
      callChecklist: [
        buildPlaybookItem(
          "why-paused",
          "Clarify why the search paused",
          "Capture the real reason the opportunity cooled off so future follow-up can be relevant instead of generic.",
        ),
        buildPlaybookItem(
          "future-window",
          "Ask for the next realistic window",
          "Get a month, season, or trigger event you can anchor the next reminder to.",
        ),
        buildPlaybookItem(
          "permission-to-return",
          "Keep the door open",
          "Ask how they want to be contacted if something especially relevant appears before the nurture reminder fires.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-changed",
          "What changed most?",
          "Ask whether budget, timeline, financing, family decision-making, or competition changed the plan.",
        ),
        buildPlaybookItem(
          "restart-trigger",
          "What would bring them back?",
          "Name the condition that would make them restart: a date, a price point, a neighborhood, or a new approval.",
        ),
        buildPlaybookItem(
          "future-channel",
          "Best future contact channel",
          "Confirm whether the next nurture touch should be text, email, or phone so the later reminder lands well.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "stop-for-now",
          "We are stopping for now.",
          "Respect that clearly, then ask for the best future moment to check back so the dossier has a real nurture date instead of a vague open loop.",
        ),
        buildPlaybookObjection(
          "working-with-someone-else",
          "We are working with someone else now.",
          "Stay professional and ask whether they want to keep your contact for backup help later. The goal is a clean relationship, not a hard sell.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "soft-check-in-text",
          "Soft nurture text",
          "Text",
          `Hi ${firstName}, just keeping a light touchpoint open in case your plans change. If timing opens back up or you want a quick market read, I am happy to help.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "future-reopen-email",
          "Future reopen email",
          "Email",
          `Subject: Keeping the door open\n\nHi ${firstName},\n\nI know the timing may not be right right now, so there is no pressure. I just wanted to keep the line open in case your plans change and you want to restart quickly.\n\nIf that happens, send me the latest timing, target budget, and areas you want to revisit, and I will pick it up from there.\n\nBest,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("won")) {
    return {
      focusLabel: "Post-handoff client update",
      focusDescription:
        "Front Office should keep the client calm and informed while the formal record and deadlines now live in Back Office.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. The formal file is now moving forward, and I want to make sure you know what the next milestone is and how I will keep you posted.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-milestone",
          "Name the immediate next milestone",
          "Tell the client exactly what is happening next, whether that is paperwork, inspection, approval, deposit, or another BO milestone.",
        ),
        buildPlaybookItem(
          "confirm-update-channel",
          "Confirm update cadence",
          "Ask how often they want updates and which channel they trust most for process communication.",
        ),
        buildPlaybookItem(
          "capture-anxiety",
          "Surface hidden concerns",
          "Invite the client to say what feels uncertain now so the next update can address that directly instead of only repeating status.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-happens-next",
          "Explain the process in plain English",
          "Translate the formal BO step into a client-friendly explanation and confirm they understand what is expected from them.",
        ),
        buildPlaybookItem(
          "decision-timing",
          "Clarify when they need to act next",
          "Make sure they know the next date that requires a response, payment, signature, or scheduling choice.",
        ),
        buildPlaybookItem(
          "handoff-boundary",
          "Explain who handles what",
          "Reassure them that the formal record is active while you stay aligned on communication, support, and escalation.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "dont-understand-next-steps",
          "I do not really understand what happens now.",
          "Slow down, explain only the immediate milestone, and tell them what they do not need to worry about yet. The goal is clarity, not a full training session.",
        ),
        buildPlaybookObjection(
          "worried-about-delay",
          "I am worried this is taking too long.",
          "Acknowledge the delay, restate the current blocker or milestone, and give the next expected update window so the client is not left guessing.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "milestone-update-text",
          "Milestone update",
          "Text",
          `Hi ${firstName}, quick update: the formal file is moving and I will keep you posted on the next milestone as soon as I have it. If any question comes up in the meantime, send it here and I will keep it aligned.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "process-welcome-email",
          "Welcome to process email",
          "Email",
          `Subject: What happens next\n\nHi ${firstName},\n\nThe formal process is now underway. I will keep the communication simple: I will tell you what the next milestone is, what you need to do for that step, and when you can expect the following update.\n\nIf anything feels unclear, reply here and I will help translate it into the next action.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("pending")) {
    return {
      focusLabel: "Unblock the file",
      focusDescription:
        "Pending should still feel active. Use the call to name the blocker, the owner, and the next date instead of letting the dossier sit quietly.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I wanted to check what is still blocking the next step so we can either move it now or set a clear date to revisit it.`,
      callChecklist: [
        buildPlaybookItem(
          "name-blocker",
          "Name the actual blocker",
          "Do not accept 'still pending' as the answer. Pin down whether the delay is timing, documentation, another person, or missing inventory.",
        ),
        buildPlaybookItem(
          "assign-owner",
          "Assign the owner",
          "Confirm who owns the next move: the client, a decision-maker, the agent, or the BO workflow.",
        ),
        buildPlaybookItem(
          "set-date",
          "Leave with a real date",
          "If the blocker cannot be cleared immediately, agree on the next follow-up date before ending the conversation.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-can-move-now",
          "What can still move today?",
          "Even if the main blocker remains, ask whether a document, shortlist, or decision step can still advance now.",
        ),
        buildPlaybookItem(
          "hidden-objection",
          "Is there an unspoken hesitation?",
          "Pending often hides uncertainty. Ask what feels unresolved so you do not manage the wrong problem.",
        ),
        buildPlaybookItem(
          "deadline-cost",
          "What happens if this slips another week?",
          "This surfaces urgency without sounding pushy and helps the client decide whether the blocker really matters.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "waiting-on-someone",
          "We are waiting on someone else.",
          "Ask what that person needs in order to respond and whether you can package the ask more clearly. Turn passive waiting into a defined follow-up plan.",
        ),
        buildPlaybookObjection(
          "not-urgent-right-now",
          "It is not urgent right now.",
          "Acknowledge that, then ask what date would make it urgent again so the dossier gets a concrete next-touch instead of a vague pause.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "blocker-checkin-text",
          "Blocker check-in",
          "Text",
          `Hi ${firstName}, quick check-in so I can keep this moving cleanly: what is still blocking the next step, and what date should I anchor the follow-up to if it does not clear today?\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "status-check-email",
          "Status check email",
          "Email",
          `Subject: Quick status check\n\nHi ${firstName},\n\nI wanted to keep this from drifting. What is the current blocker, who owns the next move, and what date should we use for the next check-in if it is still unresolved?\n\nOnce I have that, I can keep the follow-up clean instead of guessing.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("contacted") ||
    normalizedStage.includes("warm") ||
    normalizedStage.includes("qualified")
  ) {
    return {
      focusLabel: "Qualification follow-up",
      focusDescription:
        "Move the record from general interest into a defined shortlist by tightening intent, budget, area, and timing on this call.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I wanted to tighten the search before I send another round of options so everything I send is actually aligned with your timing, budget, and preferred areas.`,
      callChecklist: [
        buildPlaybookItem(
          "restate-brief",
          "Restate the brief back to them",
          `Repeat the current working picture for ${intentContext}, ${budgetContext}, and ${areaContext}, then ask what needs to be corrected.`,
        ),
        buildPlaybookItem(
          "narrow-search",
          "Reduce the search shape",
          "Try to leave the call with fewer neighborhoods, a firmer budget guardrail, or a clearer property type preference than you had before.",
        ),
        buildPlaybookItem(
          "set-tour-readiness",
          "Test tour readiness",
          "Ask what would need to be true for them to book a showing this week instead of staying in passive browsing mode.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "must-have-vs-nice-to-have",
          "Must-have vs. nice-to-have",
          "Ask which features are true decision filters and which ones are only preferences.",
        ),
        buildPlaybookItem(
          "timing-trigger",
          "Timing trigger",
          "Ask what date or life event is driving the move so urgency is grounded in reality.",
        ),
        buildPlaybookItem(
          "decision-circle",
          "Who else is part of the decision?",
          "Clarify whether a partner, parent, roommate, or employer still needs to weigh in before a showing or application can happen.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "still-browsing",
          "We are still browsing.",
          "That is fine, but ask what would make the browsing feel actionable. The goal is to turn vague browsing into criteria you can actually work with.",
        ),
        buildPlaybookObjection(
          "send-more-options",
          "Can you just send more options first?",
          "Agree to send more only after you tighten one variable. Otherwise the next batch just creates more noise and no progress.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "shortlist-text",
          "Shortlist follow-up",
          "Text",
          `Hi ${firstName}, I am tightening the shortlist around ${areaContext} and ${budgetContext}. Send me the top feature you care about most right now, and I will make the next batch more precise.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "qualification-email",
          "Qualification recap",
          "Email",
          `Subject: Tightening the shortlist\n\nHi ${firstName},\n\nBefore I send the next round of options, I want to make sure I am aiming at the right search. Right now I am working from ${intentContext}, ${budgetContext}, and ${areaContext}.\n\nReply with anything that should change, especially around timing, top must-haves, and the neighborhoods that matter most.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  return {
    focusLabel: "First call",
    focusDescription: `Use the first conversation to qualify ${intentContext}, timing, budget, and areas quickly so the next move is intentional instead of generic. ${appointmentContext}`,
    introScript: `Hi ${firstName}, this is ${agentLabel} from Acre. I wanted to make sure I understand what you are looking for before I send a random batch of options. Do you have two or three minutes to go over timing, budget, and the areas that matter most?`,
    callChecklist: [
      buildPlaybookItem(
        "timing",
        "Confirm the move timeline",
        "Ask what is driving the timing and whether they are making a move this month, this season, or only exploring for later.",
      ),
      buildPlaybookItem(
        "budget",
        "Confirm the working budget",
        `Use ${budgetContext} as the starting point and tighten whether that number is hard, flexible, or still unknown.`,
      ),
      buildPlaybookItem(
        "areas",
        "Confirm the priority areas",
        `Use ${areaContext} as the starting map and reduce it to the neighborhoods they would actually tour first.`,
      ),
    ],
    conversationPrompts: [
      buildPlaybookItem(
        "goal",
        "What problem are they solving?",
        "Ask why this move matters now. The answer usually reveals the real urgency and filters out nice-to-have conversations.",
      ),
      buildPlaybookItem(
        "readiness",
        "How ready are they to act?",
        "Ask what still needs to happen before they would book a showing, apply, or seriously narrow choices.",
      ),
      buildPlaybookItem(
        "decision-makers",
        "Who else is involved?",
        "Clarify who will help decide so follow-up can include the right people early instead of stalling later.",
      ),
    ],
    objectionHandling: [
      buildPlaybookObjection(
        "just-looking",
        "We are just looking right now.",
        "Take the pressure off, then ask what would make the search feel worth taking seriously. That gives you a real threshold for the next touch.",
      ),
      buildPlaybookObjection(
        "too-early-for-call",
        "Can you just text or email me instead?",
        "Respect that, but still ask for one key variable now, such as timing or budget, so your next message feels tailored instead of automated.",
      ),
    ],
    messageTemplates: [
      buildPlaybookTemplate(
        "intro-text",
        "Intro text",
        "Text",
        `Hi ${firstName}, this is ${agentLabel} from Acre. I am pulling together options around ${areaContext}, and I want to make sure I have the right timing and budget before I send them. What is the ideal move timeline for you right now?`,
      ),
      buildPlaybookTemplate(
        "first-call-email",
        "First-call recap",
        "Email",
        `Subject: Quick search setup\n\nHi ${firstName},\n\nThanks again. Before I send options, I want to make sure I understand the search correctly. Right now I am working from ${intentContext}, ${budgetContext}, and ${areaContext}.\n\nReply with the timing that matters most and anything I should adjust before I build the shortlist.\n\nThanks,\n${agentLabel}`,
      ),
    ],
  };
}

function mapHandoffTone(
  status: FrontOfficeHandoffStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case FrontOfficeHandoffStatus.committed:
      return "success";
    case FrontOfficeHandoffStatus.canceled:
      return "neutral";
    case FrontOfficeHandoffStatus.ready:
      return "warning";
    default:
      return "accent";
  }
}

function formatHandoffStatusLabel(status: FrontOfficeHandoffStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTransactionStatusLabel(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildTransactionWorkspaceHref(transactionId: string, anchor?: string) {
  return anchor?.trim()
    ? `/office/transactions/${transactionId}#${anchor}`
    : `/office/transactions/${transactionId}`;
}

function mapOfferStatusTone(status: string): FrontOfficeClientDetailTone {
  switch (status) {
    case "accepted":
      return "success";
    case "countered":
    case "under_review":
      return "warning";
    case "submitted":
    case "received":
      return "accent";
    case "rejected":
    case "withdrawn":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

function buildOfferWorkspaceHref(
  transactionId: string,
  offerId?: string | null,
) {
  return offerId?.trim()
    ? `/office/transactions/${transactionId}#offer-${offerId}`
    : buildTransactionWorkspaceHref(transactionId, "transaction-offers");
}

function formatTransactionTaskStatusLabel(status: TransactionTaskStatus) {
  return formatTransactionStatusLabel(status);
}

function mapTransactionTaskTone(
  status: TransactionTaskStatus,
  dueAt: Date | null,
  now: Date,
): FrontOfficeClientDetailTone {
  if (status === TransactionTaskStatus.completed) {
    return "success";
  }

  if (dueAt && dueAt.getTime() < now.getTime()) {
    return "danger";
  }

  if (status === TransactionTaskStatus.review_requested) {
    return "warning";
  }

  if (status === TransactionTaskStatus.in_progress) {
    return "accent";
  }

  if (status === TransactionTaskStatus.reopened) {
    return "warning";
  }

  return "neutral";
}

function formatSignatureRequestStatusLabel(status: SignatureRequestStatus) {
  return formatTransactionStatusLabel(status);
}

function mapSignatureRequestTone(
  status: SignatureRequestStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case SignatureRequestStatus.completed:
      return "success";
    case SignatureRequestStatus.pending_send:
      return "warning";
    case SignatureRequestStatus.sent:
    case SignatureRequestStatus.viewed:
    case SignatureRequestStatus.signed:
      return "accent";
    case SignatureRequestStatus.declined:
    case SignatureRequestStatus.canceled:
    case SignatureRequestStatus.voided:
    case SignatureRequestStatus.expired:
      return "danger";
    default:
      return "neutral";
  }
}

function formatIncomingUpdateStatusLabel(status: IncomingUpdateStatus) {
  return formatTransactionStatusLabel(status);
}

function mapIncomingUpdateTone(
  status: IncomingUpdateStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case IncomingUpdateStatus.accepted:
    case IncomingUpdateStatus.applied:
      return "success";
    case IncomingUpdateStatus.rejected:
      return "danger";
    default:
      return "warning";
  }
}

function buildTransactionLocationLabel(input: {
  address: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
}) {
  const addressLabel = input.address?.trim() || "";
  const cityStateLabel = [input.city?.trim() || "", input.state?.trim() || ""]
    .filter(Boolean)
    .join(", ");

  return [addressLabel, cityStateLabel].filter(Boolean).join(", ");
}

function buildTransactionContextMetaLabel(input: {
  title: string | null | undefined;
  address: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  acceptanceDate: Date | null | undefined;
  closingDate: Date | null | undefined;
  timeZone?: string | null;
}) {
  const timingLabels = [
    input.acceptanceDate
      ? `Accepted ${formatDateLabel(input.acceptanceDate, input.timeZone)}`
      : "",
    input.closingDate
      ? `Closing ${formatDateLabel(input.closingDate, input.timeZone)}`
      : "",
  ].filter(Boolean);

  return [
    input.title?.trim() || "",
    buildTransactionLocationLabel(input),
    ...timingLabels,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildWorkflowSignal(input: {
  clientId: string;
  stage: string;
  lastContactAt: Date | null;
  nextTouchAt: Date | null;
  leaseReminderAt: Date | null;
  leaseReminderNeedsAttention: boolean;
  hasOverdueTask: boolean;
  openTaskCount: number;
  activeHandoff: {
    status: FrontOfficeHandoffStatus;
    href: string;
    committedTransactionId: string | null;
  } | null;
  linkedTransactionHref: string | null;
  timeZone?: string | null;
  now: Date;
}): FrontOfficeClientDetailWorkflowSignal {
  const normalizedStage = input.stage.trim().toLowerCase();
  const isClosedStage =
    normalizedStage.includes("won") || normalizedStage.includes("lost");
  const isActiveOpportunity = Boolean(normalizedStage) && !isClosedStage;
  const daysSinceLastTouch = input.lastContactAt
    ? Math.floor(
        (input.now.getTime() - input.lastContactAt.getTime()) / 86_400_000,
      )
    : null;
  const hasOverdueNextTouch = Boolean(
    input.nextTouchAt && input.nextTouchAt.getTime() < input.now.getTime(),
  );

  let pressureLabel = "Workflow healthy";
  let pressureTone: FrontOfficeClientDetailTone = "success";
  let pressureDescription =
    input.nextTouchAt || input.openTaskCount
      ? "This dossier already has an upcoming touch or task attached, so the workflow is still moving."
      : "Recent activity is still fresh, but the next touch should be scheduled before the client goes quiet.";

  if (input.hasOverdueTask) {
    pressureLabel = "Overdue follow-up";
    pressureTone = "danger";
    pressureDescription =
      "At least one follow-up task is already past due. Close the loop or reschedule it today so the client does not slip.";
  } else if (input.leaseReminderNeedsAttention && input.leaseReminderAt) {
    pressureLabel = "Lease reminder due";
    pressureTone =
      input.leaseReminderAt.getTime() < input.now.getTime()
        ? "danger"
        : "warning";
    pressureDescription = `Lease-related follow-up is due by ${formatDateLabel(input.leaseReminderAt, input.timeZone)}. Confirm renewal, remarketing, or move timing before this window slips.`;
  } else if (
    isActiveOpportunity &&
    daysSinceLastTouch !== null &&
    daysSinceLastTouch >= 15
  ) {
    pressureLabel = "15+ day pressure";
    pressureTone = "warning";
    pressureDescription = `No contact has been logged for ${daysSinceLastTouch} days while this opportunity is still active. The system should push the next action now.`;
  } else if (hasOverdueNextTouch) {
    pressureLabel = "Next touch overdue";
    pressureTone = "warning";
    pressureDescription = `The scheduled next touch slipped past ${formatDateLabel(input.nextTouchAt, input.timeZone)}. Move it forward or create a new follow-up.`;
  } else if (
    isActiveOpportunity &&
    !input.nextTouchAt &&
    input.openTaskCount === 0
  ) {
    pressureLabel = "No next touch scheduled";
    pressureTone = "warning";
    pressureDescription =
      "This client is active but no future follow-up is on the books yet. Add a reminder before the dossier goes stale.";
  }

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Work from the Back Office record"
          : "Move this client into Back Office",
      nextStepTone:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "success"
          : "warning",
      nextStepDescription:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Formal transaction workflow has already started. Keep execution aligned from the linked Back Office record."
          : "Negotiation, application, or offer work is now formal enough that the shared Back Office workflow should take over.",
      actionLabel:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Open Back Office record"
          : "Open Back Office create flow",
      actionHref:
        input.activeHandoff?.href ??
        input.linkedTransactionHref ??
        "/office/transactions",
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Confirm the showing logistics",
      nextStepTone: "accent",
      nextStepDescription:
        "Use the calendar to confirm the address, access notes, contact, and reminder timing before the appointment happens.",
      actionLabel: "Open calendar",
      actionHref: `/agent/calendar?clientId=${input.clientId}`,
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Capture feedback and set the next follow-up",
      nextStepTone: "accent",
      nextStepDescription:
        "Log the client reaction, narrow the shortlist, and place the next call or message on the calendar now.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  if (normalizedStage.includes("lost")) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Place a nurture reminder",
      nextStepTone: "neutral",
      nextStepDescription:
        "This opportunity is marked lost, but the dossier should still carry a future check-in instead of disappearing.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  if (normalizedStage.includes("won") && input.linkedTransactionHref) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Track progress from the shared transaction record",
      nextStepTone: "success",
      nextStepDescription:
        "The client is already won. Keep milestone updates aligned from the linked Back Office transaction instead of duplicating workflow here.",
      actionLabel: "Open transaction",
      actionHref: input.linkedTransactionHref,
    };
  }

  if (normalizedStage.includes("pending")) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Clarify the blocker and owner",
      nextStepTone: "warning",
      nextStepDescription:
        "Pending stages should still have an explicit owner, due date, and unblock plan so the record does not sit quietly.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  if (input.leaseReminderAt) {
    const leaseReminderSoon =
      input.leaseReminderAt.getTime() <=
      new Date(
        input.now.getFullYear(),
        input.now.getMonth(),
        input.now.getDate() + 14,
      ).getTime();

    if (leaseReminderSoon) {
      return {
        pressureLabel,
        pressureTone,
        pressureDescription,
        nextStepTitle: "Start renewal or remarketing follow-up",
        nextStepTone: input.leaseReminderNeedsAttention ? "warning" : "accent",
        nextStepDescription:
          "Use the lease window to confirm whether this client is renewing, moving, or needs a fresh listing / tour plan before the date passes quietly.",
        actionLabel: "Create follow-up",
        actionHref: "#front-office-follow-up-form",
      };
    }
  }

  return {
    pressureLabel,
    pressureTone,
    pressureDescription,
    nextStepTitle: "Set the next call, text, or showing",
    nextStepTone: "accent",
    nextStepDescription:
      "Front Office should keep the next touch visible by default. Create a follow-up or book the next appointment before leaving this dossier.",
    actionLabel: "Create follow-up",
    actionHref: "#front-office-follow-up-form",
  };
}

export async function getFrontOfficeClientDetail(
  input: GetFrontOfficeClientDetailInput,
): Promise<FrontOfficeClientDetailSnapshot | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );

  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      ownerMembershipId: input.viewerMembershipId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      intent: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      notes: true,
      lastContactAt: true,
      nextFollowUpAt: true,
      leaseEndDate: true,
      leaseReminderAt: true,
      ownerMembership: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      followUpTasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assigneeMembership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      frontOfficeSendRecords: {
        orderBy: [{ sentAt: "desc" }],
        take: 8,
        select: {
          id: true,
          channel: true,
          materialType: true,
          clientStageLabel: true,
          appointmentId: true,
          appointmentTitle: true,
          appointmentStartsAt: true,
          sentAt: true,
          firstOpenedAt: true,
          lastOpenedAt: true,
          openCount: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      appointments: {
        where: {
          startsAt: {
            gte: thirtyDaysAgo,
            lte: thirtyDaysFromNow,
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startsAt: true,
          location: true,
          meetingUrl: true,
          contactLabel: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      stageHistory: {
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          note: true,
          createdAt: true,
          membership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      handoffDrafts: {
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          stageLabel: true,
          summary: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          committedAt: true,
          committedTransactionId: true,
        },
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          role: true,
          transaction: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  const [sendCount, openedSendCount, sendAggregate] = await Promise.all([
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
      },
    }),
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
        openCount: {
          gt: 0,
        },
      },
    }),
    prisma.frontOfficeSendRecord.aggregate({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
      },
      _sum: {
        openCount: true,
      },
      _max: {
        lastOpenedAt: true,
      },
    }),
  ]);

  const openTaskCount = client.followUpTasks.filter(
    (task) => task.status !== TaskStatus.completed,
  ).length;
  const earliestOpenTaskDueAt = client.followUpTasks.reduce<Date | null>(
    (earliest, task) => {
      if (task.status === TaskStatus.completed || !task.dueAt) {
        return earliest;
      }

      return pickEarliestDate(earliest, task.dueAt);
    },
    null,
  );
  const nextTouchAt = pickEarliestDate(
    earliestOpenTaskDueAt,
    client.nextFollowUpAt,
    client.leaseReminderAt,
  );
  const leaseReminder = buildLeaseReminderSnapshot({
    leaseEndDate: client.leaseEndDate,
    leaseReminderAt: client.leaseReminderAt,
    now,
    timeZone: input.timeZone,
  });
  const activeHandoffDraft =
    client.handoffDrafts.find(
      (draft) =>
        draft.status === FrontOfficeHandoffStatus.ready ||
        draft.status === FrontOfficeHandoffStatus.draft,
    ) ??
    client.handoffDrafts.find(
      (draft) => draft.status === FrontOfficeHandoffStatus.committed,
    ) ??
    null;
  const activeHandoff = activeHandoffDraft
    ? {
        status: activeHandoffDraft.status,
        href:
          activeHandoffDraft.status === FrontOfficeHandoffStatus.committed &&
          activeHandoffDraft.committedTransactionId
            ? `/office/transactions/${activeHandoffDraft.committedTransactionId}`
            : buildFrontOfficeHandoffCreateHref(activeHandoffDraft.id),
        committedTransactionId: activeHandoffDraft.committedTransactionId,
      }
    : null;
  const primaryLinkedTransaction =
    (activeHandoffDraft?.committedTransactionId
      ? client.transactionContacts.find(
          (link) =>
            link.transaction.id === activeHandoffDraft.committedTransactionId,
        )
      : null) ??
    client.transactionContacts[0] ??
    null;
  const negotiationTransactionId =
    primaryLinkedTransaction?.transaction.id ??
    activeHandoffDraft?.committedTransactionId ??
    null;
  const linkedTransactionHref = client.transactionContacts[0]
    ? `/office/transactions/${client.transactionContacts[0].transaction.id}`
    : null;
  const activeSignatureStatuses = [
    SignatureRequestStatus.pending_send,
    SignatureRequestStatus.sent,
    SignatureRequestStatus.viewed,
    SignatureRequestStatus.signed,
  ];
  const [
    negotiationOffersSnapshot,
    upcomingAppointmentCount,
    openHandoffCount,
    inspectionTransactionRecord,
    inspectionOpenTaskCount,
    inspectionOverdueTaskCount,
    inspectionPendingSignatureCount,
    inspectionPendingIncomingUpdateCount,
    inspectionTaskRows,
    inspectionSignatureRows,
    inspectionIncomingUpdateRows,
  ] = await Promise.all([
    negotiationTransactionId
      ? listTransactionOffersSnapshot(
          input.organizationId,
          negotiationTransactionId,
        )
      : Promise.resolve(null),
    Promise.resolve(
      client.appointments.filter(
        (appointment) =>
          appointment.status === AppointmentStatus.scheduled &&
          appointment.startsAt.getTime() >= now.getTime(),
      ).length,
    ),
    Promise.resolve(
      client.handoffDrafts.filter(
        (draft) =>
          draft.status === FrontOfficeHandoffStatus.draft ||
          draft.status === FrontOfficeHandoffStatus.ready,
      ).length,
    ),
    negotiationTransactionId
      ? prisma.transaction.findFirst({
          where: {
            id: negotiationTransactionId,
            organizationId: input.organizationId,
          },
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
            status: true,
            acceptanceDate: true,
            closingDate: true,
          },
        })
      : Promise.resolve(null),
    negotiationTransactionId
      ? prisma.transactionTask.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.transactionTask.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
            dueAt: {
              lt: now,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.signatureRequest.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              in: activeSignatureStatuses,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.incomingUpdate.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: IncomingUpdateStatus.pending_review,
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.transactionTask.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 3,
          select: {
            id: true,
            checklistGroup: true,
            title: true,
            status: true,
            dueAt: true,
            assigneeMembership: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    negotiationTransactionId
      ? prisma.signatureRequest.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              in: activeSignatureStatuses,
            },
          },
          orderBy: [{ expiresAt: "asc" }, { updatedAt: "desc" }],
          take: 2,
          select: {
            id: true,
            contextLabel: true,
            recipientName: true,
            recipientEmail: true,
            status: true,
            sentAt: true,
            expiresAt: true,
            form: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    negotiationTransactionId
      ? prisma.incomingUpdate.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: IncomingUpdateStatus.pending_review,
          },
          orderBy: [{ receivedAt: "desc" }],
          take: 2,
          select: {
            id: true,
            summary: true,
            status: true,
            sourceSystem: true,
            sourceReference: true,
            receivedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const ownerLabel =
    `${client.ownerMembership?.user.firstName ?? ""} ${client.ownerMembership?.user.lastName ?? ""}`.trim() ||
    client.ownerMembership?.user.email ||
    "Unassigned";
  const budgetLabel = formatBudgetRange(
    client.budgetMin ? Number(client.budgetMin) : null,
    client.budgetMax ? Number(client.budgetMax) : null,
  );
  const preferredAreasLabel = client.preferredAreas.length
    ? client.preferredAreas.join(", ")
    : "Areas not captured";
  const totalOpenCount = sendAggregate._sum.openCount ?? 0;
  const revisitCount = Math.max(totalOpenCount - openedSendCount, 0);
  const workflow = buildWorkflowSignal({
    clientId: client.id,
    stage: client.stage,
    lastContactAt: client.lastContactAt,
    nextTouchAt,
    leaseReminderAt: client.leaseReminderAt,
    leaseReminderNeedsAttention: leaseReminder.needsAttention,
    hasOverdueTask: client.followUpTasks.some(
      (task) =>
        task.status !== TaskStatus.completed &&
        Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
    ),
    openTaskCount,
    activeHandoff,
    linkedTransactionHref,
    timeZone: input.timeZone,
    now,
  });
  const negotiationOfferCount = negotiationOffersSnapshot?.offers.length ?? 0;
  const negotiationBoundaryLabel = negotiationTransactionId
    ? "BO workspace live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Ready for BO handoff"
      : "Front Office prep";
  const negotiationBoundaryTone: FrontOfficeClientDetailTone =
    negotiationTransactionId
      ? "success"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "warning"
        : "accent";
  const negotiationPrimaryActionLabel = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? "Open BO offers"
      : "Start BO offer tracking"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Open Back Office create flow"
      : workflow.actionLabel;
  const negotiationPrimaryActionHref = negotiationTransactionId
    ? buildOfferWorkspaceHref(negotiationTransactionId)
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? activeHandoff?.href ?? "/office/transactions"
      : workflow.actionHref;
  const negotiationBoundaryTitle = negotiationTransactionId
    ? "Formal offer workspace is now the source of truth"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Negotiation is ready to become a formal record"
      : "Keep offer prep lightweight inside Front Office";
  const negotiationBoundaryDescription = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? `${negotiationOfferCount} offer record(s) already exist in the shared Back Office workspace, so comparison, documents, and signatures stay anchored there.`
      : "The formal transaction record is live. Start structured offer tracking from the shared Back Office offers workspace instead of creating a second Front Office record."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Stage, appointments, send trail, and handoff context are already lined up. The next formal offer record should start in Back Office, not as a duplicate Front Office note."
      : "Use appointment feedback, send context, and follow-up to sharpen pricing, timing, and decision-maker clarity before this becomes a formal Back Office offer workflow.";
  const negotiationBoundaryMetaLabel = negotiationTransactionId
    ? inspectionTransactionRecord
      ? buildTransactionContextMetaLabel({
          title: inspectionTransactionRecord.title,
          address: inspectionTransactionRecord.address,
          city: inspectionTransactionRecord.city,
          state: inspectionTransactionRecord.state,
          acceptanceDate: inspectionTransactionRecord.acceptanceDate,
          closingDate: inspectionTransactionRecord.closingDate,
          timeZone: input.timeZone,
        })
      : "Linked transaction ready"
    : activeHandoffDraft
      ? activeHandoffDraft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(
          activeHandoffDraft.stageLabel,
          client.fullName,
        )
      : `Current stage · ${client.stage}`;
  const negotiationEmptyStateTitle = negotiationTransactionId
    ? "No formal offers yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "No BO offer workspace started yet"
      : "Still in Front Office prep";
  const negotiationEmptyStateDescription = negotiationTransactionId
    ? "Once the first Back Office offer is created, it will appear here with status, price, expiration, and direct links into the shared offer workspace."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is at a BO-ready stage, but the formal transaction and offer workspace have not been opened yet."
      : "This client is not yet at a formal negotiation / offer stage, so the next move should stay in Front Office follow-up, showing, and send prep.";
  const inspectionBoundaryLabel = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Inspection-era live"
      : "Contract file live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Ready for contract file"
      : "Front Office prep";
  const inspectionBoundaryTone: FrontOfficeClientDetailTone =
    negotiationTransactionId
      ? inspectionTransactionRecord?.acceptanceDate
        ? "success"
        : "accent"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "warning"
        : "neutral";
  const inspectionBoundaryTitle = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Inspection-era execution now lives in the shared BO workspace"
      : "Formal contract file is live, but acceptance is not locked yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The next formal contract step should start in Back Office"
      : "Inspection support starts after the formal file exists";
  const inspectionBoundaryDescription = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Use the shared Back Office transaction to drive checklist work, signatures, incoming update review, and client-facing milestone clarity through the inspection window."
      : "The transaction record exists, but Acre does not have an accepted-contract date yet. Finish the offer-to-contract transition in Back Office before treating this as a live inspection file."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Negotiation is advanced enough that the next formal contract / inspection step should begin from the shared Back Office record, not as a second Front Office checklist."
      : "Keep the client in Front Office follow-up, showing, and negotiation prep until the formal contract file is opened.";
  const inspectionBoundaryMetaLabel = negotiationTransactionId
    ? inspectionTransactionRecord
      ? buildTransactionContextMetaLabel({
          title: inspectionTransactionRecord.title,
          address: inspectionTransactionRecord.address,
          city: inspectionTransactionRecord.city,
          state: inspectionTransactionRecord.state,
          acceptanceDate: inspectionTransactionRecord.acceptanceDate,
          closingDate: inspectionTransactionRecord.closingDate,
          timeZone: input.timeZone,
        })
      : "Back Office transaction ready"
    : activeHandoffDraft
      ? activeHandoffDraft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(
          activeHandoffDraft.stageLabel,
          client.fullName,
        )
      : `Current stage · ${client.stage}`;
  const inspectionPrimaryActionLabel = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? "Open BO tasks"
      : inspectionPendingSignatureCount > 0
        ? "Open signatures"
        : inspectionPendingIncomingUpdateCount > 0
          ? "Review incoming updates"
          : "Open transaction"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Open Back Office create flow"
      : workflow.actionLabel;
  const inspectionPrimaryActionHref = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? buildTransactionWorkspaceHref(
          negotiationTransactionId,
          "transaction-tasks",
        )
      : inspectionPendingSignatureCount > 0
        ? buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-forms-signatures",
          )
        : inspectionPendingIncomingUpdateCount > 0
          ? buildTransactionWorkspaceHref(
              negotiationTransactionId,
              "transaction-incoming-updates",
            )
          : buildTransactionWorkspaceHref(negotiationTransactionId)
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? activeHandoff?.href ?? "/office/transactions"
      : workflow.actionHref;
  const inspectionEmptyStateTitle = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "No inspection pressure right now"
      : "Contract file is live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Formal contract support has not started yet"
      : "Still in Front Office prep";
  const inspectionEmptyStateDescription = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Open tasks, pending signatures, and incoming review items will show up here when the shared transaction workspace needs action."
      : "Open the formal transaction record to finish acceptance / contract setup. Inspection-era checklist support will become meaningful once the BO file is carrying the live milestones."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is BO-ready, but the formal contract workspace has not been opened yet."
      : "Inspection support is intentionally deferred until the client reaches formal contract work.";
  const inspectionItems = negotiationTransactionId
    ? [
        ...inspectionTaskRows.map((task) => ({
          id: `task-${task.id}`,
          title: task.title,
          statusLabel: formatTransactionTaskStatusLabel(task.status),
          statusTone: mapTransactionTaskTone(task.status, task.dueAt, now),
          contextLabel: task.checklistGroup?.trim() || "BO checklist",
          description: [
            formatTaskDueLabel(task.dueAt, now, input.timeZone),
            task.assigneeMembership
              ? `Assignee · ${
                  `${task.assigneeMembership.user.firstName ?? ""} ${task.assigneeMembership.user.lastName ?? ""}`.trim() ||
                  task.assigneeMembership.user.email ||
                  "Unassigned"
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          metaLabel:
            task.dueAt && task.dueAt.getTime() < now.getTime()
              ? "Needs attention now"
              : "Open Back Office checklist item",
          actionLabel: "Open BO tasks",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-tasks",
          ),
        })),
        ...inspectionSignatureRows.map((request) => ({
          id: `signature-${request.id}`,
          title:
            request.contextLabel?.trim() ||
            request.form?.name?.trim() ||
            `Signature request for ${request.recipientName || request.recipientEmail}`,
          statusLabel: formatSignatureRequestStatusLabel(request.status),
          statusTone: mapSignatureRequestTone(request.status),
          contextLabel:
            request.recipientName?.trim() || request.recipientEmail.trim(),
          description: [
            request.sentAt
              ? `Sent ${formatDateLabel(request.sentAt, input.timeZone)}`
              : request.status === SignatureRequestStatus.pending_send
                ? "Ready to send"
                : "",
            request.expiresAt
              ? `Expires ${formatDateLabel(request.expiresAt, input.timeZone)}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          metaLabel: request.form?.name?.trim() || "Shared BO signature flow",
          actionLabel: "Open signatures",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-forms-signatures",
          ),
        })),
        ...inspectionIncomingUpdateRows.map((update) => ({
          id: `incoming-update-${update.id}`,
          title: update.summary,
          statusLabel: formatIncomingUpdateStatusLabel(update.status),
          statusTone: mapIncomingUpdateTone(update.status),
          contextLabel: `${update.sourceSystem} · ${update.sourceReference}`,
          description: `Received ${formatDateLabel(
            update.receivedAt,
            input.timeZone,
          )}`,
          metaLabel: "Awaiting Back Office review",
          actionLabel: "Review update",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-incoming-updates",
          ),
        })),
      ]
    : [];

  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email?.trim() || "",
    phone: client.phone?.trim() || "",
    stage: client.stage,
    stageTone: mapClientStageTone(client.stage),
    sourceLabel: client.source?.trim() || "Source not captured",
    intentLabel: client.intent?.trim() || "Intent not captured",
    budgetLabel,
    preferredAreasLabel,
    notesLabel: client.notes?.trim() || "No internal notes yet",
    ownerLabel,
    lastTouchLabel: client.lastContactAt
      ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
      : "No contact logged yet",
    nextTouchLabel: formatRelativeDueLabel(nextTouchAt, now, input.timeZone),
    summary: {
      openTaskCount,
      upcomingAppointmentCount,
      stageHistoryCount: client.stageHistory.length,
      openHandoffCount,
    },
    leaseReminder,
    engagement: {
      sendCount,
      openedSendCount,
      revisitCount,
      lastEngagementLabel: sendAggregate._max.lastOpenedAt
        ? `Last opened · ${formatDateTimeLabel(sendAggregate._max.lastOpenedAt, {
            timeZone: input.timeZone ?? null,
          })}`
        : "No client engagement yet",
    },
    negotiation: {
      stageLabel: client.stage,
      stageTone: mapClientStageTone(client.stage),
      boundaryLabel: negotiationBoundaryLabel,
      boundaryTone: negotiationBoundaryTone,
      boundaryTitle: negotiationBoundaryTitle,
      boundaryDescription: negotiationBoundaryDescription,
      boundaryMetaLabel: negotiationBoundaryMetaLabel,
      offerCount: negotiationOfferCount,
      expiringSoonCount: negotiationOffersSnapshot?.expiringSoonCount ?? 0,
      acceptedOfferLabel:
        negotiationOffersSnapshot?.acceptedOfferLabel || "No accepted offer",
      primaryActionLabel: negotiationPrimaryActionLabel,
      primaryActionHref: negotiationPrimaryActionHref,
      emptyStateTitle: negotiationEmptyStateTitle,
      emptyStateDescription: negotiationEmptyStateDescription,
      offers:
        negotiationTransactionId && negotiationOffersSnapshot
          ? negotiationOffersSnapshot.offers.slice(0, 4).map((offer) => ({
              id: offer.id,
              title: offer.title,
              statusLabel: offer.status,
              statusTone: mapOfferStatusTone(offer.statusValue),
              partyLabel:
                offer.buyerName.trim() || offer.offeringPartyName.trim(),
              priceLabel: offer.price || "Price not captured",
              expirationLabel: offer.expirationAt
                ? `Expires ${formatDateLabel(
                    new Date(offer.expirationAt),
                    input.timeZone,
                  )}`
                : "No expiration set",
              updatedAtLabel: `Updated ${formatDateTimeLabel(
                new Date(offer.updatedAt),
                { timeZone: input.timeZone ?? null },
              )}`,
              href: buildOfferWorkspaceHref(
                negotiationTransactionId,
                offer.id,
              ),
            }))
          : [],
    },
    inspection: {
      boundaryLabel: inspectionBoundaryLabel,
      boundaryTone: inspectionBoundaryTone,
      boundaryTitle: inspectionBoundaryTitle,
      boundaryDescription: inspectionBoundaryDescription,
      boundaryMetaLabel: inspectionBoundaryMetaLabel,
      openTaskCount: inspectionOpenTaskCount,
      overdueTaskCount: inspectionOverdueTaskCount,
      pendingSignatureCount: inspectionPendingSignatureCount,
      pendingIncomingUpdateCount: inspectionPendingIncomingUpdateCount,
      primaryActionLabel: inspectionPrimaryActionLabel,
      primaryActionHref: inspectionPrimaryActionHref,
      emptyStateTitle: inspectionEmptyStateTitle,
      emptyStateDescription: inspectionEmptyStateDescription,
      items: inspectionItems,
    },
    workflow,
    playbook: buildFrontOfficePlaybook({
      fullName: client.fullName,
      ownerLabel,
      stage: client.stage,
      intentLabel: client.intent?.trim() || "Intent not captured",
      budgetLabel,
      preferredAreasLabel,
      upcomingAppointmentCount,
    }),
    stageHistory: client.stageHistory.map((entry) => {
      const actorLabel =
        `${entry.membership?.user.firstName ?? ""} ${entry.membership?.user.lastName ?? ""}`.trim() ||
        entry.membership?.user.email ||
        "Front Office";
      const transitionLabel = entry.fromStage?.trim()
        ? `${entry.fromStage} → ${entry.toStage}`
        : `Entered ${entry.toStage}`;

      return {
        id: entry.id,
        title: transitionLabel,
        description: [entry.note?.trim() || "", `Updated by ${actorLabel}`]
          .filter(Boolean)
          .join(" · "),
        changedAtLabel: formatDateTimeLabel(entry.createdAt, {
          timeZone: input.timeZone ?? null,
        }),
        tone: mapClientStageTone(entry.toStage),
      };
    }),
    appointments: client.appointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      typeLabel: formatAppointmentTypeLabel(appointment.type),
      typeTone: mapAppointmentTypeTone(appointment.type),
      statusLabel: formatAppointmentStatusLabel(appointment.status),
      statusTone: mapAppointmentStatusTone(appointment.status),
      startsAtLabel: formatDateTimeLabel(appointment.startsAt, {
        timeZone: input.timeZone ?? null,
      }),
      locationLabel:
        appointment.location?.trim() ||
        appointment.meetingUrl?.trim() ||
        "Location pending",
      contextLabel: appointment.listing
        ? `${appointment.listing.title} · ${appointment.listing.neighborhood}, ${appointment.listing.city}`
        : appointment.contactLabel?.trim() || "Front Office appointment",
      listingOutputHref: `/agent/listings?clientId=${client.id}&appointmentId=${appointment.id}`,
    })),
    followUpTasks: client.followUpTasks.map((task) => ({
      id: task.id,
      title: task.title,
      statusValue: task.status,
      dueLabel: formatTaskDueLabel(task.dueAt, now, input.timeZone),
      dueAtValue: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
      statusLabel: formatTaskStatusLabel(task.status),
      tone: mapTaskTone(task.status, task.dueAt, now),
      assigneeLabel:
        `${task.assigneeMembership?.user.firstName ?? ""} ${task.assigneeMembership?.user.lastName ?? ""}`.trim() ||
        task.assigneeMembership?.user.email ||
        "Unassigned",
    })),
    sendRecords: client.frontOfficeSendRecords.map((record) => ({
      id: record.id,
      title:
        record.listing?.title?.trim() ||
        (record.materialType === "listing_share"
          ? "Listing share"
          : "Front Office material"),
      channelLabel: formatFrontOfficeSendChannelLabel(record.channel),
      stageLabel: formatSendRecordStageLabel(record.clientStageLabel),
      appointmentLabel: buildSendRecordAppointmentLabel({
        title: record.appointmentTitle,
        startsAt: record.appointmentStartsAt,
        timeZone: input.timeZone,
      }),
      sentAtLabel: formatDateTimeLabel(record.sentAt, {
        timeZone: input.timeZone ?? null,
      }),
      engagementLabel: buildFrontOfficeSendEngagementLabel(record.openCount),
      engagementTone: mapFrontOfficeSendEngagementTone(record.openCount),
      lastActivityLabel:
        record.lastOpenedAt && record.openCount > 0
          ? `Last opened · ${formatDateTimeLabel(record.lastOpenedAt, {
              timeZone: input.timeZone ?? null,
            })}`
          : "No open recorded yet",
      href: record.appointmentId
        ? `/agent/listings?clientId=${client.id}&appointmentId=${record.appointmentId}`
        : `/agent/listings?clientId=${client.id}`,
    })),
    handoffs: client.handoffDrafts.map((draft) => ({
      id: draft.id,
      stageLabel: draft.stageLabel,
      statusLabel: formatHandoffStatusLabel(draft.status),
      tone: mapHandoffTone(draft.status),
      summary:
        draft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(draft.stageLabel, client.fullName),
      updatedAtLabel: formatDateTimeLabel(
        draft.committedAt ?? draft.updatedAt ?? draft.createdAt,
        { timeZone: input.timeZone ?? null },
      ),
      href:
        draft.status === FrontOfficeHandoffStatus.committed &&
        draft.committedTransactionId
          ? `/office/transactions/${draft.committedTransactionId}`
          : buildFrontOfficeHandoffCreateHref(draft.id),
    })),
    linkedTransactions: client.transactionContacts.map((link) => ({
      id: link.transaction.id,
      label: `${link.transaction.title} · ${link.transaction.address}, ${link.transaction.city}, ${link.transaction.state}`,
      statusLabel: formatTransactionStatusLabel(link.transaction.status),
      roleLabel: link.role
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("-"),
      href: `/office/transactions/${link.transaction.id}`,
    })),
  };
}
