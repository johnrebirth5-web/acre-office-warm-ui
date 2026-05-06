import Link from "next/link";
import { canManageOfficeHr, canViewOfficeHr } from "@acre/auth";
import { getHrOnboardingCaseDetail } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { HrChecklistItemButton, HrIssueOnboardingTokenButton } from "../../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../../_shared";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function HrOnboardingDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const { caseId } = await params;
  const snapshot = await getHrOnboardingCaseDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    caseId,
  });
  if (!snapshot) {
    notFound();
  }
  const canManage = canManageOfficeHr(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/hr/onboarding">Back</Link>}
        summary={
          <>
            <SummaryChip label="Status" value={snapshot.case.status} />
            <SummaryChip label="Token expires" value={snapshot.case.tokenExpiresAt || "—"} />
            <SummaryChip label="Drive" value={snapshot.case.driveSyncState} />
          </>
        }
        title={snapshot.case.candidateName}
      />
      <HrModuleNav />

      <OfficeListPageTableCard actions={canManage ? <HrIssueOnboardingTokenButton caseId={caseId} /> : null} title="Onboarding window">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>Email</span><strong>{snapshot.case.candidateEmail}</strong></div>
          <div className="office-detail-field"><span>Position</span><strong>{snapshot.case.position || "—"}</strong></div>
          <div className="office-detail-field"><span>Team lead</span><strong>{snapshot.case.teamLeadName || "—"}</strong></div>
          <div className="office-detail-field"><span>Google form</span><strong><a href={snapshot.case.legalFormUrl} rel="noreferrer" target="_blank">Open form</a></strong></div>
        </div>
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Documents">
        {snapshot.documents.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No documents uploaded yet.</p></div>
        ) : (
          <HrDataTable columns={["Document", "Kind", "Uploaded"]} gridTemplateColumns="minmax(240px, 2fr) 160px 180px">
            {snapshot.documents.map((document) => (
              <div className="office-table-row" key={document.id} role="row">
                <strong>{document.title}<span>{document.fileName}</span></strong>
                <span>{document.kind}</span>
                <span>{document.createdAt}</span>
              </div>
            ))}
          </HrDataTable>
        )}
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
