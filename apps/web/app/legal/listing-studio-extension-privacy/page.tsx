export const metadata = {
  title: "Acre Listing Studio Extension Privacy",
  description:
    "Privacy notice for the Acre Listing Studio Chrome extension.",
};

const sections = [
  {
    title: "What the extension does",
    body: [
      "Acre Listing Studio helps licensed real estate professionals save supported StreetEasy and Zillow listing pages into Acre Listing Studio.",
      "The extension captures listing facts, media, and page data only when the user actively connects the extension and saves a listing.",
    ],
  },
  {
    title: "Data the extension stores",
    body: [
      "The extension stores a connection token issued by Acre so the browser can send saved listings into the user's Acre workspace.",
      "The extension may temporarily store connection status, the active Acre base URL, and the most recent save result inside Chrome local extension storage.",
    ],
  },
  {
    title: "Data the extension sends to Acre",
    body: [
      "When a user saves a supported listing, the extension sends the listing URL, captured HTML, parsed listing facts, image URLs, and related source sections needed to create a Listing Studio packet.",
      "This data is sent only to the Acre workspace selected during the connection flow.",
    ],
  },
  {
    title: "What the extension does not do",
    body: [
      "The extension does not sell personal data.",
      "The extension does not use captured listing data for advertising.",
      "The extension does not read unrelated websites for background tracking.",
    ],
  },
  {
    title: "Third-party websites",
    body: [
      "The extension runs on supported listing detail pages such as StreetEasy and Zillow so it can detect and save listing information.",
      "Those websites remain subject to their own terms, privacy practices, and availability.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For questions about the Acre Listing Studio extension or this privacy notice, contact Acre at support@acresystem.us.",
    ],
  },
];

export default function ListingStudioExtensionPrivacyPage() {
  return (
    <main className="listing-studio-legal-shell">
      <div className="listing-studio-legal-page">
        <section className="listing-studio-legal-hero">
          <span className="listing-studio-legal-kicker">Acre Listing Studio</span>
          <h1>Chrome extension privacy notice</h1>
          <p>
            This notice explains what the Acre Listing Studio Chrome extension
            stores, what it sends to Acre, and how it is used.
          </p>
          <div className="listing-studio-legal-meta">
            <span>Last updated</span>
            <strong>April 7, 2026</strong>
          </div>
        </section>

        <section className="listing-studio-legal-card">
          <div className="listing-studio-legal-summary">
            <strong>Plain English summary</strong>
            <p>
              The extension only works for supported listing pages and only
              sends data into Acre when the user chooses to connect the
              extension and save a listing.
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
