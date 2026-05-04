import {
  canCreateProjectSigning,
  canManageProjectSigning,
  canViewProjectSigning,
  getFrontOfficeProjectSigningSnapshot,
} from "@acre/db";
import { ListPageStatsGrid, SectionCard, StatCard, SummaryChip } from "@acre/ui";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";
import { FrontOfficeProjectsClient } from "./front-office-projects-client";

export default async function AgentProjectsPage(props: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  const context = await requireSessionContext();

  if (!canViewProjectSigning(context.currentMembership)) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="projects"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const searchParams = (await props.searchParams) ?? {};
  const includeArchived = searchParams.archived === "1";
  const canManage = canManageProjectSigning(context.currentMembership);
  const canCreateTemplate = canCreateProjectSigning(context.currentMembership);

  const snapshot = await getFrontOfficeProjectSigningSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
    includeArchived,
  });

  return (
    <FrontOfficePageTemplate
      description="Bundle project sales documents into one signing flow, hand an iPad to buyers, and keep the signed archive under the right project automatically."
      eyebrow="Front Office"
      main={
        <>
          <SectionCard
            className="office-list-card front-office-projects-overview front-office-projects-kpi-card"
            subtitle="The workbench below follows the same path every time: project, template fields, session, then delivery."
            title="Project signing workspace"
          >
            <ListPageStatsGrid className="office-kpi-grid-compact">
              <StatCard
                hint="Visible to your role scope"
                label="Projects"
                tone="accent"
                value={snapshot.summary.projectCount}
              />
              <StatCard
                hint="Awaiting or partially signed"
                label="Active sessions"
                tone="accent"
                value={snapshot.summary.activeSessionCount}
              />
              <StatCard
                hint="Archived signed PDFs"
                label="Archive"
                tone="default"
                value={snapshot.summary.archivedDocumentCount}
              />
              <StatCard
                hint="Needs retry or admin review"
                label="Job failures"
                tone={snapshot.summary.failedJobCount ? "accent" : "default"}
                value={snapshot.summary.failedJobCount}
              />
            </ListPageStatsGrid>
          </SectionCard>

          <FrontOfficeProjectsClient
            archivedProjectCount={snapshot.summary.archivedProjectCount}
            canCreateTemplate={canCreateTemplate}
            canManage={canManage}
            includeArchived={snapshot.summary.includeArchived}
            projects={snapshot.projects}
            templates={snapshot.templates}
          />
        </>
      }
      summary={
        <>
          <SummaryChip label="Projects" tone="accent" value={snapshot.summary.projectCount} />
          <SummaryChip label="Active sessions" tone="accent" value={snapshot.summary.activeSessionCount} />
          <SummaryChip label="Archived docs" value={snapshot.summary.archivedDocumentCount} />
        </>
      }
      title="Project Signing"
    />
  );
}
