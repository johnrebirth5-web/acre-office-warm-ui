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
            {canManage ? <a className="office-button-secondary" href={`/api/office/admin-office/events/${eventId}/export`}>Export CSV</a> : null}
            <Link className="office-button-secondary" href="/office/admin-office/signups">Back</Link>
          </>
        }
        summary={
          <>
            <SummaryChip label="Type" value={snapshot.event.eventType} />
            <SummaryChip label="Starts" value={snapshot.event.startsAt} />
            <SummaryChip label="Signups" value={snapshot.event.rsvpCount} />
          </>
        }
        title={snapshot.event.title}
      />
      <AdminOfficeModuleNav />
      <OfficeListPageTableCard title="Event">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>Time</span><strong>{snapshot.event.startsAt}</strong></div>
          <div className="office-detail-field"><span>Location</span><strong>{snapshot.event.location || "—"}</strong></div>
          <div className="office-detail-field"><span>Capacity</span><strong>{snapshot.event.capacity ?? "—"}</strong></div>
          <div className="office-detail-field"><span>Signup closes</span><strong>{snapshot.event.signupClosesAt || "—"}</strong></div>
        </div>
      </OfficeListPageTableCard>
      <OfficeListPageTableCard title="Signup list">
        {snapshot.signups.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No signups yet.</p></div>
        ) : (
          <AdminOfficeDataTable columns={["Name", "Email", "Status", "Responded"]} gridTemplateColumns="minmax(220px, 2fr) minmax(220px, 2fr) 130px 180px">
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
