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

function getDashboardRoleFocus(role: string, isZh: boolean) {
  switch (role) {
    case "team_lead":
      return {
        label: isZh ? "团队视图" : "Team view",
        description: isZh
          ? "先清掉可见清理压力，再继续跟进、预约和交接。"
          : "Clear visible cleanup pressure first, then keep moving through follow-up, appointments, and handoff.",
      };
    case "owner":
    case "office_admin":
      return {
        label: isZh ? "办公室视图" : "Office view",
        description: isZh
          ? "把执行压力留在这里，正式工作再进 Back Office。"
          : "Keep execution pressure visible here, then move formal work into Back Office.",
      };
    default:
      return {
        label: isZh ? "经纪人视图" : "Agent view",
        description: isZh
          ? "先从下一步动作开始，再继续跟进、预约和交接。"
          : "Start with the next move, then continue through follow-up, appointments, and handoff.",
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
  const leadingEngagement =
    input.snapshot.listingOutput.recentEngagement[0] ?? null;
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

  if (input.canViewClients) {
    addItem({
      id: "intake",
      badgeLabel: isZh ? "录入" : "Intake",
      badgeTone: "accent",
      title: isZh
        ? "打开录入辅助"
        : "Open intake assist",
      description: isZh
        ? "从截图或粘贴内容里抓关键字段，再决定是否写进正式表单。"
        : "Capture key fields from screenshots or pasted text before anything reaches the live form.",
      metaLabel: input.clientsSnapshot
        ? `${input.clientsSnapshot.summary.liveContacts} live contact(s) in scope`
        : isZh
          ? "字段复核会先保留在卡片里"
          : "Field review stays in the card first",
      href: "#dashboard-intake-launch",
      actionLabel: isZh ? "打开录入辅助" : "Open intake assist",
    });
  }

  if (input.snapshot.summary.todayCommitmentCount > 0) {
    addItem({
      id: "commitments",
      badgeLabel: isZh ? "今天" : "Today",
      badgeTone: "accent",
      title: isZh ? "打开日历" : "Open calendar",
      description: leadingCommitment
        ? `${leadingCommitment.title} ${commitmentAction?.whyNowLabel ?? ""}`.trim()
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

  if (leadingEngagement) {
    addItem({
      id: "engagement",
      badgeLabel: leadingEngagement.engagementLabel,
      badgeTone: leadingEngagement.engagementTone,
      title: isZh ? "打开房源跟进" : "Open listing follow-up",
      description: `${leadingEngagement.listingTitle} already has tracked engagement context. Use the next-step view to turn that open or quiet send into a concrete next step instead of sending blindly.`,
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

  return items.slice(0, 6);
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
  const activityCenterHref = snapshot.leadershipQueue.visible
    ? "/agent/notifications?activityView=team_cleanup#team-cleanup-pressure"
    : "/agent/notifications?activityView=personal_cleanup#personal-cleanup-pressure";

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
                  hint={
                    isZh
                      ? "当前可见的 AI 建议"
                      : "AI suggestions currently visible"
                  }
                  label={isZh ? "AI 建议" : "AI suggestions"}
                  tone="accent"
                  value={snapshot.aiQueue.suggestionCount}
                />
              </ListPageStatsGrid>

              <FrontOfficeDashboardAiQueueClient
                items={snapshot.aiQueue.items}
              />
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
            {snapshot.pipeline.stageMetrics.length ? (
              <ListPageStatsGrid>
                {snapshot.pipeline.stageMetrics.map((metric) => (
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
                ))}
              </ListPageStatsGrid>
            ) : null}

            {snapshot.pipeline.recentClients.length ? (
              <div className="list-column front-office-record-list">
                {snapshot.pipeline.recentClients.map((client) => (
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
                ))}
              </div>
            ) : null}
          </SectionCard>

        </>
      }
      pageClassName="front-office-dashboard-page"
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
            label={isZh ? "需要 Back Office" : "Needs Back Office"}
            tone="accent"
            value={snapshot.summary.needsBackOfficeCount}
          />
        </>
      }
      title={isZh ? "Front Office 仪表盘" : "Front Office dashboard"}
    />
  );
}
