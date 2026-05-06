import { resolveHrOnboardingToken } from "@acre/db";
import { Badge } from "@acre/ui";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { consumePublicTokenRateLimit } from "../../../lib/public-token-rate-limit";
import { PublicOnboardingUploadForm } from "./onboarding-client";

type PageProps = {
  params: Promise<{ token: string }>;
};

const PUBLIC_ONBOARDING_READ_RATE_LIMIT_OPTIONS = {
  limit: 40,
  windowMs: 10 * 60 * 1000,
};

export default async function PublicOnboardingPage({ params }: PageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/onboarding/read",
    request: headerStore,
    token,
    options: PUBLIC_ONBOARDING_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await resolveHrOnboardingToken(token);

  if (!snapshot) {
    return (
      <main className="office-page-shell">
        <section className="office-section-card">
          <div className="office-section-body">
            <p className="office-empty-copy">This onboarding link is invalid or expired.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="office-page-shell">
      <section className="office-page-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Acre onboarding</span>
          <h2>{snapshot.candidateName}</h2>
        </div>
        <div className="office-page-supporting">
          <Badge>{snapshot.status}</Badge>
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>Required form</h3>
          </div>
          <a className="office-button-secondary" href={snapshot.legalFormUrl} rel="noreferrer" target="_blank">
            Open Google form
          </a>
        </header>
        <div className="office-section-body">
          <div className="office-detail-two-column">
            <div className="office-detail-field"><span>Email</span><strong>{snapshot.candidateEmail}</strong></div>
            <div className="office-detail-field"><span>Expires</span><strong>{snapshot.expiresAt}</strong></div>
          </div>
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>Upload documents</h3>
          </div>
        </header>
        <div className="office-section-body">
          <PublicOnboardingUploadForm candidateEmail={snapshot.candidateEmail} token={token} />
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>Uploaded</h3>
          </div>
        </header>
        <div className="office-section-body">
          {snapshot.documents.length === 0 ? (
            <p className="office-empty-copy">No documents uploaded yet.</p>
          ) : (
            <div className="office-list-page-stack">
              {snapshot.documents.map((document) => (
                <div className="office-detail-field" key={document.id}>
                  <span>{document.kind}</span>
                  <strong>{document.title || document.fileName}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
