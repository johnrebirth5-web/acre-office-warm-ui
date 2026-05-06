import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { listAdminEmailRequests } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { AdminEmailRequestForm } from "../admin-office-client";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../_shared";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusFilterLabels: Record<string, { en: string; zh: string }> = {
  all: { en: "All", zh: "全部" },
  pending: { en: "Pending", zh: "待处理" },
  approved: { en: "Approved", zh: "已批准" },
  completed: { en: "Completed", zh: "已完成" },
  rejected: { en: "Rejected", zh: "已拒绝" },
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOfficeEmailRequestsPage(props: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listAdminEmailRequests({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    status: readParam(searchParams.status),
  });
  const canManage = canManageAdminOffice(context.currentMembership);
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        summary={
          <>
            <SummaryChip label={isZh ? "总数" : "Total"} value={snapshot.summary.totalCount} />
            <SummaryChip label={isZh ? "待处理" : "Pending"} tone="accent" value={snapshot.summary.pendingCount} />
            <SummaryChip label={isZh ? "已批准" : "Approved"} value={snapshot.summary.approvedCount} />
            <SummaryChip label={isZh ? "已完成" : "Completed"} value={snapshot.summary.completedCount} />
          </>
        }
        title={isZh ? "邮箱申请" : "Email requests"}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard
        filters={
          <nav className="office-filter-bar" aria-label={isZh ? "邮箱申请状态" : "Email request status"}>
            {["all", "pending", "approved", "completed", "rejected"].map((status) => (
              <Link className="office-filter-chip" href={status === "all" ? "/office/admin-office/email-requests" : `/office/admin-office/email-requests?status=${status}`} key={status}>{isZh ? statusFilterLabels[status]?.zh ?? status : statusFilterLabels[status]?.en ?? status}</Link>
            ))}
          </nav>
        }
        title={isZh ? "申请" : "Requests"}
      >
        {snapshot.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">{isZh ? "当前视图没有匹配的邮箱申请。" : "No email requests matched this view."}</p>
          </div>
        ) : (
          <AdminOfficeDataTable columns={isZh ? ["姓名", "首选前缀", "状态", "更新", ""] : ["Name", "Preferred prefix", "Status", "Updated", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 180px 90px">
            {snapshot.requests.map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <span>{request.updatedAt}</span>
                <Link href={request.href}>{isZh ? "打开" : "Open"}</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title={isZh ? "新建申请" : "New request"}>
          <AdminEmailRequestForm />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
