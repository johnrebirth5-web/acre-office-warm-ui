import { canCreateProjectSigning, getProjectSigningTemplateFieldEditorSnapshot } from "@acre/db";
import { Button, SectionCard, SummaryChip } from "@acre/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FrontOfficeAccessNotice } from "../../../../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../../../../_components/front-office-page-template";
import { requireSessionContext } from "../../../../../../lib/auth-session";
import { getServerI18n } from "../../../../../../lib/i18n/server";
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

  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const pdfUrl = `/api/agent/projects/templates/${encodeURIComponent(templateId)}/pdf`;

  return (
    <FrontOfficePageTemplate
      description={isZh ? "创建项目签署会话前，先设置可复用的字段布局。" : "Set the reusable field layout before creating Project Signing sessions."}
      eyebrow={isZh ? "项目签署" : "Project Signing"}
      main={
        <>
          {!snapshot.template.hasPdfSource ? (
            <SectionCard
              className="office-list-card"
              subtitle={isZh ? "放置签名字段前，请先上传源 PDF。" : "Upload a source PDF before placing signature fields."}
              title={isZh ? "需要 PDF 源文件" : "PDF source required"}
            >
              <Link href="/agent/projects">
                <Button type="button" variant="secondary">
                  {isZh ? "返回项目签署" : "Back to Project Signing"}
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
          <SummaryChip label={isZh ? "版本" : "Version"} value={`v${snapshot.template.version}`} />
          <SummaryChip label={isZh ? "收件人" : "Recipients"} value={snapshot.template.recipients.length} />
          <SummaryChip label={isZh ? "字段" : "Fields"} tone={snapshot.template.fields.length ? "accent" : "default"} value={snapshot.template.fields.length} />
        </>
      }
      title={`${isZh ? "设置字段" : "Set Fields"} · ${snapshot.template.name}`}
    />
  );
}
