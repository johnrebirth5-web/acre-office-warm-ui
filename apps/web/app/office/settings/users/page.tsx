import { canManageOfficeSettings, canManageOfficeTeams, canManageOfficeUsers, canViewOfficeAgents, canViewOfficeUsers } from "@acre/auth";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { getOfficeAdminUsersSnapshot, getOfficeAgentsRosterSnapshot, type OfficeUsersWorkspaceSnapshot, type OfficeUsersWorkspaceView } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSettingsUsersWorkspaceClient } from "./users-workspace-client";

type OfficeSettingsUsersPageProps = {
  searchParams?: Promise<{
    view?: string;
    page?: string;
    q?: string;
    role?: string;
    status?: string;
    officeId?: string;
    teamId?: string;
    onboardingStatus?: string;
    membershipStatus?: string;
  }>;
};

const defaultOfficeUsersWorkspacePage = 1;
const officeUsersWorkspacePageSize = 50;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const numeric = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return numeric;
}

function resolveActiveView(requestedView: string | undefined, canViewUsers: boolean, canViewAgents: boolean): OfficeUsersWorkspaceView {
  if (requestedView === "operations") {
    return canViewAgents ? "operations" : "access";
  }

  if (requestedView === "access") {
    return canViewUsers ? "access" : "operations";
  }

  if (canViewUsers) {
    return "access";
  }

  return "operations";
}

export default async function OfficeSettingsUsersPage(props: OfficeSettingsUsersPageProps) {
  const context = await requireOfficeSession();
  const canViewUsers = canViewOfficeUsers(context.currentMembership);
  const canViewAgents = canViewOfficeAgents(context.currentMembership);

  if (!canViewUsers && !canViewAgents) {
    redirect("/office/settings");
  }

  const searchParams = (await props.searchParams) ?? {};
  const activeView = resolveActiveView(searchParams.view, canViewUsers, canViewAgents);
  const page = parsePositiveInteger(searchParams.page, defaultOfficeUsersWorkspacePage);
  const snapshot: OfficeUsersWorkspaceSnapshot = {
    activeView,
    availableViews: [
      ...(canViewUsers ? (["access"] as OfficeUsersWorkspaceView[]) : []),
      ...(canViewAgents ? (["operations"] as OfficeUsersWorkspaceView[]) : [])
    ],
    access: null,
    operations: null
  };

  if (activeView === "access" && canViewUsers) {
    snapshot.access = await getOfficeAdminUsersSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      q: searchParams.q,
      role: searchParams.role,
      status: searchParams.status,
      officeFilterId: searchParams.officeId,
      page,
      pageSize: officeUsersWorkspacePageSize
    });
  }

  if (activeView === "operations" && canViewAgents) {
    snapshot.operations = await getOfficeAgentsRosterSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      officeFilterId: searchParams.officeId,
      role: searchParams.role,
      teamId: searchParams.teamId,
      onboardingStatus: searchParams.onboardingStatus,
      membershipStatus: searchParams.membershipStatus,
      q: searchParams.q,
      page,
      pageSize: officeUsersWorkspacePageSize
    });
  }
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow={isZh ? "办公室管理" : "Office admin"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            {snapshot.access ? (
              <>
                <SummaryChip label={isZh ? "用户总数" : "Total users"} tone="accent" value={snapshot.access.summary.totalUsers} />
                <SummaryChip label={isZh ? "启用" : "Active"} value={snapshot.access.summary.activeUsers} />
                <SummaryChip label={isZh ? "已邀请" : "Invited"} value={snapshot.access.summary.invitedUsers} />
                <SummaryChip label={isZh ? "已锁定" : "Locked"} value={snapshot.access.summary.lockedUsers} />
              </>
            ) : null}
            {snapshot.operations ? (
              <>
                <SummaryChip label={isZh ? "名册成员" : "Rostered members"} tone="accent" value={snapshot.operations.summary.totalMembers} />
                <SummaryChip label={isZh ? "启用团队" : "Active teams"} value={snapshot.operations.summary.activeTeamCount} />
                <SummaryChip label={isZh ? "入职处理中" : "Onboarding in progress"} value={snapshot.operations.summary.onboardingInProgressCount} />
                <SummaryChip label={isZh ? "停用成员" : "Inactive members"} value={snapshot.operations.summary.inactiveMemberCount} />
              </>
            ) : null}
          </>
        }
        title={isZh ? "用户与成员" : "Users"}
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsUsersWorkspaceClient
          canManageAdminRoles={canManageOfficeSettings(context.currentMembership)}
          canManageTeams={canManageOfficeTeams(context.currentMembership)}
          canManageUsers={canManageOfficeUsers(context.currentMembership)}
          snapshot={snapshot}
        />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
