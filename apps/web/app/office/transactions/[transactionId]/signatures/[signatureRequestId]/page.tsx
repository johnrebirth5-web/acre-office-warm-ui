import { canManageOfficeSignatures, canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureTemplateLibrarySnapshot, getSignatureEditorSnapshot } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
import { getServerI18n } from "../../../../../../lib/i18n/server";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../../../_components/office-detail-page-template";
import { SignatureRequestEditor } from "../signature-request-editor";

type SignatureRequestPageProps = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

export default async function SignatureRequestPage({ params }: SignatureRequestPageProps) {
  const context = await requireOfficeSession();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  if (!canManageOfficeSignatures(context.currentMembership)) {
    redirect(`/office/transactions`);
  }

  const { transactionId, signatureRequestId } = await params;
  const [snapshot, templateLibrary] = await Promise.all([
    getSignatureEditorSnapshot(context.currentOrganization.id, transactionId, signatureRequestId),
    canManageOfficeSignatureTemplates(context.currentMembership)
      ? getOfficeSignatureTemplateLibrarySnapshot({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null
        })
      : Promise.resolve(null)
  ]);

  if (!snapshot) {
    notFound();
  }

  return (
    <OfficeDetailPageShell className="office-signature-page">
      <OfficeDetailPageHeader
        description={isZh ? "更新收件人或字段位置，确保每个字段都分配给正确签署人；请求准备好后可重新发送。" : "Update recipients or field placement, keep every field assigned to the right signer, and resend once the request is ready."}
        eyebrow={isZh ? "交易签名" : "Transaction signatures"}
        title={isZh ? `编辑签名请求 · ${snapshot.document.title}` : `Edit signature request · ${snapshot.document.title}`}
      />

      <SignatureRequestEditor
        defaultReplyTo={context.currentUser.email}
        defaultSenderDisplayName={`${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() || context.currentUser.email}
        availableTemplates={templateLibrary?.templates ?? []}
        document={snapshot.document}
        initialAuditEntries={snapshot.auditEntries}
        initialFields={snapshot.fields}
        initialRequest={snapshot.signatureRequest}
        initialTemplate={null}
        transactionId={transactionId}
      />
    </OfficeDetailPageShell>
  );
}
