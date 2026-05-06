import { can } from "@acre/auth";
import {
  getFrontOfficeDashboardSnapshot,
  type FrontOfficeDashboardTone,
} from "@acre/db";
import {
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip,
} from "@acre/ui";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { FrontOfficeDashboardDailyActionsClient } from "./front-office-dashboard-daily-actions-client";
import { FrontOfficeDashboardQuickCaptureClient } from "./front-office-dashboard-quick-capture-client";

function getDashboardDescription(role: string, isZh: boolean) {
  if (role === "team_lead") {
    return isZh
      ? "默认先处理自己的工作；团队压力只作为旁侧入口。"
      : "Start with your own work by default; team pressure stays in the supporting rail.";
  }

  if (role === "office_admin" || role === "owner") {
    return isZh
      ? "把前台首页收束成今天的执行入口；正式交易、签署和财务仍回到后台处理。"
      : "Keep the Front Office homepage focused on today's execution; formal transaction and finance work still moves into Back Office.";
  }

  return isZh
    ? "先处理最该做的下一步，再进入完整客户、日历或后台工作区。"
    : "Work the next action first, then open the full client, calendar, or Back Office workspace.";
}

function countActionsByKind(input: {
  kinds: string[];
  actions: { kind: string }[];
}) {
  const kindSet = new Set(input.kinds);

  return input.actions.filter((action) => kindSet.has(action.kind)).length;
}

function resolveChipTone(count: number): "default" | "accent" {
  return count > 0 ? "accent" : "default";
}

function mapToneToStatTone(
  tone: FrontOfficeDashboardTone,
): "default" | "accent" {
  return tone === "neutral" ? "default" : "accent";
}

export default async function AgentDashboardPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="dashboard"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const canUseAi = can(context.currentMembership, "ai:use");
  const canViewClients = can(context.currentMembership, "clients:view");
  const snapshot = await getFrontOfficeDashboardSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    canUseAi,
  });
  const duplicatePreviewCandidates: FrontOfficeLeadDuplicatePreviewCandidate[] =
    snapshot.pipeline.recentClients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      sourceLabel: client.source,
      nextTouchLabel: client.nextTouchLabel,
      href: client.href,
    }));
  const dueFollowUpCount = countActionsByKind({
    actions: snapshot.dailyActions,
    kinds: ["overdue_follow_up", "follow_up_due"],
  });
  const hotSignalCount = countActionsByKind({
    actions: snapshot.dailyActions,
    kinds: ["listing_warm_signal", "listing_send_risk"],
  });
  const needsHandoffCount = countActionsByKind({
    actions: snapshot.dailyActions,
    kinds: ["back_office_handoff"],
  });
  const teamPressureHref = "/agent/notifications?activityView=team_cleanup";
  const openAiHref = "/agent/notifications?activityView=personal_cleanup";
  const todayScheduleItems = snapshot.commitments.items.filter((item) =>
    item.startsAtLabel.includes(",") || item.startsAtLabel.trim().length > 0,
  );

  return (
    <FrontOfficePageTemplate
      description={getDashboardDescription(context.currentMembership.role, isZh)}
      eyebrow={isZh ? "前台" : "Front Office"}
      headerClassName="front-office-dashboard-header"
      layoutClassName="front-office-dashboard-layout"
      pageClassName="front-office-dashboard-page"
      summary={
        <>
          <SummaryChip
            label={isZh ? "待跟进" : "Due follow-up"}
            tone={resolveChipTone(dueFollowUpCount)}
            value={dueFollowUpCount}
          />
          <SummaryChip
            label={isZh ? "今日日程" : "Today schedule"}
            tone={resolveChipTone(snapshot.summary.todayCommitmentCount)}
            value={snapshot.summary.todayCommitmentCount}
          />
          <SummaryChip
            label={isZh ? "热信号" : "Hot signals"}
            tone={resolveChipTone(hotSignalCount)}
            value={hotSignalCount}
          />
          <SummaryChip
            label={isZh ? "需交接" : "Needs handoff"}
            tone={resolveChipTone(needsHandoffCount)}
            value={needsHandoffCount}
          />
          {snapshot.leadershipQueue.visible ? (
            <SummaryChip
              label={isZh ? "团队压力" : "Team pressure"}
              tone={resolveChipTone(snapshot.summary.leadershipPressureCount)}
              value={snapshot.summary.leadershipPressureCount}
            />
          ) : null}
        </>
      }
      summaryClassName="front-office-dashboard-summary"
      title={isZh ? "前台工作台" : "Front Office dashboard"}
      main={
        <SectionCard
          actions={
            <>
              {canViewClients ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href="/agent/clients?clientView=follow_first"
                >
                  {isZh ? "打开客户队列" : "Open clients"}
                </FrontOfficeLink>
              ) : null}
              {canUseAi ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={openAiHref}
                >
                  {isZh ? "打开 AI 建议" : "Open AI suggestions"}
                </FrontOfficeLink>
              ) : null}
            </>
          }
          className="office-list-card front-office-dashboard-next-actions"
          subtitle={
            isZh
              ? "这里不是完整客户库，也不是完整 AI 队列；只放今天最值得先处理的动作。"
              : "This is not the full CRM or AI queue; it only shows the actions most worth doing now."
          }
          title={isZh ? "下一步动作" : "Next Actions"}
        >
          <FrontOfficeDashboardDailyActionsClient
            items={snapshot.dailyActions}
          />
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href="/agent/calendar"
              >
                {isZh ? "打开日历" : "Open calendar"}
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle={
              isZh
                ? "这里只显示今天需要留意的预约和办公室事项；完整日历仍在日历页。"
                : "Only today's commitments stay here; the full schedule remains in Calendar."
            }
            title={isZh ? "今日日程" : "Today Schedule"}
          >
            {todayScheduleItems.length ? (
              <div className="office-queue-list">
                {todayScheduleItems.slice(0, 4).map((item) => (
                  <article
                    className="front-office-dashboard-schedule-item"
                    key={item.id}
                  >
                    <div>
                      <StatusBadge tone={item.badgeTone}>
                        {item.badgeLabel}
                      </StatusBadge>
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.contextLabel}</p>
                    <div className="front-office-record-meta">
                      <span>{item.startsAtLabel}</span>
                      <span>{item.locationLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </FrontOfficeLink>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description={
                  isZh
                    ? "今天没有需要处理的预约或办公室活动。"
                    : "No appointment or office event lands today."
                }
                title={isZh ? "今天没有日程压力" : "No schedule pressure"}
              />
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "需要时再打开抽屉，表单不会占用工作台首屏。"
                : "Launch the drawer when needed; the form no longer occupies the dashboard first screen."
            }
            title={isZh ? "快速录入" : "Quick Capture"}
          >
            <FrontOfficeDashboardQuickCaptureClient
              duplicatePreviewCandidates={duplicatePreviewCandidates}
            />
          </SectionCard>

          {snapshot.leadershipQueue.visible ? (
            <SectionCard
              actions={
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={teamPressureHref}
                >
                  {isZh ? "打开团队清理" : "Open team cleanup"}
                </FrontOfficeLink>
              }
              className="office-list-card"
              subtitle={
                isZh
                  ? "团队逾期、沉默客户和低反馈发送只放在经理入口，不挤占普通经纪人的前三个动作。"
                  : "Team overdue work, stale clients, and quiet sends stay in manager mode instead of polluting an agent's first actions."
              }
              title={isZh ? "团队压力" : "Team Pressure"}
            >
              <div className="office-list-page-stats">
                <StatCard
                  hint={isZh ? "当前可见范围内需要清理的压力" : "Visible cleanup pressure"}
                  label={snapshot.leadershipQueue.scopeLabel}
                  tone={mapToneToStatTone(
                    snapshot.summary.leadershipPressureCount > 0
                      ? "danger"
                      : "neutral",
                  )}
                  value={snapshot.summary.leadershipPressureCount}
                />
              </div>
            </SectionCard>
          ) : null}
        </>
      }
    />
  );
}
