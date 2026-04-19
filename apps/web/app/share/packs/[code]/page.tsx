import { getStudioListingPublicPack } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../lib/public-token-rate-limit";

type ListingStudioPublicSharePageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingStudioPublicSharePage(
  props: ListingStudioPublicSharePageProps,
) {
  const { code } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const viewerFingerprint =
    typeof searchParams.viewer === "string" ? searchParams.viewer : null;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/listing-studio/packs/read",
    request: headerStore,
    token: code,
    options: PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getStudioListingPublicPack({
    shareCode: code,
    viewerFingerprint,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip"),
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="listing-studio-share-shell">
      <div className="listing-studio-share-page">
        <section className="listing-studio-share-hero">
          <div className="listing-studio-share-copy">
            <span className="office-eyebrow">Acre listing</span>
            <h1>{snapshot.headline}</h1>
            <p>{snapshot.summary}</p>
            <div className="listing-studio-share-price">{snapshot.priceLabel}</div>
            <div className="listing-studio-share-address">
              <strong>{snapshot.addressLine}</strong>
              {snapshot.locationLine ? <span>{snapshot.locationLine}</span> : null}
            </div>
          </div>
          {snapshot.selectedAssets[0] ? (
            <div className="listing-studio-share-hero-media">
              <img
                alt={snapshot.title}
                src={`/api/listing-studio/assets/${snapshot.selectedAssets[0].id}?shareCode=${snapshot.code}`}
              />
            </div>
          ) : null}
        </section>

        <section className="listing-studio-share-facts">
          {snapshot.facts.map((fact) => (
            <div className="listing-studio-fact-card" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </section>

        {snapshot.selectedAssets.length > 1 ? (
          <section className="listing-studio-share-gallery">
            {snapshot.selectedAssets.slice(1).map((asset) => (
              <div className="listing-studio-share-gallery-item" key={asset.id}>
                <img
                  alt={asset.label ?? snapshot.title}
                  src={`/api/listing-studio/assets/${asset.id}?shareCode=${snapshot.code}`}
                />
              </div>
            ))}
          </section>
        ) : null}

        <section className="listing-studio-share-sections">
          <div className="listing-studio-share-section">
            <h2>Listing overview</h2>
            {snapshot.descriptionText ? <p>{snapshot.descriptionText}</p> : null}
            {snapshot.agentNote ? (
              <blockquote>{snapshot.agentNote}</blockquote>
            ) : null}
          </div>

          {snapshot.sourceFacts.length ? (
            <div className="listing-studio-share-section">
              <h2>Source facts</h2>
              <div className="listing-studio-keyvalue-grid">
                {snapshot.sourceFacts.map((item) => (
                  <div className="listing-studio-keyvalue-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.amenities.length ? (
            <div className="listing-studio-share-section">
              <h2>Amenities</h2>
              {snapshot.amenities.map((section) => (
                <div className="listing-studio-pill-group" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-pill-row">
                    {section.items.map((item) => (
                      <span className="listing-studio-pill" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.transit.length ? (
            <div className="listing-studio-share-section">
              <h2>Transit</h2>
              <div className="listing-studio-transit-list">
                {snapshot.transit.map((item) => (
                  <div
                    className="listing-studio-transit-item"
                    key={`${item.label}-${item.distanceLabel ?? ""}`}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.detail ?? "Transit details captured"}</span>
                    {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.propertyHistory.length ? (
            <div className="listing-studio-share-section">
              <h2>History</h2>
              <div className="listing-studio-detail-section-list">
                {snapshot.propertyHistory.map((section) => (
                  <div className="listing-studio-detail-section-block" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="listing-studio-detail-section-items">
                      {section.items.map((item) => (
                        <span key={`${section.title}-${item}`}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.capturedSections.length ? (
            <div className="listing-studio-share-section">
              <h2>Additional details</h2>
              <div className="listing-studio-detail-section-list">
                {snapshot.capturedSections.map((section) => (
                  <div className="listing-studio-detail-section-block" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="listing-studio-detail-section-items">
                      {section.items.map((item) => (
                        <span key={`${section.title}-${item}`}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <footer className="listing-studio-share-footer">
          <div>
            <strong>{snapshot.contact.name}</strong>
            <span>{snapshot.contact.title}</span>
            {snapshot.contact.phone ? <span>{snapshot.contact.phone}</span> : null}
            {snapshot.contact.email ? <span>{snapshot.contact.email}</span> : null}
          </div>
          <div className="listing-studio-share-footer-meta">
            <span>Source: {snapshot.sourceSite}</span>
            <a href={snapshot.sourceUrl} rel="noreferrer" target="_blank">
              View original listing
            </a>
            <span>Captured {snapshot.capturedAtLabel}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
