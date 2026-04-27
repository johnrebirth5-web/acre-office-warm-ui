import { AcreLegalPage } from "../_components/acre-legal-page";

export const metadata = {
  title: "Acre Back Office Privacy Notice",
  description:
    "Privacy notice for Acre Back Office and the QuickBooks Online connection.",
};

const sections = [
  {
    title: "What this notice covers",
    body: [
      "This notice applies to Acre Back Office, including Acre Agent OS and Back Office workflows for brokerage operations, transaction management, documents, approvals, billing, commissions, reporting, settings, and connected accounting workflows.",
      "It also covers the QuickBooks Online connection used by authorized administrators to connect Acre Back Office with a selected Intuit QuickBooks Online company.",
    ],
  },
  {
    title: "Information Acre Back Office stores",
    body: [
      "Acre Back Office may store user profile details, organization and office information, roles and permissions, contacts, tasks, transactions, offers, documents, signatures, approvals, accounting workflow records, billing and commission metadata, activity logs, settings, and support or audit information.",
      "The system may also store security and operational data such as session records, permission checks, request metadata, integration status, validation results, and system logs needed to operate, secure, and troubleshoot the service.",
    ],
  },
  {
    title: "QuickBooks Online data",
    body: [
      "When an authorized administrator connects QuickBooks Online, Acre Back Office stores the QuickBooks company realm ID, company information returned by Intuit, connection status, validation history, and encrypted OAuth access and refresh tokens.",
      "The current release verifies the connected QuickBooks company and stores the connection state. Acre Back Office does not automatically push invoices, payments, payouts, ledger rows, or other accounting objects unless a separate sync workflow is later enabled.",
      "QuickBooks tokens are used only to operate the QuickBooks connection selected by the authorized administrator and are not sold or used for advertising.",
    ],
  },
  {
    title: "How information is used",
    body: [
      "Acre Back Office uses information to provide and secure the product, authenticate users, enforce permissions, support brokerage workflows, maintain audit trails, operate integrations, troubleshoot issues, and improve reliability.",
      "QuickBooks Online data is used to start, validate, refresh, maintain, and disconnect the QuickBooks connection, and to support accounting workflows that authorized administrators choose to enable.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "Acre Back Office shares information with service providers that help host, operate, secure, support, or monitor the system, subject to appropriate business and security controls.",
      "When QuickBooks Online is connected, Acre Back Office communicates with Intuit services as needed to complete OAuth authorization, refresh tokens, validate the company, and operate enabled QuickBooks workflows.",
      "Acre may also disclose information when required by law, to protect rights and security, or with the direction or consent of an authorized organization administrator.",
    ],
  },
  {
    title: "Security",
    body: [
      "Acre Back Office uses role-based access, audit records, server-side token handling, and encrypted storage for saved QuickBooks OAuth tokens.",
      "No system can guarantee perfect security. Users should protect credentials, use appropriate permissions, and promptly report suspected unauthorized access.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "Acre Back Office keeps business records and operational logs for as long as needed to provide the service, support brokerage operations, preserve audit trails, meet legal or compliance needs, and resolve disputes.",
      "Disconnecting QuickBooks removes saved QuickBooks OAuth tokens from Acre Back Office. Existing Acre records remain unless an authorized user separately updates or deletes them according to the organization's policies.",
    ],
  },
  {
    title: "Choices and access",
    body: [
      "Authorized users can manage profile information, settings, and QuickBooks connection status inside Acre Back Office based on their role and permissions.",
      "Organization administrators can request help with access, correction, export, disconnection, or deletion workflows by contacting Acre support.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about this privacy notice can be sent to support@acresystem.us or mailed to ACRE NY REALTY INC, 45-10 Ct Square W, 1st floor, Long Island City, NY 11101.",
    ],
  },
];

export default function AcreBackOfficePrivacyPage() {
  return (
    <AcreLegalPage
      description="This notice explains what Acre Back Office stores, how the QuickBooks Online connection is used, and how users can manage that connection."
      kicker="Acre Back Office"
      lastUpdated="April 27, 2026"
      sections={sections}
      summary="Acre Back Office stores operational brokerage records and, when enabled by an authorized admin, encrypted QuickBooks OAuth tokens and company connection details."
      title="Privacy notice"
    />
  );
}
