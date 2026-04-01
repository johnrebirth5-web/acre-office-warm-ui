import Link from "next/link";
import {
  canCreateOfficeTransactions,
  canManageOfficeFields,
  canManageOfficeTransactionStatus,
} from "@acre/auth";
import {
  getFrontOfficeHandoffPrefill,
  getOfficeFieldSettingsSnapshot,
  getOfficeTransactionIntakeSchema,
  getOfficeTransactionOwnerAssignment,
} from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import {
  OfficeDetailPageHeader,
  OfficeDetailPageShell,
} from "../../_components/office-detail-page-template";
import { getCreateTransactionStatusFieldPolicy } from "../transaction-status-rules";
import { TransactionCreatePageClient } from "./transaction-create-page-client";

type OfficeTransactionCreatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function OfficeTransactionCreatePage(
  props: OfficeTransactionCreatePageProps,
) {
  const context = await requireOfficeSession();
  const canManageFields = canManageOfficeFields(context.currentMembership);
  const canManageTransactionStatus = canManageOfficeTransactionStatus(
    context.currentMembership,
  );
  const searchParams = (await props.searchParams) ?? {};
  const handoffId = readSearchParamValue(searchParams.handoffId)?.trim() || "";

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    redirect("/office/transactions");
  }

  const [schema, ownerAssignment, fieldSettingsSnapshot, handoffPrefill] =
    await Promise.all([
      getOfficeTransactionIntakeSchema({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
      }),
      getOfficeTransactionOwnerAssignment({
        organizationId: context.currentOrganization.id,
        viewerMembershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
      }),
      getOfficeFieldSettingsSnapshot({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        selectedModule: "transaction",
      }),
      handoffId
        ? getFrontOfficeHandoffPrefill({
            organizationId: context.currentOrganization.id,
            handoffDraftId: handoffId,
            officeId: context.currentOffice?.id ?? null,
          })
        : Promise.resolve(null),
    ]);

  return (
    <OfficeDetailPageShell className="office-transaction-create-page">
      <OfficeDetailPageHeader
        description={
          handoffPrefill
            ? `Prefilled from Front Office for ${handoffPrefill.clientName}. ${handoffPrefill.summary}`
            : "Create a transaction using the current office intake schema. Office admins can now adjust intake fields directly from this page without leaving the form."
        }
        summary={
          <>
            <Link
              className="office-button-secondary"
              href="/office/transactions"
            >
              Back to transactions
            </Link>
            {handoffPrefill ? (
              <Link
                className="office-button-secondary office-button-sm"
                href={handoffPrefill.clientWorkspaceHref}
              >
                Open Front Office client
              </Link>
            ) : null}
            {handoffPrefill ? (
              <SummaryChip
                label="FO handoff"
                tone="accent"
                value={handoffPrefill.stageLabel}
              />
            ) : null}
            {handoffPrefill ? (
              <SummaryChip
                label="Areas"
                value={handoffPrefill.preferredAreasLabel}
              />
            ) : null}
            {handoffPrefill ? (
              <SummaryChip label="Budget" value={handoffPrefill.budgetLabel} />
            ) : null}
          </>
        }
        title={
          handoffPrefill
            ? `New transaction · ${handoffPrefill.clientName}`
            : "New transaction"
        }
      />

      <TransactionCreatePageClient
        canManageFields={canManageFields}
        initialFieldModule={fieldSettingsSnapshot.currentModule}
        initialOwnerMembershipId={
          handoffPrefill?.ownerMembershipId ?? undefined
        }
        initialSchema={schema}
        initialValues={handoffPrefill?.initialValues}
        ownerAssignment={ownerAssignment}
        statusFieldPolicy={getCreateTransactionStatusFieldPolicy(
          canManageTransactionStatus,
        )}
        submissionExtras={
          handoffPrefill
            ? {
                frontOfficeClientId: handoffPrefill.clientId,
                handoffDraftId: handoffPrefill.handoffDraftId,
              }
            : undefined
        }
      />
    </OfficeDetailPageShell>
  );
}
