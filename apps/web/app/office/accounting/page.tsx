import {
  canAccessOfficeAccounting,
  canManageOfficeAccounting,
  canManageOfficeAgentBilling,
  canManageOfficeCommissions,
  canManageOfficePayments,
  canApproveOfficeCommissions,
  canCalculateOfficeCommissions,
  canViewOfficeCommissions,
  canViewOfficeAgentBilling
} from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeAccountingSnapshot, getOfficeAgentBillingSnapshot, getOfficeCommissionManagementSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeAccountingClient } from "./accounting-client";

type OfficeAccountingPageProps = {
  searchParams?: Promise<{
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    ownerMembershipId?: string;
    q?: string;
    entryId?: string;
    billingMembershipId?: string;
    billingStatus?: string;
    billingStartDate?: string;
    billingEndDate?: string;
    billingTransactionId?: string;
    billingQ?: string;
    commissionMembershipId?: string;
    commissionTeamId?: string;
    commissionPlanId?: string;
    commissionStatus?: string;
    commissionTransactionId?: string;
    commissionStartDate?: string;
    commissionEndDate?: string;
  }>;
};

export default async function OfficeAccountingPage(props: OfficeAccountingPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeAccounting(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const [snapshot, agentBillingSnapshot, commissionSnapshot] = await Promise.all([
    getOfficeAccountingSnapshot({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      type: searchParams.type,
      status: searchParams.status,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ownerMembershipId: searchParams.ownerMembershipId,
      q: searchParams.q,
      entryId: searchParams.entryId
    }),
    canViewOfficeAgentBilling(context.currentMembership)
      ? getOfficeAgentBillingSnapshot({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null,
          membershipId: searchParams.billingMembershipId,
          status: searchParams.billingStatus,
          startDate: searchParams.billingStartDate,
          endDate: searchParams.billingEndDate,
          transactionId: searchParams.billingTransactionId,
          q: searchParams.billingQ
        })
      : null,
    canViewOfficeCommissions(context.currentMembership)
      ? getOfficeCommissionManagementSnapshot({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null,
          viewerMembershipId: context.currentMembership.id,
          membershipId: searchParams.commissionMembershipId,
          teamId: searchParams.commissionTeamId,
          commissionPlanId: searchParams.commissionPlanId,
          status: searchParams.commissionStatus,
          transactionId: searchParams.commissionTransactionId,
          startDate: searchParams.commissionStartDate,
          endDate: searchParams.commissionEndDate
        })
      : null
  ]);

  return (
    <PageShell className="office-list-page office-accounting-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Total invoices" tone="accent" value={snapshot.overview.totalInvoices} />
            <SummaryChip label="Open bills" value={snapshot.overview.openBills} />
            <SummaryChip label="Office net ledger impact" value={snapshot.overview.officeNetLedgerImpactLabel} />
          </PageHeaderSummary>
        }
        description="Transactional accounting for invoices, bills, payments, ledger posting, and earnest money workflows."
        eyebrow="Accounting"
        title="Accounting"
      />

      <OfficeAccountingClient
        agentBillingSnapshot={agentBillingSnapshot}
        canManageAccounting={canManageOfficeAccounting(context.currentMembership)}
        canManageAgentBilling={canManageOfficeAgentBilling(context.currentMembership)}
        canManageCommissions={canManageOfficeCommissions(context.currentMembership)}
        canManagePayments={canManageOfficePayments(context.currentMembership)}
        canApproveCommissions={canApproveOfficeCommissions(context.currentMembership)}
        canCalculateCommissions={canCalculateOfficeCommissions(context.currentMembership)}
        canViewCommissions={canViewOfficeCommissions(context.currentMembership)}
        commissionSnapshot={commissionSnapshot}
        canViewAgentBilling={canViewOfficeAgentBilling(context.currentMembership)}
        officeLabel={context.currentOffice?.name ?? context.currentOrganization.name}
        snapshot={snapshot}
      />
    </PageShell>
  );
}
