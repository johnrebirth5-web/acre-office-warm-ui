import Link from "next/link";
import { canViewAdminOffice } from "@acre/auth";
import { listAdminEmailRequests, listAdminOfficeEvents } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/admin-office/calendar">{isZh ? "创建活动" : "Create event"}</Link>}
        eyebrow={isZh ? "后台" : "Back Office"}
        summary={
          <>
            <SummaryChip label={isZh ? "邮箱申请" : "Email requests"} value={emailRequests.summary.totalCount} />
            <SummaryChip label={isZh ? "待处理" : "Pending"} tone="accent" value={emailRequests.summary.pendingCount} />
            <SummaryChip label={isZh ? "本月活动" : "This month"} value={calendar.events.length} />
          </>
        }
        title={isZh ? "行政" : "Admin Office"}
      />
      <AdminOfficeModuleNav />

      <OfficeListPageTableCard title={isZh ? "邮箱申请" : "Email requests"}>
        {emailRequests.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">{isZh ? "还没有邮箱申请。" : "No email requests yet."}</p>
            <Link className="office-button-primary" href="/office/admin-office/email-requests">{isZh ? "新建申请" : "New request"}</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={isZh ? ["姓名", "前缀", "状态", ""] : ["Name", "Prefix", "Status", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 90px">
            {emailRequests.requests.slice(0, 8).map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <Link href={request.href}>{isZh ? "打开" : "Open"}</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title={isZh ? "公司日历" : "Company calendar"}>
        {calendar.events.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">{isZh ? "本月没有公司活动。" : "No company events this month."}</p>
            <Link className="office-button-primary" href="/office/admin-office/calendar">{isZh ? "创建活动" : "Create event"}</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={isZh ? ["活动", "类型", "时间", "报名", ""] : ["Event", "Type", "Time", "Signups", ""]} gridTemplateColumns="minmax(240px, 2fr) 140px 180px 120px 90px">
            {calendar.events.slice(0, 8).map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}<span>{event.location}</span></strong>
                <span>{event.eventType}</span>
                <span>{event.startsAt}</span>
                <span>{event.signupRequired ? event.rsvpCount : "—"}</span>
                <Link href={event.href}>{isZh ? "打开" : "Open"}</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
