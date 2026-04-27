type AcreLegalSection = {
  title: string;
  body: string[];
};

type AcreLegalAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type AcreLegalPageProps = {
  actions?: AcreLegalAction[];
  description: string;
  kicker: string;
  lastUpdated: string;
  sections: AcreLegalSection[];
  summary: string;
  title: string;
};

export function AcreLegalPage({
  actions = [],
  description,
  kicker,
  lastUpdated,
  sections,
  summary,
  title,
}: AcreLegalPageProps) {
  return (
    <main className="acre-legal-shell">
      <div className="acre-legal-page">
        <section className="acre-legal-hero">
          <span className="acre-legal-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="acre-legal-meta">
            <span>Last updated</span>
            <strong>{lastUpdated}</strong>
          </div>
          {actions.length ? (
            <div className="acre-legal-actions">
              {actions.map((action) => (
                <a
                  className={
                    action.variant === "primary"
                      ? "acre-legal-button acre-legal-button-primary"
                      : "acre-legal-button"
                  }
                  href={action.href}
                  key={`${action.href}-${action.label}`}
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="acre-legal-summary">
          <strong>Plain English summary</strong>
          <p>{summary}</p>
        </section>

        <div className="acre-legal-sections">
          {sections.map((section) => (
            <article className="acre-legal-section" key={section.title}>
              <h2>{section.title}</h2>
              <div className="acre-legal-copy">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
