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
import { getServerI18n } from "../../../lib/i18n/server";

const intakeReviewStages = new Set([
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Pending",
]);

function getClientReviewActionLabel(stage: string, isZh: boolean) {
  return intakeReviewStages.has(stage)
    ? isZh
      ? "继续录入复核"
      : "Continue intake review"
    : isZh
      ? "打开客户记录"
      : "Open client record";
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

function getDashboardQueueAction(
  input: {
    actionId: string;
    href: string;
    actionLabel: string;
    count: number;
    canViewClients: boolean;
  },
  isZh: boolean,
) {
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
      label:
        input.count === 1
          ? isZh
            ? "立即锚定"
            : "Anchor now"
          : isZh
            ? "打开优先跟进队列"
            : "Open follow-first queue",
    };
  }

  if (input.actionId === "lease-reminders" && input.href === "/agent/clients") {
    return {
      href:
        input.count === 1
          ? buildClientWorkbenchHref("anchor_now")
          : buildClientWorkbenchHref("viewing_lane"),
      label:
        input.count === 1
          ? isZh
            ? "立即锚定租约提醒"
            : "Anchor lease now"
          : isZh
            ? "打开租约提醒"
            : "Open lease reminders",
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

function getLaunchpadStepContext(index: number, isZh: boolean) {
  return index === 0
    ? isZh
      ? "步骤 1 · 先做这个"
      : "Step 1 · Do this first"
    : isZh
      ? `步骤 ${index + 1} · 继续推进`
      : `Step ${index + 1} · Keep moving`;
}

function formatTodayActionLabel(count: number, isZh: boolean) {
  return count === 1
    ? isZh
      ? "今天有 1 项动作需要关注"
      : "1 action needs attention today"
    : isZh
      ? `今天有 ${count} 项动作需要关注`
      : `${count} actions need attention today`;
}

function getDashboardCommandLeadText(
  input: {
    snapshot: FrontOfficeDashboardSnapshot;
    primaryLaunchpadItem: DashboardLaunchpadItem | null;
  },
  isZh: boolean,
) {
  if (
    input.snapshot.leadershipQueue.visible &&
    input.snapshot.summary.leadershipPressureCount > 0
  ) {
    return isZh
      ? `${input.snapshot.leadershipQueue.scopeLabel} 现在是当前的指挥重点。先把它清掉，再按下面的顺序处理启动板，这样下一步已落地动作、预约处理、发送风险跟进和重复记录审查都会保持在同一条指挥顺序里。`
      : `${input.snapshot.leadershipQueue.scopeLabel} is the top priority right now. Clear it first, then work the ordered list below so the next move, appointment follow-up, listing follow-up, and duplicate review stay in a clear order.`;
  }

  if (input.primaryLaunchpadItem) {
    return isZh
      ? `${input.primaryLaunchpadItem.title} 现在是当前的指挥重点。按下面的顺序处理启动板，让下一步动作保持节奏。`
      : `${input.primaryLaunchpadItem.title} is the top priority right now. Work the ordered list below so the next move stays in sequence.`;
  }

  return isZh
    ? "当前没有哪一项明显高于其他。先把实时队列和录入辅助保持在视野里，直到出现更明确的下一步。"
    : "Nothing stands clearly above the rest right now. Keep the live queue and intake assist in view until a clearer next move appears.";
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getDashboardRoleFocus(role: string, isZh: boolean) {
  switch (role) {
    case "team_lead":
      return {
        label: isZh ? "团队视图" : "Team view",
        description: isZh
          ? "先清掉当前可见的团队清理压力，再把跟进、预约回写、发送轨迹跟进和正式交接都放在同一个 Front Office 指挥面上处理。"
          : "Clear visible team cleanup first, then keep follow-up, appointment updates, listing follow-up, and formal handoff in one Front Office view.",
      };
    case "owner":
    case "office_admin":
      return {
        label: isZh ? "办公室视图" : "Office view",
        description: isZh
          ? "把办公室执行压力留在这里可见，只有当资料包真正准备好时，再把真正正式的工作移入 Back Office。"
          : "Keep office execution pressure visible here, then move only truly formal work into Back Office once the package is genuinely ready.",
      };
    default:
      return {
        label: isZh ? "经纪人视图" : "Agent view",
        description: isZh
          ? "先从下一个已落地的触达开始，再处理租约时点、约定事项、发送/点击后的跟进和正式交接，不要过早离开 Front Office。"
          : "Start with the next grounded touch, then work lease timing, commitments, send/click follow-through, and formal handoffs without leaving Front Office early.",
      };
  }
}

function buildDashboardLaunchpadItems(input: {
  snapshot: FrontOfficeDashboardSnapshot;
  clientsSnapshot: FrontOfficeClientsSnapshot | null;
  canUseAi: boolean;
  canViewClients: boolean;
  viewerRole: string;
  isZh: boolean;
}) {
  const { isZh } = input;
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
        input.viewerRole === "team_lead"
          ? isZh
            ? "团队清理"
            : "Team cleanup"
          : isZh
            ? "办公室清理"
            : "Office cleanup",
      badgeTone: "danger",
      title: isZh ? "打开清理列表" : "Open cleanup list",
      description: leadingLeadershipItem
        ? `${leadingLeadershipItem.title} is the clearest pressure point right now. ${leadingLeadershipItem.whyNowLabel}`
        : isZh
          ? "团队/办公室清理压力已经直接显示在 Front Office 里，所以漏掉的跟进和安静的分享不会被 Back Office 工作淹没。"
          : "Leadership cleanup is already visible in Front Office, so missed follow-up and quiet shares do not hide behind Back Office work.",
      metaLabel: leadershipAction
        ? `${input.snapshot.summary.leadershipPressureCount} visible cleanup signal(s) · ${leadershipAction.nextStepLabel}`
        : `${input.snapshot.summary.leadershipPressureCount} visible cleanup signal(s)`,
      href:
        leadershipAction?.href ??
        "/agent/notifications?activityView=team_cleanup#team-cleanup-pressure",
      actionLabel:
        leadershipAction?.actionLabel ??
        (isZh ? "打开清理列表" : "Open cleanup list"),
    });
  }

  if (
    input.snapshot.summary.followUpDueCount > 0 ||
    input.snapshot.summary.overdueTaskCount > 0
  ) {
    addItem({
      id: "follow-up",
      badgeLabel: isZh ? "现在处理" : "Do now",
      badgeTone: "warning",
      title: isZh
        ? "清掉实时下一触达压力"
        : "Clear the live next-touch pressure",
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
          : isZh
            ? "共享跟进时钟仍在驱动下一触达顺序"
            : "The shared follow-up clock still drives the next-touch order",
      href: followUpAction?.href ?? buildClientWorkbenchHref("follow_first"),
      actionLabel:
        followUpAction?.actionLabel ??
        (isZh ? "打开优先跟进队列" : "Open follow-first queue"),
    });
  }

  if (leadingLeaseReminder && input.snapshot.leaseReminders.dueCount > 0) {
    addItem({
      id: "lease-reminders",
      badgeLabel: leadingLeaseReminder.statusLabel,
      badgeTone: leadingLeaseReminder.tone,
      title: isZh
        ? `保护 ${leadingLeaseReminder.clientName} 的租约窗口`
        : `Protect ${leadingLeaseReminder.clientName}'s lease window`,
      description: leaseAction
        ? `${leadingLeaseReminder.detailLabel} ${leaseAction.whyNowLabel}`
        : isZh
          ? `${leadingLeaseReminder.detailLabel} 在续租、搬迁或重新挂牌变成临时救火前，先把时间窗口保持可见。`
          : `${leadingLeaseReminder.detailLabel} Keep renewal, move, or remarketing timing visible before it slips into a last-minute scramble.`,
      metaLabel: leaseAction
        ? leaseAction.nextStepLabel
        : leadingLeaseReminder.reminderLabel,
      href: leaseAction?.href ?? leadingLeaseReminder.href,
      actionLabel:
        leaseAction?.actionLabel ??
        (isZh ? "打开客户记录" : "Open client record"),
    });
  }

  if (input.snapshot.summary.todayCommitmentCount > 0) {
    addItem({
      id: "commitments",
      badgeLabel: isZh ? "今天" : "Today",
      badgeTone: "accent",
      title: isZh ? "打开日历" : "Open calendar",
      description: leadingCommitment
        ? `${leadingCommitment.title} ${
            commitmentAction?.whyNowLabel ??
            (isZh
              ? "已经在日历上了。打开日历，在开始前确认准备动作、后续跟进和任何承诺过的下一次触达。"
              : "is already on the calendar. Open the calendar to confirm prep, follow-through, and any promised next touch before the start window.")
          }`
        : `${input.snapshot.summary.todayCommitmentCount} appointment or office commitment(s) land today.`,
      metaLabel: commitmentAction
        ? commitmentAction.nextStepLabel
        : leadingCommitment
          ? `${leadingCommitment.startsAtLabel} · ${leadingCommitment.contextLabel}`
          : `${input.snapshot.summary.todayCommitmentCount} commitment(s) scheduled today`,
      href: commitmentAction?.href ?? "/agent/calendar",
      actionLabel:
        commitmentAction?.actionLabel ?? (isZh ? "打开日历" : "Open calendar"),
    });
  }

  if (leadingBackOfficeItem) {
    addItem({
      id: "handoff",
      badgeLabel: isZh ? "边界" : "Boundary",
      badgeTone: leadingBackOfficeItem.tone,
      title: `Open ${leadingBackOfficeItem.title}'s formal workflow`,
      description: handoffAction
        ? `${leadingBackOfficeItem.description} ${handoffAction.whyNowLabel}`
        : `${leadingBackOfficeItem.description} Only open the formal record when the package is genuinely ready.`,
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
      description: `${leadingAiItem.description} ${leadingAiItem.safeActionLabel}. ${leadingAiItem.sequenceContractLabel}. Acre still waits for your approval. Nothing here auto-sends or hides automation behind the queue.`,
      metaLabel: `${leadingAiItem.safeActionLabel} · ${leadingAiItem.whyNowLabel}`,
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
      title: isZh ? "打开房源跟进" : "Open listing follow-up",
      description: `${leadingEngagement.listingTitle} already has tracked engagement context. Use the next-step rail to turn that open or quiet send into a concrete next step instead of sending blindly.`,
      metaLabel: `${leadingEngagement.channelLabel} · ${leadingEngagement.detailLabel}`,
      href: leadingEngagement.href,
      actionLabel: isZh ? "打开下一步" : "Open next step",
    });
  } else if (input.snapshot.listingOutput.activeListingCount > 0) {
    addItem({
      id: "listing-output",
      badgeLabel: isZh ? "可发送" : "Send-ready",
      badgeTone: "success",
      title: isZh ? "打开房源跟进" : "Open listing follow-up",
      description: `${input.snapshot.listingOutput.activeListingCount} active or hot listing(s) are ready for outreach. You still choose the link and channel; Acre only records the activity after you send, and the next-step view keeps share risk visible.`,
      metaLabel:
        input.snapshot.listingOutput.trackedLinkCount > 0
          ? `${input.snapshot.listingOutput.trackedLinkCount} tracked link(s) already created`
          : isZh
            ? "第一条跟踪发送从房源输出开始"
            : "First tracked send starts from listing output",
      href: "/agent/listings?lane=draft-lane",
      actionLabel: isZh ? "打开房源跟进" : "Open listing follow-up",
    });
  }

  if (
    input.canViewClients &&
    (input.clientsSnapshot?.summary.potentialDuplicateCount ?? 0) > 0
  ) {
    addItem({
      id: "duplicate-review",
      badgeLabel: isZh ? "审查" : "Review",
      badgeTone: "warning",
      title: isZh ? "查看重复记录" : "Review duplicates",
      description: `${input.clientsSnapshot?.summary.potentialDuplicateCount ?? 0} potential duplicate pair(s) are already visible. Review them before more work lands so intake and follow-up stay on one surviving client record.`,
      metaLabel: isZh
        ? "重复比较和合并仍留在客户队列内"
        : "Duplicate compare and merge stays in the client queue",
      href: buildClientWorkbenchHref("duplicate_review", "duplicate-review"),
      actionLabel: isZh ? "查看重复记录" : "Review duplicates",
    });
  }

  if (input.canViewClients) {
    addItem({
      id: "intake",
      badgeLabel: isZh ? "录入" : "Intake",
      badgeTone: "accent",
      title: isZh
        ? "用审查优先的录入方式捕获下一条线索"
        : "Capture the next lead with review-first intake",
      description: isZh
        ? "当实时通话、截图或粘贴聊天需要变成真实客户记录时，用录入辅助来处理。Acre 在创建任何内容前仍会等待你的审查。"
        : "Use intake assist when a live call, screenshot, or pasted chat needs to become a real client record. Acre still waits for your review before anything is created.",
      metaLabel: input.clientsSnapshot
        ? `${input.clientsSnapshot.summary.liveContacts} live contact(s) in your current scope`
        : isZh
          ? "字段级复核和重复预警会保留在卡片中"
          : "Field-level review and duplicate warnings stay in the card",
      href: "#dashboard-intake-launch",
      actionLabel: isZh ? "打开录入辅助" : "Open intake assist",
    });
  }

  return items.slice(0, 4);
}

function buildDashboardHeroStats(input: {
  snapshot: FrontOfficeDashboardSnapshot;
  canUseAi: boolean;
  isZh: boolean;
}) {
  const { isZh } = input;
  const followUpPressureCount = Math.max(
    input.snapshot.summary.followUpDueCount,
    input.snapshot.summary.overdueTaskCount,
  );
  const sendSignalValue = input.snapshot.listingOutput.recentEngagement.length
    ? input.snapshot.listingOutput.recentEngagement.length
    : input.snapshot.listingOutput.activeListingCount;
  const sendSignalLabel = input.snapshot.listingOutput.recentEngagement.length
    ? isZh
      ? "发送信号"
      : "Send signals"
    : isZh
      ? "可发送房源"
      : "Send-ready listings";
  const sendSignalHint = input.snapshot.listingOutput.recentEngagement.length
    ? isZh
      ? "值得现在处理的已跟踪打开或安静分享"
      : "tracked opens or quiet shares worth working now"
    : isZh
      ? "已激活库存，适合发起可跟踪外联"
      : "active inventory ready for tracked outreach";
  const stats = [
    ...(input.snapshot.leadershipQueue.visible
      ? [
          {
            label: isZh ? "团队/办公室压力" : "Leadership pressure",
            value: input.snapshot.summary.leadershipPressureCount,
            hint: isZh
              ? "当前可见的团队或办公室清理信号"
              : "visible team or office cleanup signals",
            tone:
              input.snapshot.summary.leadershipPressureCount > 0
                ? ("accent" as const)
                : ("default" as const),
          },
        ]
      : []),
    {
      label: isZh ? "跟进压力" : "Follow-up pressure",
      value: followUpPressureCount,
      hint: isZh
        ? "已到期触达或已逾期的共享跟进任务"
        : "due touches or overdue shared follow-up tasks",
      tone:
        followUpPressureCount > 0 ? ("accent" as const) : ("default" as const),
    },
    {
      label: isZh ? "今日约定事项" : "Today commitments",
      value: input.snapshot.summary.todayCommitmentCount,
      hint: isZh
        ? "今天发生的预约或共享办公室事项"
        : "appointments or shared office commitments landing today",
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
      label: isZh ? "需要 Back Office" : "Needs Back Office",
      value: input.snapshot.summary.needsBackOfficeCount,
      hint: isZh
        ? "现在需要进入正式工作流的记录"
        : "records that now need formal workflow",
      tone:
        input.snapshot.summary.needsBackOfficeCount > 0
          ? ("accent" as const)
          : ("default" as const),
    },
  ];

  if (input.snapshot.summary.leaseReminderCount > 0) {
    stats.splice(2, 0, {
      label: isZh ? "租约提醒" : "Lease reminders",
      value: input.snapshot.summary.leaseReminderCount,
      hint: isZh
        ? "续租或搬迁窗口已临近到期"
        : "renewal or move windows already due soon",
      tone: "accent" as const,
    });
  }

  if (input.canUseAi) {
    stats.push({
      label: isZh ? "AI 建议" : "AI suggestions",
      value: input.snapshot.summary.aiSuggestionCount,
      hint: isZh
        ? "等待批准的落地型下一触达建议"
        : "grounded next-touch ideas waiting for approval",
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
  isZh: boolean,
) {
  if (item.count <= 0) {
    return {
      label: isZh ? "已清空" : "Clear",
      tone: "neutral" as const,
    };
  }

  switch (item.id) {
    case "follow-up":
      return {
        label: isZh ? "现在处理" : "Do now",
        tone: item.tone,
      };
    case "commitments":
      return {
        label: isZh ? "今天" : "Today",
        tone: item.tone,
      };
    case "lease-reminders":
      return {
        label:
          item.tone === "danger"
            ? isZh
              ? "已晚"
              : "Late"
            : isZh
              ? "即将到来"
              : "Upcoming",
        tone: item.tone,
      };
    case "content":
      return {
        label:
          item.tone === "warning"
            ? isZh
              ? "补救"
              : "Rescue"
            : isZh
              ? "信号"
              : "Signal",
        tone: item.tone,
      };
    case "handoff":
      return {
        label: isZh ? "边界" : "Boundary",
        tone: item.tone,
      };
    case "leadership":
      return {
        label: isZh ? "审查" : "Review",
        tone: item.tone,
      };
    default:
      return {
        label: isZh ? "进行中" : "Active",
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
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
  const roleFocus = getDashboardRoleFocus(context.currentMembership.role, isZh);
  const launchpadItems = buildDashboardLaunchpadItems({
    snapshot,
    clientsSnapshot,
    canUseAi,
    canViewClients,
    viewerRole: context.currentMembership.role,
    isZh,
  });
  const primaryLaunchpadItem = launchpadItems[0] ?? null;
  const supportingLaunchpadItems = launchpadItems.slice(1);
  const heroStats = buildDashboardHeroStats({
    snapshot,
    canUseAi,
    isZh,
  });
  const todayActionCount = snapshot.summary.todayActionCount;
  const commandLeadText = getDashboardCommandLeadText(
    {
      snapshot,
      primaryLaunchpadItem,
    },
    isZh,
  );
  const leadingAiItem = snapshot.aiQueue.items[0] ?? null;
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
          label: isZh ? "已互动客户" : "Engaged clients",
          value: snapshot.listingOutput.engagedClientCount,
        }
      : {
          label: isZh ? "可发送房源" : "Send-ready listings",
          value: snapshot.listingOutput.activeListingCount,
        };
  const executionOrder = snapshot.actionQueue
    .filter((item) => item.count > 0)
    .slice(0, 4);
  const honestStateText = canUseAi
    ? isZh
      ? "Acre 会把实时跟进、已跟踪的发送/点击历史、审查优先的 AI 建议，以及是否需要进入正式流程的信息都摆在这里。它仍不会自动发送，也不会把自动化藏起来。"
      : "Acre surfaces live follow-up, tracked send/click history, review-first AI suggestions, and clear signals about when formal workflow is needed. It still does not auto-send or hide automation."
    : isZh
      ? "Acre 会把实时跟进、已跟踪的发送/点击历史，以及是否需要进入正式流程的信息都摆在这里。它仍不会自动发送，也不会把自动化藏起来。"
      : "Acre surfaces live follow-up, tracked send/click history, and clear signals about when formal workflow is needed. It still does not auto-send or hide automation.";
  const primaryLaneLabel =
    executionOrder[0]?.label ??
    (canViewClients
      ? isZh
        ? "录入辅助"
        : "Intake assist"
      : isZh
        ? "动态中心"
        : "Activity center");

  return (
    <FrontOfficePageTemplate
      description={roleFocus.description}
      eyebrow={isZh ? "Front Office" : "Front Office"}
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
                    ? isZh
                      ? "打开清理列表"
                      : "Open cleanup list"
                    : isZh
                      ? "打开动态中心"
                      : "Open activity center"}
                </FrontOfficeLink>
                {canViewClients ? (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildClientWorkbenchHref("follow_first")}
                  >
                    {isZh ? "打开优先跟进队列" : "Open follow-first queue"}
                  </FrontOfficeLink>
                ) : null}
              </>
            }
            subtitle={
              isZh
                ? "先处理最紧急的事项，再继续客户、预约、房源和交接。"
                : "Start with the most urgent items, then continue through clients, appointments, listings, and handoff."
            }
            title={isZh ? "今日重点" : "Today priorities"}
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
                  context={getLaunchpadStepContext(0, isZh)}
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
                    context={getLaunchpadStepContext(index + 1, isZh)}
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
              subtitle={
                isZh
                  ? "先清掉上面的实时压力，再使用这里。录入始终保持审查优先：重复预警可见，OCR / transcript 辅助不会自动创建任何内容。"
                  : "Use this after you clear the live pressure above. Intake stays review-first: duplicate warnings are visible and OCR / transcript assist does not auto-create anything."
              }
              title={
                isZh
                  ? "准备接新工作时再打开录入辅助"
                  : "Intake assist when you are ready to capture new work"
              }
            >
              <ListPageStatsGrid>
                <StatCard
                  hint={
                    isZh
                      ? "当前客户范围里可见的实时客户记录"
                      : "live client records visible in your current client scope"
                  }
                  label={isZh ? "实时联系人" : "Live contacts"}
                  value={clientsSnapshot.summary.liveContacts}
                />
                <StatCard
                  hint={
                    isZh
                      ? "客户队列里已经可见的当日或逾期下一触达标记"
                      : "same-day or overdue next-touch markers already visible in the client queue"
                  }
                  label={isZh ? "待跟进" : "Follow-up due"}
                  tone="accent"
                  value={clientsSnapshot.summary.followUpDueCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "当前正在客户列表中等待处理的成对重复审查建议"
                      : "pairwise duplicate review suggestions currently waiting in the client list"
                  }
                  label={isZh ? "重复审查" : "Duplicate review"}
                  tone="accent"
                  value={clientsSnapshot.summary.potentialDuplicateCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "当前范围里已经逾期的已安排跟进任务"
                      : "scheduled follow-up tasks already overdue in your current scope"
                  }
                  label={isZh ? "逾期任务" : "Overdue tasks"}
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
                      {isZh ? "打开录入辅助" : "Open intake assist"}
                    </FrontOfficeLink>
                  }
                  badgeLabel={isZh ? "辅助" : "Assist"}
                  badgeTone="accent"
                  context={isZh ? "仪表盘入口" : "Dashboard launch"}
                  description={
                    isZh
                      ? "从这里开始一条新录入，或重新打开下面的辅助卡，把仍待审查的截图 / transcript 建议处理完，再决定是否创建。"
                      : "Start a new capture here or reopen the assist card below to finish any screenshot or transcript suggestions that are still pending review before create."
                  }
                  meta={
                    <span>
                      {isZh
                        ? "创建只会使用当前表单里的实时值。"
                        : "Create only uses the live form values."}
                    </span>
                  }
                  title={
                    isZh ? "继续录入辅助复核" : "Continue intake assist review"
                  }
                />
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={buildClientWorkbenchHref("all")}
                    >
                      {isZh ? "打开全部客户" : "Open all clients"}
                    </FrontOfficeLink>
                  }
                  badgeLabel={isZh ? "客户" : "Clients"}
                  badgeTone="accent"
                  context={`${clientsSnapshot.summary.liveContacts} live contact(s)`}
                  description={
                    isZh
                      ? "当你需要阶段视图、下一触达排序，以及继续复核现有客户记录时，直接跳进完整客户列表。"
                      : "Jump into the full client list when you need the stage view, next-touch ordering, and the real queue for continuing review across existing client records."
                  }
                  meta={
                    <span>
                      {clientsSnapshot.summary.followUpDueCount} follow-up
                      item(s) are already due there.
                    </span>
                  }
                  title={
                    isZh ? "查看实时客户队列" : "Review the live client queue"
                  }
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
                      {isZh ? "查看重复记录" : "Review duplicates"}
                    </FrontOfficeLink>
                  }
                  badgeLabel={
                    clientsSnapshot.summary.potentialDuplicateCount > 0
                      ? isZh
                        ? "审查"
                        : "Review"
                      : isZh
                        ? "已清空"
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
                      : isZh
                        ? "当前视图中没有成对重复记录"
                        : "No pairwise duplicates in view"
                  }
                  description={
                    isZh
                      ? "创建时出现的重复预警仍然保持审查优先：在真正合并之前，客户列表里的专用视图仍是比较客户记录的地方。"
                      : "Keep create-time duplicate warnings review-first: the dedicated view in the client list is still the place to compare client records before you merge anything."
                  }
                  meta={
                    <span>
                      {isZh
                        ? "重复审查仍保留在客户队列里。"
                        : "Duplicate review stays in the client queue."}
                    </span>
                  }
                  title={
                    isZh ? "跟随重复记录提示处理" : "Follow the duplicate cue"
                  }
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
                            {isZh ? "查看保留记录" : "Review keep record"}
                          </FrontOfficeLink>
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={buildClientWorkbenchHref(
                              "duplicate_review",
                              "duplicate-review",
                            )}
                          >
                            {isZh ? "查看重复记录" : "Review duplicates"}
                          </FrontOfficeLink>
                        </>
                      }
                      badgeLabel={
                        pair.matchReasons.length >= 2
                          ? isZh
                            ? "高重合"
                            : "High overlap"
                          : isZh
                            ? "先审查"
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
              subtitle={
                isZh
                  ? "只有当上面的实时队列已经受控时，再打开新的线索录入；或者重新打开仍需审查的截图 / transcript 建议。这个卡片会在任何内容写入实时表单之前，把置信度、来源和重复预警保持可见。"
                  : "Open a new lead capture only when the live queue above is under control, or reopen screenshot / transcript suggestions that still need review. The card keeps confidence, provenance, and duplicate warnings visible before anything touches the live form."
              }
              title={isZh ? "审查优先的录入辅助" : "Review-first intake assist"}
            />
          </div>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "这些条目按优先级排列，方便你直接进入下一步。"
                : "These items are ordered by priority so you can move straight into the next task."
            }
            title={isZh ? "今日队列" : "Today queue"}
          >
            <div className="list-column front-office-record-list">
              {snapshot.actionQueue.map((item) => {
                const action = getDashboardQueueAction(
                  {
                    actionId: item.id,
                    href: item.href,
                    actionLabel: item.actionLabel,
                    count: item.count,
                    canViewClients,
                  },
                  isZh,
                );
                const laneStatus = getActionLaneStatus(item, isZh);

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
              subtitle={
                isZh
                  ? "基于当前记录，给出可以直接跟进的建议。"
                  : "Suggested follow-ups based on the current record history."
              }
              title={isZh ? "AI 跟进建议" : "AI follow-up suggestions"}
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="grounded AI suggestion and rule-layer opportunities currently visible in this dashboard scope"
                  label={isZh ? "AI 建议" : "AI suggestions"}
                  tone="accent"
                  value={snapshot.aiQueue.suggestionCount}
                />
              </ListPageStatsGrid>

              <FrontOfficeDashboardAiQueueClient
                items={snapshot.aiQueue.items}
                strategy={snapshot.aiStrategy}
              />
            </SectionCard>
          ) : null}

          {canUseAi ? (
            <SectionCard
              className="office-list-card"
              subtitle={
                isZh
                  ? "通过这一层追踪你接受建议之后真正发生了什么：哪些动作变成了真实跟进或已跟踪发送，哪些仍然需要继续处理。"
                  : "Use this trust layer to see what happened after you accepted a suggestion: which action became a real follow-up or tracked send, and which ones still need help."
              }
              title={
                isZh ? "AI 已接受动作与结果" : "AI accepted actions & outcomes"
              }
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="accepted AI follow-up or tracked-send actions in your current dashboard scope"
                  label={isZh ? "已接受动作" : "Accepted actions"}
                  value={snapshot.aiAcceptedActions.acceptedCount}
                />
                <StatCard
                  hint="accepted actions that already turned into a completed follow-up or tracked open"
                  label={isZh ? "正向结果" : "Positive outcomes"}
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
                        <p>
                          {isZh
                            ? "这个时间窗口里还没有已接受的 AI 动作。"
                            : "No accepted AI actions in this window yet."}
                        </p>
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
                    description={
                      isZh
                        ? "当你接受仪表盘或客户页里的 AI 建议后，产生的任务和已跟踪发送结果都会汇总到这里。"
                        : "Once you accept dashboard or client-page AI suggestions, the resulting task and tracked-send outcomes will roll up here."
                    }
                    title={
                      isZh
                        ? "还没有已接受的 AI 动作"
                        : "No accepted AI actions yet"
                    }
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
                    {isZh ? "打开全部客户" : "Open all clients"}
                  </FrontOfficeLink>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={buildClientWorkbenchHref(
                      "duplicate_review",
                      "duplicate-review",
                    )}
                  >
                    {isZh ? "查看重复记录" : "Review duplicates"}
                  </FrontOfficeLink>
                </>
              ) : undefined
            }
            subtitle={
              isZh
                ? "把这里当作仍需要人工判断的客户记录快速总览。完整清理、合并和详细复核仍然保留在客户列表里。"
                : "Use this as a fast overview for client records that still need human judgment. Full cleanup, merge, and detailed review still stay in the client list."
            }
            title={isZh ? "实时客户队列" : "Live client queue"}
          >
            <ListPageStatsGrid>
              {snapshot.pipeline.stageMetrics.length ? (
                snapshot.pipeline.stageMetrics.map((metric) => (
                  <StatCard
                    className="front-office-stage-card"
                    hint={
                      isZh ? "处于这个阶段的客户数" : "clients in this stage"
                    }
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
                  description={
                    isZh
                      ? "先从录入辅助或客户队列开始。当这个范围里出现实时客户记录后，阶段分布就会显示出来。"
                      : "Start with intake assist or the client queue. Stage distribution appears once live client records are moving in this scope."
                  }
                  title={isZh ? "还没有客户阶段分布" : "No client stages yet"}
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
                      {getClientReviewActionLabel(client.stage, isZh)}
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
                      {isZh ? "打开录入辅助" : "Open intake assist"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "当客户活动开始流入共享 CRM 后，最新的活跃记录就会显示在这里。"
                      : "When client activity starts flowing into the shared CRM, the latest active records will appear here."
                  }
                  title={
                    isZh ? "还没有活跃客户记录" : "No active client records"
                  }
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "预约和共享办公室事项会保留在同一个 FO 日历视图里。Google、Outlook、ICS 和邮件都仍然是显式桥接动作，而不是双向同步。"
                : "Appointments and shared office commitments stay in one FO calendar view. Google, Outlook, ICS, and email remain explicit bridge actions, not two-way sync."
            }
            title={isZh ? "日历与约定事项" : "Calendar & commitments"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh
                    ? "当前范围里今天或接下来可见的事项"
                    : "visible today or upcoming in scope"
                }
                label={isZh ? "即将到来的事项" : "Upcoming commitments"}
                value={snapshot.commitments.items.length}
              />
              <StatCard
                hint={
                  snapshot.commitments.appointmentModuleReady
                    ? isZh
                      ? "经纪人排期模块已上线"
                      : "agent scheduling is live"
                    : isZh
                      ? "尚未上线"
                      : "not live yet"
                }
                label={isZh ? "预约模块" : "Appointment module"}
                value={
                  snapshot.commitments.appointmentModuleReady
                    ? isZh
                      ? "已上线"
                      : "Live"
                    : isZh
                      ? "进行中"
                      : "In progress"
                }
              />
            </ListPageStatsGrid>

            <div className="front-office-placeholder-note">
              <Badge tone="accent">
                {isZh ? "桥接动作保持显式" : "Bridge actions stay explicit"}
              </Badge>
              <p>
                {snapshot.commitments.appointmentMessage}{" "}
                {isZh
                  ? "Acre 可以在这里记录排期路径和外部跟进状态，但不会假装自己拥有隐藏的日历同步。"
                  : "Acre can log the scheduling path and external follow-up state here, but it is not pretending to own a hidden calendar sync."}
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
                      {isZh ? "打开日历" : "Open calendar"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "当前还没有安排事项。使用日历来放入下一次预约或承诺中的后续跟进。"
                      : "Nothing is on deck yet. Use the calendar to stage the next appointment or promised follow-up."
                  }
                  title={
                    isZh ? "还没有安排任何事项" : "No commitments scheduled"
                  }
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "查看最近发送、打开和后续跟进情况。"
                : "Review recent sends, opens, and follow-up activity."
            }
            title={isZh ? "房源跟进" : "Listing follow-up"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh
                    ? "当前范围内的活跃或热门房源"
                    : "active or hot listings in scope"
                }
                label={isZh ? "可发送房源" : "Send-ready listings"}
                value={snapshot.listingOutput.activeListingCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "你已经创建的跟踪链接"
                    : "tracked links already created by you"
                }
                label={isZh ? "跟踪链接" : "Tracked links"}
                value={snapshot.listingOutput.trackedLinkCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "你的跟踪链接上的点击记录"
                    : "clicks recorded on your tracked links"
                }
                label={isZh ? "跟踪点击" : "Tracked clicks"}
                value={snapshot.listingOutput.trackedClickCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "从 Front Office 记录下来的客户关联发送"
                    : "client-linked sends recorded from Front Office"
                }
                label={isZh ? "客户发送" : "Client sends"}
                value={snapshot.listingOutput.sendRecordCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "至少被打开过一次的发送记录"
                    : "send records that have at least one open"
                }
                label={isZh ? "已打开发送" : "Opened sends"}
                value={snapshot.listingOutput.openedSendCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "至少打开过一次发送的唯一客户数"
                    : "unique clients who opened at least one send"
                }
                label={isZh ? "已互动客户" : "Engaged clients"}
                value={snapshot.listingOutput.engagedClientCount}
              />
              <StatCard
                hint={
                  snapshot.listingOutput.trackedSendingReady
                    ? isZh
                      ? "现有分享链接已经开始产生互动"
                      : "existing share links are already producing engagement"
                    : isZh
                      ? "一旦创建分享链接，就可以开始房源外联"
                      : "listing outreach can start as soon as share links are created"
                }
                label={isZh ? "已跟踪发送" : "Tracked sending"}
                value={
                  snapshot.listingOutput.trackedSendingReady
                    ? isZh
                      ? "活跃"
                      : "Active"
                    : isZh
                      ? "就绪"
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
                      {isZh ? "打开房源工作台" : "Open listings"}
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
                      {isZh ? "打开房源跟进" : "Open listing follow-up"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "当共享房源模型里有库存后，活跃房源会显示在这里。"
                      : "Active listings will appear here once inventory is available in the shared listing model."
                  }
                  title={
                    isZh
                      ? "当前范围内没有房源库存"
                      : "No listing inventory in scope"
                  }
                />
              )}
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
                      {isZh ? "打开下一步" : "Open next step"}
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
                      {isZh ? "打开房源跟进" : "Open listing follow-up"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "从房源输出或客户记录开始，创建第一条客户关联发送记录。之后打开和再次访问都会显示在这里。"
                      : "Start from listing output or a client record to create the first client-linked send record. Opens and revisits will show here after that."
                  }
                  title={
                    isZh ? "还没有客户关联发送" : "No client-linked sends yet"
                  }
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "这些客户已进入需要正式流程处理的阶段。"
                : "These clients are ready for the formal transaction process."
            }
            title={isZh ? "待交接到 Back Office" : "Ready for Back Office"}
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
                        ? isZh
                          ? "继续留在全部客户"
                          : "Stay in all clients"
                        : isZh
                          ? "打开动态中心"
                          : "Open activity center"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "当前没有任何内容需要正式 BO 档案。继续处理实时 FO 队列，直到某个资料包、签署或交易真正需要可审计归属。"
                      : "Nothing needs a formal BO file right now. Keep working the live FO queue until a package, signature, or transaction truly needs auditable ownership."
                  }
                  title={
                    isZh
                      ? "当前没有正式工作流待处理"
                      : "Nothing waiting for formal workflow"
                  }
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
                  {isZh ? "打开清理列表" : "Open cleanup list"}
                </FrontOfficeLink>
              }
              subtitle={
                isZh
                  ? "先在这里扫描逾期任务、沉寂客户和安静发送轨迹，再决定是否有人需要跳进正式办公室记录。"
                  : "Use this section to scan overdue tasks, stale clients, and quiet send activity before anyone has to jump into a formal office record."
              }
              title={snapshot.leadershipQueue.scopeLabel}
            >
              <ListPageStatsGrid>
                <StatCard
                  hint={
                    isZh
                      ? "已经逾期的共享跟进任务"
                      : "open shared follow-up tasks already overdue"
                  }
                  label={isZh ? "逾期任务" : "Overdue tasks"}
                  value={snapshot.leadershipQueue.overdueTaskCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "15 天以上没有活动的活跃客户"
                      : "active clients with 15+ days of inactivity"
                  }
                  label={isZh ? "15+ 天沉寂" : "15+ day stale"}
                  value={snapshot.leadershipQueue.staleClientCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "最近被跟踪但从未打开或已经沉寂的发送"
                      : "latest tracked sends that were never opened or have gone quiet"
                  }
                  label={isZh ? "分享风险" : "Share risk"}
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
                    description={
                      isZh
                        ? "当前没有可见的逾期任务、沉寂客户或安静发送压力。"
                        : "No overdue tasks, stale clients, or quiet send activity are visible right now."
                    }
                    title={
                      isZh ? "领导队列已清空" : "Leadership queue is clear"
                    }
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
                  ? isZh
                    ? "打开清理列表"
                    : "Open cleanup list"
                  : isZh
                    ? "打开动态中心"
                    : "Open activity center"}
              </FrontOfficeLink>
            }
            subtitle={
              isZh
                ? "共享办公室提醒和个人通知链接会帮助你在不离开 Front Office 指挥台的情况下清掉今天的队列。"
                : "Shared office alerts and personal notice links that help you clear today's queue without leaving this page."
            }
            title={isZh ? "动态与通知" : "Activity & notices"}
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
                        {isZh ? "打开通知" : "Open notice"}
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
                  description={
                    isZh
                      ? "通知栏目前没有新内容等待处理。动态中心里仍然会保留个人清理和提醒压力。"
                      : "Nothing new is waiting in the notice rail. The activity center still carries personal cleanup and reminder pressure."
                  }
                  title={isZh ? "当前没有通知" : "No current notices"}
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
                  {isZh ? "打开租约提醒" : "Open lease reminders"}
                </FrontOfficeLink>
              ) : undefined
            }
            subtitle={
              isZh
                ? "续租和重新挂牌窗口应该在变成临时救火前就浮现出来。"
                : "Lease renewal and remarketing windows should surface before they become a last-minute fire drill."
            }
            title={isZh ? "租约日期提醒" : "Lease-date reminders"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh
                    ? "未来两周内到期的租约提醒"
                    : "lease reminders due within the next two weeks"
                }
                label={isZh ? "即将到期" : "Due soon"}
                value={snapshot.leaseReminders.dueCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "已经超过目标触达日期的租约提醒"
                    : "lease reminders already past their target touch date"
                }
                label={isZh ? "已逾期" : "Overdue"}
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
                        {isZh ? "打开客户记录" : "Open client record"}
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
                  description={
                    isZh
                      ? "当客户进入续租或搬迁时间窗口后，租约日期提醒就会显示在这里。"
                      : "Lease-date reminders will appear here once clients start carrying renewal or move timing."
                  }
                  title={isZh ? "当前没有租约提醒" : "No lease reminders due"}
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
                {isZh ? "打开资源中心" : "Open resources"}
              </FrontOfficeLink>
            }
            subtitle={
              isZh
                ? "已发布的文档、模板和 playbook 会始终和当前执行队列保持一步之遥。"
                : "Published documents, templates, and playbooks stay one click away from the active execution queue."
            }
            title={isZh ? "培训与文档" : "Training & documents"}
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
                        {isZh ? "打开资源" : "Open resource"}
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
                  description={
                    isZh
                      ? "当共享资料库被填充后，已发布的 FO 资源会显示在这里。"
                      : "Published FO resources will surface here once the shared library is populated."
                  }
                  title={isZh ? "还没有发布资源" : "No resources published"}
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
                  {isZh ? "打开共享脉冲" : "Open shared pulse"}
                </FrontOfficeLink>
              }
              subtitle={
                isZh
                  ? "管理者应该能看见共享 Front Office 资料库是否真的在当前可见团队中被使用，而不仅仅是已发布。"
                  : "Leadership should be able to see whether the shared Front Office library is actually being used across the visible bench, not only published."
              }
              title={resourcePulse.scopeLabel}
            >
              <div
                className="office-summary-chip-row"
                style={{ marginBottom: "1rem" }}
              >
                <SummaryChip
                  label={
                    isZh
                      ? `跟踪动作 vs ${resourcePulseComparisonLabel}`
                      : `Tracked actions vs ${resourcePulseComparisonLabel}`
                  }
                  tone={
                    resourcePulse.totalCountDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.totalCountDelta)}
                />
                <SummaryChip
                  label={
                    isZh
                      ? `活跃操作员 vs ${resourcePulseComparisonLabel}`
                      : `Active operators vs ${resourcePulseComparisonLabel}`
                  }
                  tone={
                    resourcePulse.activeMembershipDelta > 0
                      ? "accent"
                      : undefined
                  }
                  value={formatSignedDelta(resourcePulse.activeMembershipDelta)}
                />
                <SummaryChip
                  label={
                    isZh
                      ? `资源打开数 vs ${resourcePulseComparisonLabel}`
                      : `Resource opens vs ${resourcePulseComparisonLabel}`
                  }
                  tone={
                    resourcePulse.resourceOpenDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.resourceOpenDelta)}
                />
                <SummaryChip
                  label={
                    isZh
                      ? `供应商点击 vs ${resourcePulseComparisonLabel}`
                      : `Vendor clicks vs ${resourcePulseComparisonLabel}`
                  }
                  tone={
                    resourcePulse.vendorClickDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(resourcePulse.vendorClickDelta)}
                />
              </div>

              <ListPageStatsGrid>
                <StatCard
                  hint={
                    isZh
                      ? "当前可见 FO 范围内的成员"
                      : "members in the visible FO scope"
                  }
                  label={isZh ? "可见成员" : "Visible members"}
                  value={resourcePulse.visibleMembershipCount}
                />
                <StatCard
                  hint={resourcePulse.windowLabel.toLowerCase()}
                  label={isZh ? "活跃成员" : "Active members"}
                  tone="accent"
                  value={resourcePulse.activeMembershipCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "当前可见范围内的跟踪动作总数"
                      : "tracked actions across the visible scope"
                  }
                  label={isZh ? "跟踪动作" : "Tracked actions"}
                  value={resourcePulse.totalCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "当前可见范围内的资源打开次数"
                      : "resource opens across the visible scope"
                  }
                  label={isZh ? "资源打开数" : "Resource opens"}
                  value={resourcePulse.resourceOpenCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "供应商电话、邮件或站点点击"
                      : "vendor call, email, or site clicks"
                  }
                  label={isZh ? "供应商点击" : "Vendor clicks"}
                  value={resourcePulse.vendorClickCount}
                />
                <StatCard
                  hint={
                    isZh
                      ? "最近一次共享跟踪活动"
                      : "latest shared tracked activity"
                  }
                  label={isZh ? "最近共享触达" : "Last shared touch"}
                  value={resourcePulse.lastInteractionLabel}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list" style={{ marginTop: "1rem" }}>
                {resourcePulse.topActors.length ? (
                  resourcePulse.topActors.slice(0, 2).map((actor) => (
                    <FrontOfficeRailItem
                      badgeLabel={isZh ? "操作员" : "Operator"}
                      badgeTone="accent"
                      description={
                        isZh
                          ? `${actor.label} 在 ${resourcePulse.windowLabel.toLowerCase()} 内记录了 ${actor.interactionCount} 次跟踪动作。`
                          : `${actor.label} logged ${actor.interactionCount} tracked action(s) in ${resourcePulse.windowLabel.toLowerCase()}.`
                      }
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
                    description={
                      isZh
                        ? "当当前可见团队开始在这个 hub 里真实工作后，已跟踪的资源搜索、培训进度和供应商使用情况就会浮现在这里。"
                        : "Tracked resource search, training progress, and vendor use will start surfacing here once the visible bench works this hub live."
                    }
                    title={
                      isZh
                        ? "还没有共享操作员脉冲"
                        : "No shared operator pulse yet"
                    }
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
            subtitle={
              isZh
                ? "经纪人在客户执行过程中会用到的供应商快捷入口。"
                : "Operational shortcuts for vendors that agents need during client execution."
            }
            title={isZh ? "供应商快捷入口" : "Vendor shortcuts"}
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
                          {isZh ? "联系供应商" : "Contact vendor"}
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
                  description={
                    isZh
                      ? "当共享供应商目录可用后，这个办公室范围内的推荐供应商会显示在这里。"
                      : "Featured vendors for this office scope will appear here when the shared vendor directory is available."
                  }
                  title={
                    isZh ? "还没有供应商快捷入口" : "No vendor shortcuts yet"
                  }
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label={isZh ? "今日事项" : "Today actions"}
            tone="accent"
            value={todayActionCount}
          />
          <SummaryChip
            label={isZh ? "待跟进" : "Follow-up due"}
            tone="accent"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label={isZh ? "今日约定事项" : "Today commitments"}
            value={snapshot.summary.todayCommitmentCount}
          />
          <SummaryChip
            label={isZh ? "房源跟进" : "Listing follow-up"}
            tone="accent"
            value={listingSummaryChip.value}
          />
          {snapshot.leadershipQueue.visible ? (
            <SummaryChip
              label={isZh ? "领导压力" : "Leadership pressure"}
              tone="accent"
              value={snapshot.summary.leadershipPressureCount}
            />
          ) : null}
          <SummaryChip
            label={isZh ? "需要 Back Office" : "Needs Back Office"}
            tone="accent"
            value={snapshot.summary.needsBackOfficeCount}
          />
          {snapshot.summary.leaseReminderCount > 0 ? (
            <SummaryChip
              label={isZh ? "租约提醒" : "Lease reminders"}
              tone="accent"
              value={snapshot.summary.leaseReminderCount}
            />
          ) : null}
          {canUseAi ? (
            <SummaryChip
              label={isZh ? "AI 建议" : "AI suggestions"}
              tone="accent"
              value={snapshot.summary.aiSuggestionCount}
            />
          ) : null}
          {clientsSnapshot &&
          clientsSnapshot.summary.potentialDuplicateCount > 0 ? (
            <SummaryChip
              label={isZh ? "重复审查" : "Duplicate review"}
              tone="accent"
              value={clientsSnapshot.summary.potentialDuplicateCount}
            />
          ) : null}
          {clientsSnapshot ? (
            <SummaryChip
              label={isZh ? "客户" : "Clients"}
              value={clientsSnapshot.summary.liveContacts}
            />
          ) : null}
        </>
      }
      title={isZh ? "Front Office 仪表盘" : "Front Office dashboard"}
    />
  );
}
