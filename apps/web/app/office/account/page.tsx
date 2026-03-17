import Link from "next/link";
import { getRoleSummary } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAccountSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeAccountClient } from "./account-client";

export default async function OfficeAccountPage() {
  const context = await requireOfficeSession();
  const snapshot = await getOfficeAccountSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id
  });

  if (!snapshot) {
    redirect("/office/dashboard");
  }

  return (
    <PageShell className="office-account-page office-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <Link className="office-button office-button-secondary office-button-sm" href="/office/notifications">
              Open notifications
            </Link>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Role" value={getRoleSummary(context.currentMembership).label} />
            <SummaryChip label="Open tasks" tone="accent" value={snapshot.summary.openTaskCount} />
          </PageHeaderSummary>
        }
        description="Self-service profile, current office/team assignment, in-app notification preferences, and truthful account security context."
        eyebrow="Account"
        title="My profile"
      />

      <OfficeAccountClient snapshot={snapshot} />
    </PageShell>
  );
}
