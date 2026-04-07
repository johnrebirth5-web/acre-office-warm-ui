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
import { SectionCard, SummaryChip } from "@acre/ui";
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

type TransactionCreateLeadIn = {
  badgeLabel?: string;
  badgeTone?: "neutral" | "accent" | "success" | "warning" | "danger";
  title: string;
  description: string;
  items?: string[];
};

type FrontOfficeHandoffPrefillState = Awaited<
  ReturnType<typeof getFrontOfficeHandoffPrefill>
>;

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function buildPageTitle(handoffPrefill: FrontOfficeHandoffPrefillState | null) {
  if (!handoffPrefill || handoffPrefill.kind === "missing") {
    return "New transaction";
  }

  if (handoffPrefill.kind === "available") {
    return `New transaction · ${handoffPrefill.clientName}`;
  }

  if (handoffPrefill.kind === "committed") {
    return "Front Office handoff already committed";
  }

  if (handoffPrefill.kind === "submitting") {
    return "Front Office handoff submitting";
  }

  if (handoffPrefill.kind === "unsupported_target") {
    return "Front Office handoff unavailable";
  }

  return "New transaction";
}

function buildPageDescription(
  handoffPrefill: FrontOfficeHandoffPrefillState | null,
) {
  if (!handoffPrefill) {
    return "Create a transaction using the current office intake schema. Office admins can now adjust intake fields directly from this page without leaving the form.";
  }

  if (handoffPrefill.kind === "available") {
    return `Prefilled from Front Office for ${handoffPrefill.clientName}. ${handoffPrefill.feedbackDescription}`;
  }

  return handoffPrefill.feedbackDescription;
}

function buildCreateLeadIn(
  handoffPrefill: FrontOfficeHandoffPrefillState | null,
): TransactionCreateLeadIn | undefined {
  if (!handoffPrefill || handoffPrefill.kind !== "available") {
    return undefined;
  }

  return {
    badgeLabel: "Front Office handoff",
    badgeTone: handoffPrefill.isComplete ? "accent" : "warning",
    title: handoffPrefill.feedbackTitle,
    description: handoffPrefill.feedbackDescription,
    items: handoffPrefill.issues.map(
      (issue) => `${issue.label}: ${issue.description}`,
    ),
  };
}

function buildHandoffSummaryValue(
  handoffPrefill: Exclude<FrontOfficeHandoffPrefillState, null>,
) {
  switch (handoffPrefill.kind) {
    case "available":
      return handoffPrefill.stageLabel;
    case "committed":
      return "Committed";
    case "submitting":
      return "Submitting";
    case "canceled":
      return "Canceled";
    case "unsupported_target":
      return "Other workflow";
    default:
      return "";
  }
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

  const shouldShowCreateForm =
    !handoffPrefill || handoffPrefill.kind === "available";
  const createLeadIn = buildCreateLeadIn(handoffPrefill);
  const clientWorkspaceHref =
    handoffPrefill && handoffPrefill.kind !== "missing"
      ? handoffPrefill.clientWorkspaceHref
      : null;
  const committedTransactionHref =
    handoffPrefill?.kind === "committed"
      ? handoffPrefill.committedTransactionHref
      : null;

  return (
    <OfficeDetailPageShell className="office-transaction-create-page">
      <OfficeDetailPageHeader
        description={buildPageDescription(handoffPrefill)}
        summary={
          <>
            <Link
              className="office-button-secondary"
              href="/office/transactions"
            >
              Back to transactions
            </Link>
            {clientWorkspaceHref ? (
              <Link
                className="office-button-secondary office-button-sm"
                href={clientWorkspaceHref}
              >
                Open Front Office client
              </Link>
            ) : null}
            {committedTransactionHref ? (
              <Link
                className="office-button-secondary office-button-sm"
                href={committedTransactionHref}
              >
                Open Back Office record
              </Link>
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip
                label="FO handoff"
                tone={handoffPrefill.kind === "available" ? "accent" : "default"}
                value={buildHandoffSummaryValue(handoffPrefill)}
              />
            ) : null}
            {handoffPrefill?.kind === "available" ? (
              <SummaryChip
                label="Prefill"
                tone={handoffPrefill.isComplete ? "accent" : "default"}
                value={handoffPrefill.isComplete ? "Ready" : "Needs review"}
              />
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip
                label="Areas"
                value={handoffPrefill.preferredAreasLabel}
              />
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip label="Budget" value={handoffPrefill.budgetLabel} />
            ) : null}
          </>
        }
        title={buildPageTitle(handoffPrefill)}
      />

      {shouldShowCreateForm ? (
        <TransactionCreatePageClient
          canManageFields={canManageFields}
          handoffPrefill={
            handoffPrefill?.kind === "available"
              ? {
                  handoffDraftId: handoffPrefill.handoffDraftId,
                  requiresAcknowledgement:
                    handoffPrefill.requiresAcknowledgement,
                  acknowledgementLabel:
                    handoffPrefill.acknowledgementLabel,
                }
              : undefined
          }
          initialFieldModule={fieldSettingsSnapshot.currentModule}
          initialOwnerMembershipId={
            handoffPrefill?.kind === "available"
              ? handoffPrefill.ownerMembershipId ?? undefined
              : undefined
          }
          initialSchema={schema}
          initialValues={
            handoffPrefill?.kind === "available"
              ? handoffPrefill.initialValues
              : undefined
          }
          leadIn={createLeadIn}
          ownerAssignment={ownerAssignment}
          statusFieldPolicy={getCreateTransactionStatusFieldPolicy(
            canManageTransactionStatus,
          )}
        />
      ) : handoffPrefill ? (
        <SectionCard
          actions={
            <>
              <Link
                className="office-button-secondary office-button-sm"
                href="/office/transactions/new"
              >
                Start manual create
              </Link>
              {clientWorkspaceHref ? (
                <Link
                  className="office-button-secondary office-button-sm"
                  href={clientWorkspaceHref}
                >
                  Reopen Front Office dossier
                </Link>
              ) : null}
            </>
          }
          className="office-new-transaction-card office-new-transaction-live-card"
          title={handoffPrefill.feedbackTitle}
          subtitle={handoffPrefill.feedbackDescription}
        >
          <p>
            {handoffPrefill.kind === "committed"
              ? "Front Office has already handed this record off. Continue the formal transaction workflow in the linked Back Office record instead of creating a second file from this URL."
              : handoffPrefill.kind === "submitting"
                ? "This handoff is already in the middle of a Back Office create request. Wait for that request to settle, then reload before deciding whether anything else is needed."
                : "This handoff is not currently usable for the Back Office create flow. Reopen the client dossier if you need to refresh the handoff, or start a clearly manual create without this handoff link."}
          </p>
        </SectionCard>
      ) : null}
    </OfficeDetailPageShell>
  );
}
