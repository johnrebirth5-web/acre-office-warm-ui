import { canCreateProjectSigning, getProjectSigningTemplateFieldEditorSnapshot } from "@acre/db";
import { Button, SectionCard, SummaryChip } from "@acre/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FrontOfficeAccessNotice } from "../../../../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../../../../_components/front-office-page-template";
import { requireSessionContext } from "../../../../../../lib/auth-session";
import { ProjectSigningTemplateFieldEditor } from "../../../project-signing-template-field-editor";

export default async function ProjectSigningTemplateFieldsPage(props: {
  params: Promise<{ templateId: string }>;
}) {
  const context = await requireSessionContext();

  if (!canCreateProjectSigning(context.currentMembership)) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="projects"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const { templateId } = await props.params;
  const snapshot = await getProjectSigningTemplateFieldEditorSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
    templateId,
  });

  if (!snapshot) {
    notFound();
  }

  const pdfUrl = `/api/agent/projects/templates/${encodeURIComponent(templateId)}/pdf`;

  return (
    <FrontOfficePageTemplate
      description="Set the reusable field layout before creating Project Signing sessions."
      eyebrow="Project Signing"
      main={
        <>
          {!snapshot.template.hasPdfSource ? (
            <SectionCard
              className="office-list-card"
              subtitle="Upload a source PDF before placing signature fields."
              title="PDF source required"
            >
              <Link href="/agent/projects">
                <Button type="button" variant="secondary">
                  Back to Project Signing
                </Button>
              </Link>
            </SectionCard>
          ) : (
            <ProjectSigningTemplateFieldEditor pdfUrl={pdfUrl} template={snapshot.template} />
          )}
        </>
      }
      summary={
        <>
          <SummaryChip label="Version" value={`v${snapshot.template.version}`} />
          <SummaryChip label="Recipients" value={snapshot.template.recipients.length} />
          <SummaryChip label="Fields" tone={snapshot.template.fields.length ? "accent" : "default"} value={snapshot.template.fields.length} />
        </>
      }
      title={`Set Fields · ${snapshot.template.name}`}
    />
  );
}
