import Link from "next/link";
import { listStudioListingCollectionShares } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";

function formatDateTime(value: string | null, locale: string) {
  const isZh = locale === "zh-CN";

  if (!value) {
    return isZh ? "暂无活动" : "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return isZh ? "最近" : "Recently";
  }

  return date.toLocaleString(isZh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCollectionMeta(
  listingCount: number,
  updatedAt: string,
  locale: string,
) {
  const isZh = locale === "zh-CN";
  const updatedLabel = formatDateTime(updatedAt, locale);

  if (isZh) {
    return `${listingCount} 套房源 · 更新于 ${updatedLabel}`;
  }

  return `${listingCount} listing${listingCount === 1 ? "" : "s"} · Updated ${updatedLabel}`;
}

export default async function ListingStudioSharesPage() {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const snapshot = await listStudioListingCollectionShares({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">
            {isZh ? "房源工作室" : "Listing Studio"}
          </span>
          <h2>{isZh ? "分享记录" : "Shares"}</h2>
          <p>
            {isZh
              ? "查看从房源工作室复制出去的清单链接，以及客户打开公开页面后的访问记录。"
              : "Review collection links you copied out of Studio and the public opens recorded after clients viewed those collection pages."}
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "当前房源工作区内的清单分享活动。"
              : "Collection share activity for your current Studio workspace."
          }
          title={isZh ? "清单分享概览" : "Collection share pulse"}
        >
          <ListPageStatsGrid>
            <StatCard
              hint={
                isZh
                  ? "已有公开链接或分享历史的清单"
                  : "Collections with a live link or recorded share history"
              }
              label={isZh ? "已分享清单" : "Shared collections"}
              value={snapshot.summary.sharedCollections}
            />
            <StatCard
              hint={
                isZh
                  ? "清单分享链接被复制的次数"
                  : "Times a collection share link was copied"
              }
              label={isZh ? "分享次数" : "Shares"}
              value={snapshot.summary.shareCount}
            />
            <StatCard
              hint={isZh ? "公开清单页打开次数" : "Public collection page opens"}
              label={isZh ? "访问次数" : "Views"}
              value={snapshot.summary.viewCount}
            />
            <StatCard
              hint={
                isZh
                  ? "当前仍可访问的清单分享链接"
                  : "Currently enabled collection share links"
              }
              label={isZh ? "有效链接" : "Live links"}
              value={snapshot.summary.activeShareLinks}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <div className="listing-studio-shell">
          <section className="listing-studio-listed-section">
            <div className="listing-studio-listed-section-head">
              <div>
                <span className="listing-studio-shell-eyebrow">
                  {isZh ? "分享历史" : "Share history"}
                </span>
                <h2>{isZh ? "清单分享" : "Collection shares"}</h2>
              </div>
              <p>
                {isZh
                  ? `当前有 ${snapshot.items.length} 个清单产生过分享活动。`
                  : `${snapshot.items.length} collection${
                      snapshot.items.length === 1 ? "" : "s"
                    } currently have share activity.`}
              </p>
            </div>

            {snapshot.items.length ? (
              <div className="office-list-table listing-studio-shares-table">
                <div className="office-list-table-header listing-studio-shares-table-row">
                  <span>{isZh ? "清单" : "Collection"}</span>
                  <span>{isZh ? "状态" : "Status"}</span>
                  <span>{isZh ? "分享" : "Shares"}</span>
                  <span>{isZh ? "访问" : "Views"}</span>
                  <span>{isZh ? "最近分享" : "Last shared"}</span>
                  <span>{isZh ? "最近访问" : "Last viewed"}</span>
                  <span>{isZh ? "链接" : "Link"}</span>
                </div>

                <div className="office-list-table-body">
                  {snapshot.items.map((item) => (
                    <div
                      className="office-list-table-row listing-studio-shares-table-row"
                      key={item.id}
                    >
                      <div className="office-list-table-main">
                        <strong>
                          <Link href={`/listing-studio/collections/${item.id}`}>
                            {item.name}
                          </Link>
                        </strong>
                        <p>
                          {formatCollectionMeta(
                            item.listingCount,
                            item.updatedAt,
                            locale,
                          )}
                        </p>
                      </div>

                      <span>
                        <StatusBadge tone={item.shareEnabled ? "success" : "neutral"}>
                          {item.shareEnabled
                            ? isZh
                              ? "有效"
                              : "Live"
                            : isZh
                              ? "未启用"
                              : "Inactive"}
                        </StatusBadge>
                      </span>

                      <span className="listing-studio-share-count">
                        {item.shareCount}
                      </span>
                      <span className="listing-studio-share-count">
                        {item.viewCount}
                      </span>
                      <span>{formatDateTime(item.lastSharedAt, locale)}</span>
                      <span>{formatDateTime(item.lastViewedAt, locale)}</span>
                      <span>
                        {item.shareCode ? (
                          <Link
                            className="office-table-action-muted"
                            href={`/share/collections/${item.shareCode}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {isZh ? "打开" : "Open"}
                          </Link>
                        ) : (
                          isZh ? "未生成" : "Not minted"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    className="office-button office-button-primary"
                    href="/listing-studio/collections"
                  >
                    {isZh ? "打开客户清单" : "Open collections"}
                  </Link>
                }
                className="listing-studio-empty-state"
                description={
                  isZh
                    ? "从清单详情页复制分享链接后，这里会开始记录分享历史。"
                    : "Copy a collection share link from a collection detail page to start the share history."
                }
                title={isZh ? "还没有清单分享记录。" : "No collection shares yet."}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
