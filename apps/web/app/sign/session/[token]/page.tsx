import { resolveProjectRemoteSigningToken } from "@acre/db";
import { ProjectRemoteSignClient } from "./project-remote-sign-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function buildSigningFields(resolved: NonNullable<Awaited<ReturnType<typeof resolveProjectRemoteSigningToken>>>) {
  const sessionRecipient = resolved.recipient;

  return sessionRecipient.session.documents.flatMap((document) => {
    const matchingSignatureRecipients = document.signatureRequest.recipients.filter(
      (recipient) =>
        (sessionRecipient.normalizedEmail && recipient.email.toLowerCase() === sessionRecipient.normalizedEmail) ||
        (sessionRecipient.membershipId && recipient.membershipId === sessionRecipient.membershipId),
    );
    const assignedRecipientIds = new Set(matchingSignatureRecipients.map((recipient) => recipient.id));

    return document.signatureRequest.fields
      .filter((field) => field.assignedRecipientId && assignedRecipientIds.has(field.assignedRecipientId))
      .map((field) => ({
        id: field.id,
        fieldType: field.fieldType,
        label: field.label,
        documentTitle: document.title,
      }));
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
    <main className="project-public-shell">
      <ProjectRemoteSignClient
        signingFields={buildSigningFields(resolved)}
        recipientName={resolved.recipient.name}
        token={token}
      />
    </main>
  );
}
