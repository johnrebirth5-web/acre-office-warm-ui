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
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";
import { requireSessionContext } from "../../../lib/auth-session";
import { FrontOfficeResourceSearchForm } from "./front-office-resource-search-form";

type ResourcesSnapshot = Awaited<
  ReturnType<typeof getFrontOfficeResourcesSnapshot>
>;
type ResourceRecord = ResourcesSnapshot["resources"][number];
type VendorRecord = ResourcesSnapshot["vendors"][number];

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const resourceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const resourceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
};

const resourceTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
};

const resourceTitleWrapStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};

const resourceBadgeWrapStyle: CSSProperties = {
  flexShrink: 0,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.83rem",
  lineHeight: 1.4,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const tagStyle: CSSProperties = {
  padding: "0.18rem 0.56rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.07)",
  color: "#58708a",
  fontSize: "0.78rem",
  fontWeight: 600,
  lineHeight: 1.3,
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "1rem",
};

const filterPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.45rem 0.78rem",
  borderRadius: "999px",
  border: "1px solid rgba(18, 53, 104, 0.12)",
  background: "#ffffff",
  color: "#39516b",
  fontSize: "0.82rem",
  fontWeight: 600,
  lineHeight: 1,
  textDecoration: "none",
};

const activeFilterPillStyle: CSSProperties = {
  ...filterPillStyle,
  borderColor: "rgba(18, 53, 104, 0.32)",
  background: "rgba(18, 53, 104, 0.08)",
};

const vendorGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  lineHeight: 1.5,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const quickSearchRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "1rem",
};

const groupedDirectoryStyle: CSSProperties = {
  display: "grid",
  gap: "1.15rem",
};

const groupedSectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const groupedSectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

function getSearchParamValue(value: string | string[] | undefined) {
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

function buildResourcesUrl(updates: Record<string, string | null>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(updates)) {
    if (value && value.trim()) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/agent/resources?${query}` : "/agent/resources";
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
    </>
  );
}

function ResourceRecordCard(props: { resource: ResourceRecord }) {
  const { resource } = props;

  return (
    <article style={resourceCardStyle}>
      <div style={resourceHeaderStyle}>
        <div style={{ display: "grid", gap: "0.5rem", width: "100%" }}>
          <div style={resourceTitleRowStyle}>
            <strong style={resourceTitleWrapStyle}>{resource.title}</strong>
            <div style={resourceBadgeWrapStyle}>
              <StatusBadge tone={resource.typeTone}>
                {resource.typeLabel}
              </StatusBadge>
            </div>
          </div>
          <p style={helperTextStyle}>{resource.summary}</p>
        </div>
      </div>

      <div style={metaRowStyle}>
        <span>{resource.detailLabel}</span>
        <span>{resource.freshnessLabel}</span>
      </div>

      {resource.tags.length ? (
        <div style={tagRowStyle}>
          {resource.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={actionRowStyle}>
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
    </article>
  );
}

function VendorCard(props: { vendor: VendorRecord }) {
  const { vendor } = props;

  return (
    <article style={resourceCardStyle}>
      <div style={resourceHeaderStyle}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <strong>{vendor.name}</strong>
            {vendor.isFeatured ? (
              <StatusBadge tone="accent">Featured go-to</StatusBadge>
            ) : null}
          </div>
          <p style={helperTextStyle}>{vendor.headline}</p>
        </div>
        <StatusBadge tone={vendor.categoryTone}>
          {vendor.categoryLabel}
        </StatusBadge>
      </div>

      <div style={metaRowStyle}>
        <span>{vendor.coverageLabel}</span>
        <span>{vendor.contactLabel}</span>
      </div>

      <div style={actionRowStyle}>{renderVendorActions(vendor)}</div>
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
  const selectedType = getSearchParamValue(resolvedSearchParams.type);
  const selectedVendorCategory = getSearchParamValue(
    resolvedSearchParams.vendorCategory,
  );
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);

  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  const resourceTypeOptions = snapshot.resourceTypes
    .filter(
      (type) => type.key !== "vendor_card" && type.key !== "training_video",
    )
    .map((type) => ({
      value: type.key,
      label: type.label,
    }));
  const effectiveType = resourceTypeOptions.some(
    (option) => option.value === selectedType,
  )
    ? selectedType
    : "";
  const baseResources = snapshot.resources.filter(
    (resource) =>
      resource.typeKey !== "vendor_card" &&
      resource.typeKey !== "training_video",
  );
  const filteredResources = baseResources
    .filter((resource) =>
      effectiveType ? resource.typeKey === effectiveType : true,
    )
    .filter((resource) =>
      resourceMatchesSearch(resource, normalizedSearchQuery),
    );
  const filteredVendors = snapshot.vendors
    .filter((vendor) =>
      selectedVendorCategory
        ? vendor.category.toLowerCase() === selectedVendorCategory.toLowerCase()
        : true,
    )
    .filter((vendor) => vendorMatchesSearch(vendor, normalizedSearchQuery));
  const groupedResources = resourceTypeOptions
    .map((option) => ({
      ...option,
      resources: baseResources.filter(
        (resource) => resource.typeKey === option.value,
      ),
    }))
    .filter((group) => group.resources.length > 0);
  const showGroupedResourceBrowse = !normalizedSearchQuery && !effectiveType;
  const searchExamples = [
    "buyer consultation",
    "listing presentation",
    "offer checklist",
    "lender",
  ];

  return (
    <FrontOfficePageTemplate
      description="Search the published office directory for shared materials and vendor contacts. YouTube training lives in the separate Training module."
      eyebrow="Resources"
      main={
        <div style={stackStyle}>
          <SectionCard
            className="office-list-card"
            subtitle="Most agents come here with a file or contact in mind. Search the title, summary, tags, or vendor name first."
            title="Search"
          >
            <FrontOfficeResourceSearchForm
              initialQuery={searchQuery}
              initialType={effectiveType}
              searchContext="resources"
              typeOptions={resourceTypeOptions}
            />

            {normalizedSearchQuery ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                <ListPageStatsGrid>
                  <StatCard
                    hint="matching resources"
                    label="Resource matches"
                    tone="accent"
                    value={filteredResources.length}
                  />
                  <StatCard
                    hint="matching vendors"
                    label="Vendor matches"
                    value={filteredVendors.length}
                  />
                </ListPageStatsGrid>

                <div style={vendorGridStyle}>
                  <div style={stackStyle}>
                    <strong>Matching resources</strong>
                    {filteredResources.length ? (
                      filteredResources.map((resource) => (
                        <ResourceRecordCard
                          key={resource.id}
                          resource={resource}
                        />
                      ))
                    ) : (
                      <EmptyState
                        action={
                          <a
                            className="office-button-secondary"
                            href="/agent/resources"
                          >
                            Clear filters
                          </a>
                        }
                        description="Try a different keyword, remove the type filter, or browse the directory by type below."
                        title="No matching resources"
                      />
                    )}
                  </div>

                  <div style={stackStyle}>
                    <strong>Matching vendors</strong>
                    {filteredVendors.length ? (
                      filteredVendors.map((vendor) => (
                        <VendorCard key={vendor.id} vendor={vendor} />
                      ))
                    ) : (
                      <EmptyState
                        action={
                          <a
                            className="office-button-secondary"
                            href="/agent/resources"
                          >
                            Clear filters
                          </a>
                        }
                        description="Try a broader query or browse the vendor pool below."
                        title="No matching vendors"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{ marginTop: "0.9rem", display: "grid", gap: "0.7rem" }}
              >
                <p className="office-form-helper" style={{ margin: 0 }}>
                  Search is the fastest path. If you do not know the exact file
                  yet, use the type filters below or start with one of these
                  common searches.
                </p>
                <div style={quickSearchRowStyle}>
                  {searchExamples.map((example) => (
                    <a
                      href={buildResourcesUrl({ q: example })}
                      key={example}
                      style={filterPillStyle}
                    >
                      {example}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This is the full published directory of office-approved materials for agents. Browse by type when you do not want to search yet."
            title="Browse directory"
          >
            <div style={filterRowStyle}>
              <a
                href={buildResourcesUrl({
                  q: searchQuery || null,
                  vendorCategory: selectedVendorCategory || null,
                })}
                style={effectiveType ? filterPillStyle : activeFilterPillStyle}
              >
                All resources
              </a>
              {resourceTypeOptions.map((option) => (
                <a
                  href={buildResourcesUrl({
                    q: searchQuery || null,
                    type: option.value,
                    vendorCategory: selectedVendorCategory || null,
                  })}
                  key={option.value}
                  style={
                    effectiveType === option.value
                      ? activeFilterPillStyle
                      : filterPillStyle
                  }
                >
                  {option.label}
                </a>
              ))}
            </div>

            {showGroupedResourceBrowse ? (
              groupedResources.length ? (
                <div style={groupedDirectoryStyle}>
                  {groupedResources.map((group) => (
                    <section key={group.value} style={groupedSectionStyle}>
                      <div style={groupedSectionHeaderStyle}>
                        <div style={{ display: "grid", gap: "0.24rem" }}>
                          <strong>{group.label}</strong>
                          <p
                            className="office-form-helper"
                            style={{ margin: 0 }}
                          >
                            {group.resources.length} published{" "}
                            {group.resources.length === 1 ? "item" : "items"}
                          </p>
                        </div>
                        <StatusBadge tone="neutral">
                          {group.resources.length}
                        </StatusBadge>
                      </div>

                      <div style={cardGridStyle}>
                        {group.resources.map((resource) => (
                          <ResourceRecordCard
                            key={resource.id}
                            resource={resource}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="This office has not published any agent-facing materials yet."
                  title="No resources yet"
                />
              )
            ) : (
              <>
                {filteredResources.length ? (
                  <div style={cardGridStyle}>
                    {filteredResources.map((resource) => (
                      <ResourceRecordCard
                        key={resource.id}
                        resource={resource}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    action={
                      <a
                        className="office-button-secondary"
                        href="/agent/resources"
                      >
                        Clear filters
                      </a>
                    }
                    description="No published resource matches the current search or type filter."
                    title="No resources in this view"
                  />
                )}
              </>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="A simple partner directory. Search or browse by category when an agent needs contact details or coverage."
            title="Vendor pool"
          >
            <div style={filterRowStyle}>
              <a
                href={buildResourcesUrl({
                  q: searchQuery || null,
                  type: effectiveType || null,
                })}
                style={
                  selectedVendorCategory
                    ? filterPillStyle
                    : activeFilterPillStyle
                }
              >
                All vendors
              </a>
              {snapshot.vendorCategories.map((category) => (
                <a
                  href={buildResourcesUrl({
                    q: searchQuery || null,
                    type: effectiveType || null,
                    vendorCategory: category.category,
                  })}
                  key={category.category}
                  style={
                    selectedVendorCategory.toLowerCase() ===
                    category.category.toLowerCase()
                      ? activeFilterPillStyle
                      : filterPillStyle
                  }
                >
                  {category.label}
                </a>
              ))}
            </div>

            {filteredVendors.length ? (
              <div style={vendorGridStyle}>
                {filteredVendors.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  selectedVendorCategory || normalizedSearchQuery ? (
                    <a
                      className="office-button-secondary"
                      href="/agent/resources"
                    >
                      Clear filters
                    </a>
                  ) : undefined
                }
                description={
                  snapshot.summary.vendorCount
                    ? "No vendor matches the current search or category filter."
                    : "This office has not published any vendor contacts yet."
                }
                title={
                  snapshot.summary.vendorCount
                    ? "No vendors in this view"
                    : "No vendors yet"
                }
              />
            )}
          </SectionCard>
        </div>
      }
      summary={
        <>
          <SummaryChip label="Resources" value={baseResources.length} />
          <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
        </>
      }
      title="Resources"
    />
  );
}
