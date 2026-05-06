import Link from "next/link";
import { canManageOfficeHrOffboarding, canViewOfficeHr } from "@acre/auth";
import { getHrOffboardingCaseDetail } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { HrChecklistItemButton } from "../../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../../_shared";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function HrOffboardingDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const { caseId } = await params;
  const snapshot = await getHrOffboardingCaseDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    caseId,
  });
  if (!snapshot) {
    notFound();
  }
  const canManage = canManageOfficeHrOffboarding(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/hr/offboarding">Back</Link>}
        summary={
          <>
            <SummaryChip label="Status" value={snapshot.case.status} />
            <SummaryChip label="Finance" value={snapshot.case.financeHandoffStatus || "—"} />
            <SummaryChip label="Access closed" value={snapshot.case.accessClosedAt || "—"} />
          </>
        }
        title={snapshot.case.candidateName}
      />
      <HrModuleNav />

      <OfficeListPageTableCard title="Offboarding case">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>Email</span><strong>{snapshot.case.candidateEmail}</strong></div>
          <div className="office-detail-field"><span>Position</span><strong>{snapshot.case.position || "—"}</strong></div>
          <div className="office-detail-field"><span>Supervisor</span><strong>{snapshot.case.directSupervisor || "—"}</strong></div>
          <div className="office-detail-field"><span>Last working date</span><strong>{snapshot.case.lastWorkingDate || "—"}</strong></div>
          <div className="office-detail-field"><span>Form</span><strong><a href={snapshot.case.externalFormUrl} rel="noreferrer" target="_blank">Open form</a></strong></div>
          <div className="office-detail-field"><span>License unlink</span><strong>{snapshot.case.salespersonLicenseUnlinkRequired ? "Required" : "Not required"}</strong></div>
        </div>
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Checklist">
        {snapshot.checklistInstances.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No checklist has been created.</p></div>
        ) : snapshot.checklistInstances.map((instance) => (
          <HrDataTable columns={["Item", "Status", "Completed", ""]} gridTemplateColumns="minmax(260px, 2fr) 130px 180px 130px" key={instance.id}>
            {instance.items.map((item) => (
              <div className="office-table-row" key={item.id} role="row">
                <strong>{item.title}</strong>
                <HrStatusBadge tone={item.status === "completed" ? "success" : "neutral"}>{item.status}</HrStatusBadge>
                <span>{item.completedAt || "—"}</span>
                {canManage ? <HrChecklistItemButton completed={item.status === "completed"} itemId={item.id} /> : <span />}
              </div>
            ))}
          </HrDataTable>
        ))}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
