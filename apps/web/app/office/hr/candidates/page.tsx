import Link from "next/link";
import { canViewOfficeHr } from "@acre/auth";
import { listHrCandidates } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../_shared";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HrCandidatesPage(props: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listHrCandidates({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    status: readParam(searchParams.status),
  });

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/hr/candidates/new">New candidate</Link>}
        summary={
          <>
            <SummaryChip label="Total" value={snapshot.summary.totalCount} />
            <SummaryChip label="Active" value={snapshot.summary.activeCount} />
            <SummaryChip label="Offered" value={snapshot.summary.offeredCount} />
            <SummaryChip label="Hired" value={snapshot.summary.hiredCount} />
            <SummaryChip label="Sync issues" value={snapshot.summary.syncIssueCount} />
          </>
        }
        title="Candidates"
      />
      <HrModuleNav />

      <OfficeListPageTableCard
        filters={
          <nav className="office-filter-bar" aria-label="Candidate status">
            {["all", "applied", "screening", "interview_1", "interview_2", "offered", "hired", "rejected"].map((status) => (
              <Link className={`office-filter-chip${snapshot.filters.status === status ? " is-active" : ""}`} href={status === "all" ? "/office/hr/candidates" : `/office/hr/candidates?status=${status}`} key={status}>{status}</Link>
            ))}
          </nav>
        }
        title="Candidate list"
      >
        {snapshot.candidates.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No candidates matched this view.</p>
            <Link className="office-button-primary" href="/office/hr/candidates/new">New candidate</Link>
          </div>
        ) : (
          <HrDataTable columns={["Candidate", "Status", "Position", "Sync", ""]} gridTemplateColumns="minmax(220px, 2fr) 140px minmax(160px, 1fr) 130px 90px">
            {snapshot.candidates.map((candidate) => (
              <div className="office-table-row" key={candidate.id} role="row">
                <strong>{candidate.fullName}<span>{candidate.email}</span></strong>
                <HrStatusBadge tone={candidate.statusTone}>{candidate.statusLabel}</HrStatusBadge>
                <span>{candidate.positionTitle || candidate.role || "—"}</span>
                <HrStatusBadge tone={candidate.driveSyncTone}>{candidate.driveSyncLabel}</HrStatusBadge>
                <Link href={candidate.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
