import Link from "next/link";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import { getAdminOfficeEventSignupSnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { AdminSignupButton } from "../../admin-office-client";
import { AdminOfficeDataTable, AdminOfficeModuleNav, AdminOfficeStatusBadge } from "../../_shared";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminOfficeSignupDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewAdminOffice(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const { eventId } = await params;
  const snapshot = await getAdminOfficeEventSignupSnapshot({
    organizationId: context.currentOrganization.id,
    eventId,
  });
  if (!snapshot) {
    notFound();
  }
  const canManage = canManageAdminOffice(context.currentMembership);
  const currentSignup = snapshot.signups.find((signup) => signup.email === context.currentUser.email);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={
          <>
            {snapshot.event.signupRequired ? <AdminSignupButton eventId={eventId} isSignedUp={currentSignup?.status === "going"} /> : null}
            {canManage ? <a className="office-button-secondary" href={`/api/office/admin-office/events/${eventId}/export`}>导出 CSV</a> : null}
            <Link className="office-button-secondary" href="/office/admin-office/signups">返回</Link>
          </>
        }
        summary={
          <>
            <SummaryChip label="类型" value={snapshot.event.eventType} />
            <SummaryChip label="开始" value={snapshot.event.startsAt} />
            <SummaryChip label="报名" value={snapshot.event.rsvpCount} />
          </>
        }
        title={snapshot.event.title}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title="活动">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>时间</span><strong>{snapshot.event.startsAt}</strong></div>
          <div className="office-detail-field"><span>地点</span><strong>{snapshot.event.location || "—"}</strong></div>
          <div className="office-detail-field"><span>容量</span><strong>{snapshot.event.capacity ?? "—"}</strong></div>
          <div className="office-detail-field"><span>报名截止</span><strong>{snapshot.event.signupClosesAt || "—"}</strong></div>
        </div>
      </OfficeListPageTableCard>
      <OfficeListPageTableCard title="报名名单">
        {snapshot.signups.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">还没有报名记录。</p></div>
        ) : (
          <AdminOfficeDataTable columns={["姓名", "邮箱", "状态", "响应时间"]} gridTemplateColumns="minmax(220px, 2fr) minmax(220px, 2fr) 130px 180px">
            {snapshot.signups.map((signup) => (
              <div className="office-table-row" key={signup.id} role="row">
                <strong>{signup.name}</strong>
                <span>{signup.email}</span>
                <AdminOfficeStatusBadge tone={signup.status === "going" ? "success" : "neutral"}>{signup.status}</AdminOfficeStatusBadge>
                <span>{signup.respondedAt}</span>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
