import { SectionCard } from "@acre/ui";
import { requireSessionContext } from "../../../../../lib/auth-session";
import { ListingStudioExtensionApprovalClient } from "./approval-client";

type ListingStudioExtensionConnectPageProps = {
  params: Promise<{ challengeToken: string }>;
};

export default async function ListingStudioExtensionConnectPage(
  props: ListingStudioExtensionConnectPageProps,
) {
  const context = await requireSessionContext();
  const { challengeToken } = await props.params;

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Approve Chrome extension access</h2>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle="The extension will receive a long-lived Acre token after approval. It is scoped to your current organization and can only save Listing Studio imports."
          title="Connection details"
        >
          <div className="listing-studio-approval-grid">
            <div className="listing-studio-approval-field">
              <span>Organization</span>
              <strong>{context.currentOrganization.name}</strong>
            </div>
            <div className="listing-studio-approval-field">
              <span>Office</span>
              <strong>{context.currentOffice?.name ?? "Company-wide scope"}</strong>
            </div>
            <div className="listing-studio-approval-field">
              <span>User</span>
              <strong>
                {`${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
                  context.currentUser.email}
              </strong>
            </div>
          </div>
          <ListingStudioExtensionApprovalClient challengeToken={challengeToken} />
        </SectionCard>
      </div>
    </div>
  );
}
