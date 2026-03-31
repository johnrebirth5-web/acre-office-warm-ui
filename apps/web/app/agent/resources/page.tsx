import { listResources, listVendors } from "@acre/backoffice";
import { EmptyState, SectionCard, SummaryChip } from "@acre/ui";
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
          <div className="office-note-list">
            {resourceFeed.length ? (
              resourceFeed.map((resource) => (
                <article className="office-note-item" key={resource.id}>
                  <span>{resource.type}</span>
                  <div className="front-office-note-copy">
                    <strong>{resource.title}</strong>
                    <p>{resource.summary}</p>
                    <p>{resource.tags.join(" · ")}</p>
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
          <div className="office-note-list">
            {vendorFeed.length ? (
              vendorFeed.map((vendor) => (
                <article className="office-note-item" key={vendor.id}>
                  <span>{vendor.category}</span>
                  <div className="front-office-note-copy">
                    <strong>{vendor.name}</strong>
                    <p>{vendor.headline}</p>
                    <p>{vendor.neighborhoods.join(" · ")}</p>
                  </div>
                </article>
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
