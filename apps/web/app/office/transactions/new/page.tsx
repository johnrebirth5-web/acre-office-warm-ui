import Link from "next/link";
import { canCreateOfficeTransactions, canManageOfficeTransactionStatus } from "@acre/auth";
import { getOfficeTransactionIntakeSchema, getOfficeTransactionOwnerAssignment } from "@acre/db";
import { PageHeader, PageShell, SectionCard } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";
import { getCreateTransactionStatusFieldPolicy } from "../transaction-status-rules";

export default async function OfficeTransactionCreatePage() {
  const context = await requireOfficeSession();
  const canManageTransactionStatus = canManageOfficeTransactionStatus(context.currentMembership);

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    redirect("/office/transactions");
  }

  const [schema, ownerAssignment] = await Promise.all([
    getOfficeTransactionIntakeSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    }),
    getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    })
  ]);

  return (
    <PageShell className="bm-new-transaction-page">
      <PageHeader
        actions={
          <Link className="office-button office-button-secondary" href="/office/transactions">
            Back to transactions
          </Link>
        }
        description="Create a transaction using the current office intake schema. Field structure is managed centrally from Settings > Fields."
        title="New transaction"
      />

      <SectionCard className="bm-new-transaction-card bm-new-transaction-live-card" title="Transaction intake">
        <TransactionIntakeWorkspace
          afterSubmit="go-detail"
          canEditValues={true}
          chrome="page"
          mode="create"
          ownerAssignment={ownerAssignment}
          schema={schema}
          statusFieldPolicy={getCreateTransactionStatusFieldPolicy(canManageTransactionStatus)}
          submitEndpoint="/api/office/transactions"
          submitLabel="Create transaction"
          submitMethod="POST"
          title="Office intake form"
        />
      </SectionCard>
    </PageShell>
  );
}
