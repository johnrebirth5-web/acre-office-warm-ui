import { resolveProjectHandoffToken } from "@acre/db";
import { ProjectHandoffClient } from "./project-handoff-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function buildSigningFieldsForRecipient(
  session: NonNullable<Awaited<ReturnType<typeof resolveProjectHandoffToken>>>,
  sessionRecipient: NonNullable<Awaited<ReturnType<typeof resolveProjectHandoffToken>>>["recipients"][number],
) {
  return session.documents.flatMap((document) => {
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
        defaultValue: field.defaultValue ?? "",
      }));
  });
}

export default async function ProjectHandoffSigningPage({ params }: PageProps) {
  const { token } = await params;
  const session = await resolveProjectHandoffToken(token);

  if (!session) {
    return (
      <main className="project-kiosk-shell">
        <section className="project-kiosk-panel">
          <h1>Handoff expired</h1>
          <p>This iPad handoff link is invalid, expired, or has been reset by the agent.</p>
        </section>
      </main>
    );
  }

  return (
    <ProjectHandoffClient
      projectName={session.project.name}
      recipients={session.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        status: recipient.status,
        routingStep: recipient.routingStep,
        signingFields: buildSigningFieldsForRecipient(session, recipient),
      }))}
      token={token}
    />
  );
}
