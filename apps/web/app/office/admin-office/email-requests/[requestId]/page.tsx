import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { getAdminEmailRequest } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { AdminEmailStatusForm } from "../../admin-office-client";
import { AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../../_shared";

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function AdminEmailRequestDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const { requestId } = await params;
  const request = await getAdminEmailRequest({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    requestId,
  });
  if (!request) {
    notFound();
  }
  const canManage = canManageAdminOffice(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/admin-office/email-requests">Back</Link>}
        summary={
          <>
            <SummaryChip label="Status" value={request.status} />
            <SummaryChip label="Updated" value={request.updatedAt} />
          </>
        }
        title={request.fullName}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title="Request">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>Full name</span><strong>{request.fullName}</strong></div>
          <div className="office-detail-field"><span>Preferred prefix</span><strong>{request.preferredEmailPrefix}</strong></div>
          <div className="office-detail-field"><span>Status</span><strong><AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge></strong></div>
          <div className="office-detail-field"><span>Created</span><strong>{request.createdAt}</strong></div>
        </div>
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="Update status">
          <AdminEmailStatusForm requestId={request.id} />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
