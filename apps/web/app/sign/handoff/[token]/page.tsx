import { resolveProjectHandoffToken } from "@acre/db";
import { getServerI18n } from "../../../../lib/i18n/server";
import { ProjectHandoffClient } from "./project-handoff-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function buildSigningDocumentsForRecipient(
  session: NonNullable<Awaited<ReturnType<typeof resolveProjectHandoffToken>>>,
  sessionRecipient: NonNullable<Awaited<ReturnType<typeof resolveProjectHandoffToken>>>["recipients"][number],
  token: string,
) {
  return session.documents
    .map((document) => {
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
        documentUrl: `/api/public/project-handoff/${encodeURIComponent(token)}/documents/${encodeURIComponent(document.id)}`,
        fields,
      };
    });
}

export default async function ProjectHandoffSigningPage({ params }: PageProps) {
  const { token } = await params;
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";
  const session = await resolveProjectHandoffToken(token);

  if (!session) {
    return (
      <main className="project-kiosk-shell">
        <section className="project-kiosk-panel">
          <h1>{isZh ? "交接链接已失效" : "Handoff link unavailable"}</h1>
          <p>{isZh ? "这个 iPad 交接链接无效、已过期，或已被经纪人重置。" : "This iPad handoff link is invalid, expired, or was reset by the agent."}</p>
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
        documents: buildSigningDocumentsForRecipient(session, recipient, token),
      }))}
      token={token}
    />
  );
}
