import { resolveHrOnboardingToken } from "@acre/db";
import { Badge } from "@acre/ui";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getServerI18n } from "../../../lib/i18n/server";
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
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";

  if (!snapshot) {
    return (
      <main className="office-page-shell">
        <section className="office-section-card">
          <div className="office-section-body">
            <p className="office-empty-copy">{isZh ? "这个入职链接无效或已过期。" : "This onboarding link is invalid or expired."}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="office-page-shell">
      <section className="office-page-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">{isZh ? "Acre 入职" : "Acre onboarding"}</span>
          <h2>{snapshot.candidateName}</h2>
        </div>
        <div className="office-page-supporting">
          <Badge>{snapshot.status}</Badge>
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>{isZh ? "必填表单" : "Required form"}</h3>
          </div>
          <a className="office-button-secondary" href={snapshot.legalFormUrl} rel="noreferrer" target="_blank">
            {isZh ? "打开 Google 表单" : "Open Google Form"}
          </a>
        </header>
        <div className="office-section-body">
          <div className="office-detail-two-column">
            <div className="office-detail-field"><span>{isZh ? "邮箱" : "Email"}</span><strong>{snapshot.candidateEmail}</strong></div>
            <div className="office-detail-field"><span>{isZh ? "过期时间" : "Expires"}</span><strong>{snapshot.expiresAt}</strong></div>
          </div>
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>{isZh ? "上传文件" : "Upload files"}</h3>
          </div>
        </header>
        <div className="office-section-body">
          <PublicOnboardingUploadForm candidateEmail={snapshot.candidateEmail} token={token} />
        </div>
      </section>

      <section className="office-section-card">
        <header className="office-section-head">
          <div className="office-section-copy">
            <h3>{isZh ? "已上传" : "Uploaded"}</h3>
          </div>
        </header>
        <div className="office-section-body">
          {snapshot.documents.length === 0 ? (
            <p className="office-empty-copy">{isZh ? "还没有上传文件。" : "No files have been uploaded yet."}</p>
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
