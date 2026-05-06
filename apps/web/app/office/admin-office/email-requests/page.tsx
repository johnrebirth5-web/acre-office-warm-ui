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
            <SummaryChip label="Total" value={snapshot.summary.totalCount} />
            <SummaryChip label="Pending" tone="accent" value={snapshot.summary.pendingCount} />
            <SummaryChip label="Approved" value={snapshot.summary.approvedCount} />
            <SummaryChip label="Completed" value={snapshot.summary.completedCount} />
          </>
        }
        title="Email requests"
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard
        filters={
          <nav className="office-filter-bar" aria-label="Email request status">
            {["all", "pending", "approved", "completed", "rejected"].map((status) => (
              <Link className="office-filter-chip" href={status === "all" ? "/office/admin-office/email-requests" : `/office/admin-office/email-requests?status=${status}`} key={status}>{status}</Link>
            ))}
          </nav>
        }
        title="Requests"
      >
        {snapshot.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No email requests matched this view.</p>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["Name", "Preferred prefix", "Status", "Updated", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 180px 90px">
            {snapshot.requests.map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <span>{request.updatedAt}</span>
                <Link href={request.href}>Open</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="New request">
          <AdminEmailRequestForm />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
