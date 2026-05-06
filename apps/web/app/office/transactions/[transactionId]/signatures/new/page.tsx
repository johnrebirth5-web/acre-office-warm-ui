import { canManageOfficeSignatures, canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureTemplate, getOfficeSignatureTemplateLibrarySnapshot, getTransactionById } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
import { getServerI18n } from "../../../../../../lib/i18n/server";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../../../_components/office-detail-page-template";
import { SignatureRequestEditor } from "../signature-request-editor";

type NewSignatureRequestPageProps = {
  params: Promise<{
    transactionId: string;
  }>;
  searchParams: Promise<{
    documentId?: string;
    templateId?: string;
  }>;
};

export default async function NewSignatureRequestPage({ params, searchParams }: NewSignatureRequestPageProps) {
  const context = await requireOfficeSession();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  if (!canManageOfficeSignatures(context.currentMembership)) {
    redirect(`/office/transactions`);
  }

  const { transactionId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const documentId = resolvedSearchParams.documentId?.trim();
  const templateId = resolvedSearchParams.templateId?.trim();

  if (!documentId) {
    redirect(`/office/transactions/${transactionId}#transaction-documents`);
  }

  const [transaction, templateLibrary, initialTemplate] = await Promise.all([
    getTransactionById({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      transactionId,
      officeId: context.currentOffice?.id ?? null
    }),
    canManageOfficeSignatureTemplates(context.currentMembership)
      ? getOfficeSignatureTemplateLibrarySnapshot({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null
        })
      : Promise.resolve(null),
    templateId && canManageOfficeSignatureTemplates(context.currentMembership)
      ? getOfficeSignatureTemplate({
          organizationId: context.currentOrganization.id,
          templateId
        })
      : Promise.resolve(null)
  ]);

  if (!transaction) {
    notFound();
  }

  const document = transaction.documents.find((entry) => entry.id === documentId && entry.mimeType.toLowerCase() === "application/pdf");

  if (!document) {
    redirect(`/office/transactions/${transactionId}#transaction-documents`);
  }

  return (
    <OfficeDetailPageShell className="office-signature-page">
      <OfficeDetailPageHeader
        description={isZh ? "第 1 步配置收件人与发送方式；第 2 步放置 PDF 字段，并把每个字段绑定到正确签署人。" : "Step 1 configures recipients and sending details; Step 2 places PDF fields and binds each field to the right signer."}
        eyebrow={isZh ? "交易签名" : "Transaction signatures"}
        title={isZh ? `准备签名 · ${document.title}` : `Prepare signature · ${document.title}`}
      />

      <SignatureRequestEditor
        defaultReplyTo={context.currentUser.email}
        defaultSenderDisplayName={`${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() || context.currentUser.email}
        availableTemplates={templateLibrary?.templates ?? []}
        document={document}
        initialAuditEntries={[]}
        initialFields={[]}
        initialRequest={null}
        initialTemplate={initialTemplate}
        transactionId={transactionId}
      />
    </OfficeDetailPageShell>
  );
}
