import { canManageOfficeSignatures } from "@acre/auth";
import { getSignatureEditorSnapshot } from "@acre/db";
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
  const snapshot = await getSignatureEditorSnapshot(context.currentOrganization.id, transactionId, signatureRequestId);

  if (!snapshot) {
    notFound();
  }

  return (
    <PageShell className="office-signature-page">
      <PageHeader
        description="Adjust fields, resend the request if needed, and monitor the signing audit trail."
        eyebrow="Transaction signatures"
        title={`Edit signature request · ${snapshot.document.title}`}
      />

      <SignatureRequestEditor
        defaultReplyTo={context.currentUser.email}
        defaultSenderDisplayName={`${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() || context.currentUser.email}
        document={snapshot.document}
        initialAuditEntries={snapshot.auditEntries}
        initialFields={snapshot.fields}
        initialRequest={snapshot.signatureRequest}
        transactionId={transactionId}
      />
    </PageShell>
  );
}
