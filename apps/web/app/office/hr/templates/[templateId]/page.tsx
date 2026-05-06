import Link from "next/link";
import { canManageOfficeHrTemplates, canViewOfficeHr } from "@acre/auth";
import { getHrDocumentTemplate } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { HrTemplateForm } from "../../hr-client";
import { HrModuleNav } from "../../_shared";

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function HrTemplateDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const { templateId } = await params;
  const template = await getHrDocumentTemplate({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    templateId,
  });
  if (!template) {
    notFound();
  }
  if (!canManageOfficeHrTemplates(context.currentMembership)) {
    redirect("/office/hr/templates");
  }

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/hr/templates">Back</Link>}
        title={template.name}
      />
      <HrModuleNav />
      <OfficeListPageTableCard title="Template">
        <HrTemplateForm template={template} />
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
