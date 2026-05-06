import type { CSSProperties, ReactNode } from "react";
import { can } from "@acre/auth";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import { EmptyState, SectionCard, StatusBadge } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
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

const compactStatsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
};

const compactStatPillStyle: CSSProperties = {
  display: "grid",
  gap: "0.08rem",
  minWidth: "132px",
  padding: "0.8rem 0.95rem",
  borderRadius: "16px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "rgba(248, 250, 253, 0.92)",
};

const compactStatValueStyle: CSSProperties = {
  color: "#173153",
  fontSize: "1rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

const compactStatLabelStyle: CSSProperties = {
  color: "#6a7f96",
  fontSize: "0.74rem",
  fontWeight: 700,
  lineHeight: 1.3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
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
  if (pageCount <= 8) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (activePage <= 4) {
    return [1, 2, 3, 4, 5, pageCount];
  }

  if (activePage >= pageCount - 3) {
    return [
      1,
      pageCount - 4,
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ];
  }

  return [
    1,
    activePage - 1,
    activePage,
    activePage + 1,
    activePage + 2,
    pageCount,
  ];
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

function renderCompactStats(
  items: Array<{
    label: string;
    value: string | number;
    tone?: "accent" | "neutral";
  }>,
) {
  return (
    <div style={compactStatsRowStyle}>
      {items.map((item) => (
        <div
          key={item.label}
          style={
            item.tone === "accent"
              ? {
                  ...compactStatPillStyle,
                  background:
                    "linear-gradient(180deg, rgba(236, 243, 252, 0.98) 0%, rgba(230, 238, 249, 0.96) 100%)",
                  border: "1px solid rgba(57, 92, 145, 0.12)",
                }
              : compactStatPillStyle
          }
        >
          <span style={compactStatLabelStyle}>{item.label}</span>
          <span style={compactStatValueStyle}>{item.value}</span>
        </div>
      ))}
    </div>
  );
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
          拨打
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
          发邮件
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
          打开网站
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
          openInNewTab
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
              <StatusBadge tone="accent">常用推荐</StatusBadge>
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
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="resources"
        userLocale={context.currentUser.locale}
      />
    );
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
    { key: "documents", label: "文档" },
    { key: "vendors", label: "供应商" },
    { key: "training", label: "视频学院" },
  ];
  const tabSubtitle: Record<FrontOfficeResourceSearchTab, string> = {
    documents:
      "办公室已发布的 PDF、操作手册、模板，以及其他供经纪人使用的审核文档。",
    vendors:
      "合作伙伴联系人集中在这里，可按类别、服务范围或联系方式搜索。",
    training:
      "YouTube 培训视频独立放在这个标签页里，不会混入文档列表。",
  };

  let resultTitle = "文档";
  let resultDescription = tabSubtitle.documents;
  let resultStats: ReactNode = renderCompactStats([
    {
      label: "当前显示",
      value: paginatedDocuments.visibleItems.length,
      tone: "accent",
    },
    {
      label: "匹配结果",
      value: filteredDocuments.length,
    },
    {
      label: "资料总数",
      value: documentResources.length,
    },
  ]);
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
            清除搜索
          </a>
        ) : undefined
      }
      description={
        documentResources.length
          ? "请换一个关键词。搜索只会检查当前标签页里的文档。"
          : "这个办公室还没有发布任何文档。"
      }
      title={
        documentResources.length ? "没有找到文档" : "还没有文档"
      }
    />
  );

  if (activeTab === "vendors") {
    resultTitle = "供应商库";
    resultDescription = tabSubtitle.vendors;
    resultStats = renderCompactStats([
      {
        label: "当前显示",
        value: paginatedVendors.visibleItems.length,
        tone: "accent",
      },
      {
        label: "匹配结果",
        value: filteredVendors.length,
      },
      {
        label: "重点推荐",
        value: vendors.filter((vendor) => vendor.isFeatured).length,
      },
    ]);
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
              清除搜索
            </a>
          ) : undefined
        }
        description={
          vendors.length
            ? "请换一个更宽泛的供应商关键词，或稍后再浏览。"
            : "这个办公室还没有发布任何供应商联系人。"
        }
        title={vendors.length ? "没有找到供应商" : "还没有供应商"}
      />
    );
  } else if (activeTab === "training") {
    resultTitle = "视频学院";
    resultDescription = tabSubtitle.training;
    resultStats = renderCompactStats([
      {
        label: "当前显示",
        value: paginatedTraining.visibleItems.length,
        tone: "accent",
      },
      {
        label: "匹配结果",
        value: filteredTraining.length,
      },
      {
        label: "全部培训",
        value: trainingResources.length,
      },
    ]);
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
              清除搜索
            </a>
          ) : undefined
        }
        description={
          trainingResources.length
            ? "请换一个主题、流程或话术关键词。搜索只会检查当前标签页里的 YouTube 视频。"
            : "这个办公室还没有发布任何 YouTube 培训视频。"
        }
        title={trainingResources.length ? "没有找到视频" : "还没有培训内容"}
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
        ? "个供应商"
        : "个供应商"
      : activeTab === "training"
        ? filteredTraining.length === 1
          ? "个视频"
          : "个视频"
        : filteredDocuments.length === 1
          ? "份文档"
          : "份文档";

  return (
    <FrontOfficePageTemplate
      description="文档、供应商和 YouTube 培训都集中在一个可搜索目录里。用搜索栏下方的标签页切换到需要的内容区。"
      eyebrow="资源"
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
            subtitle="在同一个入口搜索供应商、视频和文档，结果会保留在当前查看的标签页内。"
            title="资源与培训"
          >
            <FrontOfficeResourceSearchForm
              initialQuery={searchQuery}
              placeholder="搜索供应商、视频、文档..."
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
                    第 {activePagination.currentPage} 页，共{" "}
                    {activePagination.pageCount} 页 ·{" "}
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
                      上一页
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
                      下一页
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      }
      title="资源与培训"
    />
  );
}
