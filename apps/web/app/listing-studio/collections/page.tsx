import Link from "next/link";
import { listStudioListingCollections } from "@acre/db";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { CreateCollectionForm } from "./create-collection-form";
import { DeleteCollectionButton } from "./delete-collection-button";

type ListingStudioCollectionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
}

function formatUpdatedLabel(value: string, locale: string) {
  const date = new Date(value);
  const isZh = locale === "zh-CN";

  if (Number.isNaN(date.getTime())) {
    return isZh ? "最近更新" : "Recently updated";
  }

  return date.toLocaleDateString(isZh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ListingStudioCollectionsPage(
  props: ListingStudioCollectionsPageProps,
) {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const searchParams = (await props.searchParams) ?? {};
  const deleted = readSearchParam(searchParams, "deleted");
  const collections = await listStudioListingCollections({
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
          <h2>{isZh ? "客户清单" : "Collections"}</h2>
          <p>
            {isZh
              ? "把导入的房源资料整理成私密客户清单，并在详情页查看这些房源在地图上的分布。"
              : "Build private client folders from imported listing packets, then use the detail view to study how those homes spread across the map."}
          </p>
        </div>
      </section>

      <div className="listing-studio-shell">
        {deleted ? (
          <div className="listing-studio-status-message">
            {isZh
              ? "清单已从房源工作室删除。"
              : "Collection deleted from Listing Studio."}
          </div>
        ) : null}

        <section className="listing-studio-toolbar-card">
          <CreateCollectionForm />
        </section>

        <section className="listing-studio-listed-section">
          <div className="listing-studio-listed-section-head">
            <div>
              <span className="listing-studio-shell-eyebrow">
                {isZh ? "私密分组" : "Private folders"}
              </span>
              <h2>{isZh ? "已保存的客户清单" : "Your saved collections"}</h2>
            </div>
            <p>
              {isZh
                ? `当前前台席位下有 ${collections.length} 个清单。`
                : `${collections.length} collection${
                    collections.length === 1 ? "" : "s"
                  } currently belong to this Front Office seat.`}
            </p>
          </div>

          <div className="listing-studio-collections-grid">
            {collections.length ? (
              collections.map((collection) => (
                <div
                  className="listing-studio-collection-card-shell"
                  key={collection.id}
                >
                  <div className="listing-studio-collection-card-actions">
                    <DeleteCollectionButton
                      buttonClassName="listing-studio-card-delete-button"
                      collectionId={collection.id}
                      collectionName={collection.name}
                      iconOnly
                    />
                  </div>

                  <Link
                    className="listing-studio-collection-card"
                    href={`/listing-studio/collections/${collection.id}`}
                  >
                    <div className="listing-studio-collection-card-media">
                      {collection.previewListings.length ? (
                        collection.previewListings.map((listing, index) => (
                          <div
                            className="listing-studio-collection-card-tile"
                            key={listing.packId}
                            style={{ zIndex: collection.previewListings.length - index }}
                          >
                            {listing.heroAssetId ? (
                              <img
                                alt={listing.displayTitle || listing.addressLine}
                                src={`/api/listing-studio/assets/${listing.heroAssetId}`}
                              />
                            ) : (
                              <span>
                                {listing.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow"}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="listing-studio-collection-card-empty">
                          {isZh ? "空清单" : "Empty collection"}
                        </div>
                      )}
                    </div>

                    <div className="listing-studio-collection-card-body">
                      <div className="listing-studio-collection-card-meta">
                        <span>
                          {isZh
                            ? `${collection.listingCount} 套房源`
                            : `${collection.listingCount} listing${
                                collection.listingCount === 1 ? "" : "s"
                              }`}
                        </span>
                        <span>
                          {isZh
                            ? `更新于 ${formatUpdatedLabel(
                                collection.updatedAt,
                                locale,
                              )}`
                            : `Updated ${formatUpdatedLabel(
                                collection.updatedAt,
                                locale,
                              )}`}
                        </span>
                      </div>
                      <strong>{collection.name}</strong>
                      <p>
                        {isZh
                          ? "打开这个清单，查看所有已保存房源以及区域地图。"
                          : "Open this folder to review every saved listing and the live map view for the area."}
                      </p>
                    </div>
                  </Link>
                </div>
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>{isZh ? "还没有客户清单。" : "No collections yet."}</strong>
                <p>
                  {isZh
                    ? "先创建一个命名清单，再按楼宇、街区或客户候选列表整理导入的房源。"
                    : "Create a named folder above, then start grouping imported packets by building, neighborhood, or client short-list."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
