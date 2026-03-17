import Link from "next/link";
import {
  getOfficeOfferFieldSchema,
  getOfficeTransactionIntakeSchema,
  getTransactionById,
  getTransactionCommissionSnapshot,
  listTransactionOffersSnapshot,
  listTransactionTaskAssigneeOptions,
  listTransactionTasks
} from "@acre/db";
import {
  canApproveOfficeDocuments,
  canApproveOfficeCommissions,
  canEditOfficeTransactions,
  canManageOfficeTransactionFinance,
  canManageOfficeDocuments,
  canManageOfficeCommissions,
  canManageOfficeOffers,
  canManageOfficeSignatures,
  canCalculateOfficeCommissions,
  canAcceptOfficeOffers,
  canReviewOfficeTasks,
  canReviewOfficeOffers,
  canReviewOfficeIncomingUpdates,
  canSecondaryReviewOfficeTasks,
  canUseOfficeForms,
  canViewOfficeCommissions,
  canViewOfficeDocuments,
  canViewOfficeOffers
} from "@acre/auth";
import { DetailSection, PageHeader, PageShell, SectionCard, SecondaryMetaList } from "@acre/ui";
import { notFound } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { TransactionContactsCard } from "./contacts-card";
import { TransactionDocumentsCard, TransactionUnsortedDocumentsCard } from "./documents-card";
import { TransactionFinanceForm } from "./finance-form";
import { TransactionFormsSignaturesCard } from "./forms-signatures-card";
import { TransactionIncomingUpdatesCard } from "./incoming-updates-card";
import { TransactionCommissionCard } from "./commission-card";
import { TransactionOffersCard } from "./offers-card";
import { TransactionStatusForm } from "./status-form";
import { TransactionTasksCard } from "./tasks-card";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";

type TransactionDetailPageProps = {
  params: Promise<{
    transactionId: string;
  }>;
};

export default async function OfficeTransactionDetailPage({ params }: TransactionDetailPageProps) {
  const context = await requireOfficeSession();
  const { transactionId } = await params;
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
    getTransactionCommissionSnapshot(context.currentOrganization.id, transactionId, context.currentOffice?.id ?? null),
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
  const canReviewIncomingUpdatesForRole = canReviewOfficeIncomingUpdates(context.currentMembership);
  const canReviewTasksForRole = canReviewOfficeTasks(context.currentMembership);
  const canSecondaryReviewTasksForRole = canSecondaryReviewOfficeTasks(context.currentMembership);
  const canApproveDocumentsForRole = canApproveOfficeDocuments(context.currentMembership);
  const canViewOffersForRole = canViewOfficeOffers(context.currentMembership);
  const canManageOffersForRole = canManageOfficeOffers(context.currentMembership);
  const canReviewOffersForRole = canReviewOfficeOffers(context.currentMembership);
  const canAcceptOffersForRole = canAcceptOfficeOffers(context.currentMembership);
  const canViewCommissionsForRole = canViewOfficeCommissions(context.currentMembership);
  const canEditTransactionsForRole = canEditOfficeTransactions(context.currentMembership);
  const canManageTransactionFinanceForRole = canManageOfficeTransactionFinance(context.currentMembership);
  const canManageCommissionsForRole = canManageOfficeCommissions(context.currentMembership);
  const canCalculateCommissionsForRole = canCalculateOfficeCommissions(context.currentMembership);
  const canApproveCommissionsForRole = canApproveOfficeCommissions(context.currentMembership);

  return (
    <PageShell className="bm-transaction-detail-page office-detail-page">
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
            <span>Price</span>
            <strong>{transaction.price ? `$${Number(transaction.price).toLocaleString("en-US")}` : "$0"}</strong>
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
        </div>
      </DetailSection>

      <SectionCard subtitle="Update the primary workflow status for this transaction." title="Status">
        <TransactionStatusForm currentStatus={transaction.status} transactionId={transaction.id} />
      </SectionCard>

      <TransactionContactsCard
        availableContacts={transaction.availableContacts}
        contacts={transaction.contacts}
        transactionId={transaction.id}
      />

      {canViewOffersForRole ? (
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
      ) : null}

      <TransactionTasksCard
        assigneeOptions={taskAssigneeOptions}
        canApproveDocuments={canApproveDocumentsForRole}
        currentMembershipId={context.currentMembership.id}
        canReviewTasks={canReviewTasksForRole}
        canSecondaryReviewTasks={canSecondaryReviewTasksForRole}
        tasks={tasks}
        transactionId={transaction.id}
      />

      <TransactionDocumentsCard
        canManageDocuments={canManageDocumentsForRole}
        canViewDocuments={canViewDocumentsForRole}
        documents={transaction.documents}
        taskOptions={taskOptions}
        transactionId={transaction.id}
      />

      <TransactionUnsortedDocumentsCard
        canManageDocuments={canManageDocumentsForRole}
        canViewDocuments={canViewDocumentsForRole}
        documents={transaction.documents}
        taskOptions={taskOptions}
        transactionId={transaction.id}
      />

      <TransactionFormsSignaturesCard
        canManageSignatures={canManageSignaturesForRole}
        canUseForms={canUseFormsForRole}
        canViewDocuments={canViewDocumentsForRole}
        formTemplates={transaction.formTemplates}
        forms={transaction.forms}
        taskOptions={taskOptions}
        transactionId={transaction.id}
      />

      <TransactionIncomingUpdatesCard
        canReviewIncomingUpdates={canReviewIncomingUpdatesForRole}
        incomingUpdates={transaction.incomingUpdates}
        transactionId={transaction.id}
      />

      {transaction.canViewFinancials ? (
        <SectionCard subtitle="Minimal finance layer for commissions, office net, and notes." title="Finance">
          <TransactionFinanceForm
            agentNet={transaction.agentNet}
            financeNotes={transaction.financeNotes}
            grossCommission={transaction.grossCommission}
            officeNet={transaction.officeNet}
            readOnly={!canManageTransactionFinanceForRole}
            referralFee={transaction.referralFee}
            transactionId={transaction.id}
          />
        </SectionCard>
      ) : null}

      {canViewCommissionsForRole && commissionSnapshot ? (
        <TransactionCommissionCard
          canApproveCommissions={canApproveCommissionsForRole}
          canCalculateCommissions={canCalculateCommissionsForRole}
          canManageCommissions={canManageCommissionsForRole}
          snapshot={commissionSnapshot}
          transactionId={transaction.id}
        />
      ) : null}

      <SectionCard subtitle="Review and update transaction values using the current centralized intake schema." title="Intake fields">
        <TransactionIntakeWorkspace
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
            price: transaction.price,
            buyerAgreementDate: transaction.buyerAgreementDate,
            buyerExpirationDate: transaction.buyerExpirationDate,
            acceptanceDate: transaction.acceptanceDate,
            listingDate: transaction.listingDate,
            listingExpirationDate: transaction.listingExpirationDate,
            closingDate: transaction.closingDate,
            ...transaction.additionalFields
          }}
          mode="edit"
          schema={transactionIntakeSchema}
          submitEndpoint={`/api/office/transactions/${transaction.id}/intake`}
          submitLabel="Save intake changes"
          submitMethod="PATCH"
          title="Office intake editor"
        />
      </SectionCard>
    </PageShell>
  );
}
