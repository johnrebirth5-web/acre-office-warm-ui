import type { CSSProperties, ReactNode } from "react";
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
import { requireSessionContext } from "../../../lib/auth-session";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";
import { FrontOfficeTrainingGallery } from "./front-office-training-gallery";
import {
  FrontOfficeResourceSearchForm,
  type FrontOfficeResourceSearchTab,
} from "./front-office-resource-search-form";

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
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const resourceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
  minHeight: "100%",
  padding: "1.05rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
  boxShadow: "0 12px 24px rgba(18, 53, 104, 0.05)",
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

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  lineHeight: 1.5,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
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

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const documentActionRowStyle: CSSProperties = {
  ...actionRowStyle,
  marginTop: "auto",
  justifyContent: "flex-end",
  paddingTop: "0.25rem",
};

const segmentedTabsShellStyle: CSSProperties = {
  display: "grid",
  width: "100%",
  gap: "0.55rem",
  padding: "0.6rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  borderRadius: "24px",
  border: "1px solid rgba(18, 53, 104, 0.1)",
  background: "linear-gradient(180deg, #f7f9fc 0%, #f2f6fb 100%)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
};

const segmentedTabStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  minHeight: "68px",
  padding: "0.95rem 1.25rem",
  borderRadius: "18px",
  color: "#4d6480",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  whiteSpace: "nowrap",
  letterSpacing: "-0.02em",
};

const activeSegmentedTabStyle: CSSProperties = {
  ...segmentedTabStyle,
  color: "#173153",
  background: "#ffffff",
  boxShadow:
    "0 14px 28px rgba(18, 53, 104, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.96)",
};

const vendorActionRowStyle: CSSProperties = {
  ...actionRowStyle,
  marginTop: "auto",
  paddingTop: "0.25rem",
};

const paginationRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  marginTop: "1rem",
};

const pageMetaStyle: CSSProperties = {
  color: "#5a718d",
  fontSize: "0.84rem",
  fontWeight: 600,
};

const paginationButtonsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const resourcesPerPage = 12;

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function getActiveTab(value: string): FrontOfficeResourceSearchTab {
  if (value === "vendors" || value === "training") {
    return value;
  }

  return "documents";
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function buildResourcesUrl(params: {
  tab: FrontOfficeResourceSearchTab;
  q?: string | null;
  page?: number | null;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", params.tab);

  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if ((params.page ?? 1) > 1) {
    searchParams.set("page", String(params.page));
  }

  return `/agent/resources?${searchParams.toString()}`;
}

function parsePageNumber(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}

function buildPageNumbers(pageCount: number, activePage: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, activePage]);

  for (let offset = -1; offset <= 1; offset += 1) {
    const nextPage = activePage + offset;

    if (nextPage > 1 && nextPage < pageCount) {
      pages.add(nextPage);
    }
  }

  return Array.from(pages).sort((left, right) => left - right);
}

function paginateItems<T>(items: T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / resourcesPerPage));
  const currentPage = Math.min(requestedPage, pageCount);
  const startIndex = (currentPage - 1) * resourcesPerPage;

  return {
    currentPage,
    pageCount,
    visibleItems: items.slice(startIndex, startIndex + resourcesPerPage),
  };
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

function renderVendorActions(vendor: VendorRecord) {
  return (
    <>
      {vendor.phoneHref ? (
        <FrontOfficeTrackedLink
          className="office-button-secondary office-button-sm"
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
          className="office-button-secondary office-button-sm"
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
          className="office-button-secondary office-button-sm"
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

function DocumentRecordCard(props: { resource: ResourceRecord }) {
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

      <div style={documentActionRowStyle}>
        <FrontOfficeTrackedLink
          className="office-button-secondary office-button-sm"
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
        <div style={{ display: "grid", gap: "0.5rem", width: "100%" }}>
          <div style={resourceTitleRowStyle}>
            <strong style={resourceTitleWrapStyle}>{vendor.name}</strong>
            <div style={resourceBadgeWrapStyle}>
              <StatusBadge tone={vendor.categoryTone}>
                {vendor.categoryLabel}
              </StatusBadge>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {vendor.isFeatured ? (
              <StatusBadge tone="accent">Featured go-to</StatusBadge>
            ) : null}
          </div>
          <p style={helperTextStyle}>{vendor.headline}</p>
        </div>
      </div>

      <div style={metaRowStyle}>
        <span>{vendor.coverageLabel}</span>
        <span>{vendor.contactLabel}</span>
      </div>

      <div style={vendorActionRowStyle}>{renderVendorActions(vendor)}</div>
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
  const activeTab = getActiveTab(getSearchParamValue(resolvedSearchParams.tab));
  const searchQuery = getSearchParamValue(resolvedSearchParams.q);
  const requestedPage = parsePageNumber(
    getSearchParamValue(resolvedSearchParams.page),
  );
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);

  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  const documentResources = snapshot.resources.filter(
    (resource) =>
      resource.typeKey !== "vendor_card" &&
      resource.typeKey !== "training_video",
  );
  const trainingResources = snapshot.resources.filter(
    (resource) => resource.typeKey === "training_video",
  );
  const vendors = snapshot.vendors;

  const filteredDocuments = documentResources.filter((resource) =>
    resourceMatchesSearch(resource, normalizedSearchQuery),
  );
  const filteredTraining = trainingResources.filter((resource) =>
    resourceMatchesSearch(resource, normalizedSearchQuery),
  );
  const filteredVendors = vendors.filter((vendor) =>
    vendorMatchesSearch(vendor, normalizedSearchQuery),
  );
  const paginatedDocuments = paginateItems(filteredDocuments, requestedPage);
  const paginatedVendors = paginateItems(filteredVendors, requestedPage);
  const paginatedTraining = paginateItems(filteredTraining, requestedPage);

  const tabStats = {
    documents: documentResources.length,
    vendors: vendors.length,
    training: trainingResources.length,
  };
  const tabDefinitions: Array<{
    key: FrontOfficeResourceSearchTab;
    label: string;
  }> = [
    { key: "documents", label: "Documents" },
    { key: "vendors", label: "Vendors" },
    { key: "training", label: "Video Academy" },
  ];
  const tabSubtitle: Record<FrontOfficeResourceSearchTab, string> = {
    documents:
      "Published PDFs, playbooks, templates, and other office-approved documents for agents.",
    vendors:
      "Partner contacts live here as a simple searchable pool. Search by category, coverage, or contact detail.",
    training:
      "YouTube-based refreshers stay in their own tab so video learning never gets mixed into the document list.",
  };

  let resultTitle = "Documents";
  let resultDescription = tabSubtitle.documents;
  let resultStats: ReactNode = (
    <ListPageStatsGrid>
      <StatCard
        hint="published office documents"
        label="Documents"
        tone="accent"
        value={filteredDocuments.length}
      />
      <StatCard
        hint="available in this directory"
        label="All documents"
        value={documentResources.length}
      />
    </ListPageStatsGrid>
  );
  let resultContent: ReactNode = filteredDocuments.length ? (
    <div style={cardGridStyle}>
      {paginatedDocuments.visibleItems.map((resource) => (
        <DocumentRecordCard key={resource.id} resource={resource} />
      ))}
    </div>
  ) : (
    <EmptyState
      action={
        normalizedSearchQuery ? (
          <a
            className="office-button-secondary"
            href={buildResourcesUrl({ tab: activeTab })}
          >
            Clear search
          </a>
        ) : undefined
      }
      description={
        documentResources.length
          ? "Try a different keyword. Search only checks the documents in this tab."
          : "This office has not published any documents yet."
      }
      title={
        documentResources.length ? "No documents found" : "No documents yet"
      }
    />
  );

  if (activeTab === "vendors") {
    resultTitle = "Vendor pool";
    resultDescription = tabSubtitle.vendors;
    resultStats = (
      <ListPageStatsGrid>
        <StatCard
          hint="searchable partner contacts"
          label="Vendors"
          tone="accent"
          value={filteredVendors.length}
        />
        <StatCard
          hint="flagged as go-to contacts"
          label="Featured"
          value={vendors.filter((vendor) => vendor.isFeatured).length}
        />
      </ListPageStatsGrid>
    );
    resultContent = filteredVendors.length ? (
      <div style={cardGridStyle}>
        {paginatedVendors.visibleItems.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>
    ) : (
      <EmptyState
        action={
          normalizedSearchQuery ? (
            <a
              className="office-button-secondary"
              href={buildResourcesUrl({ tab: activeTab })}
            >
              Clear search
            </a>
          ) : undefined
        }
        description={
          vendors.length
            ? "Try a broader vendor keyword or browse again later."
            : "This office has not published any vendor contacts yet."
        }
        title={vendors.length ? "No vendors found" : "No vendors yet"}
      />
    );
  } else if (activeTab === "training") {
    resultTitle = "Video academy";
    resultDescription = tabSubtitle.training;
    resultStats = (
      <ListPageStatsGrid>
        <StatCard
          hint="matching YouTube training videos"
          label="Videos"
          tone="accent"
          value={filteredTraining.length}
        />
        <StatCard
          hint="available in this tab"
          label="All training"
          value={trainingResources.length}
        />
      </ListPageStatsGrid>
    );
    resultContent = filteredTraining.length ? (
      <FrontOfficeTrainingGallery resources={paginatedTraining.visibleItems} />
    ) : (
      <EmptyState
        action={
          normalizedSearchQuery ? (
            <a
              className="office-button-secondary"
              href={buildResourcesUrl({ tab: activeTab })}
            >
              Clear search
            </a>
          ) : undefined
        }
        description={
          trainingResources.length
            ? "Try another topic, process, or script keyword. Search only checks YouTube videos in this tab."
            : "This office has not published any YouTube training videos yet."
        }
        title={trainingResources.length ? "No videos found" : "No training yet"}
      />
    );
  }

  const activePagination =
    activeTab === "vendors"
      ? paginatedVendors
      : activeTab === "training"
        ? paginatedTraining
        : paginatedDocuments;
  const paginationLinks = buildPageNumbers(
    activePagination.pageCount,
    activePagination.currentPage,
  );
  const resultCountLabel =
    activeTab === "vendors"
      ? filteredVendors.length === 1
        ? "vendor"
        : "vendors"
      : activeTab === "training"
        ? filteredTraining.length === 1
          ? "video"
          : "videos"
        : filteredDocuments.length === 1
          ? "document"
          : "documents";

  return (
    <FrontOfficePageTemplate
      description="One searchable directory for documents, vendors, and YouTube training. Use the tabs below the search bar to stay inside the section you need."
      eyebrow="Resources"
      main={
        <div style={stackStyle}>
          <SectionCard className="office-list-card">
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <div style={segmentedTabsShellStyle}>
                {tabDefinitions.map((tab) => (
                  <a
                    aria-current={activeTab === tab.key ? "page" : undefined}
                    href={buildResourcesUrl({ tab: tab.key })}
                    key={tab.key}
                    style={
                      activeTab === tab.key
                        ? activeSegmentedTabStyle
                        : segmentedTabStyle
                    }
                  >
                    {tab.label} ({tabStats[tab.key]})
                  </a>
                ))}
              </div>

              <p className="office-form-helper" style={{ margin: 0 }}>
                {tabSubtitle[activeTab]}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Search vendors, videos, and documents from one place. Results stay inside the tab you're viewing."
            title="Resources & Training"
          >
            <FrontOfficeResourceSearchForm
              initialQuery={searchQuery}
              placeholder="Search vendors, videos, documents..."
              tab={activeTab}
            />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={resultDescription}
            title={resultTitle}
          >
            {resultStats}

            <div style={{ marginTop: "1rem" }}>
              {resultContent}

              {activePagination.pageCount > 1 ? (
                <div style={paginationRowStyle}>
                  <span style={pageMetaStyle}>
                    Page {activePagination.currentPage} of{" "}
                    {activePagination.pageCount} ·{" "}
                    {activeTab === "vendors"
                      ? filteredVendors.length
                      : activeTab === "training"
                        ? filteredTraining.length
                        : filteredDocuments.length}{" "}
                    {resultCountLabel}
                  </span>
                  <div style={paginationButtonsStyle}>
                    <a
                      aria-disabled={activePagination.currentPage === 1}
                      className="office-button-secondary office-button-sm"
                      href={
                        activePagination.currentPage === 1
                          ? undefined
                          : buildResourcesUrl({
                              tab: activeTab,
                              q: searchQuery,
                              page: activePagination.currentPage - 1,
                            })
                      }
                      style={
                        activePagination.currentPage === 1
                          ? {
                              pointerEvents: "none",
                              opacity: 0.45,
                            }
                          : undefined
                      }
                    >
                      Previous
                    </a>
                    {paginationLinks.map((pageNumber, index) => {
                      const previousPage = paginationLinks[index - 1];
                      const showGap =
                        previousPage && pageNumber - previousPage > 1;

                      return (
                        <span
                          key={pageNumber}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          {showGap ? (
                            <span
                              style={{
                                color: "#7a8ea6",
                                fontSize: "0.86rem",
                                fontWeight: 700,
                              }}
                            >
                              ...
                            </span>
                          ) : null}
                          <a
                            aria-current={
                              pageNumber === activePagination.currentPage
                                ? "page"
                                : undefined
                            }
                            className={
                              pageNumber === activePagination.currentPage
                                ? "office-button office-button-sm"
                                : "office-button-secondary office-button-sm"
                            }
                            href={buildResourcesUrl({
                              tab: activeTab,
                              q: searchQuery,
                              page: pageNumber,
                            })}
                          >
                            {pageNumber}
                          </a>
                        </span>
                      );
                    })}
                    <a
                      aria-disabled={
                        activePagination.currentPage ===
                        activePagination.pageCount
                      }
                      className="office-button-secondary office-button-sm"
                      href={
                        activePagination.currentPage ===
                        activePagination.pageCount
                          ? undefined
                          : buildResourcesUrl({
                              tab: activeTab,
                              q: searchQuery,
                              page: activePagination.currentPage + 1,
                            })
                      }
                      style={
                        activePagination.currentPage ===
                        activePagination.pageCount
                          ? {
                              pointerEvents: "none",
                              opacity: 0.45,
                            }
                          : undefined
                      }
                    >
                      Next
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      }
      summary={
        <>
          <SummaryChip label="Documents" value={tabStats.documents} />
          <SummaryChip label="Training" value={tabStats.training} />
          <SummaryChip label="Vendors" value={tabStats.vendors} />
        </>
      }
      title="Resources & Training"
    />
  );
}
