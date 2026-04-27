export const metadata = {
  title: "Acre Terms of Use",
  description:
    "Terms of use for Acre Agent OS, Back Office, and connected operational services.",
};

const sections = [
  {
    title: "Authorized use",
    body: [
      "Acre Agent OS and Back Office are provided for authorized brokerage operations users, including administrators, staff, and agents invited by the brokerage organization.",
      "Users are responsible for keeping their credentials secure and for using the system only for legitimate brokerage business.",
    ],
  },
  {
    title: "Operational records",
    body: [
      "Acre records activity, workflow state, approvals, accounting handoffs, document actions, and other operational changes so the brokerage can review how work moved through the system.",
      "Users should enter accurate information and should not mark work as paid, signed, synced, approved, or complete unless that state is true in the relevant system of record.",
    ],
  },
  {
    title: "Connected services",
    body: [
      "Administrators may connect external services such as QuickBooks Online to support specific workflows.",
      "For QuickBooks Online, Acre's current integration is limited to creating unpaid bills from confirmed payout statements. Acre does not automatically pay bills or initiate bank transfers.",
    ],
  },
  {
    title: "Brokerage responsibility",
    body: [
      "Acre supports brokerage operations, but it does not replace professional accounting, legal, compliance, tax, or brokerage supervision.",
      "The brokerage remains responsible for reviewing records, supervising users, verifying payouts, and confirming external system entries before taking financial action.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "Acre may change features, workflows, integrations, and access controls as the system evolves.",
      "Connected service availability can depend on third-party provider APIs, authorization, account configuration, and provider terms.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For questions about Acre access, terms, or connected service behavior, contact Acre at support@acresystem.us.",
    ],
  },
];

export default function AcreTermsPage() {
  return (
    <main className="listing-studio-legal-shell">
      <div className="listing-studio-legal-page">
        <section className="listing-studio-legal-hero">
          <span className="listing-studio-legal-kicker">Acre Agent OS</span>
          <h1>Terms of use</h1>
          <p>
            These terms describe the allowed operational use of Acre and its
            connected brokerage workflows.
          </p>
          <div className="listing-studio-legal-meta">
            <span>Last updated</span>
            <strong>April 27, 2026</strong>
          </div>
        </section>

        <section className="listing-studio-legal-card">
          <div className="listing-studio-legal-summary">
            <strong>Plain English summary</strong>
            <p>
              Acre is an internal brokerage work system. Authorized users should
              use it accurately, keep financial actions reviewable, and treat
              external integrations as operational handoffs rather than
              automatic approvals or payments.
            </p>
          </div>

          <div className="listing-studio-legal-sections">
            {sections.map((section) => (
              <article
                className="listing-studio-legal-section"
                key={section.title}
              >
                <h2>{section.title}</h2>
                <div className="listing-studio-legal-copy">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
