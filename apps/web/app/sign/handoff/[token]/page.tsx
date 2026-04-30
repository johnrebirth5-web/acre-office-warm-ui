import { resolveProjectHandoffToken } from "@acre/db";
import { ProjectHandoffClient } from "./project-handoff-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

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
      }))}
      token={token}
    />
  );
}

