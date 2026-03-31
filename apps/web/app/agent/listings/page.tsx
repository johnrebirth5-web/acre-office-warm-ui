import { listListings } from "@acre/backoffice";
import { Badge, EmptyState, ListPageStatsGrid, SectionCard, StatCard, SummaryChip } from "@acre/ui";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";

export default function AgentListingsPage() {
  const listingFeed = listListings("agent");
  const trackedClicks = listingFeed.reduce((total, listing) => total + listing.trackedClicks, 0);
  const publicListings = listingFeed.filter((listing) => listing.isPublic).length;

  return (
    <FrontOfficePageTemplate
      description="Listings in Front Office are about recommendation, outreach, and content output, not back-office inventory administration."
      eyebrow="Listings"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Use this list as the send-ready inventory surface for active client outreach."
          title="Send-ready inventory"
        >
          <div className="list-column front-office-record-list">
            {listingFeed.length ? (
              listingFeed.map((listing) => (
                <article className="list-row front-office-record" key={listing.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{listing.name}</strong>
                      <p>{listing.area}</p>
                    </div>
                    <Badge tone="success">{listing.status}</Badge>
                  </div>
                  <p>{listing.hook}</p>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{listing.price}</span>
                    <span>{listing.city}</span>
                    <span>{listing.trackedClicks} tracked click(s)</span>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                description="Listings will appear here once send-ready inventory is available in the Front Office feed."
                title="No listing inventory in scope"
              />
            )}
          </div>
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Quick read on the current listing output surface."
            title="Output signals"
          >
            <ListPageStatsGrid>
              <StatCard hint="inventory visible to agents" label="Listings" value={listingFeed.length} />
              <StatCard hint="currently marked public-ready" label="Public-ready" value={publicListings} />
              <StatCard hint="sum of tracked clicks in feed" label="Tracked clicks" value={trackedClicks} />
              <StatCard hint="current view target" label="Surface" tone="accent" value="Send-ready" />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This route should feel like an output terminal, not an admin inventory console."
            title="Output modes"
          >
            <div className="office-note-list">
              <article className="office-note-item">
                <span>Links</span>
                <div className="front-office-note-copy">
                  <strong>Tracked share link</strong>
                  <p>Use listing-level links to connect outreach back to click behavior without leaving Front Office.</p>
                </div>
              </article>
              <article className="office-note-item">
                <span>Media</span>
                <div className="front-office-note-copy">
                  <strong>Poster export</strong>
                  <p>Generate presentation-ready listing output with agent identity and compliant property framing.</p>
                </div>
              </article>
              <article className="office-note-item">
                <span>Notes</span>
                <div className="front-office-note-copy">
                  <strong>Custom notes</strong>
                  <p>Add client-specific framing or local insight without turning this route into a full listing-admin workflow.</p>
                </div>
              </article>
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Listings" value={listingFeed.length} />
          <SummaryChip label="Public-ready" value={publicListings} />
          <SummaryChip label="Tracked clicks" tone="accent" value={trackedClicks} />
          <SummaryChip label="Surface" value="Outreach" />
        </>
      }
      title="Listing output"
    />
  );
}
