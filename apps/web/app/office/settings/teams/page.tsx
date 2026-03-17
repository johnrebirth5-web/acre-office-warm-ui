import { canManageOfficeTeams, canViewOfficeTeams } from "@acre/auth";
import { ListPageStack, PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeSettingsNav } from "../settings-nav";
import { OfficeSettingsTeamsClient } from "./teams-client";

export default async function OfficeSettingsTeamsPage() {
  const context = await requireOfficeSession();

  if (!canViewOfficeTeams(context.currentMembership)) {
    redirect("/office/settings");
  }

  const snapshot = await getOfficeAgentsRosterSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null
  });

  return (
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Teams" tone="accent" value={snapshot.teams.length} />
            <SummaryChip label="Rostered members" value={snapshot.summary.totalMembers} />
            <SummaryChip label="Onboarding in progress" value={snapshot.summary.onboardingInProgressCount} />
          </PageHeaderSummary>
        }
        description="Administrative team roster management for operational grouping, assignment, and active/inactive team structure."
        eyebrow="Office admin"
        title="Teams"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <OfficeSettingsTeamsClient canManageTeams={canManageOfficeTeams(context.currentMembership)} snapshot={snapshot} />
      </ListPageStack>
    </PageShell>
  );
}
