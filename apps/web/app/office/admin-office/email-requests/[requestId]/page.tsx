import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { getAdminEmailRequest } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { getServerI18n } from "../../../../../lib/i18n/server";
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/admin-office/email-requests">{isZh ? "返回" : "Back"}</Link>}
        summary={
          <>
            <SummaryChip label={isZh ? "状态" : "Status"} value={request.status} />
            <SummaryChip label={isZh ? "更新" : "Updated"} value={request.updatedAt} />
          </>
        }
        title={request.fullName}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title={isZh ? "申请" : "Request"}>
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>{isZh ? "姓名" : "Full name"}</span><strong>{request.fullName}</strong></div>
          <div className="office-detail-field"><span>{isZh ? "首选前缀" : "Preferred prefix"}</span><strong>{request.preferredEmailPrefix}</strong></div>
          <div className="office-detail-field"><span>{isZh ? "状态" : "Status"}</span><strong><AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge></strong></div>
          <div className="office-detail-field"><span>{isZh ? "创建时间" : "Created"}</span><strong>{request.createdAt}</strong></div>
        </div>
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title={isZh ? "更新状态" : "Update status"}>
          <AdminEmailStatusForm requestId={request.id} />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
