import Link from "next/link";
import { canViewOfficeAgentBilling, getRoleSummary } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeBillingSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeBillingClient } from "./billing-client";

export default async function OfficeBillingPage() {
  const context = await requireOfficeSession();

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeBillingSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id
  });

  if (!snapshot) {
    redirect("/office/dashboard");
  }

  return (
    <PageShell className="office-billing-page office-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <Link className="office-button office-button-secondary office-button-sm" href="/office/activity?objectType=accounting">
              Open billing activity
            </Link>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Role" value={getRoleSummary(context.currentMembership).label} />
            <SummaryChip label="Outstanding balance" tone="accent" value={snapshot.summary.outstandingBalanceLabel} />
          </PageHeaderSummary>
        }
        description="Self-service billing visibility for outstanding charges, payments, credits, statements, and payment-method references. Live checkout and ACH execution are not implemented."
        eyebrow="Billing"
        title="My billing"
      />

      <OfficeBillingClient snapshot={snapshot} />
    </PageShell>
  );
}
