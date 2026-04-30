import { resolveProjectRemoteSigningToken } from "@acre/db";
import { ProjectRemoteSignClient } from "./project-remote-sign-client";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

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
        otpRequired={resolved.otpRequired}
        recipientName={resolved.recipient.name}
        token={token}
      />
    </main>
  );
}

