import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import { EmptyState, SectionCard, SummaryChip, StatusBadge } from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";

export default async function AgentResourcesPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "resources:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone
  });

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
            {snapshot.resources.length ? (
              snapshot.resources.map((resource) => (
                <article className="list-row front-office-record" key={resource.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{resource.title}</strong>
                      <p>{resource.summary}</p>
                    </div>
                    <StatusBadge tone="neutral">{resource.typeLabel}</StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    {resource.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <FrontOfficeLink className="office-inline-link front-office-inline-link" href={resource.href}>
                    Open resource
                  </FrontOfficeLink>
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
            {snapshot.vendors.length ? (
              snapshot.vendors.map((vendor) => (
                <FrontOfficeRailItem
                  action={
                    vendor.href ? (
                      <FrontOfficeLink className="office-inline-link front-office-inline-link" href={vendor.href}>
                        Contact vendor
                      </FrontOfficeLink>
                    ) : null
                  }
                  badgeLabel={vendor.category}
                  badgeTone="neutral"
                  description={vendor.headline}
                  key={vendor.id}
                  meta={
                    <>
                      <span>{vendor.neighborhoodsLabel}</span>
                      <span>{vendor.contactLabel}</span>
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
          <SummaryChip label="Resources" value={snapshot.summary.resourceCount} />
          <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
          <SummaryChip label="Types" tone="accent" value={snapshot.summary.resourceTypeCount} />
        </>
      }
      title="Resource hub"
    />
  );
}
