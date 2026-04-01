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
          <span className="listing-share-eyebrow">Private listing share</span>
          <span className="listing-share-status">{snapshot.statusLabel}</span>
        </div>

        <div className="listing-share-copy">
          <h1>{snapshot.listingTitle}</h1>
          <p>{snapshot.summaryLabel}</p>
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
          <p>
            This private page came from an Acre agent share link, so the sender
            can keep the listing conversation aligned without sending you into
            Back Office tools.
          </p>
        </div>
      </section>
    </main>
  );
}
