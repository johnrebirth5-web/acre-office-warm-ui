import Link from "next/link";
import { canCreateOfficeTransactions, canManageOfficeFields } from "@acre/auth";
import { getOfficeTransactionIntakeSchema } from "@acre/db";
import { PageHeader, PageShell, SectionCard } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";

export default async function OfficeTransactionCreatePage() {
  const context = await requireOfficeSession();

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    redirect("/office/transactions");
  }

  const schema = await getOfficeTransactionIntakeSchema({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });

  return (
    <PageShell className="bm-new-transaction-page">
      <PageHeader
        actions={
          <Link className="office-button office-button-secondary" href="/office/transactions">
            Back to transactions
          </Link>
        }
        description="Create a transaction using the current office intake schema. Office admins can manage visibility, requiredness, and custom fields in place."
        title="New transaction"
      />

      <SectionCard className="bm-new-transaction-card bm-new-transaction-live-card" title="Transaction intake">
        <TransactionIntakeWorkspace
          afterSubmit="go-detail"
          canConfigureSchema={canManageOfficeFields(context.currentMembership)}
          canEditValues={true}
          chrome="page"
          mode="create"
          schema={schema}
          submitEndpoint="/api/office/transactions"
          submitLabel="Create transaction"
          submitMethod="POST"
          title="Office intake form"
        />
      </SectionCard>
    </PageShell>
  );
}
