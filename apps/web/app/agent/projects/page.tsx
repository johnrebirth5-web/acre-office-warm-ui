import {
  canCreateProjectSigning,
  canManageProjectSigning,
  canViewProjectSigning,
  getFrontOfficeProjectSigningSnapshot,
} from "@acre/db";
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
        <FrontOfficeProjectsClient
          archivedProjectCount={snapshot.summary.archivedProjectCount}
          canCreateTemplate={canCreateTemplate}
          canManage={canManage}
          includeArchived={snapshot.summary.includeArchived}
          projects={snapshot.projects}
          templates={snapshot.templates}
        />
      }
      title="Project Signing"
    />
  );
}
