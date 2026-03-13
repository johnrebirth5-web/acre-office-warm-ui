import { listListings } from "@acre/backoffice";
import { Badge, ListPageSplit, PageHeader, PageHeaderSummary, PageShell, SectionCard, SummaryChip } from "@acre/ui";

export default function AgentListingsPage() {
  const listingFeed = listListings("agent");

  return (
    <PageShell className="office-agent-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Active feed" value={listingFeed.length} />
            <SummaryChip label="Responsive target" value="Mobile + desktop" />
          </PageHeaderSummary>
        }
        description="Listing search, poster generation, tracked share links, and custom notes in one operating surface."
        eyebrow="Listings"
        title="Agent marketing layer"
      />

      <ListPageSplit className="office-agent-workspace">
        <SectionCard title="Suggested inventory" subtitle="Seeded from the structured listing model defined in the PRD.">
          <div className="list-column">
            {listingFeed.map((listing) => (
              <article className="list-row" key={listing.id}>
                <div className="list-row-top">
                  <strong>{listing.name}</strong>
                  <Badge tone="success">{listing.status}</Badge>
                </div>
                <p>{listing.area}</p>
                <p>{listing.hook}</p>
                <div className="list-row-meta">
                  <span>{listing.price}</span>
                  <span>Tracked link ready</span>
                  <span>{listing.trackedClicks} clicks</span>
                </div>
              </article>
              ))}
            </div>
        </SectionCard>

        <SectionCard title="Output modes" subtitle="The listings module is more than inventory; it is a marketing terminal.">
          <div className="action-grid">
            <article className="action-card">
              <strong>Tracked WeChat link</strong>
              <p>Agent-specific share link with click tracking and later gated lead capture.</p>
            </article>
            <article className="action-card">
              <strong>Poster export</strong>
              <p>Auto-inserts agent identity, compliance fields, and listing highlights.</p>
            </article>
            <article className="action-card">
              <strong>Custom notes</strong>
              <p>Agent can append local insight or investment framing per target client.</p>
            </article>
          </div>
        </SectionCard>
      </ListPageSplit>
    </PageShell>
  );
}
