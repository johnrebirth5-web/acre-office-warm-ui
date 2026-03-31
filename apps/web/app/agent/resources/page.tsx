import { listResources, listVendors } from "@acre/backoffice";
import { EmptyState, SectionCard, SummaryChip, StatusBadge } from "@acre/ui";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";

export default function AgentResourcesPage() {
  const resourceFeed = listResources();
  const vendorFeed = listVendors();
  const resourceTypeCount = new Set(resourceFeed.map((resource) => resource.type)).size;

  return (
    <FrontOfficePageTemplate
      description="Training, templates, documents, and vendor lookup should stay one click away from the Front Office workflow."
      eyebrow="Resources"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Published operating materials live here so agents can pull context without leaving the FO shell."
          title="Published resources"
        >
          <div className="list-column front-office-record-list">
            {resourceFeed.length ? (
              resourceFeed.map((resource) => (
                <article className="list-row front-office-record" key={resource.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{resource.title}</strong>
                      <p>{resource.summary}</p>
                    </div>
                    <StatusBadge tone="neutral">{resource.type}</StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    {resource.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                description="Shared documents and templates will appear here once the Front Office library is populated."
                title="No published resources"
              />
            )}
          </div>
        </SectionCard>
      }
      rail={
        <SectionCard
          className="office-list-card"
          subtitle="Vendor lookup should feel like part of the same workspace, not a second app."
          title="Vendor shortcuts"
        >
          <div className="office-queue-list">
            {vendorFeed.length ? (
              vendorFeed.map((vendor) => (
                <FrontOfficeRailItem
                  badgeLabel={vendor.category}
                  badgeTone="neutral"
                  description={vendor.headline}
                  key={vendor.id}
                  meta={
                    <>
                      <span>{vendor.neighborhoods.join(" · ")}</span>
                    </>
                  }
                  title={vendor.name}
                />
              ))
            ) : (
              <EmptyState
                className="front-office-inline-empty"
                description="Vendor cards will appear here once the shared vendor layer is populated."
                title="No vendor shortcuts"
              />
            )}
          </div>
        </SectionCard>
      }
      summary={
        <>
          <SummaryChip label="Resources" value={resourceFeed.length} />
          <SummaryChip label="Vendors" value={vendorFeed.length} />
          <SummaryChip label="Types" tone="accent" value={resourceTypeCount} />
        </>
      }
      title="Resource hub"
    />
  );
}
