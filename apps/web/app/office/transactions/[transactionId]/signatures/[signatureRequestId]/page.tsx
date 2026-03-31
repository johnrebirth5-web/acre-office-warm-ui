import { canManageOfficeSignatures, canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureTemplateLibrarySnapshot, getSignatureEditorSnapshot } from "@acre/db";
import { PageHeader, PageShell } from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../../lib/auth-session";
import { SignatureRequestEditor } from "../signature-request-editor";

type SignatureRequestPageProps = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

export default async function SignatureRequestPage({ params }: SignatureRequestPageProps) {
  const context = await requireOfficeSession();

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
    <PageShell className="office-signature-page">
      <PageHeader
        description="Update recipients or field placement, keep every field assigned to the right signer, and resend when the request is ready."
        eyebrow="Transaction signatures"
        title={`Edit signature request · ${snapshot.document.title}`}
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
    </PageShell>
  );
}
