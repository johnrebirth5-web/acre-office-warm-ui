import { canManageOfficeTeams, canViewOfficeTeams } from "@acre/auth";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
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
    officeId: context.currentOffice?.id ?? null,
    scopeMode: "teams"
  });
  const rootTeams = getRootTeams(snapshot);
  const totalChildBranches = getTotalChildBranchCount(snapshot);
  const unassignedBranches = getUnassignedBranchCount(snapshot);
  const isManageView = resolvedSearchParams.view === "manage";

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Teams" tone="accent" value={rootTeams.length} />
            <SummaryChip label="Child teams" value={totalChildBranches} />
            <SummaryChip label="Rostered members" value={snapshot.summary.totalMembers} />
            <SummaryChip label="Needs owner" value={unassignedBranches} />
          </>
        }
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
    </OfficeListPageShell>
  );
}
