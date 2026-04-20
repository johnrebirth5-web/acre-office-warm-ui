import { can, getDefaultAppPath } from "@acre/auth";
import {
  getFrontOfficeAppointmentsSnapshot,
  getFrontOfficeEventHubSnapshot,
} from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import {
  deriveCalendarViewFromRoute,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "./calendar-view";
import { FrontOfficeEventHubClient } from "./front-office-event-hub-client";
import {
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
  const targetAppointmentId = readSearchParamValue(
    searchParams.appointmentId,
  )?.trim();
  const targetEventId = readSearchParamValue(searchParams.eventId)?.trim();
  const calendarViewFromFilters = deriveCalendarViewFromRoute({
    coordination:
      readSearchParamValue(searchParams.coordination)?.trim() ?? "all",
    followUp: readSearchParamValue(searchParams.followUp)?.trim() ?? "all",
    status: readSearchParamValue(searchParams.status)?.trim() ?? "all",
  });
  const activeCalendarView: CalendarViewKey =
    hasExplicitCalendarView
      ? requestedCalendarView
      : targetAppointmentId || calendarViewFromFilters !== "all"
        ? calendarViewFromFilters
        : "month";
  const activeCalendarViewConfig = getCalendarViewConfig(activeCalendarView);
  const activeCalendarViewPatch = hasExplicitCalendarView
    ? getCalendarViewRoutePatch(activeCalendarView)
    : null;
  const shouldRenderEventHub =
    !targetAppointmentId &&
    (activeCalendarView === "month" ||
      activeCalendarView === "week" ||
      activeCalendarView === "day");

  if (shouldRenderEventHub) {
    const hubSnapshot = await getFrontOfficeEventHubSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      viewerRole: context.currentMembership.role,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
      view: activeCalendarView,
      focusDate: readSearchParamValue(searchParams.focusDate)?.trim(),
      targetEventId,
    });

    return (
      <FrontOfficePageTemplate
        description={
          isZh
            ? "用 Event Hub 统一查看 shared office event、mandatory 节点和 appointment coordination。"
            : "Use Event Hub to manage shared office events, mandatory commitments, and appointment coordination in one place."
        }
        eyebrow={isZh ? "事件中枢" : "Event Hub"}
        main={
          <FrontOfficeEventHubClient
            isZh={isZh}
            snapshot={hubSnapshot}
            timeZone={context.currentUser.timezone}
          />
        }
        rail={null}
        summary={
          <>
            <SummaryChip
              label={isZh ? "当前视图" : "View"}
              tone="accent"
              value={activeCalendarViewConfig.label}
            />
            <SummaryChip
              label={isZh ? "共享活动" : "Shared events"}
              value={hubSnapshot.summary.sharedEventCount}
            />
            <SummaryChip
              label={isZh ? "Mandatory" : "Mandatory"}
              tone="accent"
              value={hubSnapshot.summary.mandatoryEventCount}
            />
            <SummaryChip
              label={isZh ? "预约" : "Appointments"}
              value={hubSnapshot.summary.appointmentCount}
            />
            <SummaryChip
              label={isZh ? "今日承诺" : "Today"}
              value={hubSnapshot.summary.todayCommitmentCount}
            />
          </>
        }
        title={isZh ? "Event Hub" : "Event Hub"}
      />
    );
  }

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
    targetAppointmentId,
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
      description={
        isZh
          ? "保留 appointment coordination 全能力，同时把月/周/日主入口交给 Event Hub。"
          : "Keep the full appointment coordination workbench while Event Hub takes over the month, week, and day entry views."
      }
      eyebrow={isZh ? "事件中枢" : "Event Hub"}
      main={
        <FrontOfficeCalendarClient
          initialClientId={initialClientId}
          initialListingId={initialListingId}
          snapshot={snapshot}
          timeZone={context.currentUser.timezone}
        />
      }
      rail={null}
      summary={
        <>
          <SummaryChip
            label={isZh ? "当前视图" : "View"}
            tone="accent"
            value={activeCalendarViewConfig.label}
          />
          <SummaryChip
            label={isZh ? "预约即将到来" : "Upcoming"}
            value={snapshot.summary.upcomingCount}
          />
          <SummaryChip
            label={isZh ? "待回复" : "Awaiting reply"}
            value={snapshot.summary.awaitingReplyCount}
          />
          <SummaryChip
            label={isZh ? "触达已到期" : "Touch due"}
            value={snapshot.summary.touchDueCount}
          />
          <SummaryChip
            label={isZh ? "待确认" : "Awaiting confirm"}
            tone="accent"
            value={snapshot.summary.confirmationPendingCount}
          />
        </>
      }
      title={isZh ? "Event Hub" : "Event Hub"}
    />
  );
}
