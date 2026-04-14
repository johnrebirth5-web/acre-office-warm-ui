import type { CSSProperties } from "react";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
  StatusBadge,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeResourceProgressActions } from "./front-office-resource-progress-actions";
import { FrontOfficeResourceSearchForm } from "./front-office-resource-search-form";
import { requireSessionContext } from "../../../lib/auth-session";

type ResourcesSnapshot = Awaited<
  ReturnType<typeof getFrontOfficeResourcesSnapshot>
>;
type ResourceLane = ResourcesSnapshot["resourceTypes"][number];
type ResourceRecord = ResourcesSnapshot["resources"][number];
type VendorRecord = ResourcesSnapshot["vendors"][number];
type VendorCategory = ResourcesSnapshot["vendorCategories"][number];

const laneGridStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const laneCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 252, 0.92) 100%)",
  boxShadow: "0 18px 36px rgba(18, 53, 104, 0.06)",
};

const laneHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const lanePreviewStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  color: "#58708a",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const laneActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const libraryLaneStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const libraryLaneStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "rgba(250, 252, 255, 0.92)",
};

const subsectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const subsectionIntroStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#5a7089",
  fontSize: "0.92rem",
  lineHeight: 1.45,
};

const resourceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const resourceCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const resourceMetaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const resourceTagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const resourceTagStyle: CSSProperties = {
  padding: "0.18rem 0.56rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.07)",
  color: "#58708a",
  fontSize: "0.78rem",
  fontWeight: 600,
  lineHeight: 1.3,
};

const resourceHintStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const resourceActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const vendorDeskGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  alignItems: "start",
  marginTop: "1rem",
};

const vendorColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const vendorCategoryGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const vendorCategoryCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  padding: "0.95rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 249, 253, 0.96) 100%)",
};

const categoryMetaStyle: CSSProperties = {
  color: "#5a7089",
  fontSize: "0.84rem",
  lineHeight: 1.4,
};

const compactQueueStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildResourceLaneMap(resources: ResourceRecord[]) {
  const lanes = new Map<ResourceRecord["typeKey"], ResourceRecord[]>();

  for (const resource of resources) {
    const existing = lanes.get(resource.typeKey) ?? [];
    existing.push(resource);
    lanes.set(resource.typeKey, existing);
  }

  return lanes;
}

function getSearchParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function resourceMatchesSearch(resource: ResourceRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    resource.title,
    resource.summary,
    resource.detailLabel,
    resource.laneLabel,
    resource.typeLabel,
    ...resource.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function vendorMatchesSearch(vendor: VendorRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    vendor.name,
    vendor.categoryLabel,
    vendor.headline,
    vendor.coverageLabel,
    vendor.contactLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function renderVendorActions(vendor: VendorRecord) {
  return (
    <>
      {vendor.phoneHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.phoneHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "phone",
          }}
        >
          Call
        </FrontOfficeTrackedLink>
      ) : null}
      {vendor.emailHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.emailHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "email",
          }}
        >
          Email
        </FrontOfficeTrackedLink>
      ) : null}
      {vendor.websiteHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.websiteHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "website",
          }}
        >
          Open site
        </FrontOfficeTrackedLink>
      ) : null}
      {!vendor.phoneHref &&
      !vendor.emailHref &&
      !vendor.websiteHref &&
      vendor.href ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.href}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "primary",
          }}
        >
          {vendor.actionLabel}
        </FrontOfficeTrackedLink>
      ) : null}
    </>
  );
}

function ResourceRecordCard(props: { resource: ResourceRecord }) {
  const { resource } = props;

  return (
    <article style={resourceCardStyle}>
      <div style={resourceCardHeaderStyle}>
        <div>
          <strong>{resource.title}</strong>
          <p style={resourceHintStyle}>{resource.summary}</p>
        </div>
        <StatusBadge tone={resource.typeTone}>{resource.typeLabel}</StatusBadge>
      </div>

      <div style={resourceMetaRowStyle}>
        <span>{resource.laneLabel}</span>
        <span>{resource.freshnessLabel}</span>
      </div>

      {resource.tags.length ? (
        <div style={resourceTagRowStyle}>
          {resource.tags.map((tag) => (
            <span key={tag} style={resourceTagStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={resourceActionRowStyle}>
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={resource.href}
          tracking={{
            type: "resource_open",
            resourceId: resource.id,
          }}
        >
          {resource.actionLabel}
        </FrontOfficeTrackedLink>
      </div>

      {resource.typeKey === "training_video" ? (
        <FrontOfficeResourceProgressActions resourceId={resource.id} />
      ) : null}
    </article>
  );
}

function VendorShortcutCard(props: { vendor: VendorRecord }) {
  const { vendor } = props;

  return (
    <FrontOfficeRailItem
      action={renderVendorActions(vendor)}
      badgeLabel={vendor.categoryLabel}
      badgeTone={vendor.isFeatured ? "accent" : vendor.categoryTone}
      context={vendor.isFeatured ? "Shared go-to" : vendor.quickActionLabel}
      description={vendor.headline}
      meta={
        <>
          <span>{vendor.coverageLabel}</span>
          <span>{vendor.contactLabel}</span>
        </>
      }
      title={vendor.name}
    />
  );
}

function VendorCategoryCard(props: { category: VendorCategory }) {
  const { category } = props;

  return (
    <article style={vendorCategoryCardStyle}>
      <div style={laneHeaderStyle}>
        <StatusBadge tone={category.tone}>{category.label}</StatusBadge>
        <span style={categoryMetaStyle}>
          {pluralize(category.count, "vendor")} published
        </span>
      </div>
      <strong>{category.label} coverage</strong>
      <p style={resourceHintStyle}>{category.description}</p>
    </article>
  );
}

export default async function AgentResourcesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "resources:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const resolvedSearchParams = props.searchParams
    ? await props.searchParams
    : {};
  const searchQuery = getSearchParamValue(resolvedSearchParams.q);
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  const resourceLanes = buildResourceLaneMap(snapshot.resources);
  const searchedResources = normalizedSearchQuery
    ? snapshot.resources.filter((resource) =>
        resourceMatchesSearch(resource, normalizedSearchQuery),
      )
    : [];
  const searchedVendors = normalizedSearchQuery
    ? snapshot.vendors.filter((vendor) =>
        vendorMatchesSearch(vendor, normalizedSearchQuery),
      )
    : [];
  const libraryLanes = snapshot.resourceTypes.filter(
    (lane) => lane.key !== "vendor_card",
  );
  const populatedLibraryLanes = libraryLanes.filter(
    (lane) => (resourceLanes.get(lane.key)?.length ?? 0) > 0,
  );
  const readyNowVendors = snapshot.vendors.filter(
    (vendor) => vendor.quickActionCount > 0,
  );

  return (
    <FrontOfficePageTemplate
      description="Search the right playbook, template, document, or vendor and move straight into the next resource action."
      eyebrow="Resources"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Search the hub first, then jump into the right material or partner without reading every section."
            title="Search"
          >
            <FrontOfficeResourceSearchForm initialQuery={searchQuery} />

            {normalizedSearchQuery ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                <ListPageStatsGrid>
                  <StatCard
                    hint="matching resources"
                    label="Resources"
                    tone="accent"
                    value={searchedResources.length}
                  />
                  <StatCard
                    hint="matching vendors"
                    label="Vendors"
                    value={searchedVendors.length}
                  />
                  <StatCard
                    hint="tracked searches in this window"
                    label="Tracked searches"
                    value={snapshot.interactionTracking.searchCount}
                  />
                </ListPageStatsGrid>

                <div style={vendorDeskGridStyle}>
                  <div style={vendorColumnStyle}>
                    <div style={subsectionHeaderStyle}>
                      <div>
                        <strong>Resources</strong>
                        <p style={subsectionIntroStyle}>
                          Open the matching material first, then keep moving.
                        </p>
                      </div>
                    </div>

                    <div style={compactQueueStyle}>
                      {searchedResources.length ? (
                        searchedResources.slice(0, 6).map((resource) => (
                          <ResourceRecordCard
                            key={resource.id}
                            resource={resource}
                          />
                        ))
                      ) : (
                        <EmptyState
                          className="front-office-inline-empty"
                          description="Try a different section, tag, or vendor phrase."
                          title="No matching resources"
                        />
                      )}
                    </div>
                  </div>

                  <div style={vendorColumnStyle}>
                    <div style={subsectionHeaderStyle}>
                      <div>
                        <strong>Vendors</strong>
                        <p style={subsectionIntroStyle}>
                          Keep the partner hit beside the material hit.
                        </p>
                      </div>
                    </div>

                    <div className="office-queue-list">
                      {searchedVendors.length ? (
                        searchedVendors.slice(0, 6).map((vendor) => (
                          <VendorShortcutCard key={vendor.id} vendor={vendor} />
                        ))
                      ) : (
                        <EmptyState
                          className="front-office-inline-empty"
                          description="Try a category, coverage area, or contact phrase."
                          title="No matching vendors"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p
                className="office-form-helper"
                style={{ margin: "0.9rem 0 0" }}
              >
                Searches are tracked so the hub can reopen the same work later.
              </p>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Start from the job at hand and open the right lane without reading the whole library."
            title="Browse by section"
          >
            {snapshot.resourceTypes.length ? (
              <div style={laneGridStyle}>
                {snapshot.resourceTypes.map((lane) => {
                  const laneResources = resourceLanes.get(lane.key) ?? [];
                  const previewLabels =
                    lane.key === "vendor_card"
                      ? snapshot.vendorCategories
                          .slice(0, 2)
                          .map((category) => category.label)
                      : laneResources
                          .slice(0, 2)
                          .map((resource) => resource.title);

                  return (
                    <article key={lane.key} style={laneCardStyle}>
                      <div style={laneHeaderStyle}>
                        <StatusBadge tone={lane.tone}>{lane.label}</StatusBadge>
                        <span style={categoryMetaStyle}>
                          {pluralize(lane.count, "item")} published
                        </span>
                      </div>

                      <div>
                        <strong>{lane.label}</strong>
                        <p style={subsectionIntroStyle}>{lane.description}</p>
                        <p style={subsectionIntroStyle}>{lane.startLabel}</p>
                      </div>

                      <div style={lanePreviewStyle}>
                        {previewLabels.length ? (
                          previewLabels.map((label) => (
                            <span key={label}>- {label}</span>
                          ))
                        ) : (
                          <span>
                            {lane.key === "vendor_card"
                              ? "Vendor categories will surface here once cards are published."
                              : "This section will list the first practical materials once published."}
                          </span>
                        )}
                      </div>

                      <div style={laneActionRowStyle}>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={
                            lane.key === "vendor_card"
                              ? "#vendor-hub"
                              : `#lane-${lane.key}`
                          }
                        >
                          {lane.actionLabel}
                        </FrontOfficeLink>
                        {lane.key !== "vendor_card" ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href="#published-tool-library"
                          >
                            Open library
                          </FrontOfficeLink>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="front-office-inline-empty"
                description="Shared material will organize itself here by the job it helps finish."
                title="No library sections yet"
              />
            )}
          </SectionCard>

          <SectionCard
            id="published-tool-library"
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href="#vendor-hub"
              >
                Jump to vendor desk
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="Open the right material, finish the next move, and keep the library compact."
            title="Library by section"
          >
            {populatedLibraryLanes.length ? (
              <div style={libraryLaneStackStyle}>
                {populatedLibraryLanes.map((lane) => {
                  const laneResources = resourceLanes.get(lane.key) ?? [];

                  return (
                    <article
                      id={`lane-${lane.key}`}
                      key={lane.key}
                      style={libraryLaneStyle}
                    >
                      <div style={subsectionHeaderStyle}>
                        <div>
                          <strong>{lane.label}</strong>
                          <p style={subsectionIntroStyle}>{lane.description}</p>
                        </div>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href="#vendor-hub"
                        >
                          Keep vendor desk close
                        </FrontOfficeLink>
                      </div>

                      <div style={compactQueueStyle}>
                        {laneResources.map((resource) => (
                          <ResourceRecordCard
                            key={resource.id}
                            resource={resource}
                          />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href="#vendor-hub"
                  >
                    Open vendor desk
                  </FrontOfficeLink>
                }
                description="Shared playbooks, templates, forms, and refreshers will appear here once published."
                title="No published tools yet"
              />
            )}
          </SectionCard>

          <SectionCard
            id="vendor-hub"
            className="office-list-card"
            subtitle="Use the vendor desk when the next step is to contact or compare a partner."
            title="Vendor desk"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="published vendors visible in this scope"
                label="Vendors"
                value={snapshot.summary.vendorCount}
              />
              <StatCard
                hint="vendors ready to contact now"
                label="Ready now"
                tone="accent"
                value={snapshot.summary.quickContactVendorCount}
              />
              <StatCard
                hint="vendors flagged as shared go-to options"
                label="Featured"
                value={snapshot.summary.featuredVendorCount}
              />
            </ListPageStatsGrid>

            <div style={vendorDeskGridStyle}>
              <div style={vendorColumnStyle}>
                <div style={subsectionHeaderStyle}>
                  <div>
                    <strong>Ready-now partners</strong>
                    <p style={subsectionIntroStyle}>
                      Featured and quick-contact vendors stay at the front.
                    </p>
                  </div>
                </div>

                <div className="office-queue-list">
                  {readyNowVendors.length ? (
                    readyNowVendors
                      .slice(0, 8)
                      .map((vendor) => (
                        <VendorShortcutCard key={vendor.id} vendor={vendor} />
                      ))
                  ) : (
                    <EmptyState
                      className="front-office-inline-empty"
                      description="No quick-contact partner is ready yet."
                      title="No quick-contact partners yet"
                    />
                  )}
                </div>
              </div>

              <div style={vendorColumnStyle}>
                <div style={subsectionHeaderStyle}>
                  <div>
                    <strong>Coverage sections</strong>
                    <p style={subsectionIntroStyle}>
                      Coverage stays visible without turning the page into a
                      marketplace.
                    </p>
                  </div>
                </div>

                {snapshot.vendorCategories.length ? (
                  <div style={vendorCategoryGridStyle}>
                    {snapshot.vendorCategories.map((category) => (
                      <VendorCategoryCard
                        category={category}
                        key={category.category}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="Service coverage will appear here once category-backed cards are published."
                    title="No vendor categories yet"
                  />
                )}
              </div>
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Resources"
            value={snapshot.summary.resourceCount}
          />
          <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
          <SummaryChip
            label="Ready-now vendors"
            tone="accent"
            value={snapshot.summary.quickContactVendorCount}
          />
        </>
      }
      title="Resources"
    />
  );
}
