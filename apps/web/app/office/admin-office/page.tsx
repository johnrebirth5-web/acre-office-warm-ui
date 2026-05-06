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
        actions={<Link className="office-button-primary" href="/office/admin-office/calendar">Create event</Link>}
        eyebrow="Back Office"
        summary={
          <>
            <SummaryChip label="Email requests" value={emailRequests.summary.totalCount} />
            <SummaryChip label="Pending" tone="accent" value={emailRequests.summary.pendingCount} />
            <SummaryChip label="This month" value={calendar.events.length} />
          </>
        }
        title="Admin Office"
      />
      <AdminOfficeModuleNav />

      <OfficeListPageTableCard title="Email requests">
        {emailRequests.requests.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No email requests yet.</p>
            <Link className="office-button-primary" href="/office/admin-office/email-requests">New request</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["Name", "Prefix", "Status", ""]} gridTemplateColumns="minmax(220px, 2fr) 180px 140px 90px">
            {emailRequests.requests.slice(0, 8).map((request) => (
              <div className="office-table-row" key={request.id} role="row">
                <strong>{request.fullName}</strong>
                <span>{request.preferredEmailPrefix}</span>
                <AdminOfficeStatusBadge>{request.status}</AdminOfficeStatusBadge>
                <Link href={request.href}>Open</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Company calendar">
        {calendar.events.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No company events this month.</p>
            <Link className="office-button-primary" href="/office/admin-office/calendar">Create event</Link>
          </div>
        ) : (
          <AdminOfficeDataTable columns={["Event", "Type", "Time", "Signups", ""]} gridTemplateColumns="minmax(240px, 2fr) 140px 180px 120px 90px">
            {calendar.events.slice(0, 8).map((event) => (
              <div className="office-table-row" key={event.id} role="row">
                <strong>{event.title}<span>{event.location}</span></strong>
                <span>{event.eventType}</span>
                <span>{event.startsAt}</span>
                <span>{event.signupRequired ? event.rsvpCount : "—"}</span>
                <Link href={event.href}>Open</Link>
              </div>
            ))}
          </AdminOfficeDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
