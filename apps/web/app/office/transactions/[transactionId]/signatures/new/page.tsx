import { canManageOfficeSignatures, canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureTemplate, getOfficeSignatureTemplateLibrarySnapshot, getTransactionById } from "@acre/db";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
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
        description="Step 1 configures recipients and delivery. Step 2 places the PDF fields and binds each field to the right signer."
        eyebrow="Transaction signatures"
        title={`Prepare signature · ${document.title}`}
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
