import Link from "next/link";
import { canViewAdminOffice } from "@acre/auth";
import { listAdminEmailRequests, listAdminOfficeEvents } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../_components/office-list-page-template";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "./_shared";

export default async function AdminOfficePage() {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const [emailRequests, calendar] = await Promise.all([
    listAdminEmailRequests({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
    }),
    listAdminOfficeEvents({
      organizationId: context.currentOrganization.id,
    }),
  ]);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/admin-office/calendar">创建活动</Link>}
        eyebrow="后台"
        summary={
          <>
            <SummaryChip label="邮箱申请" value={emailRequests.summary.totalCount} />
            <SummaryChip label="待处理" tone="accent" value={emailRequests.summary.pendingCount} />
            <SummaryChip label="本月活动" value={calendar.events.length} />
          </>
        }
        title="行政"
      />
      <AdminOfficeModuleNav />

      <OfficeListPageTableCard title="邮箱申请">
        {emailRequests.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">还没有邮箱申请。</p>
            <Link className="office-button-primary" href="/office/admin-office/email-requests">新建申请</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["姓名", "前缀", "状态", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 90px">
            {emailRequests.requests.slice(0, 8).map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <Link href={request.href}>打开</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="公司日历">
        {calendar.events.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">本月没有公司活动。</p>
            <Link className="office-button-primary" href="/office/admin-office/calendar">创建活动</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["活动", "类型", "时间", "报名", ""]} gridTemplateColumns="minmax(240px, 2fr) 140px 180px 120px 90px">
            {calendar.events.slice(0, 8).map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}<span>{event.location}</span></strong>
                <span>{event.eventType}</span>
                <span>{event.startsAt}</span>
                <span>{event.signupRequired ? event.rsvpCount : "—"}</span>
                <Link href={event.href}>打开</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
