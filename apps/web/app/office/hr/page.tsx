import Link from "next/link";
import { canViewOfficeHr } from "@acre/auth";
import {
  getHrHomeSnapshot,
  listHrInterviews,
  listHrOffboardingCases,
  listHrOnboardingCases,
} from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../_components/office-list-page-template";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "./_shared";

export default async function OfficeHrPage() {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const officeId = context.currentOffice?.id ?? null;
  const [home, interviews, onboardingCases, offboardingCases] = await Promise.all([
    getHrHomeSnapshot({
      organizationId: context.currentOrganization.id,
      officeId,
    }),
    listHrInterviews({
      organizationId: context.currentOrganization.id,
      officeId,
    }),
    listHrOnboardingCases({
      organizationId: context.currentOrganization.id,
      officeId,
    }),
    listHrOffboardingCases({
      organizationId: context.currentOrganization.id,
      officeId,
    }),
  ]);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/hr/candidates/new">New candidate</Link>}
        eyebrow="Back Office"
        summary={
          <>
            <SummaryChip label="Candidates" value={home.summary.totalCount} />
            <SummaryChip label="Interview 2" tone="accent" value={home.summary.interview2Count} />
            <SummaryChip label="Onboarding" value={onboardingCases.length} />
            <SummaryChip label="Offboarding" value={offboardingCases.length} />
            <SummaryChip label="Sync issues" value={home.summary.syncIssueCount} />
          </>
        }
        title="HR"
      />
      <HrModuleNav />

      <OfficeListPageTableCard title="Needs attention">
        {home.pendingCandidates.length === 0 && home.onboardingCases.length === 0 && home.offboardingCases.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No HR items need attention.</p>
          </div>
        ) : (
          <HrDataTable columns={["Item", "Status", "Updated", ""]} gridTemplateColumns="minmax(220px, 2fr) 140px 180px 110px">
            {home.pendingCandidates.map((item) => (
              <div className="office-table-row" key={`candidate-${item.id}`} role="row">
                <strong>{item.fullName}</strong>
                <HrStatusBadge tone={item.statusTone}>{item.statusLabel}</HrStatusBadge>
                <span>{item.updatedAt}</span>
                <Link href={item.href}>Open</Link>
              </div>
            ))}
            {home.onboardingCases.map((item) => (
              <div className="office-table-row" key={`onboarding-${item.id}`} role="row">
                <strong>{item.candidateName}</strong>
                <HrStatusBadge tone="accent">{item.status}</HrStatusBadge>
                <span>Onboarding</span>
                <Link href={item.href}>Open</Link>
              </div>
            ))}
            {home.offboardingCases.map((item) => (
              <div className="office-table-row" key={`offboarding-${item.id}`} role="row">
                <strong>{item.candidateName}</strong>
                <HrStatusBadge tone="warning">{item.status}</HrStatusBadge>
                <span>Offboarding</span>
                <Link href={item.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Upcoming interviews">
        {interviews.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No interviews scheduled.</p></div>
        ) : (
          <HrDataTable columns={["Candidate", "Time", "Mode", "Sync", ""]} gridTemplateColumns="minmax(180px, 2fr) 180px 120px 130px 90px">
            {interviews.slice(0, 8).map((interview) => (
              <div className="office-table-row" key={interview.id} role="row">
                <strong>{interview.candidateName}</strong>
                <span>{interview.startsAt || "Not scheduled"}</span>
                <span>{interview.mode}</span>
                <HrStatusBadge tone={interview.googleSyncState === "sync_failed" ? "danger" : "neutral"}>{interview.googleSyncState}</HrStatusBadge>
                <Link href={interview.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>

      <OfficeListPageTableCard title="Open cases">
        <HrDataTable columns={["Name", "Type", "Status", ""]} gridTemplateColumns="minmax(220px, 2fr) 150px 150px 90px">
          {[...onboardingCases.slice(0, 5).map((item) => ({ ...item, type: "Onboarding" })), ...offboardingCases.slice(0, 5).map((item) => ({ ...item, type: "Offboarding" }))].map((item) => (
            <div className="office-table-row" key={`${item.type}-${item.id}`} role="row">
              <strong>{item.candidateName}</strong>
              <span>{item.type}</span>
              <HrStatusBadge>{item.status}</HrStatusBadge>
              <Link href={item.href}>Open</Link>
            </div>
          ))}
        </HrDataTable>
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
