import { canManageOfficeTeams, canViewOfficeTeams } from "@acre/auth";
import { ListPageStack, PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { getRootTeams, getTotalChildBranchCount, getUnassignedBranchCount } from "./team-directory-shared";
import { OfficeSettingsTeamsClient } from "./teams-client";
import { OfficeSettingsTeamsManageClient } from "./teams-manage-client";

type OfficeSettingsTeamsPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function OfficeSettingsTeamsPage({ searchParams }: OfficeSettingsTeamsPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeTeams(context.currentMembership)) {
    redirect("/office/settings");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const snapshot = await getOfficeAgentsRosterSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null
  });
  const rootTeams = getRootTeams(snapshot);
  const totalChildBranches = getTotalChildBranchCount(snapshot);
  const unassignedBranches = getUnassignedBranchCount(snapshot);
  const isManageView = resolvedSearchParams.view === "manage";

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Top-level teams" tone="accent" value={rootTeams.length} />
            <SummaryChip label="Child branches" value={totalChildBranches} />
            <SummaryChip label="Rostered members" value={snapshot.summary.totalMembers} />
            <SummaryChip label="Unassigned branches" value={unassignedBranches} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title={isManageView ? "Teams · Advanced Manage View" : "Teams"}
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        {isManageView ? (
          <OfficeSettingsTeamsManageClient canManageTeams={canManageOfficeTeams(context.currentMembership)} snapshot={snapshot} />
        ) : (
          <OfficeSettingsTeamsClient canManageTeams={canManageOfficeTeams(context.currentMembership)} snapshot={snapshot} />
        )}
      </ListPageStack>
    </PageShell>
  );
}
