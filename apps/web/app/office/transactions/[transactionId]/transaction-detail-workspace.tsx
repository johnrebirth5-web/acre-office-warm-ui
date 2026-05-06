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
  canDeleteOfficeTransactions,
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
import { DetailSection, SectionCard, SummaryChip } from "@acre/ui";
import { notFound } from "next/navigation";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../_components/office-detail-page-template";
import { getServerI18n } from "../../../../lib/i18n/server";
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
import { TransactionDeleteAction } from "./transaction-delete-action";

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

const transactionTypeZhCopy: Record<string, string> = {
  sales: "买卖",
  sales_listing: "销售挂牌",
  rental_leasing: "租赁",
  rental_listing: "出租挂牌",
  commercial_sales: "商业买卖",
  commercial_lease: "商业租赁",
  other: "其他"
};

const transactionStatusZhCopy: Record<string, string> = {
  opportunity: "机会",
  active: "进行中",
  pending: "待处理",
  closed: "已成交",
  cancelled: "已取消",
  system_anchor: "系统锚点",
  Opportunity: "机会",
  Active: "进行中",
  Pending: "待处理",
  Closed: "已成交",
  Cancelled: "已取消"
};

const transactionRepresentingZhCopy: Record<string, string> = {
  buyer: "买方",
  seller: "卖方",
  both: "双方",
  tenant: "租客",
  landlord: "房东",
  Buyer: "买方",
  Seller: "卖方",
  Both: "双方",
  Tenant: "租客",
  Landlord: "房东"
};

function translateTransactionCopy(value: string, copy: Record<string, string>, isZh: boolean) {
  return isZh ? copy[value] ?? value : value;
}

function translateBasicValue(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  if (value === "Yes") {
    return "是";
  }

  if (value === "No") {
    return "否";
  }

  return value;
}

export async function TransactionDetailWorkspace({
  context,
  transactionId,
  chrome = "page"
}: TransactionDetailWorkspaceProps) {
  const organizationId = context.currentOrganization.id;
  const viewerMembershipId = context.currentMembership.id;
  const officeId = context.currentOffice?.id ?? null;
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  // Start the shared workspace reads together so the embedded accounting review
  // does not wait on a long serial chain before rendering.
  const transactionPromise = getTransactionById({
    organizationId,
    viewerMembershipId,
    transactionId,
    officeId
  });
  const tasksPromise = listTransactionTasks(organizationId, transactionId);
  const taskAssigneeOptionsPromise = listTransactionTaskAssigneeOptions(organizationId, transactionId);
  const commissionSnapshotPromise = getTransactionCommissionSnapshot(organizationId, transactionId, officeId, viewerMembershipId);
  const offersSnapshotPromise = listTransactionOffersSnapshot(organizationId, transactionId);
  const transactionIntakeSchemaPromise = getOfficeTransactionIntakeSchema({
    organizationId,
    officeId
  });
  const offerFieldSchemaPromise = getOfficeOfferFieldSchema({
    organizationId,
    officeId
  });
  const transaction = await transactionPromise;

  if (!transaction) {
    notFound();
  }

  const [tasks, taskAssigneeOptions, commissionSnapshot, offersSnapshot, transactionIntakeSchema, offerFieldSchema] = await Promise.all([
    tasksPromise,
    taskAssigneeOptionsPromise,
    commissionSnapshotPromise,
    offersSnapshotPromise,
    transactionIntakeSchemaPromise,
    offerFieldSchemaPromise
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
  const canDeleteTransactionsForRole = canDeleteOfficeTransactions(context.currentMembership);
  const canEditTransactionsForRole = canEditOfficeTransactions(context.currentMembership);
  const canManageTransactionStatusForRole = canManageOfficeTransactionStatus(context.currentMembership);
  const canManageTransactionFinanceForRole = canManageOfficeTransactionFinance(context.currentMembership);
  const canManageCommissionsForRole = canManageOfficeCommissions(context.currentMembership);
  const canCalculateCommissionsForRole = canCalculateOfficeCommissions(context.currentMembership);
  const canApproveCommissionsForRole = canApproveOfficeCommissions(context.currentMembership);
  const transactionDetailSectionStorageScope = `${context.currentOrganization.id}:${context.currentMembership.id}`;
  const isEmbedded = chrome === "embedded";

  return (
    <OfficeDetailPageShell
      className={[
        "office-transaction-detail-page",
        isEmbedded ? "office-transaction-detail-embedded" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!isEmbedded ? (
        <OfficeDetailPageHeader
          description={`${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`}
          eyebrow={isZh ? "交易详情" : "Transaction detail"}
          summary={
            <>
              <Link className="office-button-secondary" href="/office/transactions">
                {isZh ? "返回交易列表" : "Back to transactions"}
              </Link>
              <TransactionDeleteAction
                canDelete={canDeleteTransactionsForRole}
                transactionId={transaction.id}
                transactionTitle={transaction.title}
              />
              <SummaryChip label={isZh ? "负责人" : "Owner"} value={transaction.ownerName} />
              <SummaryChip label={isZh ? "办公室" : "Office"} value={transaction.officeName || (isZh ? "未分配" : "Unassigned")} />
              <SummaryChip label={isZh ? "状态" : "Status"} tone="accent" value={translateTransactionCopy(transaction.statusValue, transactionStatusZhCopy, isZh)} />
            </>
          }
          title={transaction.title}
        />
      ) : null}

      <DetailSection title={isZh ? "概览" : "Overview"}>
        <div className="office-detail-grid">
          <div className="office-detail-field">
            <span>{isZh ? "类型" : "Type"}</span>
            <strong>{translateTransactionCopy(transaction.typeValue, transactionTypeZhCopy, isZh)}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "代表方" : "Representing"}</span>
            <strong>{translateTransactionCopy(transaction.representingValue, transactionRepresentingZhCopy, isZh)}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "要价" : "Asking price"}</span>
            <strong>{formatTransactionCurrency(transaction.askingPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "成交价" : "Purchased price"}</span>
            <strong>{formatTransactionCurrency(transaction.purchasedPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "负责人" : "Owner"}</span>
            <strong>{transaction.ownerName}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "办公室" : "Office"}</span>
            <strong>{transaction.officeName || (isZh ? "未分配" : "Unassigned")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "公司推荐" : "Company referral"}</span>
            <strong>{translateBasicValue(transaction.companyReferral, isZh)}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "推荐员工" : "Referral employee"}</span>
            <strong>{transaction.companyReferralEmployeeName || (isZh ? "无" : "None")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "重要日期" : "Important date"}</span>
            <strong>{transaction.importantDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "买方协议日期" : "Buyer agreement date"}</span>
            <strong>{transaction.buyerAgreementDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "买方协议到期日" : "Buyer agreement expiration"}</span>
            <strong>{transaction.buyerExpirationDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "接受日期" : "Acceptance date"}</span>
            <strong>{transaction.acceptanceDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "成交日期" : "Closing date"}</span>
            <strong>{transaction.closingDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
          <div className="office-detail-field">
            <span>{isZh ? "入住日期" : "Move-in date"}</span>
            <strong>{transaction.moveInDate || (isZh ? "未设置" : "Not set")}</strong>
          </div>
        </div>
      </DetailSection>

      <SectionCard title={isZh ? "状态" : "Status"}>
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
        title={isZh ? "录入字段" : "Intake fields"}
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
          statusFieldPolicy={getEditTransactionStatusFieldPolicy(canManageTransactionStatusForRole, isZh)}
          submitEndpoint={`/api/office/transactions/${transaction.id}/intake`}
          submitLabel={isZh ? "保存录入更改" : "Save intake changes"}
          submitMethod="PATCH"
        />
      </TransactionDetailCollapsibleSection>

      {transaction.canViewFinancials ? (
        <TransactionDetailCollapsibleSection
          sectionKey="finance"
          storageScope={transactionDetailSectionStorageScope}
          subtitle={isZh ? "费用、拆分与经纪人净额。" : "Fees, splits, and agent net."}
          title={isZh ? "财务" : "Finance"}
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
          title={isZh ? "佣金" : "Commission"}
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

      <TransactionDetailCollapsibleSection sectionKey="contacts" storageScope={transactionDetailSectionStorageScope} title={isZh ? "联系人" : "Contacts"}>
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
          subtitle={isZh ? "收到的报价和关联文档。" : "Received offers and linked documents."}
          title={isZh ? "报价" : "Offers"}
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

      <TransactionDetailCollapsibleSection sectionKey="tasks" storageScope={transactionDetailSectionStorageScope} title={isZh ? "清单 / 任务" : "Checklist / tasks"}>
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
        title={isZh ? "文档" : "Documents"}
      >
        <TransactionDocumentsCard
          canManageDocuments={canManageDocumentsForRole}
          canManageSignatures={canManageSignaturesForRole}
          canViewDocuments={canViewDocumentsForRole}
          documents={transaction.documents}
          taskOptions={taskOptions}
          transactionId={transaction.id}
        />
      </TransactionDetailCollapsibleSection>

      <TransactionDetailCollapsibleSection
        sectionKey="unsorted-documents"
        storageScope={transactionDetailSectionStorageScope}
        subtitle={isZh ? "已上传但尚未分类。" : "Uploaded but not yet categorized."}
        title={isZh ? "未整理文档" : "Unsorted documents"}
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
        subtitle={isZh ? "生成并跟踪表单签名。" : "Generate and track form signatures."}
        title={isZh ? "表单与电子签名" : "Forms & eSignature"}
      >
        <TransactionFormsSignaturesCard
          canManageSignatures={canManageSignaturesForRole}
          canUseForms={canUseFormsForRole}
          canViewDocuments={canViewDocumentsForRole}
          formTemplates={transaction.formTemplates}
          forms={transaction.forms}
          signatureRequests={transaction.signatureRequests}
          taskOptions={taskOptions}
          transactionId={transaction.id}
          />
        </TransactionDetailCollapsibleSection>
    </OfficeDetailPageShell>
  );
}
