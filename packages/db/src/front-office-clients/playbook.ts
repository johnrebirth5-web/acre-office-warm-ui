import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  FrontOfficeSendChannel,
  FrontOfficeSendMaterialType,
  IncomingUpdateStatus,
  SignatureRequestStatus,
  TaskStatus,
  TransactionStatus,
  TransactionTaskStatus,
} from "@prisma/client";

import { prisma } from "../client";

import {
  buildFrontOfficeHandoffCreateHref,
  buildFrontOfficeHandoffSummary,
  isFrontOfficeStageReadyForBackOffice,
} from "../front-office-contracts";

import {
  buildFrontOfficeAiAcceptedActionBreakdown,
  buildFrontOfficeAiAcceptedActionBreakdownWindows,
  buildFrontOfficeAiBoundaryContract,
  buildFrontOfficeAiFollowUpAction,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiStrategyContract,
  buildFrontOfficeAiSuggestionInsight,
  formatFrontOfficeAiActionTypeLabel,
  formatFrontOfficeAiSourceSurfaceLabel,
  mapFrontOfficeAiAcceptedActionOutcome,
  type FrontOfficeAiFollowUpKind,
  type FrontOfficeAiStrategyContract,
  type FrontOfficeAiSuggestionHistoryIndex,
} from "../front-office-ai";

import { formatDateTimeLabel } from "../date-time";

import { buildFrontOfficeAppointmentExternalLinks } from "../front-office-calendar-links";

import {
  getFrontOfficeAppointmentBridgeStatusMap,
  getFrontOfficeAppointmentExternalWorkflowState,
  frontOfficeAppointmentExternalWorkflowStatuses,
  type FrontOfficeAppointmentBridgeStatus,
  type FrontOfficeAppointmentExternalWorkflowStatus,
} from "../front-office-appointments";

import {
  defaultLeaseReminderLeadDays,
  resolveLeaseReminderDates,
} from "../lease-reminders";

import { listTransactionOffersSnapshot } from "../offers";

import { FrontOfficeClientDetailAction, FrontOfficeClientDetailActionKind, FrontOfficeClientDetailActionTarget, FrontOfficeClientDetailAiAcceptedActionItem, FrontOfficeClientDetailAiAcceptedActions, FrontOfficeClientDetailAiDraft, FrontOfficeClientDetailAiDraftChannel, FrontOfficeClientDetailAiFollowUpSuggestion, FrontOfficeClientDetailAiStrategy, FrontOfficeClientDetailAiSuggestions, FrontOfficeClientDetailAppointmentItem, FrontOfficeClientDetailBackOfficeHandoff, FrontOfficeClientDetailBoundaryState, FrontOfficeClientDetailBridgeActivityState, FrontOfficeClientDetailClosing, FrontOfficeClientDetailClosingItem, FrontOfficeClientDetailContract, FrontOfficeClientDetailDecisionKey, FrontOfficeClientDetailFollowUpCue, FrontOfficeClientDetailFollowUpCueKey, FrontOfficeClientDetailHandoffItem, FrontOfficeClientDetailHandoffState, FrontOfficeClientDetailInspection, FrontOfficeClientDetailInspectionItem, FrontOfficeClientDetailLeaseReminder, FrontOfficeClientDetailNegotiation, FrontOfficeClientDetailNegotiationOfferItem, FrontOfficeClientDetailNextStepId, FrontOfficeClientDetailNextStepRail, FrontOfficeClientDetailNextStepRailItem, FrontOfficeClientDetailOutputHandoff, FrontOfficeClientDetailOwnershipKey, FrontOfficeClientDetailPlaybook, FrontOfficeClientDetailPlaybookItem, FrontOfficeClientDetailPlaybookObjection, FrontOfficeClientDetailPlaybookTemplate, FrontOfficeClientDetailSendEngagementKey, FrontOfficeClientDetailSendRecordItem, FrontOfficeClientDetailSnapshot, FrontOfficeClientDetailStageHistoryItem, FrontOfficeClientDetailTaskItem, FrontOfficeClientDetailTone, FrontOfficeClientDetailTransactionItem, FrontOfficeClientDetailWorkbenchReturn, FrontOfficeClientDetailWorkflowNextStepKey, FrontOfficeClientDetailWorkflowPressureKey, FrontOfficeClientDetailWorkflowSignal, GetFrontOfficeClientDetailInput, frontOfficeClientDetailActionKinds, frontOfficeClientDetailActionTargets, frontOfficeClientDetailBoundaryStates, frontOfficeClientDetailBridgeActivityStates, frontOfficeClientDetailDecisionKeys, frontOfficeClientDetailFollowUpCueKeys, frontOfficeClientDetailHandoffStates, frontOfficeClientDetailNextStepIds, frontOfficeClientDetailOwnershipKeys, frontOfficeClientDetailSendEngagementKeys, frontOfficeClientDetailWorkflowNextStepKeys, frontOfficeClientDetailWorkflowPressureKeys } from "./types";
import { FRONT_OFFICE_FOLLOW_UP_FORM_ID, FRONT_OFFICE_FOLLOW_UP_QUEUE_ID, FrontOfficeCalendarView, FrontOfficeListingsLane, buildClientAction, buildClientRouteHref, buildFrontOfficeCalendarHref, buildFrontOfficeListingsHref, buildFrontOfficeSendEngagementLabel, buildLeaseReminderSnapshot, buildPlaybookItem, buildPlaybookObjection, buildPlaybookTemplate, buildSendRecordAppointmentLabel, buildTaskHelperLabel, buildTaskQueueLabel, buildTaskTimelineContext, buildTaskTimelineDescription, buildTaskTimelineTitle, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatBudgetRange, formatCalendarDistanceLabel, formatCurrency, formatDateLabel, formatDateTimeValue, formatDateValue, formatFrontOfficeSendChannelLabel, formatRelativeDueLabel, formatSendRecordStageLabel, formatTaskDueLabel, formatTaskStatusLabel, frontOfficeCalendarViews, frontOfficeListingsLanes, getCalendarDayDifference, getClientFirstName, hasMeaningfulAreasLabel, hasMeaningfulBudgetLabel, hasMeaningfulIntentLabel, mapAppointmentStatusTone, mapAppointmentTypeTone, mapBridgeActivityState, mapClientStageTone, mapFrontOfficeSendEngagementTone, mapSendEngagementKey, mapTaskTone, pickEarliestDate, resolveFrontOfficeCalendarView, resolveFrontOfficeListingsLane, resolveNextStepRailCalendarView } from "./workflow";
import { buildClientPdfHref, buildDossierContract, buildFollowUpCue, buildFrontOfficeClientDetailWorkbenchReturn, buildFrontOfficeFollowUpAction, buildNextStepRail, buildOfferWorkspaceHref, buildTransactionContextMetaLabel, buildTransactionLocationLabel, buildTransactionWorkspaceHref, buildWorkflowSignal, formatHandoffStatusLabel, formatIncomingUpdateStatusLabel, formatSignatureRequestStatusLabel, formatTransactionStatusLabel, formatTransactionTaskStatusLabel, getDayDifferenceFromToday, getFrontOfficeClientDetailWorkbenchDescription, getFrontOfficeClientDetailWorkbenchHref, getFrontOfficeClientDetailWorkbenchLabel, mapHandoffTone, mapIncomingUpdateTone, mapOfferStatusTone, mapSignatureRequestTone, mapTransactionTaskTone } from "./dossier";
import { getFrontOfficeClientDetail } from "./detail";

export function buildFrontOfficePlaybook(input: {
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
          "Ask who needs to review or sign, and when each decision-maker will be available so the Back Office handoff is not blocked by missing approvals.",
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
          "Back Office handoff brief",
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
          "Break the process into the next two concrete actions only, tell them which documents matter first, and explain that the Back Office file will keep the formal checklist organized once this handoff is opened.",
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
        "Memory is freshest right after the visit. Use this call to separate polite reactions from real intent and decide whether the next move is a second showing, shortlist, or Back Office-ready handoff.",
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
          "Agree on when they will decide between this listing and the backups so the client page does not drift after the tour.",
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
          "Respect that clearly, then ask for the best future moment to check back so the client record has a real nurture date instead of a vague open loop.",
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
          "Tell the client exactly what is happening next, whether that is paperwork, inspection, approval, deposit, or another Back Office milestone.",
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
          "Translate the formal Back Office step into a client-friendly explanation and confirm they understand what is expected from them.",
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
        "Pending should still feel active. Use the call to name the blocker, the owner, and the next date instead of letting the client record sit quietly.",
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
          "Confirm who owns the next move: the client, a decision-maker, the agent, or the Back Office workflow.",
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
          "Acknowledge that, then ask what date would make it urgent again so the client record gets a concrete next-touch instead of a vague pause.",
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



export function buildFrontOfficeAiSuggestions(input: {
  clientId: string;
  fullName: string;
  now: Date;
  stage: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
  openTaskCount?: number;
  sendCount: number;
  openedSendCount: number;
  revisitCount: number;
  nextTouchLabel: string;
  leaseReminder: FrontOfficeClientDetailLeaseReminder;
  workflow: FrontOfficeClientDetailWorkflowSignal;
  playbook: FrontOfficeClientDetailPlaybook;
  latestAppointment: {
    title: string;
    startsAt: Date;
    type: AppointmentType;
  } | null;
  latestSendRecord: {
    listingTitle: string;
    sentAt: Date;
    openCount: number;
    lastOpenedAt: Date | null;
  } | null;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  hasLinkedTransaction: boolean;
  isClosingSoon: boolean;
  isReadyForBackOffice: boolean;
  closingKeyDateLabel: string;
  closingBoundaryLabel: string;
  closingPrimaryActionLabel: string;
  closingPrimaryActionHref: string;
  closingPrimaryActionOpensInNewTab: boolean;
  historyIndex: FrontOfficeAiSuggestionHistoryIndex;
  timeZone?: string | null;
}): FrontOfficeClientDetailAiSuggestions {
  const firstName = getClientFirstName(input.fullName);
  const areaContext = hasMeaningfulAreasLabel(input.preferredAreasLabel)
    ? input.preferredAreasLabel
    : "the right neighborhoods";
  const budgetContext = hasMeaningfulBudgetLabel(input.budgetLabel)
    ? input.budgetLabel
    : "the right budget";
  const intentContext = hasMeaningfulIntentLabel(input.intentLabel)
    ? input.intentLabel
    : "this move";
  const appointmentLabel = input.latestAppointment
    ? `${input.latestAppointment.title} · ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        {
          timeZone: input.timeZone ?? null,
        },
      )}`
    : "";
  const latestListingLabel =
    input.latestSendRecord?.listingTitle.trim() || "the last shortlist";
  const leaseReminderAt = input.leaseReminder.reminderAtValue
    ? new Date(input.leaseReminder.reminderAtValue)
    : null;
  const strategyContract = buildFrontOfficeAiStrategyContract({
    clientId: input.clientId,
    clientName: input.fullName,
    now: input.now,
    timeZone: input.timeZone,
    stage: input.stage,
    nextFollowUpAt: input.nextFollowUpAt ?? null,
    lastContactAt: input.lastContactAt ?? null,
    leaseReminderAt:
      leaseReminderAt && !Number.isNaN(leaseReminderAt.getTime())
        ? leaseReminderAt
        : null,
    leaseReminderNeedsAttention: input.leaseReminder.needsAttention,
    openTaskCount: input.openTaskCount ?? 0,
    sendCount: input.sendCount,
    openedSendCount: input.openedSendCount,
    latestSendRecordSentAt: input.latestSendRecord?.sentAt ?? null,
    latestSendRecordLastOpenedAt: input.latestSendRecord?.lastOpenedAt ?? null,
    hasClosedTransaction: input.hasClosedTransaction,
    hasCancelledTransaction: input.hasCancelledTransaction,
    hasLinkedTransaction: input.hasLinkedTransaction,
    isReadyForBackOffice: input.isReadyForBackOffice,
    isClosingSoon: input.isClosingSoon,
    closingKeyDateLabel: input.closingKeyDateLabel,
  });
  const candidateKinds: FrontOfficeAiFollowUpKind[] =
    input.hasCancelledTransaction
      ? ["reentry"]
      : input.hasClosedTransaction
        ? ["postclose"]
        : [
            ...(input.isClosingSoon ? (["closing"] as const) : []),
            ...(input.leaseReminder.needsAttention ? (["lease"] as const) : []),
            ...(input.latestAppointment ? (["appointment"] as const) : []),
            ...(input.latestSendRecord && input.latestSendRecord.openCount <= 0
              ? (["content_rescue"] as const)
              : []),
            ...(input.latestSendRecord && input.latestSendRecord.openCount > 0
              ? (["warm_engagement"] as const)
              : []),
            ...(input.isReadyForBackOffice && !input.hasLinkedTransaction
              ? (["handoff"] as const)
              : []),
          ];
  const rankedCandidateKinds = (
    candidateKinds.length ? candidateKinds : (["generic"] as const)
  )
    .map((kind) => {
      const basePriority = {
        reentry: 0,
        postclose: 1,
        closing: 2,
        lease: 4,
        appointment: 5,
        content_rescue: 6,
        warm_engagement: 7,
        handoff: 8,
        generic: 9,
      } satisfies Record<FrontOfficeAiFollowUpKind, number>;
      const insight = buildFrontOfficeAiSuggestionInsight({
        historyIndex: input.historyIndex,
        clientId: input.clientId,
        suggestionKind: kind,
      });

      return {
        kind,
        insight,
        priority: basePriority[kind] + insight.priorityAdjustment,
      };
    })
    .sort((left, right) => left.priority - right.priority);
  const selectedSuggestionKind =
    rankedCandidateKinds[0]?.kind ?? ("generic" as const);
  const selectedInsight = rankedCandidateKinds[0]?.insight ?? {
    priorityAdjustment: 0,
    historySignals: [],
    suppressDirectFollowUpCreation: false,
    primaryActionReasonOverride: null,
    oneClickReasonOverride: null,
  };

  const workflowGroundingSignals = [
    `Stage · ${input.stage}`,
    `Workflow pressure · ${input.workflow.pressureLabel}`,
    `Current touch window · ${input.nextTouchLabel}`,
    strategyContract.summaryLabel,
  ];
  let groundingSignals = [
    ...workflowGroundingSignals,
    input.leaseReminder.statusLabel !== "No lease reminder"
      ? `Lease reminder · ${input.leaseReminder.statusLabel}`
      : "",
    appointmentLabel ? `Appointment · ${appointmentLabel}` : "",
    input.sendCount > 0
      ? `Tracked engagement · ${input.openedSendCount}/${input.sendCount} send(s) opened`
      : "",
    input.hasLinkedTransaction &&
    input.closingKeyDateLabel !== "No milestone date captured"
      ? `Deal milestone · ${input.closingKeyDateLabel}`
      : "",
  ].filter(Boolean);

  const drafts: FrontOfficeClientDetailAiDraft[] = [];
  const pushDraft = (draft: FrontOfficeClientDetailAiDraft) => {
    drafts.push(draft);
  };

  let statusLabel = "Next touch ready";
  let statusTone: FrontOfficeClientDetailTone = "accent";
  let statusTitle = "Best next touch from the live client page";
  let summary =
    "Acre can already ground the next touch in the live client page instead of leaving the agent to guess the right opener.";
  let helperText =
    "These drafts are grounded in the appointment, send, follow-up, handoff, and transaction signals already on this record. Nothing auto-sends; edit before using. The shared rule layer adds review-first follow-up, lease, silent-period, and holiday signals before anything is turned into a task.";
  let suggestionKind: FrontOfficeAiFollowUpKind = "generic";
  let followUpSuggestion: FrontOfficeClientDetailAiFollowUpSuggestion | null =
    buildFrontOfficeAiFollowUpAction({
      kind: "generic",
      now: input.now,
      clientFullName: input.fullName,
    });
  let allowsDirectFollowUpCreation = true;
  let directFollowUpState:
    | "available"
    | "suppressed_by_history"
    | "suppressed_by_boundary" = "available";
  let primaryActionLabel = input.workflow.actionLabel;
  let primaryActionHref = input.workflow.actionHref;
  let primaryActionOpensInNewTab = false;

  if (selectedSuggestionKind === "reentry") {
    suggestionKind = "reentry";
    statusLabel = "Re-entry";
    statusTone = "warning";
    statusTitle = "Use a respectful reopen touch, not a hard restart";
    summary =
      "The formal deal did not close, so the best next-touch should stay low-pressure and leave the door open for timing to restart.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "reentry",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Create follow-up";
    primaryActionHref = "#front-office-follow-up-form";

    pushDraft({
      id: "reentry-call",
      title: "Soft re-entry opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "warning",
      reasonLabel: "Grounded by cancelled / lost formal outcome",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in without any pressure. If your timing opens back up or you want to revisit options, I can pick things up quickly from where we left off. What would make it useful for us to reconnect?`,
    });
    pushDraft({
      id: "reentry-email",
      title: "Respectful re-entry email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "neutral",
      reasonLabel: "Keeps the relationship warm without forcing urgency",
      subjectLine: "Checking in whenever the timing reopens",
      body: `Hi ${firstName},\n\nI wanted to check in without any pressure. If your timing opens back up or you want to revisit options, I can restart quickly from where we left off instead of rebuilding the search from scratch.\n\nIf it helps, I can also tighten a smaller shortlist around ${areaContext} so the next step feels simpler.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "postclose") {
    suggestionKind = "postclose";
    statusLabel = "Post-close";
    statusTone = "success";
    statusTitle = "Keep the win warm with a human follow-up";
    summary =
      "The deal is already closed, so the next-touch should sound supportive, recap-oriented, and referral-aware rather than salesy.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "postclose",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;

    pushDraft({
      id: "postclose-text",
      title: "Post-close check-in text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "success",
      reasonLabel:
        input.closingKeyDateLabel !== "No milestone date captured"
          ? input.closingKeyDateLabel
          : "Grounded by closed formal transaction",
      subjectLine: "",
      body: `Hi ${firstName}, congratulations again on the close. I wanted to check that everything feels settled and see if you need anything as move-in continues. Once you are fully settled, I would also be glad to help anyone you send my way.`,
    });
    pushDraft({
      id: "postclose-email",
      title: "Support-first follow-up email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel: "Built for recap, support, and referral timing",
      subjectLine: "Checking in after the close",
      body: `Hi ${firstName},\n\nCongratulations again on the close. I wanted to check that everything feels settled and make sure there is nothing you need as move-in continues.\n\nIf it helps, I can also send a clean recap packet from the current client page so you have the key details in one place. And once you are fully settled, I would love to help anyone you send my way.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "closing") {
    suggestionKind = "closing";
    statusLabel = "Closing support";
    statusTone = "warning";
    statusTitle = "Use the next touch to steady the closing window";
    summary =
      "A near-term closing or move-in date is already on the shared file, so the next-touch should reduce wrap-up confusion before the date slips by.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "closing",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;

    pushDraft({
      id: "closing-text",
      title: "Closing-week text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "warning",
      reasonLabel:
        input.closingKeyDateLabel !== "No milestone date captured"
          ? input.closingKeyDateLabel
          : "Near-term closing support",
      subjectLine: "",
      body: `Hi ${firstName}, as we get closer to ${input.closingKeyDateLabel.toLowerCase()}, I want to make sure the wrap-up stays smooth. If anything changed around timing, logistics, or the final checklist, send it over and I will help keep the next steps clear.`,
    });
    pushDraft({
      id: "closing-email",
      title: "Closing recap email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel: "Good fit when you want one clean written recap",
      subjectLine: "Quick check-in before the close",
      body: `Hi ${firstName},\n\nAs we get closer to ${input.closingKeyDateLabel.toLowerCase()}, I want to make sure the wrap-up stays smooth and that nothing important is left fuzzy.\n\nIf it helps, I can send one clean recap and keep the first post-close follow-up visible now so there is no gap once the deal lands.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "lease") {
    suggestionKind = "lease";
    statusLabel = "Lease timing";
    statusTone = input.leaseReminder.statusTone;
    statusTitle = "Use the next touch to clarify renewal or move timing";
    summary =
      "The lease reminder is already due or near due, so the next-touch should lock whether this is a renewal, remarketing, or move-planning conversation.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "lease",
      now:
        input.leaseReminder.statusLabel === "Reminder due soon"
          ? new Date(input.now.getTime() + 2 * 24 * 60 * 60 * 1000)
          : input.now,
      clientFullName: input.fullName,
    });

    pushDraft({
      id: "lease-call",
      title: "Lease-timing opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.leaseReminder.statusTone,
      reasonLabel: input.leaseReminder.statusLabel,
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on your lease timing so we can stay ahead of the decision. Are you leaning more toward renewing, moving, or starting a fresh search?`,
    });
    pushDraft({
      id: "lease-text",
      title: "Lease follow-up text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: input.leaseReminder.helperText,
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on your lease timing so we can stay ahead of the next step. If you are leaning toward renewal, moving, or starting a new search, I can map the options now rather than waiting until it gets tight.`,
    });
  } else if (
    selectedSuggestionKind === "appointment" &&
    input.latestAppointment
  ) {
    suggestionKind = "appointment";
    statusLabel = "Appointment prep";
    statusTone = "accent";
    statusTitle = "Use the touch to tighten expectations before the meeting";
    summary =
      "There is already a scheduled appointment on the calendar, so the next-touch should sharpen logistics and expectations instead of reopening discovery from zero.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "appointment",
      now: input.now,
      clientFullName: input.fullName,
      appointmentTitle: input.latestAppointment.title,
    });
    primaryActionLabel = "Open calendar";
    primaryActionHref = buildFrontOfficeCalendarHref({
      clientId: input.clientId,
      calendarView: frontOfficeCalendarViews.confirmationPending,
    });

    pushDraft({
      id: "appointment-text",
      title: "Pre-appointment text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: appointmentLabel || "Upcoming appointment in Front Office",
      subjectLine: "",
      body: `Hi ${firstName}, looking forward to our ${input.latestAppointment.title} on ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        { timeZone: input.timeZone ?? null },
      )}. I will have the key details and best-fit options ready so we can use the time well. If anything changed on budget, area, or timing, send it over and I will adjust before we meet.`,
    });
    pushDraft({
      id: "appointment-email",
      title: "Pre-appointment email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "neutral",
      reasonLabel: "Best when the meeting needs one clear written setup",
      subjectLine: `Quick setup before our ${input.latestAppointment.title}`,
      body: `Hi ${firstName},\n\nLooking forward to our ${input.latestAppointment.title} on ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        { timeZone: input.timeZone ?? null },
      )}.\n\nI will come in ready around ${intentContext}, ${budgetContext}, and ${areaContext}. If anything changed on timing or priorities, reply here and I will adjust before we meet.\n\nBest,\nAcre`,
    });
  } else if (
    selectedSuggestionKind === "content_rescue" &&
    input.latestSendRecord &&
    input.latestSendRecord.openCount <= 0
  ) {
    suggestionKind = "content_rescue";
    statusLabel = "Content follow-up";
    statusTone = "warning";
    statusTitle = "Rescue the tracked send before it goes quiet";
    summary =
      "Material has already been sent, but there is no tracked open yet, so the next-touch should reduce friction and offer a smaller next step.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "content_rescue",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Open listing output";
    primaryActionHref = buildFrontOfficeListingsHref({
      clientId: input.clientId,
      lane: frontOfficeListingsLanes.sendRescue,
    });

    pushDraft({
      id: "unopened-text",
      title: "Shortlist rescue text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "warning",
      reasonLabel: `No tracked open on ${latestListingLabel}`,
      subjectLine: "",
      body: `Hi ${firstName}, just checking that you saw the options I sent over. I can narrow them down to the 2 or 3 best matches in ${areaContext} if that makes the next step easier. Want me to tighten the list or book a quick showing?`,
    });
    pushDraft({
      id: "unopened-call",
      title: "No-open follow-up opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "accent",
      reasonLabel: "Designed to restart momentum without sounding pushy",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to make this easier instead of sending another big batch. I can cut the shortlist down around ${areaContext} and ${budgetContext} so the next step feels obvious. Which direction would help most right now?`,
    });
  } else if (
    selectedSuggestionKind === "warm_engagement" &&
    input.latestSendRecord &&
    input.latestSendRecord.openCount > 0
  ) {
    suggestionKind = "warm_engagement";
    statusLabel = "Warm engagement";
    statusTone = input.revisitCount > 0 ? "success" : "accent";
    statusTitle = "Follow the signal while the client is still engaged";
    summary =
      "The send history already shows engagement, so the next touch should turn interest into a clearer shortlist, feedback, or booked step.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "warm_engagement",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Create follow-up";
    primaryActionHref = "#front-office-follow-up-form";

    pushDraft({
      id: "engaged-call",
      title: "Engagement follow-up opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.revisitCount > 0 ? "success" : "accent",
      reasonLabel:
        input.revisitCount > 0
          ? "Revisit signal on tracked content"
          : "At least one tracked open is already recorded",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to follow up on the options we reviewed. Based on what stood out most, I can narrow the search and line up the next showing. Which one felt closest to the mark?`,
    });
    pushDraft({
      id: "engaged-text",
      title: "Warm-engagement text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: `Grounded by interest in ${latestListingLabel}`,
      subjectLine: "",
      body: `Hi ${firstName}, wanted to follow up on the options I sent over. If one or two stood out, I can narrow the list and line up the next step around ${areaContext}. Want me to tighten the shortlist or book a quick tour?`,
    });
  } else if (
    selectedSuggestionKind === "handoff" &&
    input.isReadyForBackOffice &&
    !input.hasLinkedTransaction
  ) {
    suggestionKind = "handoff";
    statusLabel = "Formal handoff";
    statusTone = "warning";
    statusTitle =
      "Use the touch to align the client before the Back Office handoff";
    summary =
      "The client page is Back Office-ready, but the formal file is not live yet, so the next touch should confirm package, timing, and expectations before handoff.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "handoff",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;
    allowsDirectFollowUpCreation = false;
    directFollowUpState = "suppressed_by_boundary";

    pushDraft({
      id: "handoff-call",
      title: "Offer / application alignment opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "warning",
      reasonLabel: input.closingBoundaryLabel,
      subjectLine: "",
      body: `Hi ${firstName}, we are at the point where the next step should become formal, and I want to make sure timing, paperwork, and expectations stay clean. If we confirm the exact package today, I can keep the process moving without extra back-and-forth.`,
    });
    pushDraft({
      id: "handoff-email",
      title: "Formal-step email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel:
        "Best when the client needs one written recap before formal handoff",
      subjectLine: "Confirming the next formal step",
      body: `Hi ${firstName},\n\nWe are at the point where the next step should become formal, and I want to keep timing, paperwork, and expectations clean.\n\nIf we confirm the exact package today, I can move the file forward without extra back-and-forth and make sure the next milestone is clear.\n\nBest,\nAcre`,
    });
  } else {
    pushDraft({
      id: "next-call",
      title: "Primary next-touch opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.workflow.nextStepTone,
      reasonLabel: input.workflow.nextStepTitle,
      subjectLine: "",
      body: input.playbook.introScript,
    });
    pushDraft({
      id: "next-text",
      title: "Short next-step text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel:
        "Built from current stage, budget, area, and timeline context",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on ${intentContext}. I can tighten the next step around ${areaContext} and ${budgetContext} so it feels more actionable instead of broad. Would a quick call this week help us choose the next move?`,
    });
  }

  const suggestionGroundingSignals = (() => {
    switch (suggestionKind) {
      case "reentry":
        return [
          "Formal deal outcome · cancelled or lost",
          "Execution boundary · relationship reset belongs in Front Office before any new formal workflow",
        ];
      case "postclose":
        return [
          input.closingKeyDateLabel !== "No milestone date captured"
            ? `Closed milestone · ${input.closingKeyDateLabel}`
            : "Formal deal outcome · closed",
          "Execution boundary · keep the touch client-facing while Back Office remains the system of record",
        ];
      case "closing":
        return [
          input.closingKeyDateLabel !== "No milestone date captured"
            ? `Shared milestone · ${input.closingKeyDateLabel}`
            : "Shared file milestone is approaching",
          "Execution boundary · steady the client touch without duplicating Back Office execution",
        ];
      case "lease":
        return [
          `Lease reminder · ${input.leaseReminder.statusLabel}`,
          input.leaseReminder.helperText,
        ];
      case "appointment":
        return input.latestAppointment
          ? [
              `Appointment · ${input.latestAppointment.title}`,
              `Starts ${formatDateTimeLabel(input.latestAppointment.startsAt, {
                timeZone: input.timeZone ?? null,
              })}`,
            ]
          : [];
      case "content_rescue":
        return [
          input.latestSendRecord?.listingTitle.trim()
            ? `Tracked send · no open on ${input.latestSendRecord.listingTitle.trim()}`
            : "Tracked send · still no open",
          input.latestSendRecord
            ? `Sent ${formatDateTimeLabel(input.latestSendRecord.sentAt, {
                timeZone: input.timeZone ?? null,
              })}`
            : "",
        ];
      case "warm_engagement":
        return [
          input.latestSendRecord?.lastOpenedAt
            ? `Tracked engagement · last open ${formatDateTimeLabel(
                input.latestSendRecord.lastOpenedAt,
                {
                  timeZone: input.timeZone ?? null,
                },
              )}`
            : `Tracked engagement · ${input.latestSendRecord?.openCount ?? 0} open(s) recorded`,
          input.latestSendRecord?.listingTitle.trim()
            ? `Listing · ${input.latestSendRecord.listingTitle.trim()}`
            : "",
        ];
      case "handoff":
        return [
          "Execution boundary · Front Office is ready for formal workflow",
          input.closingBoundaryLabel,
        ];
      default:
        return [
          `Stage · ${input.stage}`,
          "No future touch is currently scheduled on this active record.",
        ];
    }
  })();
  groundingSignals = Array.from(
    new Set(
      [...suggestionGroundingSignals, ...workflowGroundingSignals].filter(
        Boolean,
      ),
    ),
  ).slice(0, 5);

  if (selectedInsight.suppressDirectFollowUpCreation) {
    allowsDirectFollowUpCreation = false;
    directFollowUpState = "suppressed_by_history";
    helperText = `${helperText} ${selectedInsight.oneClickReasonOverride ?? "Acre is holding back one-click follow-up creation here because a similar AI-created follow-up still needs review first."}`;
    primaryActionLabel = "Review existing follow-up";
    primaryActionHref = "#front-office-follow-up-form";
    primaryActionOpensInNewTab = false;
  }

  const boundaryContract = buildFrontOfficeAiBoundaryContract({
    suggestionKind,
    hasLinkedTransaction: input.hasLinkedTransaction,
    isReadyForBackOffice: input.isReadyForBackOffice,
    hasClosedTransaction: input.hasClosedTransaction,
    hasCancelledTransaction: input.hasCancelledTransaction,
    directFollowUpState,
    primaryActionReasonOverride: selectedInsight.primaryActionReasonOverride,
    oneClickReasonOverride: selectedInsight.oneClickReasonOverride,
  });

  return {
    suggestionKind,
    statusLabel,
    statusTone,
    statusTitle,
    summary,
    helperText,
    groundingSignals,
    rankingSignals: selectedInsight.historySignals,
    boundaryLabel: boundaryContract.boundaryLabel,
    boundaryTone: boundaryContract.boundaryTone,
    boundaryDescription: boundaryContract.boundaryDescription,
    primaryActionReason: boundaryContract.primaryActionReason,
    oneClickReason: boundaryContract.oneClickReason,
    followUpSuggestion,
    allowsDirectFollowUpCreation,
    primaryActionLabel,
    primaryActionHref,
    primaryActionOpensInNewTab,
    drafts,
    aiStrategy: strategyContract,
  };
}
