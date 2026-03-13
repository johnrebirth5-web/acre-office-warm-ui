import { listResources, listVendors } from "@acre/backoffice";
import { ListPageSplit, PageHeader, PageHeaderSummary, PageShell, SectionCard, SummaryChip } from "@acre/ui";

export default function AgentResourcesPage() {
  const resourceFeed = listResources();
  const vendorFeed = listVendors();

  return (
    <PageShell className="office-agent-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Resources" value={resourceFeed.length} />
            <SummaryChip label="Vendors" value={vendorFeed.length} />
          </PageHeaderSummary>
        }
        description="Searchable retrieval across training, vendors, documents, templates, and internal operating knowledge."
        eyebrow="Resource hub"
        title="Training, vendors, docs, and searchable Acre knowledge."
      />

      <ListPageSplit className="office-agent-workspace">
        <SectionCard title="Resource families" subtitle="The PRD is explicit about the structure.">
          <div className="list-column">
            {resourceFeed.map((resource) => (
              <article className="list-row" key={resource.id}>
                <div className="list-row-top">
                  <strong>{resource.title}</strong>
                  <span className="office-status-badge office-status-badge-neutral">{resource.type}</span>
                </div>
                <p>{resource.summary}</p>
                <div className="list-row-meta">
                  {resource.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Vendor directory" subtitle="The same resource layer feeds agent lookup and later public utility surfaces.">
          <div className="list-column">
            {vendorFeed.map((vendor) => (
              <article className="list-row" key={vendor.id}>
                <div className="list-row-top">
                  <strong>{vendor.name}</strong>
                  <span className="office-status-badge office-status-badge-success">{vendor.category}</span>
                </div>
                <p>{vendor.headline}</p>
                <div className="list-row-meta">
                  {vendor.neighborhoods.map((neighborhood) => (
                    <span key={neighborhood}>{neighborhood}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </ListPageSplit>
    </PageShell>
  );
}
