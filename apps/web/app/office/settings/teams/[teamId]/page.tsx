import Link from "next/link";
import { canManageOfficeTeams, canViewOfficeTeams } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../../_components/office-detail-page-template";
import { OfficeSettingsNav } from "../../settings-nav";
import {
  getBranchLeaderLabel,
  getBranchTypeLabel,
  getChildCollectionLabel,
  getDirectMembers,
  getLeaderTitleLabel
} from "../team-directory-shared";
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
    officeId: context.currentOffice?.id ?? null,
    scopeMode: "teams"
  });
  const team = snapshot.teams.find((item) => item.id === teamId) ?? null;

  if (!team) {
    notFound();
  }

  const directMembers = getDirectMembers(team);

  return (
    <OfficeDetailPageShell className="office-settings-team-detail-page">
      <OfficeDetailPageHeader
        description={`${team.teamPathLabel} · ${team.memberCount} total members`}
        eyebrow="Office admin"
        summary={
          <>
            <Link className="office-button-secondary office-button-sm" href="/office/settings/teams">
              Back to teams
            </Link>
            <SummaryChip label="Type" value={getBranchTypeLabel(team)} />
            <SummaryChip label={getLeaderTitleLabel(team)} tone="accent" value={getBranchLeaderLabel(team)} />
            <SummaryChip label={getChildCollectionLabel(team)} value={team.childTeamCount} />
            <SummaryChip label="Direct agents" value={directMembers.length} />
          </>
        }
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
    </OfficeDetailPageShell>
  );
}
