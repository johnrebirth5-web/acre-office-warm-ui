import Link from "next/link";
import { canManageOfficeHr, canViewOfficeHr } from "@acre/auth";
import { getHrCandidateDetail } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { HrCreateOnboardingButton, HrCandidateStatusForm, HrInterviewForm, HrOffboardingForm } from "../../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../../_shared";

type PageProps = {
  params: Promise<{ candidateId: string }>;
};

export default async function HrCandidateDetailPage({ params }: PageProps) {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const { candidateId } = await params;
  const snapshot = await getHrCandidateDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    candidateId,
  });
  if (!snapshot) {
    notFound();
  }

  const canManage = canManageOfficeHr(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/hr/candidates">Back</Link>}
        summary={
          <>
            <SummaryChip label="Status" value={snapshot.candidate.statusLabel} />
            <SummaryChip label="Identity" value={snapshot.candidate.identityType || "Not set"} />
            <SummaryChip label="Drive" value={snapshot.candidate.driveSyncLabel} />
          </>
        }
        title={snapshot.candidate.fullName}
      />
      <HrModuleNav />

      <OfficeListPageTableCard actions={canManage ? <HrCreateOnboardingButton candidateId={candidateId} /> : null} title="Profile">
        <div className="office-detail-two-column">
          <div className="office-detail-field"><span>Email</span><strong>{snapshot.candidate.email}</strong></div>
          <div className="office-detail-field"><span>Phone</span><strong>{snapshot.candidate.phone || "—"}</strong></div>
          <div className="office-detail-field"><span>Position</span><strong>{snapshot.candidate.positionTitle || snapshot.candidate.role || "—"}</strong></div>
          <div className="office-detail-field"><span>Team lead</span><strong>{snapshot.candidate.teamLeadName || "—"}</strong></div>
        </div>
        {canManage ? <HrCandidateStatusForm candidateId={candidateId} status={snapshot.candidate.statusKey} /> : null}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Interviews">
        {snapshot.interviews.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No interviews yet.</p></div>
        ) : (
          <HrDataTable columns={["Title", "Time", "Mode", "Google", "Tracker"]} gridTemplateColumns="minmax(220px, 2fr) 180px 120px 130px 130px">
            {snapshot.interviews.map((interview) => (
              <div className="office-table-row" key={interview.id} role="row">
                <strong>{interview.title}</strong>
                <span>{interview.startsAt || "Not scheduled"}</span>
                <span>{interview.mode}</span>
                <span>{interview.googleSyncState}</span>
                <span>{interview.trackerSyncState}</span>
              </div>
            ))}
          </HrDataTable>
        )}
        {canManage ? <HrInterviewForm candidateId={candidateId} /> : null}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Cases">
        <HrDataTable columns={["Type", "Status", "Date", ""]} gridTemplateColumns="140px 160px 180px 90px">
          {snapshot.onboardingCases.map((item) => (
            <div className="office-table-row" key={`onboarding-${item.id}`} role="row">
              <span>Onboarding</span>
              <HrStatusBadge>{item.status}</HrStatusBadge>
              <span>{item.submittedAt || item.tokenIssuedAt || "—"}</span>
              <Link href={item.href}>Open</Link>
            </div>
          ))}
          {snapshot.offboardingCases.map((item) => (
            <div className="office-table-row" key={`offboarding-${item.id}`} role="row">
              <span>Offboarding</span>
              <HrStatusBadge>{item.status}</HrStatusBadge>
              <span>{item.lastWorkingDate || "—"}</span>
              <Link href={item.href}>Open</Link>
            </div>
          ))}
        </HrDataTable>
      </OfficeListPageTableCard>

      {canManage ? (
        <OfficeListPageTableCard title="Start offboarding">
          <HrOffboardingForm candidateId={candidateId} />
        </OfficeListPageTableCard>
      ) : null}
    </OfficeListPageShell>
  );
}
