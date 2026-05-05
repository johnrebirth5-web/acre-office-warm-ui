import { resolveProjectRemoteSigningToken } from "@acre/db";
import { ProjectRemoteSignClient } from "./project-remote-sign-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function buildSigningDocuments(
  resolved: NonNullable<Awaited<ReturnType<typeof resolveProjectRemoteSigningToken>>>,
  token: string,
) {
  const sessionRecipient = resolved.recipient;

  return sessionRecipient.session.documents.map((document) => {
    const matchingSignatureRecipients = document.signatureRequest.recipients.filter(
      (recipient) =>
        (sessionRecipient.normalizedEmail && recipient.email.toLowerCase() === sessionRecipient.normalizedEmail) ||
        (sessionRecipient.membershipId && recipient.membershipId === sessionRecipient.membershipId),
    );
    const assignedRecipientIds = new Set(matchingSignatureRecipients.map((recipient) => recipient.id));

    const fields = document.signatureRequest.fields
      .filter((field) => field.assignedRecipientId && assignedRecipientIds.has(field.assignedRecipientId))
      .map((field) => ({
        id: field.id,
        fieldType: field.fieldType,
        label: field.label,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        defaultValue: field.defaultValue ?? "",
        required: field.required,
      }));

    return {
      id: document.id,
      title: document.title,
      documentUrl: `/api/public/project-signatures/${encodeURIComponent(token)}/documents/${encodeURIComponent(document.id)}`,
      fields,
    };
  });
}

export default async function ProjectRemoteSigningPage({ params }: PageProps) {
  const { token } = await params;
  const resolved = await resolveProjectRemoteSigningToken(token);

  if (!resolved) {
    return (
      <main className="project-public-shell">
        <section className="project-public-panel">
          <h1>Signing link unavailable</h1>
          <p>This signing link is invalid, expired, or has been replaced by a newer link.</p>
        </section>
      </main>
    );
  }

  return (
    <ProjectRemoteSignClient
      documents={buildSigningDocuments(resolved, token)}
      recipientName={resolved.recipient.name}
      token={token}
    />
  );
}
