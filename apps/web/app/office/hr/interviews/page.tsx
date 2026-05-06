import Link from "next/link";
import { canManageOfficeHr, canViewOfficeHr } from "@acre/auth";
import { listHrInterviews } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { HrInterviewForm } from "../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../_shared";

export default async function HrInterviewsPage() {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const interviews = await listHrInterviews({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
  });
  const canManage = canManageOfficeHr(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/hr/candidates">New interview</Link>}
        title="Interviews"
      />
      <HrModuleNav />
      <OfficeListPageTableCard title="Interview queue">
        {interviews.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No interviews yet.</p>
            <Link className="office-button-primary" href="/office/hr/candidates">Open candidates</Link>
          </div>
        ) : (
          <HrDataTable columns={["Candidate", "Title", "Time", "Mode", "Google", ""]} gridTemplateColumns="minmax(180px, 1.5fr) minmax(220px, 2fr) 180px 110px 130px 90px">
            {interviews.map((interview) => (
              <div className="office-table-row" key={interview.id} role="row">
                <strong>{interview.candidateName}</strong>
                <span>{interview.title}</span>
                <span>{interview.startsAt || "Not scheduled"}</span>
                <span>{interview.mode}</span>
                <HrStatusBadge tone={interview.googleSyncState === "sync_failed" ? "danger" : "neutral"}>{interview.googleSyncState}</HrStatusBadge>
                <Link href={interview.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>
      {canManage ? (
        <OfficeListPageTableCard title="Create interview">
          <HrInterviewForm />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
