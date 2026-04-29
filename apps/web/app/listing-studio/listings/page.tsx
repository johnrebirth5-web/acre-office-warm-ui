import Link from "next/link";
import { canManageListingStudioCompanyFeed } from "@acre/auth";
import {
  getListingStudioWorkspaceOverview,
  listStudioListingPacks,
} from "@acre/db";
import { ListPageStatsGrid, SectionCard, StatCard, TextInput } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { ListingStudioExtensionConnectAction } from "../dashboard/extension-connect-action";
import { ListingStudioCard } from "../listing-studio-card";

type StudioListingSourceSite = "streeteasy" | "zillow";

type ListingStudioListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
}

function formatConnectedAtLabel(value: string | null, locale: string) {
  const isZh = locale === "zh-CN";

  if (!value) {
    return isZh ? "尚未连接" : "Not connected yet";
  }

  return new Date(value).toLocaleString(isZh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ListingStudioListingsPage(
  props: ListingStudioListingsPageProps,
) {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const canManageCompanyFeed = canManageListingStudioCompanyFeed(
    context.currentMembership,
  );
  const searchParams = (await props.searchParams) ?? {};
  const query = readSearchParam(searchParams, "q");
  const sourceSite = readSearchParam(searchParams, "source") as StudioListingSourceSite | "";
  const listingType = readSearchParam(searchParams, "type");
  const deleted = readSearchParam(searchParams, "deleted");
  const removed = readSearchParam(searchParams, "removed");
  const [overview, items] = await Promise.all([
    getListingStudioWorkspaceOverview({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
    }),
    listStudioListingPacks({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      search: query || null,
      sourceSite: sourceSite || null,
      listingType: listingType || null,
    }),
  ]);

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">
            {isZh ? "房源工作室" : "Listing Studio"}
          </span>
          <h2>{isZh ? "我的房源" : "My saved listings"}</h2>
          <p>
            {isZh
              ? "把自己导入的房源和从公司面板收藏的房源集中管理，并直接整理进客户清单。"
              : "Keep the listings you imported yourself and the ones you added from the company dashboard in one workspace, then organize them into collections without leaving Listing Studio."}
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        {deleted ? (
          <div className="listing-studio-status-message">
            {isZh
              ? "房源已从房源工作室删除。"
              : "Listing deleted from Listing Studio."}
          </div>
        ) : removed ? (
          <div className="listing-studio-status-message">
            {isZh
              ? "房源已从我的房源中移除。"
              : "Listing removed from My listings."}
          </div>
        ) : null}

        <SectionCard
          className="listing-studio-banner-card"
          subtitle={
            isZh
              ? "在这里连接 Chrome 扩展，然后把 StreetEasy 和 Zillow 房源直接保存到 Acre。"
              : "Connect the Chrome extension here, then save StreetEasy and Zillow listings straight into Acre."
          }
          title={isZh ? "Chrome 扩展" : "Chrome extension"}
        >
          <ListingStudioExtensionConnectAction
            serverActiveTokenCount={overview.extension.activeTokenCount}
            serverHasActiveToken={overview.extension.hasActiveToken}
            serverLatestConnectedAtLabel={formatConnectedAtLabel(
              overview.extension.latestConnectedAt,
              locale,
            )}
          />
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "快速查看当前房源工作室的动态。"
              : "A quick read on current Listing Studio activity."
          }
          title={isZh ? "工作室概览" : "Studio overview"}
        >
          <ListPageStatsGrid>
            <StatCard
              hint={isZh ? "组织内保存的全部房源" : "All saved listings in this organization"}
              label={isZh ? "已保存房源" : "Saved listings"}
              value={overview.summary.totalListings}
            />
            <StatCard
              hint={isZh ? "最近两周导入的房源" : "Imports received in the last two weeks"}
              label={isZh ? "近期导入" : "Recent imports"}
              value={overview.summary.recentImports}
            />
            <StatCard
              hint={
                isZh
                  ? "已分享房源公开页面的访问记录"
                  : "Public share page opens recorded across shared listings"
              }
              label={isZh ? "分享访问" : "Share views"}
              value={overview.summary.shareViews}
            />
            <StatCard
              hint={
                isZh
                  ? "已经生成有效公开分享链接的房源"
                  : "Listings that already have a live public share link"
              }
              label={isZh ? "可分享" : "Ready to share"}
              value={overview.summary.readyToShare}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <div className="listing-studio-shell">
          <section className="listing-studio-toolbar-card">
            <form className="listing-studio-listed-filterbar" method="get">
              <label className="listing-studio-shell-search is-wide">
                <span>{isZh ? "搜索房源" : "Search listings"}</span>
                <TextInput
                  defaultValue={query}
                  name="q"
                  placeholder={
                    isZh
                      ? "按地址、楼宇、城市或标题搜索..."
                      : "Search by address, building, city, or title..."
                  }
                />
              </label>

              <label className="listing-studio-shell-search">
                <span>{isZh ? "来源" : "Source"}</span>
                <select defaultValue={sourceSite} name="source">
                  <option value="">{isZh ? "全部来源" : "All sources"}</option>
                  <option value="streeteasy">StreetEasy</option>
                  <option value="zillow">Zillow</option>
                </select>
              </label>

              <label className="listing-studio-shell-search">
                <span>{isZh ? "房源类型" : "Listing type"}</span>
                <select defaultValue={listingType} name="type">
                  <option value="">{isZh ? "全部类型" : "All types"}</option>
                  <option value="sale">{isZh ? "出售" : "Sale"}</option>
                  <option value="rent">{isZh ? "出租" : "Rent"}</option>
                </select>
              </label>

              <div className="listing-studio-shell-actions">
                <button className="office-button office-button-primary" type="submit">
                  {isZh ? "应用筛选" : "Apply filters"}
                </button>
                <Link
                  className="office-button office-button-secondary"
                  href="/listing-studio/listings"
                >
                  {isZh ? "重置" : "Reset"}
                </Link>
              </div>
            </form>
          </section>

          <section className="listing-studio-listed-section">
            <div className="listing-studio-listed-section-head">
              <div>
                <span className="listing-studio-shell-eyebrow">
                  {isZh ? "个人工作区" : "Personal workspace"}
                </span>
                <h2>{isZh ? "已保存房源资料" : "Saved listing packets"}</h2>
              </div>
              <p>
                {isZh
                  ? `当前视图匹配 ${items.length} 套房源。`
                  : `${items.length} listing${
                      items.length === 1 ? "" : "s"
                    } currently match this view.`}
              </p>
            </div>

            <div className="listing-studio-card-grid">
              {items.length ? (
                items.map((item) => (
                  <ListingStudioCard
                    canManageCompanyFeed={canManageCompanyFeed}
                    deleteActionMode={
                      item.savedSource === "saved_from_dashboard"
                        ? "remove_from_my_listings"
                        : "delete_listing"
                    }
                    detailReturnSource="listings"
                    item={item}
                    key={item.packId}
                    showCollectionPicker
                    showDeleteAction={Boolean(item.savedSource)}
                  />
                ))
              ) : (
                <div className="listing-studio-empty-state">
                  <strong>
                    {isZh
                      ? "没有符合当前筛选的房源。"
                      : "No listings match the current filters."}
                  </strong>
                  <p>
                    {isZh
                      ? "可以放宽搜索条件、从公司面板添加房源，或通过 Acre Chrome 扩展保存新房源。"
                      : "Try a broader search, add something from the company dashboard, or save a new listing from the Acre Chrome extension."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
