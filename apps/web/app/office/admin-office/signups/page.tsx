import Link from "next/link";
import { canViewAdminOffice } from "@acre/auth";
import { listAdminOfficeEvents } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../_shared";

export default async function AdminOfficeSignupsPage() {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const snapshot = await listAdminOfficeEvents({
    organizationId: context.currentOrganization.id,
  });
  const signupEvents = snapshot.events.filter((event) => event.signupRequired);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/admin-office/calendar">创建活动</Link>}
        title="活动报名"
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title="报名活动">
        {signupEvents.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">本月没有需要报名的活动。</p>
            <Link className="office-button-primary" href="/office/admin-office/calendar">创建活动</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["活动", "类型", "时间", "已报名", ""]} gridTemplateColumns="minmax(260px, 2fr) 150px 180px 120px 90px">
            {signupEvents.map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}<span>{event.location}</span></strong>
                <AdminOfficeStatusBadge>{event.eventType}</AdminOfficeStatusBadge>
                <span>{event.startsAt}</span>
                <span>{event.rsvpCount}{event.capacity ? ` / ${event.capacity}` : ""}</span>
                <Link href={event.href}>打开</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
