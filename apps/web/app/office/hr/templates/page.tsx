import Link from "next/link";
import { canManageOfficeHrTemplates, canViewOfficeHr } from "@acre/auth";
import { listHrDocumentTemplates } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { HrTemplateForm } from "../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../_shared";

export default async function HrTemplatesPage() {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const snapshot = await listHrDocumentTemplates({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
  });
  const canManage = canManageOfficeHrTemplates(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader title="HR templates" />
      <HrModuleNav />
      <OfficeListPageTableCard title="Templates">
        {snapshot.templates.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No managed templates yet.</p></div>
        ) : (
          <HrDataTable columns={["Template", "Type", "Company", "Sync", ""]} gridTemplateColumns="minmax(260px, 2fr) 170px 150px 130px 90px">
            {snapshot.templates.map((template) => (
              <div className="office-table-row" key={template.id} role="row">
                <strong>{template.name}<span>{template.sourceUrl}</span></strong>
                <span>{template.type}</span>
                <span>{template.company || "—"}</span>
                <HrStatusBadge>{template.syncState}</HrStatusBadge>
                <Link href={template.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>
      <OfficeListPageTableCard title="Google Drive references">
        <HrDataTable columns={["Template", "Type", "Company", ""]} gridTemplateColumns="minmax(260px, 2fr) 170px 150px 90px">
          {snapshot.defaults.map((template) => (
            <div className="office-table-row" key={template.driveFileId} role="row">
              <strong>{template.name}<span>{template.driveFileId}</span></strong>
              <span>{template.type}</span>
              <span>{template.company}</span>
              <a href={template.sourceUrl} rel="noreferrer" target="_blank">Open</a>
            </div>
          ))}
        </HrDataTable>
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="New template">
          <HrTemplateForm />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
