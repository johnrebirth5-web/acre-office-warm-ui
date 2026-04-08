import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeClientDetail } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { FrontOfficeLink } from "../../_components/front-office-link";
import { FrontOfficePageTemplate } from "../../_components/front-office-page-template";
import { FrontOfficeClientChatListClient } from "./front-office-client-chat-list-client";
import { FrontOfficeClientAiSuggestionsClient } from "./front-office-client-ai-suggestions-client";
import { FrontOfficeClientDossierClient } from "./front-office-client-dossier-client";
import {
  FrontOfficeClientActionGroup,
  FrontOfficeClientGuidanceQueue,
  buildFrontOfficeClientFollowUpHref,
  frontOfficeClientDossierSectionIds,
  getFrontOfficeClientDossierSectionDescription,
  getFrontOfficeClientDossierSectionLabel,
  getFrontOfficeClientDossierSectionHref,
} from "./front-office-client-dossier-shared";
import { FrontOfficeClientLeaseReminderClient } from "./front-office-client-lease-reminder-client";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../../lib/auth-session";

type AgentClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
  searchParams: Promise<{
    followUpTitle?: string;
    followUpDueAt?: string;
    followUpSource?: string;
  }>;
};

type FrontOfficeClientDetailSnapshot = NonNullable<
  Awaited<ReturnType<typeof getFrontOfficeClientDetail>>
>;

function getClientFirstName(fullName: string) {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName?.trim() || "Client";
}

function buildWorkflowFollowUpTitle(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot) {
    return "Create the next follow-up";
  }

  const firstName = getClientFirstName(snapshot.fullName);

  switch (snapshot.workflow.nextStepKey) {
    case "capture_showing_feedback":
      return `Capture ${firstName}'s showing feedback`;
    case "start_lease_follow_up":
      return `Check ${firstName}'s lease renewal or move timing`;
    case "clarify_pending_blocker":
      return `Clarify the blocker for ${firstName}`;
    case "post_close_follow_up":
      return `Send ${firstName} a post-close check-in`;
    case "place_nurture_reminder":
      return `Place a future nurture touch for ${firstName}`;
    default:
      return `Follow up with ${firstName}`;
  }
}

function getSuggestedFollowUpSourceLabel(source: string | undefined) {
  switch (source) {
    case "ai":
      return "AI suggestion loaded into the follow-up form below.";
    case "lease":
      return "Lease reminder loaded into the follow-up form below.";
    case "workflow":
      return "Workflow pressure loaded into the follow-up form below.";
    case "timeline":
      return "Timeline action loaded into the follow-up form below.";
    default:
      return source ? "Suggested follow-up loaded into the form below." : null;
  }
}

function getChatListStrategyLabel(snapshot: FrontOfficeClientDetailSnapshot) {
  if (snapshot.phone) {
    return "Call first";
  }

  if (snapshot.email) {
    return "Email first";
  }

  return "Contact data missing";
}

function getChatListStrategyTone(
  snapshot: FrontOfficeClientDetailSnapshot,
) {
  if (snapshot.phone) {
    return "accent" as const;
  }

  if (snapshot.email) {
    return "warning" as const;
  }

  return "danger" as const;
}

function getChatListStrategyDescription(
  snapshot: FrontOfficeClientDetailSnapshot,
) {
  if (snapshot.phone) {
    return "A direct number is already on file, so the fastest move is to call first, use the intro script, and leave the client with one clear next step.";
  }

  if (snapshot.email) {
    return "No phone number is captured yet, so open with email, keep the call script ready for the reply, and avoid pretending the dossier is more complete than it is.";
  }

  return "No direct contact path is captured yet, so finish the contact record before trying to execute the playbook or send anything outbound.";
}

export default async function AgentClientDetailPage(
  props: AgentClientDetailPageProps,
) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "clients:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const { clientId } = await props.params;
  const searchParams = await props.searchParams;
  const access = getSessionAccess(context);
  const canUseAi = can(context.currentMembership, "ai:use");
  const suggestedFollowUpTitle = searchParams.followUpTitle?.trim() || "";
  const suggestedFollowUpDueAt =
    searchParams.followUpDueAt &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.followUpDueAt)
      ? searchParams.followUpDueAt
      : undefined;
  const suggestedFollowUp = suggestedFollowUpTitle
    ? {
        title: suggestedFollowUpTitle,
        dueAt: suggestedFollowUpDueAt,
        sourceLabel: getSuggestedFollowUpSourceLabel(searchParams.followUpSource),
      }
    : null;
  const snapshot = await getFrontOfficeClientDetail({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    clientId,
    timeZone: context.currentUser.timezone,
  });

  if (!snapshot) {
    notFound();
  }

  const primaryHandoff = snapshot.handoffs[0] ?? null;
  const currentRailItem =
    snapshot.nextStepRail.items.find((item) => item.isCurrent) ??
    snapshot.nextStepRail.items[0];
  const listingRailItem =
    snapshot.nextStepRail.items.find((item) => item.id === "listing_output") ??
    snapshot.nextStepRail.items[2] ??
    currentRailItem;
  const appointmentRailItem =
    snapshot.nextStepRail.items.find((item) => item.id === "appointment") ??
    currentRailItem;
  const offerRailItem =
    snapshot.nextStepRail.items.find((item) => item.id === "offer_prep") ??
    currentRailItem;
  const inspectionRailItem =
    snapshot.nextStepRail.items.find(
      (item) => item.id === "inspection_support",
    ) ?? currentRailItem;
  const closingRailItem =
    snapshot.nextStepRail.items.find(
      (item) => item.id === "closing_suggestion",
    ) ?? currentRailItem;
  const currentSectionLabel = getFrontOfficeClientDossierSectionLabel(
    currentRailItem.id,
  );
  const currentSectionDescription = getFrontOfficeClientDossierSectionDescription(
    currentRailItem.id,
  );
  const currentSectionHref = getFrontOfficeClientDossierSectionHref(
    currentRailItem.id,
  );
  const railSectionHref = `#${frontOfficeClientDossierSectionIds.nextStepRail}`;
  const backOfficeContextHref = `#${frontOfficeClientDossierSectionIds.backOfficeContext}`;
  const overviewSectionHref = "#front-office-client-overview";
  const timelineSectionHref = "#front-office-client-execution-timeline";
  const leaseReminderSectionHref = "#front-office-client-lease-reminder";
  const firstName = getClientFirstName(snapshot.fullName);
  const workflowFollowUpHref = buildFrontOfficeClientFollowUpHref({
    clientId: snapshot.id,
    title: buildWorkflowFollowUpTitle(snapshot),
    dueAt:
      snapshot.followUpCue.dueAtValue.slice(0, 10) ||
      snapshot.leaseReminder.reminderAtValue,
    source: "workflow",
  });
  const leaseFollowUpHref = buildFrontOfficeClientFollowUpHref({
    clientId: snapshot.id,
    title: `Check ${firstName}'s lease renewal or move timing`,
    dueAt:
      snapshot.leaseReminder.reminderAtValue ||
      snapshot.followUpCue.dueAtValue.slice(0, 10),
    source: "lease",
  });
  const followUpPrimaryAction = snapshot.summary.openTaskCount
    ? {
        href: "#front-office-follow-up-queue",
        label: "Review follow-up queue",
      }
    : {
        href: workflowFollowUpHref,
        label: "Create follow-up",
      };
  const primaryHandoffAction = primaryHandoff
    ? {
        href: primaryHandoff.href,
        label:
          primaryHandoff.statusLabel === "Committed"
            ? "Open Back Office record"
            : "Open Back Office create flow",
      }
    : {
        href: backOfficeContextHref,
        label: "Review handoff rules",
      };
  const workflowAction =
    snapshot.workflow.actionHref.startsWith("#front-office-follow-up")
      ? followUpPrimaryAction
      : {
          href: snapshot.workflow.actionHref,
          label: snapshot.workflow.actionLabel,
          opensInNewTab: snapshot.workflow.action.opensInNewTab,
        };
  const followUpCueAction =
    snapshot.followUpCue.action.href.startsWith("#front-office-follow-up")
      ? followUpPrimaryAction
      : {
          href: snapshot.followUpCue.action.href,
          label: snapshot.followUpCue.action.label,
          opensInNewTab: snapshot.followUpCue.action.opensInNewTab,
        };
  const executionTimelineItems = [
    ...(snapshot.leaseReminder.timelineAtValue
      ? [
          {
            id: "lease-reminder",
            title: snapshot.leaseReminder.timelineTitle,
            badgeLabel: "Lease",
            badgeTone: snapshot.leaseReminder.statusTone,
            context: snapshot.leaseReminder.statusLabel,
            description: snapshot.leaseReminder.timelineDescription,
            metaLabel: snapshot.leaseReminder.timelineAtLabel,
            sortAt: snapshot.leaseReminder.timelineAtValue,
            priority: snapshot.leaseReminder.needsAttention ? 0 : 1,
            sortDirection: "asc" as const,
            actions: [
              {
                href: leaseReminderSectionHref,
                label: "Review lease reminder",
              },
              {
                href: leaseFollowUpHref,
                label: "Load renewal follow-up",
              },
            ],
          },
        ]
      : []),
    ...snapshot.followUpTasks.map((task) => ({
      id: `follow-up-${task.id}`,
      title: task.timelineTitle,
      badgeLabel: "Follow-up",
      badgeTone: task.tone,
      context: task.timelineContext,
      description: task.timelineDescription,
      metaLabel: task.timelineAtLabel,
      sortAt: task.timelineAtValue,
      priority:
        !task.isResolved && (task.needsAttention || !task.dueAtValue)
          ? 0
          : task.isResolved
            ? 2
            : 1,
      sortDirection: task.isResolved ? ("desc" as const) : ("asc" as const),
      actions: [
        {
          href: "#front-office-follow-up-queue",
          label: "Review queue",
        },
        ...(!task.isResolved
          ? [
              {
                href: workflowFollowUpHref,
                label: "Create another follow-up",
              },
            ]
          : []),
      ],
    })),
    ...snapshot.stageHistory.map((entry) => ({
      id: `stage-${entry.id}`,
      title: entry.title,
      badgeLabel: "Stage",
      badgeTone: entry.tone,
      context: entry.actorLabel,
      description:
        entry.noteLabel || "Stage updated in the Front Office dossier.",
      metaLabel: entry.changedAtLabel,
      sortAt: entry.changedAtValue,
      priority: 2,
      sortDirection: "desc" as const,
      actions: [
        {
          href: overviewSectionHref,
          label: "Review overview",
        },
      ],
    })),
    ...snapshot.appointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: appointment.title,
      badgeLabel: "Appointment",
      badgeTone: appointment.statusTone,
      context: `${appointment.statusLabel} · ${appointment.externalStatusLabel}`,
      description: `${appointment.startsAtLabel} · ${appointment.locationLabel}`,
      metaLabel: appointment.contextLabel,
      sortAt: appointment.startsAtValue,
      priority:
        appointment.statusValue === "scheduled" &&
        new Date(appointment.startsAtValue).getTime() >= Date.now()
          ? 1
          : 2,
      sortDirection:
        appointment.statusValue === "scheduled" &&
        new Date(appointment.startsAtValue).getTime() >= Date.now()
          ? ("asc" as const)
          : ("desc" as const),
      actions: [
        {
          href: appointmentRailItem.actionHref,
          label: appointmentRailItem.actionLabel,
          opensInNewTab: appointmentRailItem.actionOpensInNewTab,
        },
      ],
    })),
    ...snapshot.sendRecords.map((record) => ({
      id: `send-${record.id}`,
      title: record.title,
      badgeLabel: "Send",
      badgeTone: record.engagementTone,
      context: `${record.channelLabel} · ${record.engagementLabel}`,
      description: [`Sent ${record.sentAtLabel}`, record.stageLabel, record.appointmentLabel]
        .filter(Boolean)
        .join(" · "),
      metaLabel: record.lastActivityLabel,
      sortAt: record.sentAtValue,
      priority: 2,
      sortDirection: "desc" as const,
      actions: [
        {
          href: record.href,
          label: "Open listing output",
        },
      ],
    })),
    ...snapshot.handoffs.map((handoff) => ({
      id: `handoff-${handoff.id}`,
      title: handoff.stageLabel,
      badgeLabel: "BO boundary",
      badgeTone: handoff.tone,
      context: handoff.statusLabel,
      description: handoff.summary,
      metaLabel: handoff.updatedAtLabel,
      sortAt: handoff.updatedAtValue,
      priority: 2,
      sortDirection: "desc" as const,
      actions: [
        {
          href: handoff.href,
          label:
            handoff.statusLabel === "Committed"
              ? "Open transaction"
              : "Open create flow",
        },
      ],
    })),
  ]
    .filter((item) => item.sortAt)
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      if (left.sortDirection !== right.sortDirection) {
        return left.sortDirection === "asc" ? -1 : 1;
      }

      const leftTime = new Date(left.sortAt).getTime();
      const rightTime = new Date(right.sortAt).getTime();
      return left.sortDirection === "asc"
        ? leftTime - rightTime
        : rightTime - leftTime;
    })
    .slice(0, 12);

  function buildRailItemActions(
    item: typeof currentRailItem,
  ) {
    return [
      {
        href: getFrontOfficeClientDossierSectionHref(item.id),
        label: "Review dossier block",
      },
      {
        href: item.actionHref,
        label: item.actionLabel,
        opensInNewTab: item.actionOpensInNewTab,
      },
    ];
  }

  return (
    <FrontOfficePageTemplate
      description="Client dossier stays focused on execution context: stage movement, next touches, appointments, and the exact return point when calendar, listing, or cleanup work brings you back here."
      eyebrow="Client dossier"
      main={
        <>
          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: currentSectionHref,
                    label: `Jump to ${currentSectionLabel}`,
                  },
                  followUpPrimaryAction,
                  {
                    href: timelineSectionHref,
                    label: "Review timeline",
                  },
                  {
                    href: `/api/agent/clients/${snapshot.id}/pdf`,
                    label: "Download client PDF",
                    opensInNewTab: true,
                  },
                ]}
              />
            }
            className="office-list-card"
            id="front-office-client-overview"
            subtitle={`${currentSectionLabel} is the current focus, and the rest of the dossier stays one jump away so calendar, listing, or cleanup re-entry lands back on the same workbench instead of a fresh admin form.`}
            title="Overview"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="current workflow pressure driving the active dossier"
                label="Workflow pressure"
                tone="accent"
                value={snapshot.workflow.pressureLabel}
              />
              <StatCard
                hint="the current next-touch cue this dossier is surfacing"
                label="Follow-up cue"
                tone="accent"
                value={snapshot.followUpCue.label}
              />
              <StatCard
                hint="renewal or remarketing timing currently attached to this client"
                label="Lease reminder"
                tone={
                  snapshot.leaseReminder.needsAttention ? "accent" : "default"
                }
                value={snapshot.leaseReminder.statusLabel}
              />
              <StatCard
                hint="where the record sits across FO execution and BO formal work"
                label="FO / BO boundary"
                tone="accent"
                value={snapshot.nextStepRail.decisionLabel}
              />
            </ListPageStatsGrid>

            <ListPageStatsGrid>
              <StatCard
                hint="open or in-progress follow-up tasks"
                label="Open follow-up"
                tone="accent"
                value={snapshot.summary.openTaskCount}
              />
              <StatCard
                hint="tasks that already need action, re-dating, or a real due date"
                label="Needs action now"
                tone={
                  snapshot.summary.attentionTaskCount > 0
                    ? "accent"
                    : "default"
                }
                value={snapshot.summary.attentionTaskCount}
              />
              <StatCard
                hint="active follow-up tasks due in the next 7 days"
                label="Due this week"
                value={snapshot.summary.dueSoonTaskCount}
              />
              <StatCard
                hint="scheduled appointments from now forward"
                label="Upcoming appointments"
                value={snapshot.summary.upcomingAppointmentCount}
              />
              <StatCard
                hint="draft or ready Back Office handoffs"
                label="BO handoffs"
                tone="accent"
                value={snapshot.summary.openHandoffCount}
              />
            </ListPageStatsGrid>

            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "workflow",
                  label: snapshot.workflow.pressureLabel,
                  tone: snapshot.workflow.pressureTone,
                  title: snapshot.workflow.nextStepTitle,
                  description: snapshot.workflow.nextStepDescription,
                  context: `${currentSectionLabel} · ${currentRailItem.stepLabel} · ${currentRailItem.ownershipLabel}`,
                  meta: <span>{snapshot.workflow.pressureDescription}</span>,
                  actions: [workflowAction],
                },
                {
                  key: "next-touch",
                  label: snapshot.followUpCue.label,
                  tone: snapshot.followUpCue.tone,
                  title: "The next touch is the live execution anchor",
                  description: snapshot.followUpCue.description,
                  context: snapshot.followUpCue.dueLabel,
                  meta: <span>{snapshot.nextTouchLabel}</span>,
                  actions: [
                    followUpCueAction,
                    ...(snapshot.leaseReminder.reminderAtValue
                      ? [
                          {
                            href: leaseFollowUpHref,
                            label: "Load renewal follow-up",
                          },
                        ]
                      : []),
                  ],
                },
                {
                  key: "boundary",
                  label: snapshot.nextStepRail.decisionLabel,
                  tone: snapshot.nextStepRail.decisionTone,
                  title: snapshot.nextStepRail.decisionTitle,
                  description: snapshot.nextStepRail.decisionDescription,
                  meta: <span>{snapshot.nextStepRail.decisionMetaLabel}</span>,
                  actions: [primaryHandoffAction],
                },
                {
                  key: "pdf",
                  label: "Client-ready PDF",
                  tone: "neutral",
                  title: "Export a recap that mirrors the live dossier",
                  description:
                    "Use the PDF when the client needs a clean summary of goals, next steps, appointments, shared options, and formal-file status without exposing Acre admin work.",
                  meta: <span>PDF export stays client-facing; formal transaction documents still live separately.</span>,
                  actions: [
                    {
                      href: `/api/agent/clients/${snapshot.id}/pdf`,
                      label: "Download client PDF",
                      opensInNewTab: true,
                    },
                  ],
                },
              ]}
            />

            <div className="office-detail-grid">
              <div className="office-detail-field">
                <span>Current section</span>
                <strong>{currentSectionLabel}</strong>
              </div>
              <div className="office-detail-field office-detail-field-wide">
                <span>Section note</span>
                <strong>{currentSectionDescription}</strong>
              </div>
              <div className="office-detail-field">
                <span>Next touch</span>
                <strong>{snapshot.followUpCue.dueLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Formal lane</span>
                <strong>
                  {primaryHandoff
                    ? `${primaryHandoff.stageLabel} · ${primaryHandoff.statusLabel}`
                    : "Front Office only for now"}
                </strong>
              </div>
              <div className="office-detail-field">
                <span>Source</span>
                <strong>{snapshot.sourceLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Intent</span>
                <strong>{snapshot.intentLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Budget</span>
                <strong>{snapshot.budgetLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Preferred areas</span>
                <strong>{snapshot.preferredAreasLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Owner</span>
                <strong>{snapshot.ownerLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Last touch</span>
                <strong>{snapshot.lastTouchLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Lease end</span>
                <strong>{snapshot.leaseReminder.leaseEndDateLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Lease reminder</span>
                <strong>{snapshot.leaseReminder.reminderAtLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Email</span>
                <strong>{snapshot.email || "No email captured"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Phone</span>
                <strong>{snapshot.phone || "No phone captured"}</strong>
              </div>
              <div className="office-detail-field office-detail-field-wide">
                <span>Notes</span>
                <strong>{snapshot.notesLabel}</strong>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id="front-office-client-lease-reminder"
            subtitle="Lease renewal and remarketing dates should live beside the live client dossier, not inside a separate spreadsheet."
            title="Lease-date reminder"
          >
            <FrontOfficeClientLeaseReminderClient snapshot={snapshot} />
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  followUpPrimaryAction,
                  {
                    href: backOfficeContextHref,
                    label: "Review BO boundary",
                  },
                ]}
              />
            }
            className="office-list-card"
            id="front-office-client-execution-timeline"
            subtitle="Action items surface first, then scheduled work, then recent history so the dossier reads like a live execution chain instead of a static profile."
            title="Execution timeline"
          >
            <div className="front-office-placeholder-note">
              <strong>Action-first timeline</strong>
              <p>
                Urgent follow-up and lease items rise to the top, upcoming
                coordination stays in the middle, and recent stage / send / BO
                history stays below for context.
              </p>
            </div>
            <div className="office-queue-list">
              {executionTimelineItems.length ? (
                executionTimelineItems.map((item) => (
                  <QueueItem
                    action={
                      <FrontOfficeClientActionGroup actions={item.actions} />
                    }
                    badgeLabel={item.badgeLabel}
                    badgeTone={item.badgeTone}
                    context={item.context}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))
              ) : (
                <EmptyState
                  description="Stage moves, sends, appointments, and BO handoff events will appear here as this dossier keeps moving."
                  title="No execution timeline yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: railSectionHref,
                    label: "Review current rail",
                  },
                  {
                    href: appointmentRailItem.actionHref,
                    label: appointmentRailItem.actionLabel,
                    opensInNewTab: appointmentRailItem.actionOpensInNewTab,
                  },
                ]}
              />
            }
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.appointmentsFollowUp}
            subtitle="Calls, reminders, confirmations, and showings stay readable together here so the next move is obvious without opening Back Office early."
            title="Appointments & follow-up"
          >
            <div className="office-list-page-stack">
              <FrontOfficeClientGuidanceQueue
                items={[
                  {
                    key: "fo-lane",
                    label: primaryHandoff ? "FO supports BO" : "Stay in FO",
                    tone: "accent",
                    title: primaryHandoff
                      ? "Daily coordination still stays in Front Office"
                      : "Daily next touches and meetings stay in Front Office",
                    description: primaryHandoff
                      ? "Even with a live transaction file, calls, confirmations, reschedules, and client-facing reminders should keep moving from this dossier."
                      : "Use follow-up tasks, next-touch dates, and appointment scheduling here before the work becomes a formal offer or contract file.",
                  },
                  {
                    key: "bo-lane",
                    label: primaryHandoff
                      ? primaryHandoff.statusLabel
                      : "BO later",
                    tone: primaryHandoff ? primaryHandoff.tone : "warning",
                    title: primaryHandoff
                      ? "Formal milestones stay on the Back Office record"
                      : "Do not open Back Office just to hold a reminder",
                    description: primaryHandoff
                      ? primaryHandoff.summary
                      : "A next-touch reminder, showing confirmation, or viewing recap is still Front Office work. Create the formal file only when negotiation, application, or contract work needs it.",
                    actions: [primaryHandoffAction],
                  },
                  {
                    key: "current-state",
                    label: snapshot.workflow.pressureLabel,
                    tone: snapshot.workflow.pressureTone,
                    title: snapshot.workflow.nextStepTitle,
                    description: `${snapshot.workflow.nextStepDescription} The appointment cards below now call out the external status, bridge log, next-touch pressure, and the exact jump back to calendar writeback.`,
                    meta: (
                      <span>
                        {currentRailItem.stepLabel} · {currentRailItem.ownershipLabel}
                      </span>
                    ),
                    actions: [
                      followUpPrimaryAction,
                      {
                        href: appointmentRailItem.actionHref,
                        label: appointmentRailItem.actionLabel,
                        opensInNewTab: appointmentRailItem.actionOpensInNewTab,
                      },
                    ],
                  },
                ]}
              />

              <div className="office-queue-list">
                {snapshot.appointments.length ? (
                  snapshot.appointments.map((appointment) => (
                    <QueueItem
                      action={
                        <>
                          <FrontOfficeLink
                            className="office-inline-link"
                            href={appointment.calendarWritebackHref}
                          >
                            Open calendar writeback
                          </FrontOfficeLink>
                          <FrontOfficeLink
                            className="office-inline-link"
                            href={appointment.listingOutputHref}
                          >
                            Open listing output
                          </FrontOfficeLink>
                          {appointment.statusLabel === "Scheduled" ? (
                            <>
                              <FrontOfficeLink
                                className="office-inline-link"
                                href={appointment.googleCalendarHref}
                              >
                                Google Calendar
                              </FrontOfficeLink>
                              <FrontOfficeLink
                                className="office-inline-link"
                                href={appointment.outlookCalendarHref}
                              >
                                Outlook
                              </FrontOfficeLink>
                              <a
                                className="office-inline-link"
                                href={appointment.icsHref}
                              >
                                Download ICS
                              </a>
                              {appointment.emailBriefHref ? (
                                <FrontOfficeLink
                                  className="office-inline-link"
                                  href={appointment.emailBriefHref}
                                >
                                  Email client
                                </FrontOfficeLink>
                              ) : null}
                            </>
                          ) : null}
                        </>
                      }
                      badgeLabel={appointment.typeLabel}
                      badgeTone={appointment.typeTone}
                      context={`${appointment.statusLabel} · ${appointment.externalStatusLabel}`}
                      description={`${appointment.startsAtLabel} · ${appointment.locationLabel}`}
                      key={appointment.id}
                      meta={
                        <div className="list-row-meta front-office-record-meta">
                          <span>{appointment.contextLabel}</span>
                          <span>
                            {appointment.externalStatusLabel} · {appointment.externalStatusDetail}
                          </span>
                          <span>
                            {appointment.bridgeStatusLabel} · {appointment.bridgeStatusDetail}
                          </span>
                          <span>Next touch · {appointment.externalNextActionAtLabel}</span>
                          <span>{appointment.bridgeNextStepLabel}</span>
                          <span>{appointment.bridgeNextStepDetail}</span>
                        </div>
                      }
                      title={appointment.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    action={
                      <FrontOfficeLink
                        className="office-button-secondary"
                        href={appointmentRailItem.actionHref}
                      >
                        {appointmentRailItem.actionLabel}
                      </FrontOfficeLink>
                    }
                    description="Showings, consultations, and meetings for this client will surface here."
                    title="No appointments yet"
                  />
                )}
              </div>
            </div>

            <FrontOfficeClientDossierClient
              snapshot={snapshot}
              suggestedFollowUp={suggestedFollowUp}
            />
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: railSectionHref,
                    label: "Review current rail",
                  },
                  {
                    href: listingRailItem.actionHref,
                    label: listingRailItem.actionLabel,
                    opensInNewTab: listingRailItem.actionOpensInNewTab,
                  },
                ]}
              />
            }
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.listingOutput}
            subtitle="Tracked sends stay client-facing and execution-first here; they should not replace the formal offer or contract record."
            title="Send record & engagement"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="client-linked sends recorded from Front Office"
                label="Sends"
                value={snapshot.engagement.sendCount}
              />
              <StatCard
                hint="send records with at least one open"
                label="Opened sends"
                value={snapshot.engagement.openedSendCount}
              />
              <StatCard
                hint="extra opens after the first one"
                label="Revisits"
                value={snapshot.engagement.revisitCount}
              />
              <StatCard
                hint="most recent tracked engagement"
                label="Latest engagement"
                tone="accent"
                value={snapshot.engagement.lastEngagementLabel}
              />
            </ListPageStatsGrid>

            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "fo-lane",
                  label: listingRailItem.ownershipLabel,
                  tone: listingRailItem.ownershipTone,
                  title: "Listing output stays client-facing in Front Office",
                  description: primaryHandoff
                    ? "Keep share links, resend context, and open signals here so the next conversation stays grounded even when a formal file already exists."
                    : "Use listing output for send and engagement tracking. Client recommendations do not need a formal Back Office file on their own.",
                },
                {
                  key: "bo-lane",
                  label: primaryHandoff ? "BO live" : "BO later",
                  tone: primaryHandoff ? primaryHandoff.tone : "warning",
                  title: primaryHandoff
                    ? "The deal file stays in Back Office once terms turn formal"
                    : "Do not use Back Office just to send inventory",
                  description: primaryHandoff
                    ? "If a transaction file already exists, keep this block focused on recap, alternatives, and client-facing send history instead of adding a second deal tracker."
                    : "Keep listing recommendations here until negotiation, application, or contract work needs the shared formal record.",
                  actions: [primaryHandoffAction],
                },
                {
                  key: "current-state",
                  label: listingRailItem.statusLabel,
                  tone: listingRailItem.statusTone,
                  title: listingRailItem.title,
                  description: listingRailItem.description,
                  context: `${listingRailItem.stepLabel} · ${listingRailItem.ownershipLabel}`,
                  meta: <span>{listingRailItem.metaLabel}</span>,
                  actions: [
                    {
                      href: listingRailItem.actionHref,
                      label: listingRailItem.actionLabel,
                      opensInNewTab: listingRailItem.actionOpensInNewTab,
                    },
                  ],
                },
              ]}
            />

            <div className="office-queue-list">
              {snapshot.sendRecords.length ? (
                snapshot.sendRecords.map((record) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={record.href}
                      >
                        Send another listing
                      </FrontOfficeLink>
                    }
                    badgeLabel={record.engagementLabel}
                    badgeTone={record.engagementTone}
                    context={`${record.channelLabel} · ${record.stageLabel}`}
                    description={[`Sent ${record.sentAtLabel}`, record.appointmentLabel]
                      .filter(Boolean)
                      .join(" · ")}
                    key={record.id}
                    meta={<span>{record.lastActivityLabel}</span>}
                    title={record.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={listingRailItem.actionHref}
                    >
                      {listingRailItem.actionLabel}
                    </FrontOfficeLink>
                  }
                  description="Client-linked listing sends will appear here once you open listing output in this client's context."
                  title="No send record yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: railSectionHref,
                    label: "Review current rail",
                  },
                  {
                    href: snapshot.negotiation.primaryActionHref,
                    label: snapshot.negotiation.primaryActionLabel,
                  },
                ]}
              />
            }
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.offerPrep}
            subtitle="Keep coaching, recap, and client-facing offer prep in Front Office until the terms need formal tracking in the shared offer workspace."
            title="Offer & negotiation"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across FO prep and BO offer execution"
                label="Workspace stage"
                tone="accent"
                value={snapshot.negotiation.boundaryLabel}
              />
              <StatCard
                hint="formal Back Office offers already tracked for the linked transaction"
                label="BO offers"
                value={snapshot.negotiation.offerCount}
              />
              <StatCard
                hint="offers that are close to expiration in the shared BO workspace"
                label="Expiring soon"
                value={snapshot.negotiation.expiringSoonCount}
              />
              <StatCard
                hint="accepted offer or current primary state"
                label="Accepted / primary"
                value={snapshot.negotiation.acceptedOfferLabel}
              />
            </ListPageStatsGrid>

            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "fo-lane",
                  label: offerRailItem.ownershipLabel,
                  tone: offerRailItem.ownershipTone,
                  title: "Client-facing prep can stay in Front Office",
                  description:
                    "Use this section for coaching, recap, expectation setting, and next-touch follow-through while the offer is still being shaped with the client.",
                },
                {
                  key: "bo-lane",
                  label: primaryHandoff ? "BO handoff active" : "Move to BO",
                  tone: primaryHandoff ? primaryHandoff.tone : "warning",
                  title: "Formal offer terms belong in Back Office",
                  description:
                    "Once price, contingencies, signatures, expiration timing, or application paperwork need auditable tracking, open the shared Back Office offer workflow instead of duplicating it here.",
                  actions: [primaryHandoffAction],
                },
                {
                  key: "current-state",
                  label: snapshot.negotiation.boundaryLabel,
                  tone: snapshot.negotiation.boundaryTone,
                  title: snapshot.negotiation.boundaryTitle,
                  description: snapshot.negotiation.boundaryDescription,
                  meta: <span>{snapshot.negotiation.boundaryMetaLabel}</span>,
                  actions: [
                    {
                      href: snapshot.negotiation.primaryActionHref,
                      label: snapshot.negotiation.primaryActionLabel,
                    },
                  ],
                },
              ]}
            />

            <div className="office-queue-list">
              {snapshot.negotiation.offers.length ? (
                snapshot.negotiation.offers.map((offer) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={offer.href}
                      >
                        Open BO offer
                      </FrontOfficeLink>
                    }
                    badgeLabel={offer.statusLabel}
                    badgeTone={offer.statusTone}
                    context={offer.partyLabel}
                    description={[offer.priceLabel, offer.expirationLabel]
                      .filter(Boolean)
                      .join(" · ")}
                    key={offer.id}
                    meta={<span>{offer.updatedAtLabel}</span>}
                    title={offer.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.negotiation.primaryActionHref}
                    >
                      {snapshot.negotiation.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  description={snapshot.negotiation.emptyStateDescription}
                  title={snapshot.negotiation.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: railSectionHref,
                    label: "Review rail",
                  },
                  {
                    href: snapshot.inspection.primaryActionHref,
                    label: snapshot.inspection.primaryActionLabel,
                  },
                ]}
              />
            }
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.inspectionSupport}
            subtitle="Inspection-era support should keep client-facing recap visible here while the shared Back Office transaction owns the formal checklist, signatures, and review queue."
            title="Inspection & contract support"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across FO prep, contract setup, and live inspection-era BO execution"
                label="Contract stage"
                tone="accent"
                value={snapshot.inspection.boundaryLabel}
              />
              <StatCard
                hint="open checklist work already living on the shared BO transaction"
                label="BO open tasks"
                value={snapshot.inspection.openTaskCount}
              />
              <StatCard
                hint="open signature requests that still need send / review / signer progress"
                label="Pending signatures"
                value={snapshot.inspection.pendingSignatureCount}
              />
              <StatCard
                hint="incoming transaction updates still waiting on BO review"
                label="Review queue"
                value={snapshot.inspection.pendingIncomingUpdateCount}
              />
            </ListPageStatsGrid>

            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "fo-lane",
                  label: inspectionRailItem.ownershipLabel,
                  tone: inspectionRailItem.ownershipTone,
                  title: "Front Office stays client-facing during inspection support",
                  description:
                    "Use this block for recap, expectation setting, appointment coordination, and the next client touch around the formal file.",
                },
                {
                  key: "bo-lane",
                  label: primaryHandoff ? "BO live" : "BO required",
                  tone: primaryHandoff ? primaryHandoff.tone : "warning",
                  title: "Formal contract work stays in Back Office",
                  description:
                    "Open tasks, signatures, and incoming update review should stay on the shared Back Office transaction instead of turning this dossier into a second inspection checklist.",
                  actions: [primaryHandoffAction],
                },
                {
                  key: "current-state",
                  label: snapshot.inspection.boundaryLabel,
                  tone: snapshot.inspection.boundaryTone,
                  title: snapshot.inspection.boundaryTitle,
                  description: snapshot.inspection.boundaryDescription,
                  meta: <span>{snapshot.inspection.boundaryMetaLabel}</span>,
                  actions: [
                    {
                      href: snapshot.inspection.primaryActionHref,
                      label: snapshot.inspection.primaryActionLabel,
                    },
                  ],
                },
              ]}
            />

            <div className="office-queue-list">
              {snapshot.inspection.items.length ? (
                snapshot.inspection.items.map((item) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={item.href}
                      >
                        {item.actionLabel}
                      </FrontOfficeLink>
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.statusTone}
                    context={item.contextLabel}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.inspection.primaryActionHref}
                    >
                      {snapshot.inspection.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  description={snapshot.inspection.emptyStateDescription}
                  title={snapshot.inspection.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeClientActionGroup
                actions={[
                  {
                    href: railSectionHref,
                    label: "Review rail",
                  },
                  {
                    href: snapshot.closing.primaryActionHref,
                    label: snapshot.closing.primaryActionLabel,
                    opensInNewTab: snapshot.closing.primaryActionOpensInNewTab,
                  },
                ]}
              />
            }
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.closingSuggestion}
            subtitle="Once the formal deal is active or closed, Front Office should turn the shared Back Office outcome into clear wrap-up, referral, and post-close guidance instead of stopping at status visibility."
            title="Closing & win suggestions"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across pre-close planning, fresh win follow-through, and post-close nurture"
                label="Close stage"
                tone={
                  snapshot.closing.boundaryTone === "neutral"
                    ? "default"
                    : "accent"
                }
                value={snapshot.closing.boundaryLabel}
              />
              <StatCard
                hint="formal shared transaction state currently attached to this dossier"
                label="Deal status"
                value={snapshot.closing.transactionStatusLabel}
              />
              <StatCard
                hint="next shared milestone date captured from the linked transaction"
                label="Key date"
                value={snapshot.closing.keyDateLabel}
              />
              <StatCard
                hint="latest client-facing follow-up timing already visible in Front Office"
                label="Next touch"
                tone="accent"
                value={snapshot.closing.nextTouchLabel}
              />
            </ListPageStatsGrid>

            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "fo-lane",
                  label: closingRailItem.ownershipLabel,
                  tone: closingRailItem.ownershipTone,
                  title: (
                    snapshot.closing.boundaryLabel === "Return to FO"
                      ? "Post-close relationship work returns to Front Office"
                      : "Front Office keeps the client-facing wrap-up visible"
                  ),
                  description:
                    "Use this section for recap timing, referral asks, testimonial follow-through, move support, and respectful re-entry guidance around the finished or finishing deal.",
                },
                {
                  key: "bo-lane",
                  label: primaryHandoff ? "BO record" : "BO source of truth",
                  tone: primaryHandoff ? primaryHandoff.tone : "accent",
                  title: "The formal deal status still lives in Back Office",
                  description:
                    "Closing dates, final milestones, and the finished transaction record remain on the shared Back Office side. Front Office should point to that outcome, not recreate it.",
                  actions: [primaryHandoffAction],
                },
                {
                  key: "current-state",
                  label: snapshot.closing.boundaryLabel,
                  tone: snapshot.closing.boundaryTone,
                  title: snapshot.closing.boundaryTitle,
                  description: snapshot.closing.boundaryDescription,
                  meta: <span>{snapshot.closing.boundaryMetaLabel}</span>,
                  actions: [
                    {
                      href: snapshot.closing.primaryActionHref,
                      label: snapshot.closing.primaryActionLabel,
                      opensInNewTab:
                        snapshot.closing.primaryActionOpensInNewTab,
                    },
                  ],
                },
              ]}
            />

            <div className="office-queue-list">
              {snapshot.closing.suggestions.length ? (
                snapshot.closing.suggestions.map((item) => (
                  <QueueItem
                    action={
                      item.opensInNewTab ? (
                        <a
                          className="office-inline-link"
                          href={item.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.actionLabel}
                        </a>
                      ) : (
                        <FrontOfficeLink
                          className="office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      )
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.statusTone}
                    context={item.contextLabel}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    snapshot.closing.primaryActionOpensInNewTab ? (
                      <a
                        className="office-button-secondary"
                        href={snapshot.closing.primaryActionHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {snapshot.closing.primaryActionLabel}
                      </a>
                    ) : (
                      <FrontOfficeLink
                        className="office-button-secondary"
                        href={snapshot.closing.primaryActionHref}
                      >
                        {snapshot.closing.primaryActionLabel}
                      </FrontOfficeLink>
                    )
                  }
                  description={snapshot.closing.emptyStateDescription}
                  title={snapshot.closing.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          {canUseAi ? (
            <div id="front-office-ai-suggestions">
              <SectionCard
                actions={
                  snapshot.aiSuggestions.primaryActionOpensInNewTab ? (
                    <a
                      className="office-button-secondary"
                      href={snapshot.aiSuggestions.primaryActionHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {snapshot.aiSuggestions.primaryActionLabel}
                    </a>
                  ) : (
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.aiSuggestions.primaryActionHref}
                    >
                      {snapshot.aiSuggestions.primaryActionLabel}
                    </FrontOfficeLink>
                  )
                }
                className="office-list-card"
                subtitle="Acre now grounds the next-touch suggestion in the live dossier trail, but still leaves the final wording and send decision to the agent."
                title="AI next-touch suggestions"
              >
                <FrontOfficeClientAiSuggestionsClient snapshot={snapshot} />
              </SectionCard>
            </div>
          ) : null}

          {canUseAi ? (
            <div id="front-office-ai-outcomes">
              <SectionCard
                className="office-list-card"
                subtitle="Accepted AI actions stay tied to the same follow-up tasks and tracked sends, so the agent can see whether the suggestion actually moved execution."
                title="Accepted AI actions & outcomes"
              >
                <ListPageStatsGrid>
                  <StatCard
                    hint="accepted follow-up or tracked-send actions tied to this dossier"
                    label="Accepted actions"
                    value={snapshot.aiAcceptedActions.acceptedCount}
                  />
                  <StatCard
                    hint="accepted actions that already produced a completion or tracked open"
                    label="Positive outcomes"
                    tone="accent"
                    value={snapshot.aiAcceptedActions.positiveOutcomeCount}
                  />
                </ListPageStatsGrid>

                {snapshot.aiAcceptedActions.breakdown.length ? (
                  <div className="list-row-meta front-office-record-meta">
                    {snapshot.aiAcceptedActions.breakdown.map((item) => (
                      <span key={item.label}>
                        {item.label} · {item.summary}
                      </span>
                    ))}
                  </div>
                ) : null}

                {snapshot.aiAcceptedActions.windows.length ? (
                  <div className="office-queue-list">
                    {snapshot.aiAcceptedActions.windows.map((window) => (
                      <article className="office-queue-item" key={window.label}>
                        <strong>{window.label}</strong>
                        <p>{window.summary}</p>
                        {window.items.length ? (
                          <div className="list-row-meta front-office-record-meta">
                            {window.items.map((item) => (
                              <span key={`${window.label}-${item.label}`}>
                                {item.label} · {item.summary}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p>No accepted AI actions in this window yet.</p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : null}

                <div className="office-queue-list">
                  {snapshot.aiAcceptedActions.items.length ? (
                    snapshot.aiAcceptedActions.items.map((item) => (
                      <QueueItem
                        action={
                          <FrontOfficeLink
                            className="office-inline-link"
                            href={item.href}
                          >
                            {item.actionLabel}
                          </FrontOfficeLink>
                        }
                        badgeLabel={item.statusLabel}
                        badgeTone={item.statusTone}
                        context={item.contextLabel}
                        description={item.description}
                        key={item.id}
                        meta={<span>{item.helperLabel}</span>}
                        title={item.title}
                      />
                    ))
                  ) : (
                    <EmptyState
                      description="When you accept an AI follow-up or use AI draft assist to create a tracked send, Acre will show the resulting task or engagement outcome here."
                      title="No accepted AI actions yet"
                    />
                  )}
                </div>
              </SectionCard>
            </div>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="Phone strategy and copy-ready outreach stay embedded in the active dossier instead of hiding in a training doc."
            title="Chat List & phone strategy"
          >
            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "contact-path",
                  label: getChatListStrategyLabel(snapshot),
                  tone: getChatListStrategyTone(snapshot),
                  title: "Start with the strongest live channel",
                  description: `${getChatListStrategyDescription(snapshot)} ${snapshot.playbook.focusDescription}`,
                  meta: (
                    <span>
                      {snapshot.playbook.messageTemplates[0]
                        ? `After the call, the first ${snapshot.playbook.messageTemplates[0].channelLabel.toLowerCase()} template is ready to copy.`
                        : "The template pack below stays ready once a first draft is needed."}
                    </span>
                  ),
                  actions: [
                    ...(snapshot.phone
                      ? [
                          {
                            href: `tel:${snapshot.phone}`,
                            label: "Call client",
                          },
                        ]
                      : []),
                    ...(snapshot.email
                      ? [
                          {
                            href: `mailto:${snapshot.email}`,
                            label: "Email client",
                          },
                        ]
                      : []),
                    followUpPrimaryAction,
                  ],
                },
                {
                  key: "next-step",
                  label: snapshot.followUpCue.label,
                  tone: snapshot.followUpCue.tone,
                  title: "Leave the call with a dated next step",
                  description:
                    "Use the intro script and checklist to leave the conversation with a real follow-up date, a clearer channel, or a confirmed meeting rather than a vague 'keep me posted'.",
                  meta: <span>{snapshot.followUpCue.dueLabel}</span>,
                  actions: [
                    followUpPrimaryAction,
                    {
                      href: workflowFollowUpHref,
                      label: "Open follow-up form",
                    },
                  ],
                },
              ]}
            />
            <FrontOfficeClientChatListClient snapshot={snapshot} />
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.nextStepRail}
            subtitle="This rail should make the daily decision obvious: keep moving inside Front Office, or cross into the formal Back Office record without duplicating anything."
            title="Next-step rail"
          >
            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "decision",
                  label: snapshot.nextStepRail.decisionLabel,
                  tone: snapshot.nextStepRail.decisionTone,
                  title: snapshot.nextStepRail.decisionTitle,
                  description: snapshot.nextStepRail.decisionDescription,
                  meta: <span>{snapshot.nextStepRail.decisionMetaLabel}</span>,
                  actions: [
                    {
                      href: getFrontOfficeClientDossierSectionHref(
                        currentRailItem.id,
                      ),
                      label: "Review active block",
                    },
                    {
                      href: snapshot.nextStepRail.primaryActionHref,
                      label: snapshot.nextStepRail.primaryActionLabel,
                      opensInNewTab:
                        snapshot.nextStepRail.primaryActionOpensInNewTab,
                    },
                  ],
                },
                {
                  key: "current-focus",
                  label: currentRailItem.statusLabel,
                  tone: currentRailItem.statusTone,
                  title: currentRailItem.title,
                  context: `${currentRailItem.stepLabel} · ${currentRailItem.ownershipLabel}`,
                  description: currentRailItem.description,
                  meta: <span>{currentRailItem.metaLabel}</span>,
                  actions: buildRailItemActions(currentRailItem),
                },
                {
                  key: "follow-up-cue",
                  label: snapshot.followUpCue.label,
                  tone: snapshot.followUpCue.tone,
                  title: "Follow-up stays at the center of the rail",
                  context: snapshot.followUpCue.dueLabel,
                  description: snapshot.followUpCue.description,
                  meta: <span>{snapshot.nextTouchLabel}</span>,
                  actions: [
                    followUpCueAction,
                    {
                      href: leaseReminderSectionHref,
                      label: "Lease reminder",
                    },
                    ...(snapshot.leaseReminder.reminderAtValue
                      ? [
                          {
                            href: leaseFollowUpHref,
                            label: "Load renewal follow-up",
                          },
                        ]
                      : []),
                  ],
                },
                {
                  key: "pdf",
                  label: "Client recap",
                  tone: "neutral",
                  title: "Export the same execution story as a client-facing PDF",
                  description:
                    "The PDF keeps goals, next steps, appointments, shortlist context, and formal-file status together without copying admin work back into Front Office.",
                  meta: <span>Use it for recap, alignment, and post-meeting follow-through.</span>,
                  actions: [
                    {
                      href: `/api/agent/clients/${snapshot.id}/pdf`,
                      label: "Download client PDF",
                      opensInNewTab: true,
                    },
                  ],
                },
                {
                  key: "bo-status",
                  label: primaryHandoff
                    ? primaryHandoff.statusLabel
                    : "BO not active",
                  tone: primaryHandoff?.tone ?? "neutral",
                  title: primaryHandoff
                    ? `${primaryHandoff.stageLabel} is the current formal lane`
                    : "Back Office is not active yet",
                  description: primaryHandoff
                    ? primaryHandoff.summary
                    : "Stay in Front Office until negotiation, application, offer, or contract work needs a formal, auditable file.",
                  meta: (
                    <span>
                      {primaryHandoff
                        ? primaryHandoff.updatedAtLabel
                        : "Use Back Office only when the work becomes formal, auditable, or finance-driven."}
                    </span>
                  ),
                  actions: [primaryHandoffAction],
                },
              ]}
            />

            <div className="front-office-placeholder-note">
              <strong>Execution chain</strong>
              <p>
                Open the matching dossier block first. Use the second jump only
                when the work needs calendar scheduling, listing output, or the
                shared Back Office record.
              </p>
            </div>

            <div className="office-queue-list">
              {snapshot.nextStepRail.items.map((item) => (
                <QueueItem
                  action={
                    <FrontOfficeClientActionGroup
                      actions={buildRailItemActions(item)}
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
              <QueueItem
                action={
                  <FrontOfficeClientActionGroup
                    actions={[followUpCueAction]}
                  />
                }
                badgeLabel={snapshot.followUpCue.label}
                badgeTone={snapshot.followUpCue.tone}
                context={snapshot.followUpCue.dueLabel}
                description={snapshot.followUpCue.description}
                meta={<span>{snapshot.nextTouchLabel}</span>}
                title="Follow-up cue"
              />
              <QueueItem
                badgeLabel={snapshot.workflow.pressureLabel}
                badgeTone={snapshot.workflow.pressureTone}
                description={snapshot.workflow.pressureDescription}
                meta={<span>{snapshot.workflow.nextStepDescription}</span>}
                title={snapshot.workflow.nextStepTitle}
              />
              <QueueItem
                action={
                  <FrontOfficeClientActionGroup
                    actions={[
                      snapshot.email
                        ? {
                            href: `mailto:${snapshot.email}`,
                            label: "Email client",
                          }
                        : {
                            href: null,
                            label: "",
                          },
                      snapshot.phone
                        ? {
                            href: `tel:${snapshot.phone}`,
                            label: "Call client",
                          }
                        : {
                            href: null,
                            label: "",
                          },
                    ]}
                  />
                }
                badgeLabel="Contact"
                badgeTone="neutral"
                description={
                  [snapshot.phone ? `Phone: ${snapshot.phone}` : "", snapshot.email ? `Email: ${snapshot.email}` : ""]
                    .filter(Boolean)
                    .join(" · ") || "No direct contact info on record yet."
                }
                meta={<span>{snapshot.lastTouchLabel}</span>}
                title="Use the latest contact info"
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id={frontOfficeClientDossierSectionIds.backOfficeContext}
            subtitle="Once formal transaction work starts, Front Office should point into the shared BO record instead of duplicating it."
            title="Back Office context"
          >
            <FrontOfficeClientGuidanceQueue
              items={[
                {
                  key: "boundary",
                  label: snapshot.nextStepRail.decisionLabel,
                  tone: snapshot.nextStepRail.decisionTone,
                  title: "Front Office stays execution-first; Back Office stays formal",
                  description:
                    "Use this rail to see when the client is still in FO follow-up versus when the next step needs a formal, auditable BO record.",
                  meta: <span>{snapshot.nextStepRail.decisionMetaLabel}</span>,
                  actions: [primaryHandoffAction],
                },
                {
                  key: "fo-follow-up",
                  label: snapshot.followUpCue.label,
                  tone: snapshot.followUpCue.tone,
                  title: "Client-facing next touches still stay in Front Office",
                  description: primaryHandoff
                    ? "Even with a live formal record, calls, recap, confirmations, and relationship follow-up should keep moving from this dossier."
                    : "Do not open Back Office just to hold a reminder. Calls, texts, showings, and queue-based next touches still belong here until the work becomes formal.",
                  meta: <span>{snapshot.contract.handoff.summary}</span>,
                  actions: [followUpPrimaryAction],
                },
              ]}
            />

            <div className="office-queue-list">
              {snapshot.handoffs.length ? (
                snapshot.handoffs.map((handoff) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={handoff.href}
                      >
                        {handoff.statusLabel === "Committed"
                          ? "Open transaction"
                          : "Open create flow"}
                      </FrontOfficeLink>
                    }
                    badgeLabel={handoff.statusLabel}
                    badgeTone={handoff.tone}
                    description={handoff.summary}
                    key={handoff.id}
                    meta={<span>{handoff.updatedAtLabel}</span>}
                    title={handoff.stageLabel}
                  />
                ))
              ) : (
                <EmptyState
                  description="When this client reaches negotiation, offer, application, or contract-style stages, the BO handoff queue will show up here."
                  title="No Back Office handoff yet"
                />
              )}
            </div>

            <div className="office-queue-list">
              {snapshot.linkedTransactions.length ? (
                snapshot.linkedTransactions.map((transaction) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={transaction.href}
                      >
                        Open transaction
                      </FrontOfficeLink>
                    }
                    badgeLabel={transaction.statusLabel}
                    badgeTone="accent"
                    description={transaction.roleLabel}
                    key={transaction.id}
                    title={transaction.label}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/office/transactions"
                    >
                      Open Back Office
                    </Link>
                  }
                  description="Linked transaction records will appear here after the formal BO workflow begins."
                  title="No linked transactions"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip label="Stage" tone="accent" value={snapshot.stage} />
          <SummaryChip
            label="Boundary"
            tone="accent"
            value={snapshot.nextStepRail.decisionLabel}
          />
          <SummaryChip
            label="Pressure"
            value={snapshot.workflow.pressureLabel}
          />
          <SummaryChip
            label="Follow-up cue"
            tone="accent"
            value={snapshot.followUpCue.label}
          />
          <SummaryChip
            label="Lease reminder"
            tone={snapshot.leaseReminder.needsAttention ? "accent" : "default"}
            value={snapshot.leaseReminder.statusLabel}
          />
          <SummaryChip
            label="Open follow-up"
            value={snapshot.summary.openTaskCount}
          />
          <SummaryChip
            label="Upcoming appointments"
            value={snapshot.summary.upcomingAppointmentCount}
          />
          <SummaryChip
            label="BO handoffs"
            tone="accent"
            value={snapshot.summary.openHandoffCount}
          />
          <SummaryChip
            label="Negotiation"
            tone="accent"
            value={snapshot.negotiation.boundaryLabel}
          />
          <SummaryChip
            label="Contract support"
            tone="accent"
            value={snapshot.inspection.boundaryLabel}
          />
          <SummaryChip
            label="Closing"
            tone="accent"
            value={snapshot.closing.boundaryLabel}
          />
          {canUseAi ? (
            <SummaryChip
              label="AI next touch"
              value={snapshot.aiSuggestions.statusLabel}
            />
          ) : null}
        </>
      }
      title={snapshot.fullName}
    />
  );
}
