import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeAppointmentsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import {
  deriveCalendarViewFromRoute,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "./calendar-view";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { FrontOfficeCalendarClient } from "./front-office-calendar-client";

type AgentCalendarPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function AgentCalendarPage(props: AgentCalendarPageProps) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const searchParams = (await props.searchParams) ?? {};
  const requestedCalendarViewValue = readSearchParamValue(
    searchParams.calendarView,
  )?.trim();
  const requestedCalendarView = resolveCalendarView(requestedCalendarViewValue);
  const hasExplicitCalendarView = Boolean(requestedCalendarViewValue);
  const calendarViewFromFilters = deriveCalendarViewFromRoute({
    coordination:
      readSearchParamValue(searchParams.coordination)?.trim() ?? "all",
    followUp: readSearchParamValue(searchParams.followUp)?.trim() ?? "all",
    status: readSearchParamValue(searchParams.status)?.trim() ?? "all",
  });
  const activeCalendarView: CalendarViewKey = hasExplicitCalendarView
    ? requestedCalendarView
    : calendarViewFromFilters;
  const activeCalendarViewConfig = getCalendarViewConfig(activeCalendarView);
  const activeCalendarViewPatch = hasExplicitCalendarView
    ? getCalendarViewRoutePatch(activeCalendarView)
    : null;
  const snapshot = await getFrontOfficeAppointmentsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    clientId: readSearchParamValue(searchParams.clientId)?.trim(),
    listingId: readSearchParamValue(searchParams.listingId)?.trim(),
    type: readSearchParamValue(searchParams.type)?.trim(),
    status:
      activeCalendarViewPatch?.status ??
      readSearchParamValue(searchParams.status)?.trim(),
    coordination:
      activeCalendarViewPatch?.coordination ??
      readSearchParamValue(searchParams.coordination)?.trim(),
    followUp:
      activeCalendarViewPatch?.followUp ??
      readSearchParamValue(searchParams.followUp)?.trim(),
    targetAppointmentId: readSearchParamValue(
      searchParams.appointmentId,
    )?.trim(),
  });
  const requestedClientId = readSearchParamValue(searchParams.clientId)?.trim();
  const initialClientId = snapshot.clientOptions.some(
    (option) => option.value === requestedClientId,
  )
    ? requestedClientId
    : undefined;
  const requestedListingId = readSearchParamValue(
    searchParams.listingId,
  )?.trim();
  const initialListingId = snapshot.listingOptions.some(
    (option) => option.value === requestedListingId,
  )
    ? requestedListingId
    : undefined;

  return (
    <FrontOfficePageTemplate
      eyebrow={isZh ? "日历" : "Calendar"}
      main={
        <FrontOfficeCalendarClient
          initialClientId={initialClientId}
          initialListingId={initialListingId}
          snapshot={snapshot}
          timeZone={context.currentUser.timezone}
        />
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "把队列拆成回复压力、确认压力、已安排触达压力、待回写、桥接记录、Acre 邮件线程连续性和 BO-ready 交接，让页面读起来更像清晰的待办列表。"
                : "Separate the queue into reply pressure, confirmation pressure, scheduled touch pressure, writeback pending, bridge logs, Acre mail-thread continuity, and BO-ready handoff so the page reads like a clear task list."
            }
            title={isZh ? "协调压力" : "Coordination pressure"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh ? "从现在开始已安排的预约" : "scheduled appointments from now forward"
                }
                label={isZh ? "即将到来" : "Upcoming"}
                value={snapshot.summary.upcomingCount}
              />
              <StatCard
                hint={isZh ? "今天落下来的事项" : "items landing today"}
                label={isZh ? "今天" : "Today"}
                tone="accent"
                value={snapshot.summary.todayCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "外部回复仍需要继续跟进的预约"
                    : "appointments whose outside reply still needs attention"
                }
                label={isZh ? "待回复" : "Reply due"}
                value={snapshot.summary.awaitingReplyCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "明确仍在等待外部确认回复的预约"
                    : "scheduled appointments explicitly waiting on an outside confirmation reply"
                }
                label={isZh ? "待确认" : "Confirmation pending"}
                tone="accent"
                value={snapshot.summary.confirmationPendingCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "仍在等待外部协调、但还没有保存下次触达截止时间的预约"
                    : "appointments still waiting on outside coordination but missing a saved next-touch deadline"
                }
                label={isZh ? "缺少下次触达" : "Missing next touch"}
                tone="accent"
                value={snapshot.summary.missingTouchPlanCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "当前可见队列里已经到期或逾期的下一次外部触达"
                    : "next external touches already due or overdue in the visible queue"
                }
                label={isZh ? "触达已到期" : "Touch due"}
                value={snapshot.summary.touchDueCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "已经保存但尚未到期的下一次外部触达"
                    : "next external touches already saved but not due yet"
                }
                label={isZh ? "已安排触达" : "Touch scheduled"}
                tone="accent"
                value={snapshot.summary.touchScheduledCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "最新回写显示需要调整时间的预约"
                    : "appointments whose latest writeback says the time needs to move"
                }
                label={isZh ? "请求改期" : "Reschedule requested"}
                tone="accent"
                value={snapshot.summary.rescheduleRequestedCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "已经从 Acre 打开过 Google、Outlook、ICS 或邮件桥接的预约"
                    : "appointments that already opened Google, Outlook, ICS, or email from Acre"
                }
                label={isZh ? "已记录桥接" : "Bridge logged"}
                value={snapshot.summary.bridgedCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "Acre 已打开桥接、但还没有保存回写的预约"
                    : "appointments where Acre opened the bridge but no writeback has been saved yet"
                }
                label={isZh ? "待回写" : "Writeback pending"}
                tone="accent"
                value={snapshot.summary.writebackPendingCount}
              />
              <StatCard
                hint={
                  isZh ? "正在 BO 中等待正式跟进的事务" : "formal transaction follow-through waiting in BO"
                }
                label={isZh ? "可交接 BO" : "BO-ready"}
                tone="accent"
                value={snapshot.summary.handoffReadyCount}
              />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "这个队列现在由明确的 Front Office 交接草稿驱动，而不是靠阶段文本猜测。"
                : "This queue is now driven by explicit Front Office handoff drafts instead of stage-text heuristics."
            }
            title={isZh ? "准备进入 Back Office" : "Ready for Back Office"}
          >
            <div className="list-column front-office-record-list">
              {snapshot.handoffs.length ? (
                snapshot.handoffs.map((handoff) => (
                  <article
                    className="list-row front-office-record tone-warning"
                    key={handoff.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{handoff.clientName}</strong>
                        <p>{handoff.summary}</p>
                      </div>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{handoff.stageLabel}</span>
                      <span>
                        {isZh
                          ? "正式工作流仍在 Back Office 中处理"
                          : "Formal workflow lives in Back Office"}
                      </span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={handoff.href}
                    >
                      {isZh ? "打开 Back Office 创建流程" : "Open Back Office create flow"}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/office/transactions"
                    >
                      {isZh ? "打开 Back Office" : "Open Back Office"}
                    </Link>
                  }
                  description={
                    isZh
                      ? "当客户进入谈判、报价等可交接 BO 的阶段后，草稿队列会显示在这里。"
                      : "When a client reaches a BO-ready phase such as negotiation or offer, the draft queue will appear here."
                  }
                  title={isZh ? "当前没有正式工作流待处理" : "Nothing waiting for formal workflow"}
                />
              )}
            </div>
          </SectionCard>

        </>
      }
      summary={
        <>
          <SummaryChip
            label={isZh ? "当前视图" : "View"}
            tone="accent"
            value={activeCalendarViewConfig.label}
          />
          <SummaryChip
            label={isZh ? "即将到来" : "Upcoming"}
            value={snapshot.summary.upcomingCount}
          />
          <SummaryChip
            label={isZh ? "待回复" : "Awaiting reply"}
            value={snapshot.summary.awaitingReplyCount}
          />
          <SummaryChip
            label={isZh ? "待确认" : "Awaiting confirm"}
            tone="accent"
            value={snapshot.summary.confirmationPendingCount}
          />
          <SummaryChip
            label={isZh ? "触达已到期" : "Touch due"}
            value={snapshot.summary.touchDueCount}
          />
          <SummaryChip
            label={isZh ? "已安排触达" : "Touch scheduled"}
            tone="accent"
            value={snapshot.summary.touchScheduledCount}
          />
          <SummaryChip
            label={isZh ? "改期" : "Reschedule"}
            tone="accent"
            value={snapshot.summary.rescheduleRequestedCount}
          />
          <SummaryChip
            label={isZh ? "待回写" : "Writeback pending"}
            tone="accent"
            value={snapshot.summary.writebackPendingCount}
          />
          <SummaryChip
            label={isZh ? "缺少触达" : "Missing touch"}
            tone="accent"
            value={snapshot.summary.missingTouchPlanCount}
          />
        </>
      }
      title={isZh ? "日历" : "Calendar"}
    />
  );
}
