import { hasAnyPermission } from "@acre/auth";
import {
  buildFrontOfficeCleanupDigest,
  getFrontOfficeActivitySnapshot,
  getFrontOfficeDashboardSnapshot,
} from "@acre/db";
import { SectionCard } from "@acre/ui";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";
import {
  activityViewOptions,
  cleanupFilterOptions,
  leadershipCleanupFilterOptions,
  noticeStreamFilterOptions,
  readStateOptions,
  resolveOptionValue,
  resolveReminderFilterValue,
} from "./agent-notifications-config";
import { AgentNotificationsClient } from "./agent-notifications-client";
import { FrontOfficeCleanupDigestCard } from "./front-office-cleanup-digest-card";

type AgentNotificationsPageProps = {
  searchParams?: Promise<{
    activityView?: string;
    appointmentFilter?: string;
    cleanupFilter?: string;
    noticeFilter?: string;
    noticeStreamFilter?: string;
    readState?: string;
    teamCleanupFilter?: string;
  }>;
};

export default async function AgentNotificationsPage(
  props: AgentNotificationsPageProps,
) {
  const context = await requireSessionContext();

  if (
    !hasAnyPermission(context.currentMembership, [
      "notifications:view",
      "events:view",
      "clients:view",
      "dashboard:view",
    ])
  ) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="activity"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const [snapshot, dashboardSnapshot, cleanupDigest] = await Promise.all([
    getFrontOfficeActivitySnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
    getFrontOfficeDashboardSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      viewerRole: context.currentMembership.role,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
    buildFrontOfficeCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    }),
  ]);
  const searchParams = (await props.searchParams) ?? {};
  const initialActivityView = resolveOptionValue(
    searchParams.activityView,
    activityViewOptions,
    "all",
  );
  const initialFilter = resolveReminderFilterValue(
    searchParams.appointmentFilter,
    searchParams.noticeFilter,
    "all",
  );
  const initialCleanupFilter = resolveOptionValue(
    searchParams.cleanupFilter,
    cleanupFilterOptions,
    "all",
  );
  const initialNoticeStreamFilter = resolveOptionValue(
    searchParams.noticeStreamFilter,
    noticeStreamFilterOptions,
    "all",
  );
  const initialReadState = resolveOptionValue(
    searchParams.readState,
    readStateOptions,
    "all",
  );
  const initialTeamCleanupFilter = resolveOptionValue(
    searchParams.teamCleanupFilter,
    leadershipCleanupFilterOptions,
    "all",
  );
  const cleanupDigestHref = `/api/agent/notifications/cleanup-digest?timeZone=${encodeURIComponent(
    context.currentUser.timezone,
  )}`;
  const cleanupDigestMailThreadHref =
    "/api/agent/notifications/cleanup-digest/mail-thread";

  return (
    <FrontOfficePageTemplate
      description="Keep follow-up, appointment pressure, cleanup, and notices in one place."
      eyebrow="Activity"
      summary={
        <span>
          Keep cleanup, reminders, notices, and team pressure in one pass.
        </span>
      }
      main={
        <AgentNotificationsClient
          initialActivityView={initialActivityView}
          initialCleanupFilter={initialCleanupFilter}
          initialFilter={initialFilter}
          initialNoticeStreamFilter={initialNoticeStreamFilter}
          initialReadState={initialReadState}
          initialTeamCleanupFilter={initialTeamCleanupFilter}
          leadershipQueue={dashboardSnapshot.leadershipQueue}
          snapshot={snapshot}
        />
      }
      rail={
        <SectionCard className="office-list-card" title="Cleanup digest">
          <FrontOfficeCleanupDigestCard
            cleanupDigest={cleanupDigest}
            cleanupDigestHref={cleanupDigestHref}
            cleanupDigestMailThreadHref={cleanupDigestMailThreadHref}
          />
        </SectionCard>
      }
      title="Activity"
    />
  );
}
