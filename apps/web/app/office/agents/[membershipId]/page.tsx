import { canManageOfficeAgents, canManageOfficeGoals, canManageOfficeOnboarding, canManageOfficeTeams, canViewOfficeAgents } from "@acre/auth";
import { getOfficeAgentProfileSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { AgentProfileClient } from "./agent-profile-client";

type OfficeAgentProfilePageProps = {
  params: Promise<{
    membershipId: string;
  }>;
};

export default async function OfficeAgentProfilePage({ params }: OfficeAgentProfilePageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeAgents(context.currentMembership.role)) {
    redirect("/office/dashboard");
  }

  const { membershipId } = await params;
  const snapshot = await getOfficeAgentProfileSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <AgentProfileClient
      canManageAgents={canManageOfficeAgents(context.currentMembership.role)}
      canManageGoals={canManageOfficeGoals(context.currentMembership.role)}
      canManageOnboarding={canManageOfficeOnboarding(context.currentMembership.role)}
      canManageTeams={canManageOfficeTeams(context.currentMembership.role)}
      snapshot={snapshot}
    />
  );
}
