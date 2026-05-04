import {
  canCreateProjectSigning,
  canManageProjectSigning,
  canViewProjectSigning,
  getFrontOfficeProjectSigningSnapshot,
} from "@acre/db";
import { EmptyState, ListPageStatsGrid, QueueItem, SectionCard, StatCard, SummaryChip } from "@acre/ui";
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
            className="office-list-card front-office-projects-overview"
            subtitle="A project-first signing workspace for reservations, waivers, disclosures, and buyer acknowledgments."
            title="Project signing workspace"
          >
            <ListPageStatsGrid>
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

            {snapshot.projects.length ? (
              <div className="office-queue-list">
                {snapshot.projects.map((project) => (
                  <QueueItem
                    badgeLabel={project.status}
                    badgeTone={project.status === "active" ? "accent" : "neutral"}
                    description={project.addressLabel}
                    key={project.id}
                    meta={
                      <>
                        <span>{project.sessionCount} sessions</span>
                        <span>{project.archivedDocumentCount} archived docs</span>
                        <span>Responsible: {project.responsibleLabel}</span>
                      </>
                    }
                    title={`${project.code} · ${project.name}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                description="Create the first project, attach project-sales templates, then start an iPad handoff or remote signing session."
                title="No project signing records yet"
              />
            )}
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
