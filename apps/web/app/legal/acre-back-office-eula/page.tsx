import { AcreLegalPage } from "../_components/acre-legal-page";

export const metadata = {
  title: "Acre Back Office End-User License Agreement",
  description:
    "End-user license agreement for Acre Back Office and the QuickBooks Online connection.",
};

const sections = [
  {
    title: "Scope",
    body: [
      "This End-User License Agreement applies to Acre Back Office, including the Acre Agent OS and Back Office features used for brokerage operations, transaction workflows, documents, billing, commissions, reporting, and connected accounting workflows.",
      "Acre Back Office is made available for authorized users of ACRE NY REALTY INC and its approved business users. If you use the application for a company or brokerage, you represent that you are authorized to use it for that organization.",
    ],
  },
  {
    title: "License and authorized use",
    body: [
      "Acre grants authorized users a limited, non-exclusive, non-transferable right to access and use Acre Back Office for internal business operations.",
      "Users may not copy, resell, sublicense, reverse engineer, interfere with, or use Acre Back Office to access data, systems, or accounts they are not permitted to use.",
    ],
  },
  {
    title: "Accounts and security",
    body: [
      "Users are responsible for keeping account credentials secure and for promptly reporting suspected unauthorized access.",
      "Administrative users are responsible for assigning appropriate roles, permissions, office access, and integration access inside Acre Back Office.",
    ],
  },
  {
    title: "Business records and user content",
    body: [
      "Business records entered into Acre Back Office remain the responsibility of the organization and its authorized users.",
      "Acre Back Office may store operational records, transaction data, contact data, accounting workflow metadata, documents, notes, approvals, activity logs, settings, and integration status needed to operate the system.",
    ],
  },
  {
    title: "QuickBooks Online connection",
    body: [
      "When an authorized administrator connects QuickBooks Online, the administrator authorizes Acre Back Office to request, store, refresh, and use Intuit OAuth credentials for the selected QuickBooks Online company.",
      "The current QuickBooks connection verifies company information and stores connection health in Acre Back Office. Automatic object sync for invoices, payments, payouts, ledger rows, or other accounting objects must be separately enabled before those records are pushed or updated.",
      "Disconnecting QuickBooks removes the saved OAuth tokens from Acre Back Office. Existing Acre records remain in Acre unless an authorized user separately deletes or changes them.",
    ],
  },
  {
    title: "No professional advice",
    body: [
      "Acre Back Office is an operational software system. It does not provide legal, tax, accounting, brokerage compliance, or financial advice.",
      "Users remain responsible for reviewing records, approvals, filings, accounting entries, commission calculations, legal documents, and compliance decisions with qualified professionals where appropriate.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "Acre Back Office may change over time as workflows, integrations, security requirements, and business needs evolve.",
      "The system may occasionally be unavailable due to maintenance, hosting issues, third-party service outages, security events, or other operational reasons.",
    ],
  },
  {
    title: "Disclaimers and limitation",
    body: [
      "Acre Back Office is provided on an as-available basis to the maximum extent permitted by law.",
      "To the maximum extent permitted by law, Acre is not liable for indirect, incidental, special, consequential, punitive, or exemplary damages, or for lost profits, lost revenue, lost data, or business interruption arising from use of the system.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about this agreement can be sent to support@acresystem.us or mailed to ACRE NY REALTY INC, 45-10 Ct Square W, 1st floor, Long Island City, NY 11101.",
    ],
  },
];

export default function AcreBackOfficeEulaPage() {
  return (
    <AcreLegalPage
      description="This agreement describes the permitted use of Acre Back Office and its connected QuickBooks Online workflows."
      kicker="Acre Back Office"
      lastUpdated="April 27, 2026"
      sections={sections}
      summary="Acre Back Office is licensed for authorized brokerage operations. QuickBooks Online access is controlled by an authorized admin and can be disconnected from Acre settings."
      title="End-user license agreement"
    />
  );
}
