import {
  canManageOfficeAgents,
  canManageOfficeGoals,
  canManageOfficeOnboarding,
  canManageOfficeTeams,
  canViewOfficeAgents
} from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAgentsRosterSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeAgentsClient } from "./agents-client";

type OfficeAgentsPageProps = {
  searchParams?: Promise<{
    officeId?: string;
    role?: string;
    teamId?: string;
    onboardingStatus?: string;
    membershipStatus?: string;
    q?: string;
  }>;
};

export default async function OfficeAgentsPage(props: OfficeAgentsPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeAgents(context.currentMembership.role)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeAgentsRosterSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    officeFilterId: searchParams.officeId,
    role: searchParams.role,
    teamId: searchParams.teamId,
    onboardingStatus: searchParams.onboardingStatus,
    membershipStatus: searchParams.membershipStatus,
    q: searchParams.q
  });

  return (
    <PageShell className="office-list-page office-agents-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary className="office-agents-header-summary">
            <SummaryChip
              className="office-agents-summary-card office-agents-summary-card-featured"
              label="Office scope"
              value={context.currentOffice?.name ?? context.currentOrganization.name}
            />
            <SummaryChip className="office-agents-summary-card" label="Rostered members" tone="accent" value={snapshot.summary.totalMembers} />
            <SummaryChip className="office-agents-summary-card" label="Active teams" value={snapshot.summary.activeTeamCount} />
            <SummaryChip className="office-agents-summary-card" label="Onboarding in progress" value={snapshot.summary.onboardingInProgressCount} />
            <SummaryChip className="office-agents-summary-card" label="Inactive members" value={snapshot.summary.inactiveMemberCount} />
          </PageHeaderSummary>
        }
        description="Agent profiles, onboarding progress, team assignments, goals, and day-to-day operating visibility for the current office."
        eyebrow="Agent management"
        title="Agents"
      />

      <OfficeAgentsClient
        canManageAgents={canManageOfficeAgents(context.currentMembership.role)}
        canManageGoals={canManageOfficeGoals(context.currentMembership.role)}
        canManageOnboarding={canManageOfficeOnboarding(context.currentMembership.role)}
        canManageTeams={canManageOfficeTeams(context.currentMembership.role)}
        snapshot={snapshot}
      />
    </PageShell>
  );
}
