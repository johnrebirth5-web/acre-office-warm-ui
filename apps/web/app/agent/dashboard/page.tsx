import { can, getDefaultAppPath } from "@acre/auth";
import Link from "next/link";
import {
  getFrontOfficeClientsSnapshot,
  getFrontOfficeDashboardSnapshot,
  type FrontOfficeClientsSnapshot,
  type FrontOfficeDashboardSnapshot,
  type FrontOfficeDashboardTone,
} from "@acre/db";
import {
  Badge,
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeDashboardAiQueueClient } from "./front-office-dashboard-ai-queue-client";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../lib/auth-session";

const intakeReviewStages = new Set([
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Pending",
]);

function getClientReviewActionLabel(stage: string) {
  return intakeReviewStages.has(stage)
    ? "Continue intake review"
    : "Open client workspace";
}

type ClientWorkbenchView =
  | "all"
  | "follow_first"
  | "anchor_now"
  | "viewing_lane"
  | "boundary_review"
  | "duplicate_review";

function buildClientWorkbenchHref(
  clientView: ClientWorkbenchView,
  hash?: string,
) {
  return `/agent/clients?clientView=${clientView}${hash ? `#${hash}` : ""}`;
}

function getDashboardQueueAction(input: {
  actionId: string;
  href: string;
  actionLabel: string;
  count: number;
  canViewClients: boolean;
}) {
  if (!input.canViewClients) {
    return {
      href: input.href,
      label: input.actionLabel,
    };
  }

  if (input.actionId === "follow-up" && input.href === "/agent/clients") {
    return {
      href:
        input.count === 1
          ? buildClientWorkbenchHref("anchor_now")
          : buildClientWorkbenchHref("follow_first"),
      label: input.count === 1 ? "Anchor now" : "Open follow-first queue",
    };
  }

  if (input.actionId === "lease-reminders" && input.href === "/agent/clients") {
    return {
      href:
        input.count === 1
          ? buildClientWorkbenchHref("anchor_now")
          : buildClientWorkbenchHref("viewing_lane"),
      label: input.count === 1 ? "Anchor lease now" : "Open lease lane",
    };
  }

  return {
    href: input.href,
    label: input.actionLabel,
  };
}

type DashboardLaunchpadItem = {
  id: string;
  badgeLabel: string;
  badgeTone: FrontOfficeDashboardTone;
  title: string;
  description: string;
  metaLabel: string;
  href: string;
  actionLabel: string;
  opensInNewTab?: boolean;
};

function getLaunchpadStepContext(index: number) {
  return index === 0
    ? "Step 1 · Do this first"
    : `Step ${index + 1} · Keep moving`;
}

function formatTodayActionLabel(count: number) {
  return count === 1
    ? "1 action needs attention today"
    : `${count} actions need attention today`;
}

function getDashboardCommandLeadText(input: {
  snapshot: FrontOfficeDashboardSnapshot;
  primaryLaunchpadItem: DashboardLaunchpadItem | null;
}) {
  if (
    input.snapshot.leadershipQueue.visible &&
    input.snapshot.summary.leadershipPressureCount > 0
  ) {
    return `${input.snapshot.leadershipQueue.scopeLabel} is the command lead right now. Clear it first, then work the ordered launchpad below so the next grounded move, appointment work, send-risk follow-through, and duplicate review stay in command order.`;
  }

  if (input.primaryLaunchpadItem) {
    return `${input.primaryLaunchpadItem.title} is the command lead right now. Work the ordered launchpad below so the next move stays in sequence.`;
  }

  return "No lane is elevated above the rest right now. Keep the live queue and intake assist in view until a grounded next move appears.";
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getDashboardRoleFocus(role: string) {
  switch (role) {
    case "team_lead":
      return {
        label: "Team command deck",
        description:
          "Clear visible team cleanup first, then keep follow-up, appointment writeback, send-trail follow-through, and formal handoff on the same Front Office command surface.",
      };
    case "owner":
    case "office_admin":
      return {
        label: "Office command deck",
        description:
          "Keep office execution pressure visible here, then move only truly formal work into Back Office once the package is genuinely ready.",
      };
    default:
      return {
        label: "Agent execution deck",
        description:
          "Start with the next grounded touch, then work lease timing, commitments, send/click follow-through, and formal handoffs without leaving Front Office early.",
      };
  }
}

function buildDashboardLaunchpadItems(input: {
  snapshot: FrontOfficeDashboardSnapshot;
  clientsSnapshot: FrontOfficeClientsSnapshot | null;
  canUseAi: boolean;
  canViewClients: boolean;
  viewerRole: string;
}) {
  const items: DashboardLaunchpadItem[] = [];
  const seen = new Set<string>();
  const addItem = (item: DashboardLaunchpadItem | null) => {
    if (!item || seen.has(item.id)) {
      return;
    }

    seen.add(item.id);
    items.push(item);
  };
  const leadingCommitment = input.snapshot.commitments.items[0] ?? null;
  const leadingLeaseReminder = input.snapshot.leaseReminders.items[0] ?? null;
  const leadingAiItem = input.snapshot.aiQueue.items[0] ?? null;
  const leadingEngagement =
    input.snapshot.listingOutput.recentEngagement[0] ?? null;
  const leadingBackOfficeItem = input.snapshot.backOffice.items[0] ?? null;
  const leadingLeadershipItem = input.snapshot.leadershipQueue.items[0] ?? null;
  const actionQueueById = new Map(
    input.snapshot.actionQueue.map((item) => [item.id, item] as const),
  );
  const followUpLead =
    input.snapshot.pipeline.recentClients.find(
      (client) =>
        client.nextTouchLabel.includes("Due") ||
        client.nextTouchLabel.includes("Overdue"),
    ) ??
    input.snapshot.pipeline.recentClients[0] ??
    null;
  const followUpAction = actionQueueById.get("follow-up") ?? null;
  const commitmentAction = actionQueueById.get("commitments") ?? null;
  const leaseAction = actionQueueById.get("lease-reminders") ?? null;
  const handoffAction = actionQueueById.get("handoff") ?? null;
  const leadershipAction = actionQueueById.get("leadership") ?? null;

  if (
    input.snapshot.leadershipQueue.visible &&
    input.snapshot.summary.leadershipPressureCount > 0
  ) {
    addItem({
      id: "leadership",
      badgeLabel:
        input.viewerRole === "team_lead" ? "Team cleanup" : "Office cleanup",
      badgeTone: "danger",
      title: "Open cleanup command center",
      description: leadingLeadershipItem
        ? `${leadingLeadershipItem.title} is the clearest pressure point right now. ${leadingLeadershipItem.whyNowLabel}`
        : "Leadership cleanup is already visible in Front Office, so missed follow-up and quiet send trails do not hide behind Back Office work.",
      metaLabel: leadershipAction
        ? `${input.snapshot.summary.leadershipPressureCount} visible cleanup signal(s) · ${leadershipAction.nextStepLabel}`
        : `${input.snapshot.summary.leadershipPressureCount} visible cleanup signal(s)`,
      href:
        leadershipAction?.href ??
        "/agent/notifications?activityView=team_cleanup#team-cleanup-pressure",
      actionLabel:
        leadershipAction?.actionLabel ?? "Open cleanup command center",
    });
  }

  if (
    input.snapshot.summary.followUpDueCount > 0 ||
    input.snapshot.summary.overdueTaskCount > 0
  ) {
    addItem({
      id: "follow-up",
      badgeLabel: "Do now",
      badgeTone: "warning",
      title: "Clear the live next-touch pressure",
      description: followUpLead
        ? `${followUpLead.fullName} is the clearest first touch. ${
            input.snapshot.summary.followUpDueCount > 0
              ? `${input.snapshot.summary.followUpDueCount} client touch(es) are already due today or overdue.`
              : `${input.snapshot.summary.overdueTaskCount} shared follow-up task(s) are already overdue.`
          } ${followUpAction?.whyNowLabel ?? ""}`.trim()
        : `${
            input.snapshot.summary.followUpDueCount > 0
              ? `${input.snapshot.summary.followUpDueCount} client touch(es) are already due today or overdue.`
              : `${input.snapshot.summary.overdueTaskCount} shared follow-up task(s) are already overdue.`
          }`,
      metaLabel: followUpAction
        ? followUpAction.nextStepLabel
        : input.snapshot.summary.overdueTaskCount > 0
          ? `${input.snapshot.summary.overdueTaskCount} overdue task(s) already sit in the shared follow-up clock`
          : "The shared follow-up clock still drives the next-touch order",
      href: followUpAction?.href ?? buildClientWorkbenchHref("follow_first"),
      actionLabel: followUpAction?.actionLabel ?? "Open follow-first queue",
    });
  }

  if (leadingLeaseReminder && input.snapshot.leaseReminders.dueCount > 0) {
    addItem({
      id: "lease-reminders",
      badgeLabel: leadingLeaseReminder.statusLabel,
      badgeTone: leadingLeaseReminder.tone,
      title: `Protect ${leadingLeaseReminder.clientName}'s lease window`,
      description: leaseAction
        ? `${leadingLeaseReminder.detailLabel} ${leaseAction.whyNowLabel}`
        : `${leadingLeaseReminder.detailLabel} Keep renewal, move, or remarketing timing visible before it slips into a last-minute scramble.`,
      metaLabel: leaseAction
        ? leaseAction.nextStepLabel
        : leadingLeaseReminder.reminderLabel,
      href: leaseAction?.href ?? leadingLeaseReminder.href,
      actionLabel: leaseAction?.actionLabel ?? "Open client dossier",
    });
  }

  if (input.snapshot.summary.todayCommitmentCount > 0) {
    addItem({
      id: "commitments",
      badgeLabel: "Today",
      badgeTone: "accent",
      title: "Open appointment workbench",
      description: leadingCommitment
        ? `${leadingCommitment.title} is already on the calendar. ${commitmentAction?.whyNowLabel ?? "Use the appointment workbench to confirm prep, follow-through, and any promised next touch before the start window."}`
        : `${input.snapshot.summary.todayCommitmentCount} appointment or office commitment(s) land today.`,
      metaLabel: commitmentAction
        ? commitmentAction.nextStepLabel
        : leadingCommitment
          ? `${leadingCommitment.startsAtLabel} · ${leadingCommitment.contextLabel}`
          : `${input.snapshot.summary.todayCommitmentCount} commitment(s) scheduled today`,
      href: commitmentAction?.href ?? "/agent/calendar",
      actionLabel:
        commitmentAction?.actionLabel ?? "Open appointment workbench",
    });
  }

  if (leadingBackOfficeItem) {
    addItem({
      id: "handoff",
      badgeLabel: "Boundary",
      badgeTone: leadingBackOfficeItem.tone,
      title: `Open ${leadingBackOfficeItem.title}'s formal workflow`,
      description: handoffAction
        ? `${leadingBackOfficeItem.description} ${handoffAction.whyNowLabel}`
        : `${leadingBackOfficeItem.description} Keep the FO -> BO boundary explicit and only open the formal record when the package is genuinely ready.`,
      metaLabel: handoffAction
        ? handoffAction.nextStepLabel
        : leadingBackOfficeItem.contextLabel,
      href: handoffAction?.href ?? leadingBackOfficeItem.href,
      actionLabel:
        handoffAction?.actionLabel ?? leadingBackOfficeItem.actionLabel,
    });
  }

  if (input.canUseAi && leadingAiItem) {
    addItem({
      id: "ai",
      badgeLabel: leadingAiItem.statusLabel,
      badgeTone: leadingAiItem.tone,
      title: `Review Acre's grounded next touch for ${leadingAiItem.clientName}`,
      description: `${leadingAiItem.description} Acre still waits for your approval. Nothing here auto-sends or hides automation behind the queue.`,
      metaLabel: leadingAiItem.helperLabel,
      href: leadingAiItem.primaryActionHref,
      actionLabel: leadingAiItem.primaryActionLabel,
      opensInNewTab: leadingAiItem.primaryActionOpensInNewTab,
    });
  }

  if (leadingEngagement) {
    addItem({
      id: "engagement",
      badgeLabel: leadingEngagement.engagementLabel,
      badgeTone: leadingEngagement.engagementTone,
      title: "Open send-risk workbench",
      description: `${leadingEngagement.listingTitle} already has tracked engagement context. Use the next-step rail to turn that open or quiet send into a concrete next step instead of sending blindly.`,
      metaLabel: `${leadingEngagement.channelLabel} · ${leadingEngagement.detailLabel}`,
      href: leadingEngagement.href,
      actionLabel: "Open next-step rail",
    });
  } else if (input.snapshot.listingOutput.activeListingCount > 0) {
    addItem({
      id: "listing-output",
      badgeLabel: "Send-ready",
      badgeTone: "success",
      title: "Open send-risk workbench",
      description: `${input.snapshot.listingOutput.activeListingCount} active or hot listing(s) are ready for outreach. You still choose the link and channel; Acre only records the execution trail after you send, and the next-step rail keeps the send-risk trail explicit.`,
      metaLabel:
        input.snapshot.listingOutput.trackedLinkCount > 0
          ? `${input.snapshot.listingOutput.trackedLinkCount} tracked link(s) already created`
          : "First tracked send starts from listing output",
      href: "/agent/listings?lane=draft-lane",
      actionLabel: "Open send-risk workbench",
    });
  }

  if (
    input.canViewClients &&
    (input.clientsSnapshot?.summary.potentialDuplicateCount ?? 0) > 0
  ) {
    addItem({
      id: "duplicate-review",
      badgeLabel: "Review",
      badgeTone: "warning",
      title: "Open duplicate review workbench",
      description: `${input.clientsSnapshot?.summary.potentialDuplicateCount ?? 0} potential duplicate pair(s) are already visible. Reopen the merge lane before more work lands so intake and follow-up stay on one surviving dossier.`,
      metaLabel: "Duplicate compare and merge stays in the client queue",
      href: buildClientWorkbenchHref("duplicate_review", "duplicate-review"),
      actionLabel: "Open duplicate review workbench",
    });
  }

  if (input.canViewClients) {
    addItem({
      id: "intake",
      badgeLabel: "Intake",
      badgeTone: "accent",
      title: "Capture the next lead with review-first intake",
      description:
        "Use intake assist when a live call, screenshot, or pasted chat needs to become a real dossier. Acre still waits for your review before anything is created, and it does not claim provider-backed ingestion or WeChat sync.",
      metaLabel: input.clientsSnapshot
        ? `${input.clientsSnapshot.summary.liveContacts} live contact(s) in your current scope`
        : "Field-level review and duplicate warnings stay in the card",
      href: "#dashboard-intake-launch",
      actionLabel: "Open intake assist",
    });
  }

  return items.slice(0, 4);
}

function buildDashboardHeroStats(input: {
  snapshot: FrontOfficeDashboardSnapshot;
  canUseAi: boolean;
}) {
  const followUpPressureCount = Math.max(
    input.snapshot.summary.followUpDueCount,
    input.snapshot.summary.overdueTaskCount,
  );
  const sendSignalValue = input.snapshot.listingOutput.recentEngagement.length
    ? input.snapshot.listingOutput.recentEngagement.length
    : input.snapshot.listingOutput.activeListingCount;
  const sendSignalLabel = input.snapshot.listingOutput.recentEngagement.length
    ? "Send signals"
    : "Send-ready listings";
  const sendSignalHint = input.snapshot.listingOutput.recentEngagement.length
    ? "tracked opens or quiet send trails worth working now"
    : "active inventory ready for tracked outreach";
  const stats = [
    ...(input.snapshot.leadershipQueue.visible
      ? [
          {
            label: "Leadership pressure",
            value: input.snapshot.summary.leadershipPressureCount,
            hint: "visible team or office cleanup signals",
            tone:
              input.snapshot.summary.leadershipPressureCount > 0
                ? ("accent" as const)
                : ("default" as const),
          },
        ]
      : []),
    {
      label: "Follow-up pressure",
      value: followUpPressureCount,
      hint: "due touches or overdue shared follow-up tasks",
      tone:
        followUpPressureCount > 0 ? ("accent" as const) : ("default" as const),
    },
    {
      label: "Today commitments",
      value: input.snapshot.summary.todayCommitmentCount,
      hint: "appointments or shared office commitments landing today",
      tone:
        input.snapshot.summary.todayCommitmentCount > 0
          ? ("accent" as const)
          : ("default" as const),
    },
    {
      label: sendSignalLabel,
      value: sendSignalValue,
      hint: sendSignalHint,
      tone: sendSignalValue > 0 ? ("accent" as const) : ("default" as const),
    },
    {
      label: "Needs Back Office",
      value: input.snapshot.summary.needsBackOfficeCount,
      hint: "records that now need formal workflow",
      tone:
        input.snapshot.summary.needsBackOfficeCount > 0
          ? ("accent" as const)
          : ("default" as const),
    },
  ];

  if (input.snapshot.summary.leaseReminderCount > 0) {
    stats.splice(2, 0, {
      label: "Lease reminders",
      value: input.snapshot.summary.leaseReminderCount,
      hint: "renewal or move windows already due soon",
      tone: "accent" as const,
    });
  }

  if (input.canUseAi) {
    stats.push({
      label: "AI suggestions",
      value: input.snapshot.summary.aiSuggestionCount,
      hint: "grounded next-touch ideas waiting for approval",
      tone:
        input.snapshot.summary.aiSuggestionCount > 0
          ? ("accent" as const)
          : ("default" as const),
    });
  }

  return stats;
}

function getActionLaneStatus(
  item: FrontOfficeDashboardSnapshot["actionQueue"][number],
) {
  if (item.count <= 0) {
    return {
      label: "Clear",
      tone: "neutral" as const,
    };
  }

  switch (item.id) {
    case "follow-up":
      return {
        label: "Do now",
        tone: item.tone,
      };
    case "commitments":
      return {
        label: "Today",
        tone: item.tone,
      };
    case "lease-reminders":
      return {
        label: item.tone === "danger" ? "Late" : "Upcoming",
        tone: item.tone,
      };
    case "content":
      return {
        label: item.tone === "warning" ? "Rescue" : "Signal",
        tone: item.tone,
      };
    case "handoff":
      return {
        label: "Boundary",
        tone: item.tone,
      };
    case "leadership":
      return {
        label: "Review",
        tone: item.tone,
      };
    default:
      return {
        label: "Active",
        tone: item.tone,
      };
  }
}

export default async function AgentDashboardPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const canUseAi = can(context.currentMembership, "ai:use");
  const canViewClients = can(context.currentMembership, "clients:view");
  const [snapshot, clientsSnapshot] = await Promise.all([
    getFrontOfficeDashboardSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      viewerRole: context.currentMembership.role,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
    canViewClients
      ? getFrontOfficeClientsSnapshot({
          organizationId: context.currentOrganization.id,
          viewerMembershipId: context.currentMembership.id,
          officeId: context.currentOffice?.id ?? null,
          timeZone: context.currentUser.timezone,
        })
      : Promise.resolve(null),
  ]);
  const duplicatePreviewCandidates: FrontOfficeLeadDuplicatePreviewCandidate[] =
    snapshot.pipeline.recentClients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      sourceLabel: client.source,
      nextTouchLabel: client.nextTouchLabel,
      href: client.href,
    }));
  const roleFocus = getDashboardRoleFocus(context.currentMembership.role);
  const launchpadItems = buildDashboardLaunchpadItems({
    snapshot,
    clientsSnapshot,
    canUseAi,
    canViewClients,
    viewerRole: context.currentMembership.role,
  });
  const primaryLaunchpadItem = launchpadItems[0] ?? null;
  const supportingLaunchpadItems = launchpadItems.slice(1);
  const heroStats = buildDashboardHeroStats({
    snapshot,
    canUseAi,
  });
  const todayActionCount = snapshot.summary.todayActionCount;
  const commandLeadText = getDashboardCommandLeadText({
    snapshot,
    primaryLaunchpadItem,
  });
  const leadershipCleanupHref =
    "/agent/notifications?activityView=team_cleanup#team-cleanup-pressure";
  const activityCenterHref = snapshot.leadershipQueue.visible
    ? leadershipCleanupHref
    : "/agent/notifications?activityView=personal_cleanup#personal-cleanup-pressure";
  const resourcePulse = snapshot.noticeRail.resourcePulse;
  const resourcePulseComparisonLabel =
    resourcePulse.comparisonWindowLabel.toLowerCase();
  const listingSummaryChip =
    snapshot.listingOutput.engagedClientCount > 0
      ? {
          label: "Engaged clients",
          value: snapshot.listingOutput.engagedClientCount,
        }
      : {
          label: "Send-ready listings",
          value: snapshot.listingOutput.activeListingCount,
        };
  const executionOrder = snapshot.actionQueue
    .filter((item) => item.count > 0)
    .slice(0, 4);
  const honestStateText = canUseAi
    ? "Acre surfaces live follow-up, tracked send/click history, review-first AI suggestions, and explicit FO -> BO handoff. It still does not auto-send, hide automation, own two-way sync, or claim provider-backed / WeChat ingestion."
    : "Acre surfaces live follow-up, tracked send/click history, and explicit FO -> BO handoff. It still does not auto-send, hide automation, own two-way sync, or claim provider-backed / WeChat ingestion.";
  const primaryLaneLabel =
    executionOrder[0]?.label ??
    (canViewClients ? "Intake assist" : "Activity center");

  return (
    <FrontOfficePageTemplate
      description={roleFocus.description}
      eyebrow="Front Office"
      headerClassName="front-office-dashboard-header"
      layoutClassName="front-office-dashboard-layout"
      summaryClassName="front-office-dashboard-summary"
      main={
        <>
          <SectionCard
            className="office-list-card"
            actions={
              <>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={activityCenterHref}
                >
                  {snapshot.leadershipQueue.visible
                    ? "Open cleanup command center"
                    : "Open activity center"}
                </FrontOfficeLink>
                {canViewClients ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildClientWorkbenchHref("follow_first")}
                  >
                    Open follow-first queue
                  </FrontOfficeLink>
                ) : null}
              </>
            }
            subtitle={`${roleFocus.label}. Clear the command lead first, then work the ordered launchpad so cleanup command center, appointment writeback, send-risk follow-through, and duplicate review stay in command order.`}
            title="Front Office command deck"
          >
            <ListPageStatsGrid>
              {heroStats.map((stat) => (
                <StatCard
                  hint={stat.hint}
                  key={stat.label}
                  label={stat.label}
                  tone={stat.tone}
                  value={stat.value}
                />
              ))}
            </ListPageStatsGrid>

            <div className="front-office-placeholder-note">
              <Badge tone={primaryLaunchpadItem?.badgeTone ?? "accent"}>
                {todayActionCount > 0
                  ? formatTodayActionLabel(todayActionCount)
                  : primaryLaunchpadItem
                    ? "Command lead"
                    : "Queue check"}
              </Badge>
              <p>
                {`${todayActionCount > 0 ? `${formatTodayActionLabel(todayActionCount)}. ` : ""}${commandLeadText}`}
              </p>
              <div className="list-row-meta front-office-record-meta">
                {executionOrder.length ? (
                  executionOrder.map((item, index) => (
                    <span key={item.id}>
                      {getLaunchpadStepContext(index)} · {item.label} ·{" "}
                      {item.sequenceLabel} · {item.nextStepLabel}
                    </span>
                  ))
                ) : (
                  <span>No lane is currently elevated above the rest.</span>
                )}
              </div>
            </div>

            <div className="front-office-placeholder-note">
              <Badge tone="neutral">Honest state</Badge>
              <p>{honestStateText}</p>
            </div>

            {primaryLaunchpadItem ? (
              <div className="office-queue-list">
                <FrontOfficeRailItem
                  action={
                    primaryLaunchpadItem.opensInNewTab ? (
                      <a
                        className="office-inline-link front-office-inline-link"
                        href={primaryLaunchpadItem.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {primaryLaunchpadItem.actionLabel}
                      </a>
                    ) : (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={primaryLaunchpadItem.href}
                      >
                        {primaryLaunchpadItem.actionLabel}
                      </FrontOfficeLink>
                    )
                  }
                  badgeLabel={primaryLaunchpadItem.badgeLabel}
                  badgeTone={primaryLaunchpadItem.badgeTone}
                  context={getLaunchpadStepContext(0)}
                  description={primaryLaunchpadItem.description}
                  meta={<span>{primaryLaunchpadItem.metaLabel}</span>}
                  title={primaryLaunchpadItem.title}
                />
              </div>
            ) : null}

            {supportingLaunchpadItems.length ? (
              <div className="office-queue-list">
                {supportingLaunchpadItems.map((item, index) => (
                  <FrontOfficeRailItem
                    action={
                      item.opensInNewTab ? (
                        <a
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.actionLabel}
                        </a>
                      ) : (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      )
                    }
                    badgeLabel={item.badgeLabel}
                    badgeTone={item.badgeTone}
                    context={getLaunchpadStepContext(index + 1)}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))}
              </div>
            ) : null}
          </SectionCard>

          {clientsSnapshot ? (
            <SectionCard
              className="office-list-card"
              subtitle="Use this after you clear the live pressure above. Intake stays review-first: duplicate warnings are visible, OCR / transcript assist does not auto-create anything, and Acre is not claiming provider-backed ingestion or WeChat integration."
              title="Intake assist when you are ready to capture new work"
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="live Front Office dossiers visible in your current client scope"
                  label="Live contacts"
                  value={clientsSnapshot.summary.liveContacts}
                />
                <StatCard
                  hint="same-day or overdue next-touch markers already visible in the client queue"
                  label="Follow-up due"
                  tone="accent"
                  value={clientsSnapshot.summary.followUpDueCount}
                />
                <StatCard
                  hint="pairwise duplicate review suggestions currently waiting in the client list"
                  label="Duplicate review"
                  tone="accent"
                  value={clientsSnapshot.summary.potentialDuplicateCount}
                />
                <StatCard
                  hint="scheduled follow-up tasks already overdue in your current scope"
                  label="Overdue tasks"
                  value={clientsSnapshot.summary.overdueTaskCount}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list">
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href="#dashboard-intake-launch"
                    >
                      Open intake assist
                    </FrontOfficeLink>
                  }
                  badgeLabel="Assist"
                  badgeTone="accent"
                  context="Dashboard launch"
                  description="Start a new capture here or reopen the assist card below to finish any screenshot or transcript suggestions that are still pending review before create."
                  meta={<span>Create only uses the live form values.</span>}
                  title="Continue intake assist review"
                />
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={buildClientWorkbenchHref("all")}
                    >
                      Open all clients
                    </FrontOfficeLink>
                  }
                  badgeLabel="Clients"
                  badgeTone="accent"
                  context={`${clientsSnapshot.summary.liveContacts} live contact(s)`}
                  description="Jump into the full client list when you need the stage view, next-touch ordering, and the real queue for continuing review across existing dossiers."
                  meta={
                    <span>
                      {clientsSnapshot.summary.followUpDueCount} follow-up
                      item(s) are already due there.
                    </span>
                  }
                  title="Review the live client queue"
                />
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={buildClientWorkbenchHref(
                        "duplicate_review",
                        "duplicate-review",
                      )}
                    >
                      Open duplicate review workbench
                    </FrontOfficeLink>
                  }
                  badgeLabel={
                    clientsSnapshot.summary.potentialDuplicateCount > 0
                      ? "Review"
                      : "Clear"
                  }
                  badgeTone={
                    clientsSnapshot.summary.potentialDuplicateCount > 0
                      ? "warning"
                      : "neutral"
                  }
                  context={
                    clientsSnapshot.summary.potentialDuplicateCount > 0
                      ? `${clientsSnapshot.summary.potentialDuplicateCount} pair(s) waiting`
                      : "No pairwise duplicates in view"
                  }
                  description="Keep create-time duplicate warnings review-first: the dedicated lane in the client list is still the place to compare dossiers before you merge anything."
                  meta={
                    <span>Duplicate review stays in the client queue.</span>
                  }
                  title="Follow the duplicate cue"
                />
              </div>

              {clientsSnapshot.duplicatePairs.length ? (
                <div className="office-queue-list">
                  {clientsSnapshot.duplicatePairs.slice(0, 2).map((pair) => (
                    <FrontOfficeRailItem
                      action={
                        <>
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={pair.recommendedClient.href}
                          >
                            Review keep record
                          </FrontOfficeLink>
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={buildClientWorkbenchHref(
                              "duplicate_review",
                              "duplicate-review",
                            )}
                          >
                            Open duplicate review workbench
                          </FrontOfficeLink>
                        </>
                      }
                      badgeLabel={
                        pair.matchReasons.length >= 2
                          ? "High overlap"
                          : "Review first"
                      }
                      badgeTone={
                        pair.matchReasons.length >= 2 ? "warning" : "accent"
                      }
                      context={pair.matchReasons.join(" · ")}
                      description={pair.rationaleLabel}
                      key={pair.id}
                      meta={
                        <>
                          <span>{pair.recommendedClient.nextTouchLabel}</span>
                          <span>{pair.duplicateClient.nextTouchLabel}</span>
                        </>
                      }
                      title={`${pair.recommendedClient.fullName} <> ${pair.duplicateClient.fullName}`}
                    />
                  ))}
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          <div id="dashboard-intake-launch">
            <FrontOfficeLeadIntakeCard
              density="compact"
              hydrateDuplicatePreviewCandidates
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="dashboard"
              subtitle="Open a new lead capture only when the live queue above is under control, or reopen screenshot / transcript suggestions that still need review. The card keeps confidence, provenance, and duplicate warnings visible before anything touches the live form."
              title="Review-first intake assist"
            />
          </div>

          <SectionCard
            className="office-list-card"
            subtitle="Work these lanes in command order. Each row is a grounded next move that Acre can already see; if a specific record is linked, open it, and if not, reopen the shared queue."
            title="Today execution lanes"
          >
            <div className="front-office-placeholder-note">
              <Badge tone="accent">Command order</Badge>
              <p>
                Front Office keeps the live execution clock here. Back Office
                starts only when the row explicitly points to a formal handoff
                or signature workflow, not when the move is still grounded in
                the active dossier.
              </p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.actionQueue.map((item) => {
                const action = getDashboardQueueAction({
                  actionId: item.id,
                  href: item.href,
                  actionLabel: item.actionLabel,
                  count: item.count,
                  canViewClients,
                });
                const laneStatus = getActionLaneStatus(item);

                return (
                  <article
                    className={`list-row front-office-record tone-${item.tone}`}
                    key={item.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge tone={laneStatus.tone}>
                        {laneStatus.label}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{item.count} item(s)</span>
                      <span>{item.sequenceLabel}</span>
                      <span>{item.helper}</span>
                      <span>{item.whyNowLabel}</span>
                      <span>{item.nextStepLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={action.href}
                    >
                      {action.label}
                    </FrontOfficeLink>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          {canUseAi ? (
            <SectionCard
              className="office-list-card"
              subtitle="Grounded next-touch suggestions only. The queue should reopen a dossier, a calendar writeback, or a formal handoff only when the record trail can support it."
              title="AI next-touch queue"
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="grounded AI suggestion opportunities currently visible in this dashboard scope"
                  label="AI suggestions"
                  tone="accent"
                  value={snapshot.aiQueue.suggestionCount}
                />
              </ListPageStatsGrid>

              <FrontOfficeDashboardAiQueueClient
                items={snapshot.aiQueue.items}
              />
            </SectionCard>
          ) : null}

          {canUseAi ? (
            <SectionCard
              className="office-list-card"
              subtitle="Use this trust layer to see what happened after you accepted a suggestion: which action became a real follow-up or tracked send, and which ones still need help."
              title="AI accepted actions & outcomes"
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="accepted AI follow-up or tracked-send actions in your current dashboard scope"
                  label="Accepted actions"
                  value={snapshot.aiAcceptedActions.acceptedCount}
                />
                <StatCard
                  hint="accepted actions that already turned into a completed follow-up or tracked open"
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
                    <FrontOfficeRailItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      }
                      badgeLabel={item.statusLabel}
                      badgeTone={item.statusTone}
                      context={`${item.clientName} · ${item.contextLabel}`}
                      description={item.description}
                      key={item.id}
                      meta={<span>{item.helperLabel}</span>}
                      title={item.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    description="Once you accept dashboard or dossier AI suggestions, the resulting task and tracked-send outcomes will roll up here."
                    title="No accepted AI actions yet"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            actions={
              canViewClients ? (
                <>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildClientWorkbenchHref("all")}
                  >
                    Open all clients
                  </FrontOfficeLink>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildClientWorkbenchHref(
                      "duplicate_review",
                      "duplicate-review",
                    )}
                  >
                    Open duplicate review workbench
                  </FrontOfficeLink>
                </>
              ) : undefined
            }
            subtitle="Use this as a fast command map for dossiers that still need operator judgment. Full cleanup, merge, and detailed review still stay in the client workspace."
            title="Live client queue"
          >
            <ListPageStatsGrid>
              {snapshot.pipeline.stageMetrics.length ? (
                snapshot.pipeline.stageMetrics.map((metric) => (
                  <StatCard
                    className="front-office-stage-card"
                    hint="clients in this stage"
                    key={metric.label}
                    label={metric.label}
                    tone={
                      metric.tone === "accent" || metric.tone === "success"
                        ? "accent"
                        : "default"
                    }
                    value={metric.count}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Start with intake assist or the client queue. Stage distribution appears once live dossiers are moving in this scope."
                  title="No client stages yet"
                />
              )}
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.pipeline.recentClients.length ? (
                snapshot.pipeline.recentClients.map((client) => (
                  <article
                    className="list-row front-office-record"
                    key={client.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{client.fullName}</strong>
                        <p>{client.source}</p>
                      </div>
                      <StatusBadge tone={client.stageTone}>
                        {client.stage}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{client.nextTouchLabel}</span>
                      <span>{client.lastTouchLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={client.href}
                    >
                      {getClientReviewActionLabel(client.stage)}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="#dashboard-intake-launch"
                    >
                      Open intake assist
                    </Link>
                  }
                  description="When client activity starts flowing into the shared CRM, the latest active records will appear here."
                  title="No active client records"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Appointments and shared office commitments stay in one FO calendar view. Google, Outlook, ICS, and email remain explicit bridge actions, not two-way sync."
            title="Calendar & commitments"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="visible today or upcoming in scope"
                label="Upcoming commitments"
                value={snapshot.commitments.items.length}
              />
              <StatCard
                hint={
                  snapshot.commitments.appointmentModuleReady
                    ? "agent scheduling is live"
                    : "not live yet"
                }
                label="Appointment module"
                value={
                  snapshot.commitments.appointmentModuleReady
                    ? "Live"
                    : "In progress"
                }
              />
            </ListPageStatsGrid>

            <div className="front-office-placeholder-note">
              <Badge tone="accent">Bridge actions stay explicit</Badge>
              <p>
                {snapshot.commitments.appointmentMessage} Acre can log the
                scheduling path and external follow-up state here, but it is not
                pretending to own a hidden calendar sync.
              </p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.commitments.items.length ? (
                snapshot.commitments.items.map((commitment) => (
                  <article
                    className="list-row front-office-record"
                    key={commitment.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{commitment.title}</strong>
                        <p>{commitment.startsAtLabel}</p>
                      </div>
                      <StatusBadge tone={commitment.badgeTone}>
                        {commitment.badgeLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{commitment.locationLabel}</span>
                      <span>{commitment.contextLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={commitment.href}
                    >
                      {commitment.actionLabel}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/agent/calendar"
                    >
                      Open calendar
                    </Link>
                  }
                  description="Nothing is on deck yet. Use the calendar to stage the next appointment or promised follow-up."
                  title="No commitments scheduled"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Tracked sends, opens, and quiet links should help you decide the next touch. The send-risk workbench keeps the next-step rail explicit; Acre records the execution trail after you send and does not auto-send or silently rescue the thread for you."
            title="Send-risk workbench"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="active or hot listings in scope"
                label="Send-ready listings"
                value={snapshot.listingOutput.activeListingCount}
              />
              <StatCard
                hint="tracked links already created by you"
                label="Tracked links"
                value={snapshot.listingOutput.trackedLinkCount}
              />
              <StatCard
                hint="clicks recorded on your tracked links"
                label="Tracked clicks"
                value={snapshot.listingOutput.trackedClickCount}
              />
              <StatCard
                hint="client-linked sends recorded from Front Office"
                label="Client sends"
                value={snapshot.listingOutput.sendRecordCount}
              />
              <StatCard
                hint="send records that have at least one open"
                label="Opened sends"
                value={snapshot.listingOutput.openedSendCount}
              />
              <StatCard
                hint="unique clients who opened at least one send"
                label="Engaged clients"
                value={snapshot.listingOutput.engagedClientCount}
              />
              <StatCard
                hint={
                  snapshot.listingOutput.trackedSendingReady
                    ? "existing share links are already producing engagement"
                    : "listing outreach can start as soon as share links are created"
                }
                label="Tracked sending"
                value={
                  snapshot.listingOutput.trackedSendingReady
                    ? "Active"
                    : "Ready"
                }
                tone="accent"
              />
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.listingOutput.recentListings.length ? (
                snapshot.listingOutput.recentListings.map((listing) => (
                  <article
                    className="list-row front-office-record"
                    key={listing.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{listing.title}</strong>
                        <p>{listing.neighborhoodLabel}</p>
                      </div>
                      <StatusBadge tone={listing.statusTone}>
                        {listing.statusLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{listing.priceLabel}</span>
                      <span>{listing.trackedLinkCount} tracked link(s)</span>
                      <span>{listing.trackedClickCount} click(s)</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={listing.href}
                    >
                      Open listings
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/agent/listings?lane=draft-lane"
                    >
                      Open send-risk workbench
                    </Link>
                  }
                  description="Active listings will appear here once inventory is available in the shared listing model."
                  title="No listing inventory in scope"
                />
              )}
            </div>

            <div className="front-office-placeholder-note">
              <strong>How to read this lane</strong>
              <p>
                Client-linked sends turn tracked links into real execution
                history, so you can see who received what, whether they opened
                it, and where the next touch still needs agent judgment instead
                of hidden automation.
              </p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.listingOutput.recentEngagement.length ? (
                snapshot.listingOutput.recentEngagement.map((record) => (
                  <article
                    className="list-row front-office-record"
                    key={record.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{record.clientName}</strong>
                        <p>{record.listingTitle}</p>
                      </div>
                      <StatusBadge tone={record.engagementTone}>
                        {record.engagementLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{record.channelLabel}</span>
                      <span>{record.sentAtLabel}</span>
                      <span>{record.stageLabel}</span>
                      {record.appointmentLabel ? (
                        <span>{record.appointmentLabel}</span>
                      ) : null}
                      <span>{record.detailLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={record.href}
                    >
                      Open next-step rail
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/agent/listings?lane=draft-lane"
                    >
                      Open send-risk workbench
                    </Link>
                  }
                  description="Start from listing output or a client dossier to create the first client-linked send record. Opens and revisits will show here after that."
                  title="No client-linked sends yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These items now need formal transactions, signatures, or auditable document flow. Front Office should tee up the work, then hand off deliberately instead of pretending the formal file already exists."
            title="Front Office -> Back Office boundary"
          >
            <div className="list-column front-office-record-list">
              {snapshot.backOffice.items.length ? (
                snapshot.backOffice.items.map((item) => (
                  <article
                    className={`list-row front-office-record tone-${item.tone}`}
                    key={item.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge tone={item.tone}>
                        {item.contextLabel}
                      </StatusBadge>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href={
                        canViewClients
                          ? buildClientWorkbenchHref("all")
                          : activityCenterHref
                      }
                    >
                      {canViewClients
                        ? "Stay in all clients"
                        : "Open activity center"}
                    </Link>
                  }
                  description="Nothing needs a formal BO file right now. Keep working the live FO queue until a package, signature, or transaction truly needs auditable ownership."
                  title="Nothing waiting for formal workflow"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      pageClassName="front-office-dashboard-page"
      rail={
        <>
          {snapshot.leadershipQueue.visible ? (
            <SectionCard
              className="office-list-card"
              actions={
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={leadershipCleanupHref}
                >
                  Open cleanup command center
                </FrontOfficeLink>
              }
              subtitle="Use this command lane to scan overdue tasks, stale clients, and quiet send trails before anyone has to jump into a direct office record."
              title={snapshot.leadershipQueue.scopeLabel}
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="open shared follow-up tasks already overdue"
                  label="Overdue tasks"
                  value={snapshot.leadershipQueue.overdueTaskCount}
                />
                <StatCard
                  hint="active clients with 15+ days of inactivity"
                  label="15+ day stale"
                  value={snapshot.leadershipQueue.staleClientCount}
                />
                <StatCard
                  hint="latest tracked sends that were never opened or have gone quiet"
                  label="Send-trail risk"
                  value={snapshot.leadershipQueue.engagementRiskCount}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list">
                {snapshot.leadershipQueue.items.length ? (
                  snapshot.leadershipQueue.items.map((item) => (
                    <FrontOfficeRailItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      }
                      badgeLabel={item.contextLabel}
                      badgeTone={item.tone}
                      description={item.description}
                      key={item.id}
                      meta={
                        <>
                          <span>{item.ownerLabel}</span>
                          <span>{item.pressureLabel}</span>
                          <span>{item.whyNowLabel}</span>
                          <span>{item.nextStepLabel}</span>
                        </>
                      }
                      title={item.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="No overdue task, stale-client, or quiet send-trail pressure is visible right now."
                    title="Leadership queue is clear"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={activityCenterHref}
              >
                {snapshot.leadershipQueue.visible
                  ? "Open cleanup command center"
                  : "Open activity center"}
              </FrontOfficeLink>
            }
            subtitle="Shared office alerts and personal notice links that help you clear today's queue without leaving the Front Office command deck."
            title="Activity & notices"
          >
            <div className="office-queue-list">
              {snapshot.noticeRail.notifications.length ? (
                snapshot.noticeRail.notifications.map((notification) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={notification.href}
                      >
                        Open notice
                      </FrontOfficeLink>
                    }
                    badgeLabel={notification.typeLabel}
                    badgeTone="accent"
                    description={notification.body}
                    key={notification.id}
                    meta={
                      <>
                        <span>{notification.createdAtLabel}</span>
                      </>
                    }
                    title={notification.title}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Nothing new is waiting in the notice rail. The activity center still carries personal cleanup and reminder pressure."
                  title="No current notices"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            actions={
              canViewClients ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={buildClientWorkbenchHref("viewing_lane")}
                >
                  Open lease lane
                </FrontOfficeLink>
              ) : undefined
            }
            subtitle="Lease renewal and remarketing windows should surface before they become a last-minute fire drill."
            title="Lease-date reminders"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="lease reminders due within the next two weeks"
                label="Due soon"
                value={snapshot.leaseReminders.dueCount}
              />
              <StatCard
                hint="lease reminders already past their target touch date"
                label="Overdue"
                value={snapshot.leaseReminders.overdueCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              {snapshot.leaseReminders.items.length ? (
                snapshot.leaseReminders.items.map((item) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={item.href}
                      >
                        Open client dossier
                      </FrontOfficeLink>
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.tone}
                    description={item.detailLabel}
                    key={item.id}
                    meta={<span>{item.reminderLabel}</span>}
                    title={item.clientName}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Lease-date reminders will appear here once clients start carrying renewal or move timing."
                  title="No lease reminders due"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href="/agent/resources"
              >
                Open resources
              </FrontOfficeLink>
            }
            subtitle="Published documents, templates, and playbooks stay one click away from the active execution queue."
            title="Training & documents"
          >
            <div className="office-queue-list">
              {snapshot.noticeRail.resources.length ? (
                snapshot.noticeRail.resources.map((resource) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={resource.href}
                      >
                        Open resource
                      </FrontOfficeLink>
                    }
                    badgeLabel={resource.typeLabel}
                    description={resource.summary}
                    key={resource.id}
                    title={resource.title}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Published FO resources will surface here once the shared library is populated."
                  title="No resources published"
                />
              )}
            </div>
          </SectionCard>

          {resourcePulse.visible ? (
            <SectionCard
              className="office-list-card"
              actions={
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href="/agent/resources#shared-adoption-pulse"
                >
                  Open shared pulse
                </FrontOfficeLink>
              }
              subtitle="Leadership should be able to see whether the shared Front Office library is actually being used across the visible bench, not only published."
              title={resourcePulse.scopeLabel}
            >
              <div
                className="office-summary-chip-row"
                style={{ marginBottom: "1rem" }}
              >
                <SummaryChip
                  label={`Tracked actions vs ${resourcePulseComparisonLabel}`}
                  tone={
                    resourcePulse.totalCountDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.totalCountDelta)}
                />
                <SummaryChip
                  label={`Active operators vs ${resourcePulseComparisonLabel}`}
                  tone={
                    resourcePulse.activeMembershipDelta > 0
                      ? "accent"
                      : undefined
                  }
                  value={formatSignedDelta(resourcePulse.activeMembershipDelta)}
                />
                <SummaryChip
                  label={`Resource opens vs ${resourcePulseComparisonLabel}`}
                  tone={
                    resourcePulse.resourceOpenDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.resourceOpenDelta)}
                />
                <SummaryChip
                  label={`Vendor clicks vs ${resourcePulseComparisonLabel}`}
                  tone={
                    resourcePulse.vendorClickDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.vendorClickDelta)}
                />
              </div>

              <ListPageStatsGrid>
                <StatCard
                  hint="members in the visible FO scope"
                  label="Visible members"
                  value={resourcePulse.visibleMembershipCount}
                />
                <StatCard
                  hint={resourcePulse.windowLabel.toLowerCase()}
                  label="Active members"
                  tone="accent"
                  value={resourcePulse.activeMembershipCount}
                />
                <StatCard
                  hint="tracked actions across the visible scope"
                  label="Tracked actions"
                  value={resourcePulse.totalCount}
                />
                <StatCard
                  hint="resource opens across the visible scope"
                  label="Resource opens"
                  value={resourcePulse.resourceOpenCount}
                />
                <StatCard
                  hint="vendor call, email, or site clicks"
                  label="Vendor clicks"
                  value={resourcePulse.vendorClickCount}
                />
                <StatCard
                  hint="latest shared tracked activity"
                  label="Last shared touch"
                  value={resourcePulse.lastInteractionLabel}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list" style={{ marginTop: "1rem" }}>
                {resourcePulse.topActors.length ? (
                  resourcePulse.topActors.slice(0, 2).map((actor) => (
                    <FrontOfficeRailItem
                      badgeLabel="Operator"
                      badgeTone="accent"
                      description={`${actor.label} logged ${actor.interactionCount} tracked action(s) in ${resourcePulse.windowLabel.toLowerCase()}.`}
                      key={actor.membershipId}
                      meta={
                        <>
                          <span>{resourcePulse.scopeLabel}</span>
                          <span>{actor.lastInteractionLabel}</span>
                        </>
                      }
                      title={actor.label}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="Tracked resource search, training progress, and vendor use will start surfacing here once the visible bench works this hub live."
                    title="No shared operator pulse yet"
                  />
                )}

                {resourcePulse.hottestTargets.slice(0, 2).map((target) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href="/agent/resources#shared-adoption-pulse"
                      >
                        Open shared pulse
                      </FrontOfficeLink>
                    }
                    badgeLabel={target.kindLabel}
                    description={`${target.interactionCount} tracked action(s) across ${resourcePulse.windowLabel.toLowerCase()}.`}
                    key={target.key}
                    meta={
                      <>
                        <span>{resourcePulse.scopeLabel}</span>
                        <span>{target.detailLabel}</span>
                      </>
                    }
                    title={target.title}
                  />
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="Operational shortcuts for vendors that agents need during client execution."
            title="Vendor shortcuts"
          >
            <div className="office-queue-list">
              {snapshot.noticeRail.vendors.length ? (
                snapshot.noticeRail.vendors.map((vendor) => (
                  <FrontOfficeRailItem
                    action={
                      vendor.href ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={vendor.href}
                        >
                          Contact vendor
                        </FrontOfficeLink>
                      ) : null
                    }
                    badgeLabel={vendor.category}
                    badgeTone="success"
                    description={vendor.headline}
                    key={vendor.id}
                    meta={
                      <>
                        <span>{vendor.contactLabel}</span>
                      </>
                    }
                    title={vendor.name}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Featured vendors for this office scope will appear here when the shared vendor directory is available."
                  title="No vendor shortcuts yet"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Office scope"
            value={
              context.currentOffice?.name ?? context.currentOrganization.name
            }
          />
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip label="Role focus" value={roleFocus.label} />
          <SummaryChip
            label="Today actions"
            tone="accent"
            value={todayActionCount}
          />
          <SummaryChip
            label="Command lead"
            tone="accent"
            value={primaryLaneLabel}
          />
          <SummaryChip
            label="Follow-up due"
            tone="accent"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label="Today commitments"
            value={snapshot.summary.todayCommitmentCount}
          />
          <SummaryChip
            label={listingSummaryChip.label}
            tone="accent"
            value={listingSummaryChip.value}
          />
          {snapshot.leadershipQueue.visible ? (
            <SummaryChip
              label="Leadership pressure"
              tone="accent"
              value={snapshot.summary.leadershipPressureCount}
            />
          ) : null}
          <SummaryChip
            label="Needs Back Office"
            tone="accent"
            value={snapshot.summary.needsBackOfficeCount}
          />
          {snapshot.summary.leaseReminderCount > 0 ? (
            <SummaryChip
              label="Lease reminders"
              tone="accent"
              value={snapshot.summary.leaseReminderCount}
            />
          ) : null}
          {canUseAi ? (
            <SummaryChip
              label="AI suggestions"
              tone="accent"
              value={snapshot.summary.aiSuggestionCount}
            />
          ) : null}
          {clientsSnapshot &&
          clientsSnapshot.summary.potentialDuplicateCount > 0 ? (
            <SummaryChip
              label="Duplicate review"
              tone="accent"
              value={clientsSnapshot.summary.potentialDuplicateCount}
            />
          ) : null}
          {clientsSnapshot ? (
            <SummaryChip
              label="Live contacts"
              value={clientsSnapshot.summary.liveContacts}
            />
          ) : null}
        </>
      }
      title="Front Office launchpad"
    />
  );
}
