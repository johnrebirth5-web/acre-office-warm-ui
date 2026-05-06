import Link from "next/link";
import { canViewOfficeHr } from "@acre/auth";
import { listHrOnboardingCases } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../_shared";

export default async function HrOnboardingPage() {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const cases = await listHrOnboardingCases({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
  });

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-primary" href="/office/hr/candidates">Start onboarding</Link>}
        title="Onboarding"
      />
      <HrModuleNav />
      <OfficeListPageTableCard title="Onboarding cases">
        {cases.length === 0 ? (
          <div className="office-empty-state">
            <p className="office-empty-copy">No onboarding cases yet.</p>
            <Link className="office-button-primary" href="/office/hr/candidates">Open candidates</Link>
          </div>
        ) : (
          <HrDataTable columns={["Candidate", "Status", "Token", "Submitted", ""]} gridTemplateColumns="minmax(220px, 2fr) 150px 180px 180px 90px">
            {cases.map((item) => (
              <div className="office-table-row" key={item.id} role="row">
                <strong>{item.candidateName}<span>{item.candidateEmail}</span></strong>
                <HrStatusBadge>{item.status}</HrStatusBadge>
                <span>{item.tokenIssuedAt || "—"}</span>
                <span>{item.submittedAt || "—"}</span>
                <Link href={item.href}>Open</Link>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
