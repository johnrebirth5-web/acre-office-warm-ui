import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { listAdminOfficeEvents } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { AdminEventForm } from "../admin-office-client";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../_shared";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOfficeCalendarPage(props: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listAdminOfficeEvents({
    organizationId: context.currentOrganization.id,
    focusDate: readParam(searchParams.month),
  });
  const canManage = canManageAdminOffice(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader title="公司日历" />
      <AdminOfficeModuleNav />
      {canManage ? (
        <OfficeListPageTableCard title="创建活动">
          <AdminEventForm />
        </OfficeListPageTableCard>
      ) : null}
      <OfficeListPageTableCard title="本月">
        {snapshot.events.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">本月没有公司活动。</p>
            {canManage ? <Link className="office-button-primary" href="/office/admin-office/calendar">创建活动</Link> : null}
          </div>
        ) : (
          <AdminOfficeDataTable columns={["活动", "类型", "时间", "地点", "报名", ""]} gridTemplateColumns="minmax(240px, 2fr) 140px 180px minmax(160px, 1fr) 120px 90px">
            {snapshot.events.map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}</strong>
                <AdminOfficeStatusBadge>{event.eventType}</AdminOfficeStatusBadge>
                <span>{event.startsAt}</span>
                <span>{event.location || "—"}</span>
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
