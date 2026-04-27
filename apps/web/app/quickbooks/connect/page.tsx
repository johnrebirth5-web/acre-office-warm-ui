import { AcreLegalPage } from "../../legal/_components/acre-legal-page";

export const metadata = {
  title: "Connect QuickBooks to Acre Back Office",
  description:
    "Connect or reconnect QuickBooks Online to Acre Back Office.",
};

const sections = [
  {
    title: "Who can connect",
    body: [
      "Only Acre Back Office users with office settings permissions can connect or reconnect QuickBooks Online.",
      "The user must also be allowed to authorize the selected QuickBooks Online company in Intuit.",
    ],
  },
  {
    title: "Connection flow",
    body: [
      "Sign in to Acre Back Office, open Office Settings, choose QuickBooks, and select Connect QuickBooks or Reconnect QuickBooks.",
      "Acre redirects the authorized user to Intuit for OAuth authorization. After Intuit approves the request, Acre stores the connection and verifies the QuickBooks company information.",
    ],
  },
  {
    title: "Current sync behavior",
    body: [
      "The current QuickBooks connection verifies company information and stores connection health in Acre Back Office.",
      "Automatic object sync for invoices, payments, payouts, ledger rows, or other accounting objects is not enabled in this phase.",
    ],
  },
  {
    title: "Need help",
    body: [
      "If you cannot connect or reconnect QuickBooks, contact your Acre Back Office administrator or email support@acresystem.us.",
    ],
  },
];

export default function QuickBooksConnectPage() {
  return (
    <AcreLegalPage
      actions={[
        {
          href: "/office/settings/quickbooks",
          label: "Open QuickBooks settings",
          variant: "primary",
        },
      ]}
      description="Use this page to connect or reconnect QuickBooks Online to Acre Back Office."
      kicker="QuickBooks Online"
      lastUpdated="April 27, 2026"
      sections={sections}
      summary="Sign in to Acre Back Office, open QuickBooks settings, and start the Intuit authorization flow from there."
      title="Connect QuickBooks"
    />
  );
}
