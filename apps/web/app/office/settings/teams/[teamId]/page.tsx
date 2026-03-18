import Link from "next/link";
import { canManageOfficeTeams, canViewOfficeTeams } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeSettingsNav } from "../../settings-nav";
import { getBranchLeaderLabel, getBranchTypeLabel, getDirectMembers } from "../team-directory-shared";
import { OfficeSettingsTeamDetailClient } from "../team-detail-client";

type OfficeSettingsTeamDetailPageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function OfficeSettingsTeamDetailPage({ params }: OfficeSettingsTeamDetailPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeTeams(context.currentMembership)) {
    redirect("/office/settings");
  }

  const { teamId } = await params;
  const snapshot = await getOfficeAgentsRosterSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null
  });
  const team = snapshot.teams.find((item) => item.id === teamId) ?? null;

  if (!team) {
    notFound();
  }

  const directMembers = getDirectMembers(team);

  return (
    <PageShell className="office-detail-page office-settings-team-detail-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <Link className="office-button office-button-secondary office-button-sm" href="/office/settings/teams">
              Back to teams
            </Link>
            <SummaryChip label="Branch type" value={getBranchTypeLabel(team)} />
            <SummaryChip label="Leader" tone="accent" value={getBranchLeaderLabel(team)} />
            <SummaryChip label="Child branches" value={team.childTeamCount} />
            <SummaryChip label="Direct agents" value={directMembers.length} />
          </PageHeaderSummary>
        }
        description={`${team.teamPathLabel} · ${team.memberCount} total members`}
        eyebrow="Office admin"
        title={team.name}
      />

      <div className="office-list-page-stack office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsTeamDetailClient
          canManageTeams={canManageOfficeTeams(context.currentMembership)}
          snapshot={snapshot}
          teamId={team.id}
        />
      </div>
    </PageShell>
  );
}
