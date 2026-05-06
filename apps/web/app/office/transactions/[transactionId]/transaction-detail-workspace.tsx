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

const transactionTypeCopy: Record<string, string> = {
  sales: "买卖",
  sales_listing: "销售挂牌",
  rental_leasing: "租赁",
  rental_listing: "出租挂牌",
  commercial_sales: "商业买卖",
  commercial_lease: "商业租赁",
  other: "其他"
};

const transactionStatusCopy: Record<string, string> = {
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

const transactionRepresentingCopy: Record<string, string> = {
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

function translateTransactionCopy(value: string, copy: Record<string, string>) {
  return copy[value] ?? value;
}

function translateBasicValue(value: string) {
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
          eyebrow="交易详情"
          summary={
            <>
              <Link className="office-button-secondary" href="/office/transactions">
                返回交易列表
              </Link>
              <TransactionDeleteAction
                canDelete={canDeleteTransactionsForRole}
                transactionId={transaction.id}
                transactionTitle={transaction.title}
              />
              <SummaryChip label="负责人" value={transaction.ownerName} />
              <SummaryChip label="办公室" value={transaction.officeName || "未分配"} />
              <SummaryChip label="状态" tone="accent" value={translateTransactionCopy(transaction.statusValue, transactionStatusCopy)} />
            </>
          }
          title={transaction.title}
        />
      ) : null}

      <DetailSection title="概览">
        <div className="office-detail-grid">
          <div className="office-detail-field">
            <span>类型</span>
            <strong>{translateTransactionCopy(transaction.typeValue, transactionTypeCopy)}</strong>
          </div>
          <div className="office-detail-field">
            <span>代表方</span>
            <strong>{translateTransactionCopy(transaction.representingValue, transactionRepresentingCopy)}</strong>
          </div>
          <div className="office-detail-field">
            <span>要价</span>
            <strong>{formatTransactionCurrency(transaction.askingPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>成交价</span>
            <strong>{formatTransactionCurrency(transaction.purchasedPrice)}</strong>
          </div>
          <div className="office-detail-field">
            <span>负责人</span>
            <strong>{transaction.ownerName}</strong>
          </div>
          <div className="office-detail-field">
            <span>办公室</span>
            <strong>{transaction.officeName || "未分配"}</strong>
          </div>
          <div className="office-detail-field">
            <span>公司推荐</span>
            <strong>{translateBasicValue(transaction.companyReferral)}</strong>
          </div>
          <div className="office-detail-field">
            <span>推荐员工</span>
            <strong>{transaction.companyReferralEmployeeName || "无"}</strong>
          </div>
          <div className="office-detail-field">
            <span>重要日期</span>
            <strong>{transaction.importantDate || "未设置"}</strong>
          </div>
          <div className="office-detail-field">
            <span>买方协议日期</span>
            <strong>{transaction.buyerAgreementDate || "未设置"}</strong>
          </div>
          <div className="office-detail-field">
            <span>买方协议到期日</span>
            <strong>{transaction.buyerExpirationDate || "未设置"}</strong>
          </div>
          <div className="office-detail-field">
            <span>接受日期</span>
            <strong>{transaction.acceptanceDate || "未设置"}</strong>
          </div>
          <div className="office-detail-field">
            <span>成交日期</span>
            <strong>{transaction.closingDate || "未设置"}</strong>
          </div>
          <div className="office-detail-field">
            <span>入住日期</span>
            <strong>{transaction.moveInDate || "未设置"}</strong>
          </div>
        </div>
      </DetailSection>

      <SectionCard title="状态">
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
        title="录入字段"
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
          submitLabel="保存录入更改"
          submitMethod="PATCH"
        />
      </TransactionDetailCollapsibleSection>

      {transaction.canViewFinancials ? (
        <TransactionDetailCollapsibleSection
          sectionKey="finance"
          storageScope={transactionDetailSectionStorageScope}
          subtitle="费用、拆分与经纪人净额。"
          title="财务"
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
          title="佣金"
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

      <TransactionDetailCollapsibleSection sectionKey="contacts" storageScope={transactionDetailSectionStorageScope} title="联系人">
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
          subtitle="收到的报价和关联文档。"
          title="报价"
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

      <TransactionDetailCollapsibleSection sectionKey="tasks" storageScope={transactionDetailSectionStorageScope} title="清单 / 任务">
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
        title="文档"
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
        subtitle="已上传但尚未分类。"
        title="未整理文档"
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
        subtitle="生成并跟踪表单签名。"
        title="表单与电子签名"
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
