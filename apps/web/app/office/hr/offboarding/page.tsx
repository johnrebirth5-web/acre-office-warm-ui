import { canManageOfficeHrOffboarding, canViewOfficeHr } from "@acre/auth";
import { listHrOffboardingCases } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../_components/office-list-page-template";
import { HrOffboardingForm } from "../hr-client";
import { HrDataTable, HrModuleNav, HrStatusBadge } from "../_shared";

export default async function HrOffboardingPage() {
  const context = await requireOfficeSession();
  if (!canViewOfficeHr(context.currentMembership)) {
    redirect("/office/dashboard");
  }
  const cases = await listHrOffboardingCases({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
  });
  const canManage = canManageOfficeHrOffboarding(context.currentMembership);

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader title="Offboarding" />
      <HrModuleNav />
      {canManage ? (
        <OfficeListPageTableCard title="Start offboarding">
          <HrOffboardingForm />
        </OfficeListPageTableCard>
      ) : null}
      <OfficeListPageTableCard title="Offboarding cases">
        {cases.length === 0 ? (
          <div className="office-empty-state"><p className="office-empty-copy">No offboarding cases yet.</p></div>
        ) : (
          <HrDataTable columns={["Candidate", "Status", "Last day", "Finance", ""]} gridTemplateColumns="minmax(220px, 2fr) 150px 160px 160px 90px">
            {cases.map((item) => (
              <div className="office-table-row" key={item.id} role="row">
                <strong>{item.candidateName}<span>{item.candidateEmail}</span></strong>
                <HrStatusBadge>{item.status}</HrStatusBadge>
                <span>{item.lastWorkingDate || "—"}</span>
                <span>{item.financeHandoffStatus || "—"}</span>
                <a href={item.href}>Open</a>
              </div>
            ))}
          </HrDataTable>
        )}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
