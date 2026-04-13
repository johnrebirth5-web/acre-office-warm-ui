import { getFrontOfficeListingSharePageSnapshot } from "@acre/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PublicListingSharePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function PublicListingSharePage(
  props: PublicListingSharePageProps,
) {
  const { code } = await props.params;
  const snapshot = await getFrontOfficeListingSharePageSnapshot(code);

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="listing-share-shell">
      <section className="listing-share-card">
        <div className="listing-share-head">
          <span className="listing-share-eyebrow">
            {snapshot.shareSurfaceLabel}
          </span>
          <span className="listing-share-status">{snapshot.statusLabel}</span>
        </div>

        <div className="listing-share-copy">
          <h1>{snapshot.listingTitle}</h1>
          <p>{snapshot.summaryLabel}</p>
          <p>{snapshot.shareContextLabel}</p>
        </div>

        <div className="listing-share-metrics">
          <article>
            <span>Area</span>
            <strong>{snapshot.areaLabel}</strong>
          </article>
          <article>
            <span>Price</span>
            <strong>{snapshot.priceLabel}</strong>
          </article>
          <article>
            <span>Layout</span>
            <strong>{snapshot.factsLabel}</strong>
          </article>
          <article>
            <span>Shared by</span>
            <strong>{snapshot.agentLabel}</strong>
          </article>
          <article>
            <span>Channel</span>
            <strong>{snapshot.channelLabel}</strong>
          </article>
          <article>
            <span>Availability</span>
            <strong>{snapshot.statusLabel}</strong>
          </article>
        </div>

        <div className="listing-share-actions">
          {snapshot.agentPhone ? (
            <a className="office-button" href={`tel:${snapshot.agentPhone}`}>
              Call agent
            </a>
          ) : null}
          {snapshot.agentEmail ? (
            <a
              className="office-button-secondary"
              href={`mailto:${snapshot.agentEmail}`}
            >
              Email agent
            </a>
          ) : null}
          {snapshot.sourceUrl ? (
            <a
              className="office-button-secondary"
              href={snapshot.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open source listing
            </a>
          ) : null}
        </div>

        <div className="listing-share-footer">
          <strong>{snapshot.organizationLabel}</strong>
          <p>{snapshot.followUpLabel}</p>
          <p>{snapshot.privacyLabel}</p>
          <p>Use the contact buttons above if you want to talk through the listing.</p>
        </div>
      </section>
    </main>
  );
}
