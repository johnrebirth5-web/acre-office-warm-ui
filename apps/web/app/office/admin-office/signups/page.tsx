import Link from "next/link";
import { canViewAdminOffice } from "@acre/auth";
import { listAdminOfficeEvents } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/admin-office/calendar">{isZh ? "创建活动" : "Create event"}</Link>}
        title={isZh ? "活动报名" : "Event signups"}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title={isZh ? "报名活动" : "Signup events"}>
        {signupEvents.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">{isZh ? "本月没有需要报名的活动。" : "No signup events this month."}</p>
            <Link className="office-button-primary" href="/office/admin-office/calendar">{isZh ? "创建活动" : "Create event"}</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={isZh ? ["活动", "类型", "时间", "已报名", ""] : ["Event", "Type", "Time", "Signed up", ""]} gridTemplateColumns="minmax(260px, 2fr) 150px 180px 120px 90px">
            {signupEvents.map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}<span>{event.location}</span></strong>
                <AdminOfficeStatusBadge>{event.eventType}</AdminOfficeStatusBadge>
                <span>{event.startsAt}</span>
                <span>{event.rsvpCount}{event.capacity ? ` / ${event.capacity}` : ""}</span>
                <Link href={event.href}>{isZh ? "打开" : "Open"}</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
