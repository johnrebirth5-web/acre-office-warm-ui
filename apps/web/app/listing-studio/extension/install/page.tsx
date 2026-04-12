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
          <p>
            Add Acre Listing Studio to this browser, then return to Listing
            Studio and Acre will finish the browser connection flow.
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle="Chrome only allows true one-click extension installs through the Chrome Web Store."
          title="Install from Acre"
        >
          <div className="listing-studio-install-layout">
            <div className="listing-studio-install-copy">
              <strong>Install on this browser first</strong>
              <p>
                After the extension is installed, return to your Listing Studio
                tab. Acre will detect the extension and continue the browser
                connection flow automatically.
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
          subtitle="After Chrome opens the store page, follow this flow to finish browser connection."
          title="Current install flow"
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
                needed, and continue the connection flow.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
