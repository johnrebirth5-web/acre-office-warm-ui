import { AcreLegalPage } from "../../legal/_components/acre-legal-page";

export const metadata = {
  title: "Disconnect QuickBooks from Acre Back Office",
  description:
    "Disconnect QuickBooks Online from Acre Back Office.",
};

const sections = [
  {
    title: "Who can disconnect",
    body: [
      "Only Acre Back Office users with office settings permissions can disconnect QuickBooks Online.",
      "For account safety, this page does not disconnect QuickBooks automatically. The disconnect action is completed after sign-in from the QuickBooks settings screen.",
    ],
  },
  {
    title: "How to disconnect",
    body: [
      "Sign in to Acre Back Office, open Office Settings, choose QuickBooks, and select Disconnect.",
      "Acre will ask for confirmation before removing the saved QuickBooks OAuth tokens from the organization.",
    ],
  },
  {
    title: "What changes after disconnecting",
    body: [
      "Disconnecting removes the saved QuickBooks OAuth tokens from Acre Back Office and stops Acre from using that QuickBooks connection.",
      "Accounting records and workflow history already stored in Acre remain in Acre unless an authorized user separately changes or deletes them.",
    ],
  },
  {
    title: "Need help",
    body: [
      "If you cannot disconnect QuickBooks from Acre Back Office, contact your Acre administrator or email support@acresystem.us.",
    ],
  },
];

export default function QuickBooksDisconnectPage() {
  return (
    <AcreLegalPage
      actions={[
        {
          href: "/office/settings/quickbooks",
          label: "Open QuickBooks settings",
          variant: "primary",
        },
        {
          href: "mailto:support@acresystem.us",
          label: "Contact support",
        },
      ]}
      description="Use this page to disconnect QuickBooks Online from Acre Back Office."
      kicker="QuickBooks Online"
      lastUpdated="April 27, 2026"
      sections={sections}
      summary="Disconnecting QuickBooks requires an authorized Acre Back Office admin and removes saved OAuth tokens from Acre."
      title="Disconnect QuickBooks"
    />
  );
}
