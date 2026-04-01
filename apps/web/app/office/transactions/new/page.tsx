import Link from "next/link";
import {
  canCreateOfficeTransactions,
  canManageOfficeFields,
  canManageOfficeTransactionStatus
} from "@acre/auth";
import {
  getOfficeFieldSettingsSnapshot,
  getOfficeTransactionIntakeSchema,
  getOfficeTransactionOwnerAssignment
} from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../_components/office-detail-page-template";
import { getCreateTransactionStatusFieldPolicy } from "../transaction-status-rules";
import { TransactionCreatePageClient } from "./transaction-create-page-client";

export default async function OfficeTransactionCreatePage() {
  const context = await requireOfficeSession();
  const canManageFields = canManageOfficeFields(context.currentMembership);
  const canManageTransactionStatus = canManageOfficeTransactionStatus(context.currentMembership);

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    redirect("/office/transactions");
  }

  const [schema, ownerAssignment, fieldSettingsSnapshot] = await Promise.all([
    getOfficeTransactionIntakeSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    }),
    getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    }),
    getOfficeFieldSettingsSnapshot({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      selectedModule: "transaction"
    })
  ]);

  return (
    <OfficeDetailPageShell className="office-transaction-create-page">
      <OfficeDetailPageHeader
        description="Create a transaction using the current office intake schema. Office admins can now adjust intake fields directly from this page without leaving the form."
        summary={
          <Link className="office-button-secondary" href="/office/transactions">
            Back to transactions
          </Link>
        }
        title="New transaction"
      />

      <TransactionCreatePageClient
        canManageFields={canManageFields}
        initialFieldModule={fieldSettingsSnapshot.currentModule}
        initialSchema={schema}
        ownerAssignment={ownerAssignment}
        statusFieldPolicy={getCreateTransactionStatusFieldPolicy(canManageTransactionStatus)}
      />
    </OfficeDetailPageShell>
  );
}
