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
        actions={<Link className="office-button-secondary" href="/office/admin-office/email-requests">返回</Link>}
        summary={
          <>
            <SummaryChip label="状态" value={request.status} />
            <SummaryChip label="更新" value={request.updatedAt} />
          </>
        }
        title={request.fullName}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title="申请">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>姓名</span><strong>{request.fullName}</strong></div>
          <div className="office-detail-field"><span>首选前缀</span><strong>{request.preferredEmailPrefix}</strong></div>
          <div className="office-detail-field"><span>状态</span><strong><AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge></strong></div>
          <div className="office-detail-field"><span>创建时间</span><strong>{request.createdAt}</strong></div>
        </div>
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="更新状态">
          <AdminEmailStatusForm requestId={request.id} />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
