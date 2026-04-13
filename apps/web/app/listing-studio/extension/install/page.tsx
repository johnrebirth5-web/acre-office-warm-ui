import Link from "next/link";
import { SectionCard } from "@acre/ui";
import { LISTING_STUDIO_EXTENSION_STORE_URL } from "../../extension-store-url";

export default function ListingStudioExtensionInstallPage() {
  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Install the Chrome extension</h2>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle="Install the extension from the Chrome Web Store, then come back here."
          title="Install extension"
        >
          <div className="listing-studio-install-layout">
            <div className="listing-studio-install-copy">
              <strong>Install on this browser first</strong>
              <p>
                After the extension is installed, return to your Listing Studio
                tab. Acre will detect the extension, continue the browser
                connection flow automatically, and finish approval without
                another manual button click.
              </p>
            </div>
            <div className="listing-studio-install-actions">
              <a
                className="office-button office-button-primary"
                href={LISTING_STUDIO_EXTENSION_STORE_URL}
                rel="noreferrer"
                target="_blank"
              >
                Add to Chrome
              </a>
              <Link
                className="office-button office-button-secondary"
                href="/listing-studio/dashboard"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="After Chrome opens the store page, follow these steps to finish setup."
          title="Setup steps"
        >
          <div className="listing-studio-install-steps">
            <div className="listing-studio-install-step">
              <span>01</span>
              <strong>Add the Acre extension in Chrome</strong>
              <p>
                If this browser already has it, a simple extension reload is
                enough before you come back here.
              </p>
            </div>
            <div className="listing-studio-install-step">
              <span>02</span>
              <strong>Return to the Listing Studio dashboard</strong>
              <p>
                Go back to the same Listing Studio tab after Chrome adds the
                extension.
              </p>
            </div>
            <div className="listing-studio-install-step">
              <span>03</span>
              <strong>Acre finishes the browser connection</strong>
              <p>
                The dashboard will detect the extension, refresh once if
                needed, open the approval page, then return here once the
                browser is linked.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
