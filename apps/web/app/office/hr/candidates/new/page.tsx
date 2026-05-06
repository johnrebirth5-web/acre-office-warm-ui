import Link from "next/link";
import { canManageOfficeHr } from "@acre/auth";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell, OfficeListPageTableCard } from "../../../_components/office-list-page-template";
import { HrModuleNav } from "../../_shared";
import { HrCandidateForm } from "../../hr-client";

export default async function NewHrCandidatePage() {
  const context = await requireOfficeSession();
  if (!canManageOfficeHr(context.currentMembership)) {
    redirect("/office/hr/candidates");
  }

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        actions={<Link className="office-button-secondary" href="/office/hr/candidates">Back</Link>}
        title="New candidate"
      />
      <HrModuleNav />
      <OfficeListPageTableCard title="Candidate profile">
        <HrCandidateForm />
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}
