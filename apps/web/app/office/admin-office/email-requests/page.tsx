import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { listAdminEmailRequests } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { AdminEmailRequestForm } from "../admin-office-client";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../_shared";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusFilterLabels: Record<string, string> = {
  all: "全部",
  pending: "待处理",
  approved: "已批准",
  completed: "已完成",
  rejected: "已拒绝",
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

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        summary={
          <>
            <SummaryChip label="总数" value={snapshot.summary.totalCount} />
            <SummaryChip label="待处理" tone="accent" value={snapshot.summary.pendingCount} />
            <SummaryChip label="已批准" value={snapshot.summary.approvedCount} />
            <SummaryChip label="已完成" value={snapshot.summary.completedCount} />
          </>
        }
        title="邮箱申请"
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard
        filters={
          <nav className="office-filter-bar" aria-label="邮箱申请状态">
            {["all", "pending", "approved", "completed", "rejected"].map((status) => (
              <Link className="office-filter-chip" href={status === "all" ? "/office/admin-office/email-requests" : `/office/admin-office/email-requests?status=${status}`} key={status}>{statusFilterLabels[status] ?? status}</Link>
            ))}
          </nav>
        }
        title="申请"
      >
        {snapshot.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">当前视图没有匹配的邮箱申请。</p>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["姓名", "首选前缀", "状态", "更新", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 180px 90px">
            {snapshot.requests.map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <span>{request.updatedAt}</span>
                <Link href={request.href}>打开</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="新建申请">
          <AdminEmailRequestForm />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
