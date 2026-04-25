import { canManageListingStudioCompanyFeed } from "@acre/auth";
import { getListingStudioCompanyDashboard } from "@acre/db";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { ListingStudioCard } from "../listing-studio-card";

export default async function ListingStudioDashboardPage() {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const canManageCompanyFeed = canManageListingStudioCompanyFeed(
    context.currentMembership,
  );
  const snapshot = await getListingStudioCompanyDashboard({
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
          <h2>{isZh ? "公司房源面板" : "Company dashboard"}</h2>
          <p>
            {isZh
              ? "管理员发布的房源会展示在这里，团队成员可以一键加入自己的房源工作区。"
              : "Listings published by your admin team appear here for the whole studio. Add the ones you want into your own listings workspace with one click."}
          </p>
        </div>
      </section>

      <div className="listing-studio-shell">
        <section className="listing-studio-listed-section">
          <div className="listing-studio-listed-section-head">
            <div>
              <span className="listing-studio-shell-eyebrow">
                {isZh ? "公司动态" : "Company feed"}
              </span>
              <h2>{isZh ? "公司共享房源" : "Shared company listings"}</h2>
            </div>
            <p>
              {isZh
                ? `当前公司面板上有 ${snapshot.items.length} 套房源。`
                : `${snapshot.items.length} listing${
                    snapshot.items.length === 1 ? "" : "s"
                  } currently live on the company board.`}
            </p>
          </div>

          <div className="listing-studio-card-grid">
            {snapshot.items.length ? (
              snapshot.items.map((item) => (
                <ListingStudioCard
                  canManageCompanyFeed={canManageCompanyFeed}
                  item={item}
                  key={item.packId}
                  mode="dashboard"
                />
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>
                  {isZh
                    ? "公司面板还没有可用房源。"
                    : "No company listings are live yet."}
                </strong>
                <p>
                  {canManageCompanyFeed
                    ? isZh
                      ? "可以先从房源工作室的“我的房源”导入，或把已保存房源发布到公司面板。"
                      : "Import a listing from Studio > Listings, or publish one from your saved listings to start the company board."
                    : isZh
                      ? "等待负责人或后台管理员发布房源后，你就可以把它们加入自己的房源工作区。"
                      : "Wait for an owner or office admin to publish listings here, then you can add them into your own Listings workspace."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
