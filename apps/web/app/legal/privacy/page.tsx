export const metadata = {
  title: "Acre Privacy Notice",
  description:
    "Privacy notice for Acre Agent OS, Back Office, and connected operational services.",
};

const sections = [
  {
    title: "What Acre does",
    body: [
      "Acre Agent OS and Back Office help real estate brokerage teams manage transactions, agents, commissions, accounting workflows, documents, communications, signatures, and operational reporting.",
      "Acre is used by authorized brokerage personnel and agents for internal brokerage operations.",
    ],
  },
  {
    title: "Information Acre processes",
    body: [
      "Acre may process user account details, brokerage membership details, office assignments, client and transaction records, task activity, document metadata, signature workflow records, commission and payout statement details, and accounting workflow data entered into the system.",
      "When an administrator connects a third-party service such as QuickBooks Online, Acre stores or uses the authorization data needed to perform the requested integration workflow.",
    ],
  },
  {
    title: "How information is used",
    body: [
      "Acre uses information to provide the internal brokerage system, keep workflows auditable, route work by organization and office, generate reports, support accounting handoffs, and maintain security controls.",
      "For QuickBooks Online, Acre uses accounting integration access only to create and manage the unpaid bill sync workflow requested by authorized administrators.",
    ],
  },
  {
    title: "What Acre does not do",
    body: [
      "Acre does not sell personal information.",
      "Acre does not use QuickBooks data for advertising.",
      "Acre does not initiate bank payments through the QuickBooks unpaid bill sync workflow.",
    ],
  },
  {
    title: "Security and access",
    body: [
      "Acre limits access by authenticated user roles, organization scope, office scope, and workflow permissions.",
      "Administrators should grant access only to personnel who need it for brokerage operations and should remove access when it is no longer needed.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "Third-party services connected to Acre, including QuickBooks Online, remain governed by their own terms, security practices, and privacy notices.",
      "Administrators can disconnect or rotate third-party access according to the connected provider's controls and Acre's documented setup process.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For questions about Acre privacy practices or connected service access, contact Acre at support@acresystem.us.",
    ],
  },
];

export default function AcrePrivacyPage() {
  return (
    <main className="listing-studio-legal-shell">
      <div className="listing-studio-legal-page">
        <section className="listing-studio-legal-hero">
          <span className="listing-studio-legal-kicker">Acre Agent OS</span>
          <h1>Privacy notice</h1>
          <p>
            This notice explains what Acre processes for internal brokerage
            operations and connected services such as QuickBooks Online.
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
              Acre is an internal brokerage operations system. It uses data to
              run brokerage workflows, keep an audit trail, and complete
              administrator-approved integrations. It does not sell personal
              information.
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
