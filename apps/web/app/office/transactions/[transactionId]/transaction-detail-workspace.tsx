import Link from "next/link";
import {
  getOfficeOfferFieldSchema,
  getOfficeTransactionIntakeSchema,
  getTransactionById,
  getTransactionCommissionSnapshot,
  listTransactionOffersSnapshot,
  listTransactionTaskAssigneeOptions,
  listTransactionTasks,
  type SessionMembershipContext
} from "@acre/db";
import {
  canApproveOfficeDocuments,
  canApproveOfficeCommissions,
  canEditOfficeTransactions,
  canManageOfficeTransactionStatus,
  canManageOfficeTransactionFinance,
  canManageOfficeDocuments,
  canManageOfficeCommissions,
  canManageOfficeOffers,
  canManageOfficeSignatures,
  canCalculateOfficeCommissions,
  canAcceptOfficeOffers,
  canManageOfficeCommissionOverrideParticipants,
  canReviewOfficeTasks,
  canReviewOfficeOffers,
  canSecondaryReviewOfficeTasks,
  canUseOfficeForms,
  canViewOfficeCommissions,
  canViewOfficeDocuments,
  canViewOfficeOffers
} from "@acre/auth";
import { DetailSection, PageHeader, PageShell, SectionCard, SecondaryMetaList } from "@acre/ui";
import { notFound } from "next/navigation";
import { TransactionContactsCard } from "./contacts-card";
import { TransactionDocumentsCard, TransactionUnsortedDocumentsCard } from "./documents-card";
import { TransactionFinanceForm } from "./finance-form";
import { TransactionFormsSignaturesCard } from "./forms-signatures-card";
import { TransactionCommissionCard } from "./commission-card";
import { TransactionOffersCard } from "./offers-card";
import { TransactionStatusForm } from "./status-form";
import { TransactionTasksCard } from "./tasks-card";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";
import { getEditTransactionStatusFieldPolicy } from "../transaction-status-rules";
import { TransactionDetailCollapsibleSection } from "./transaction-detail-collapsible-section";

type TransactionDetailWorkspaceProps = {
  context: SessionMembershipContext;
  transactionId: string;
  chrome?: "page" | "embedded";
};

function formatTransactionCurrency(value: string) {
  if (!value) {
    return "—";
  }

  return `$${Number(value).toLocaleString("en-US")}`;
}

export async function TransactionDetailWorkspace({
  context,
  transactionId,
  chrome = "page"
}: TransactionDetailWorkspaceProps) {
  const transaction = await getTransactionById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    transactionId,
    officeId: context.currentOffice?.id ?? null
  });

  if (!transaction) {
    notFound();
  }

  const [tasks, taskAssigneeOptions, commissionSnapshot, offersSnapshot, transactionIntakeSchema, offerFieldSchema] = await Promise.all([
    listTransactionTasks(context.currentOrganization.id, transactionId),
    listTransactionTaskAssigneeOptions(context.currentOrganization.id, transactionId),
    getTransactionCommissionSnapshot(
      context.currentOrganization.id,
      transactionId,
      context.currentOffice?.id ?? null,
      context.currentMembership.id
    ),
    listTransactionOffersSnapshot(context.currentOrganization.id, transactionId),
    getOfficeTransactionIntakeSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    }),
    getOfficeOfferFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    })
  ]);

  const taskOptions = tasks.map((task) => ({
    id: task.id,
    title: task.title
  }));
  const canViewDocumentsForRole = canViewOfficeDocuments(context.currentMembership);
  const canManageDocumentsForRole = canManageOfficeDocuments(context.currentMembership);
  const canUseFormsForRole = canUseOfficeForms(context.currentMembership);
  const canManageSignaturesForRole = canManageOfficeSignatures(context.currentMembership);
  const canReviewTasksForRole = canReviewOfficeTasks(context.currentMembership);
  const canSecondaryReviewTasksForRole = canSecondaryReviewOfficeTasks(context.currentMembership);
  const canApproveDocumentsForRole = canApproveOfficeDocuments(context.currentMembership);
  const canViewOffersForRole = canViewOfficeOffers(context.currentMembership);
  const canManageOffersForRole = canManageOfficeOffers(context.currentMembership);
  const canReviewOffersForRole = canReviewOfficeOffers(context.currentMembership);
  const canAcceptOffersForRole = canAcceptOfficeOffers(context.currentMembership);
  const canViewCommissionsForRole = canViewOfficeCommissions(context.currentMembership);
  const canEditTransactionsForRole = canEditOfficeTransactions(context.currentMembership);
  const canManageTransactionStatusForRole = canManageOfficeTransactionStatus(context.currentMembership);
  const canManageTransactionFinanceForRole = canManageOfficeTransactionFinance(context.currentMembership);
  const canManageCommissionsForRole = canManageOfficeCommissions(context.currentMembership);
  const canCalculateCommissionsForRole = canCalculateOfficeCommissions(context.currentMembership);
  const canApproveCommissionsForRole = canApproveOfficeCommissions(context.currentMembership);
  const transactionDetailSectionStorageScope = `${context.currentOrganization.id}:${context.currentMembership.id}`;
  const isEmbedded = chrome === "embedded";

  return (
    <PageShell
      className={[
        "office-transaction-detail-page",
        "office-detail-page",
        isEmbedded ? "office-transaction-detail-embedded" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!isEmbedded ? (
        <PageHeader
          actions={
            <Link className="office-button office-button-secondary" href="/office/transactions">
              Back to transactions
            </Link>
          }
          description={`${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`}
          eyebrow="Transaction detail"
          title={transaction.title}
        />
      ) : null}

      <DetailSection
        actions={
          <SecondaryMetaList
            items={[
              { label: "Owner", value: transaction.ownerName },
              { label: "Office", value: transaction.officeName || "Unassigned" },
              { label: "Status", value: transaction.status }
            ]}
          />
        }
        subtitle="Core transaction facts, dates, and referral context."
        title="Overview"
      >
        <div className="office-detail-grid">
          <div className="office-detail-field">
            <span>Type</span>
            <strong>{transaction.type}</strong>
          </div>
          <div className="office-detail-field">
            <span>Representing</span>
            <strong>{transaction.representing}</strong>
          </div>
          <div className="office-detail-field">
            <span>Asking Price</span>
            <strong>{formatTransactionCurrency(transaction.askingPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>Purchased Price</span>
            <strong>{formatTransactionCurrency(transaction.purchasedPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>Owner</span>
            <strong>{transaction.ownerName}</strong>
          </div>
          <div className="office-detail-field">
            <span>Office</span>
            <strong>{transaction.officeName || "Unassigned"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Company referral</span>
            <strong>{transaction.companyReferral}</strong>
          </div>
          <div className="office-detail-field">
            <span>Referral employee</span>
            <strong>{transaction.companyReferralEmployeeName || "None"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Important date</span>
            <strong>{transaction.importantDate || "Not set"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Buyer agreement date</span>
            <strong>{transaction.buyerAgreementDate || "Not set"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Buyer expiration date</span>
            <strong>{transaction.buyerExpirationDate || "Not set"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Acceptance date</span>
            <strong>{transaction.acceptanceDate || "Not set"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Closing date</span>
            <strong>{transaction.closingDate || "Not set"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Move-In date</span>
            <strong>{transaction.moveInDate || "Not set"}</strong>
          </div>
        </div>
      </DetailSection>

      <SectionCard subtitle="Update the primary workflow status for this transaction." title="Status">
        <TransactionStatusForm
          canManageStatus={canManageTransactionStatusForRole}
          currentStatus={transaction.status}
          transactionId={transaction.id}
        />
      </SectionCard>

      <TransactionDetailCollapsibleSection
        defaultExpanded
        sectionKey="intake-fields"
        storageScope={transactionDetailSectionStorageScope}
        subtitle="Review and update transaction values using the current centralized intake schema."
        title="Intake fields"
      >
        <TransactionIntakeWorkspace
          canEditFinanceFields={canManageTransactionFinanceForRole}
          canEditValues={canEditTransactionsForRole}
          chrome="detail"
          initialValues={{
            transactionType: transaction.typeValue,
            transactionStatus: transaction.statusValue,
            representing: transaction.representingValue,
            address: transaction.address,
            city: transaction.city,
            state: transaction.state,
            zipCode: transaction.zipCode,
            transactionName: transaction.title,
            askingPrice: transaction.askingPrice,
            purchasedPrice: transaction.purchasedPrice,
            price: transaction.purchasedPrice,
            buyerAgreementDate: transaction.buyerAgreementDate,
            buyerExpirationDate: transaction.buyerExpirationDate,
            acceptanceDate: transaction.acceptanceDate,
            listingDate: transaction.listingDate,
            listingExpirationDate: transaction.listingExpirationDate,
            closingDate: transaction.closingDate,
            moveInDate: transaction.moveInDate,
            ...transaction.additionalFields
          }}
          mode="edit"
          ownerAssignment={{
            currentOwnerMembershipId: transaction.ownerMembershipId ?? "",
            currentOwnerLabel: transaction.ownerName,
            canSelectDifferentOwner: false,
            options: []
          }}
          schema={transactionIntakeSchema}
          statusFieldPolicy={getEditTransactionStatusFieldPolicy(canManageTransactionStatusForRole)}
          submitEndpoint={`/api/office/transactions/${transaction.id}/intake`}
          submitLabel="Save intake changes"
          submitMethod="PATCH"
        />
      </TransactionDetailCollapsibleSection>

      {transaction.canViewFinancials ? (
        <TransactionDetailCollapsibleSection
          sectionKey="finance"
          storageScope={transactionDetailSectionStorageScope}
          subtitle="Use the same commission calculator flow here to update fees, notes, prerequisites, and the saved final agent net output."
          title="Finance"
        >
          <TransactionFinanceForm
            approvalBlockers={commissionSnapshot?.approvalBlockers ?? []}
            canAutoCalculateCommission={canCalculateCommissionsForRole}
            financeNotes={transaction.financeNotes}
            fees={transaction.financeFees}
            grossCommission={transaction.grossCommission}
            prerequisites={transaction.financePrerequisites}
            readOnly={!canManageTransactionFinanceForRole}
            summary={commissionSnapshot?.summary ?? null}
            transactionId={transaction.id}
          />
        </TransactionDetailCollapsibleSection>
      ) : null}

      {canViewCommissionsForRole && commissionSnapshot ? (
        <TransactionDetailCollapsibleSection
          sectionKey="commission"
          storageScope={transactionDetailSectionStorageScope}
          subtitle="Structured fee logic, final stakeholder split, and calculation history for this transaction."
          title="Commission"
        >
          <TransactionCommissionCard
            canApproveCommissions={canApproveCommissionsForRole}
            canCalculateCommissions={canCalculateCommissionsForRole}
            canManageCommissions={canManageCommissionsForRole}
            canManageOverrideParticipants={canManageOfficeCommissionOverrideParticipants(context.currentMembership)}
            snapshot={commissionSnapshot}
            transactionId={transaction.id}
          />
        </TransactionDetailCollapsibleSection>
      ) : null}

      <TransactionDetailCollapsibleSection sectionKey="contacts" storageScope={transactionDetailSectionStorageScope} title="Contacts">
        <TransactionContactsCard
          availableContacts={transaction.availableContacts}
          contacts={transaction.contacts}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>

      {canViewOffersForRole ? (
        <TransactionDetailCollapsibleSection
          sectionKey="offers"
          storageScope={transactionDetailSectionStorageScope}
          subtitle="Back-office offer tracking, comparison, comments, and offer-linked documents/forms/signatures."
          title="Offers"
        >
          <TransactionOffersCard
            canAcceptOffers={canAcceptOffersForRole}
            canManageDocuments={canManageDocumentsForRole}
            canManageOffers={canManageOffersForRole}
            canManageSignatures={canManageSignaturesForRole}
            canReviewOffers={canReviewOffersForRole}
            canUseForms={canUseFormsForRole}
            formTemplates={transaction.formTemplates}
            fieldSchema={offerFieldSchema}
            snapshot={offersSnapshot}
            taskOptions={taskOptions}
            transactionId={transaction.id}
          />
        </TransactionDetailCollapsibleSection>
      ) : null}

      <TransactionDetailCollapsibleSection sectionKey="tasks" storageScope={transactionDetailSectionStorageScope} title="Checklist / Tasks">
        <TransactionTasksCard
          assigneeOptions={taskAssigneeOptions}
          canApproveDocuments={canApproveDocumentsForRole}
          currentMembershipId={context.currentMembership.id}
          canReviewTasks={canReviewTasksForRole}
          canSecondaryReviewTasks={canSecondaryReviewTasksForRole}
          tasks={tasks}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>

      <TransactionDetailCollapsibleSection
        sectionKey="documents"
        storageScope={transactionDetailSectionStorageScope}
        subtitle="Structured back-office files linked to this transaction and its checklist tasks."
        title="Documents"
      >
        <TransactionDocumentsCard
          canManageDocuments={canManageDocumentsForRole}
          canViewDocuments={canViewDocumentsForRole}
          documents={transaction.documents}
          taskOptions={taskOptions}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>

      <TransactionDetailCollapsibleSection
        sectionKey="unsorted-documents"
        storageScope={transactionDetailSectionStorageScope}
        subtitle="Files that landed in the transaction but have not been organized into the main workflow yet."
        title="Unsorted documents"
      >
        <TransactionUnsortedDocumentsCard
          canManageDocuments={canManageDocumentsForRole}
          canViewDocuments={canViewDocumentsForRole}
          documents={transaction.documents}
          taskOptions={taskOptions}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>

      <TransactionDetailCollapsibleSection
        sectionKey="forms-signatures"
        storageScope={transactionDetailSectionStorageScope}
        subtitle="Generate transaction packets from templates, keep them tied to checklist tasks, and track manual signature status."
        title="Forms & eSignature"
      >
        <TransactionFormsSignaturesCard
          canManageSignatures={canManageSignaturesForRole}
          canUseForms={canUseFormsForRole}
          canViewDocuments={canViewDocumentsForRole}
          formTemplates={transaction.formTemplates}
          forms={transaction.forms}
          taskOptions={taskOptions}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>
    </PageShell>
  );
}
