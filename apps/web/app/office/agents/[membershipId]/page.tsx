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

  if (!canViewOfficeAgents(context.currentMembership)) {
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
      canManageAgents={canManageOfficeAgents(context.currentMembership)}
      canManageGoals={canManageOfficeGoals(context.currentMembership)}
      canManageOnboarding={canManageOfficeOnboarding(context.currentMembership)}
      canManageTeams={canManageOfficeTeams(context.currentMembership)}
      snapshot={snapshot}
    />
  );
}
