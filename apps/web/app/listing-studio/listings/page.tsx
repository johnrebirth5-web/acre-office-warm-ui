import Link from "next/link";
import { canManageListingStudioCompanyFeed } from "@acre/auth";
import {
  getListingStudioWorkspaceOverview,
  listStudioListingPacks,
} from "@acre/db";
import { ListPageStatsGrid, SectionCard, StatCard, TextInput } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
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

function formatConnectedAtLabel(value: string | null) {
  if (!value) {
    return "Not connected yet";
  }

  return new Date(value).toLocaleString("en-US", {
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
  const canManageCompanyFeed = canManageListingStudioCompanyFeed(
    context.currentMembership,
  );
  const searchParams = (await props.searchParams) ?? {};
  const query = readSearchParam(searchParams, "q");
  const sourceSite = readSearchParam(searchParams, "source") as StudioListingSourceSite | "";
  const listingType = readSearchParam(searchParams, "type");
  const deleted = readSearchParam(searchParams, "deleted");
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
          <span className="office-eyebrow">Listing Studio</span>
          <h2>My saved listings</h2>
          <p>
            Keep the listings you imported yourself and the ones you added from
            the company dashboard in one workspace, then organize them into
            collections without leaving Listing Studio.
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        {deleted ? (
          <div className="listing-studio-status-message">
            Listing deleted from Listing Studio.
          </div>
        ) : null}

        <SectionCard
          className="listing-studio-banner-card"
          subtitle="Connect the Chrome extension here, then save StreetEasy and Zillow listings straight into Acre."
          title="Chrome extension"
        >
          <ListingStudioExtensionConnectAction
            serverActiveTokenCount={overview.extension.activeTokenCount}
            serverHasActiveToken={overview.extension.hasActiveToken}
            serverLatestConnectedAtLabel={formatConnectedAtLabel(
              overview.extension.latestConnectedAt,
            )}
          />
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="A quick read on current Listing Studio activity."
          title="Studio overview"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="All saved listings in this organization"
              label="Saved listings"
              value={overview.summary.totalListings}
            />
            <StatCard
              hint="Imports received in the last two weeks"
              label="Recent imports"
              value={overview.summary.recentImports}
            />
            <StatCard
              hint="Public share page opens recorded across shared listings"
              label="Share views"
              value={overview.summary.shareViews}
            />
            <StatCard
              hint="Listings that already have a live public share link"
              label="Ready to share"
              value={overview.summary.readyToShare}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <div className="listing-studio-shell">
          <section className="listing-studio-toolbar-card">
            <form className="listing-studio-listed-filterbar" method="get">
              <label className="listing-studio-shell-search is-wide">
                <span>Search listings</span>
                <TextInput
                  defaultValue={query}
                  name="q"
                  placeholder="Search by address, building, city, or title..."
                />
              </label>

              <label className="listing-studio-shell-search">
                <span>Source</span>
                <select defaultValue={sourceSite} name="source">
                  <option value="">All sources</option>
                  <option value="streeteasy">StreetEasy</option>
                  <option value="zillow">Zillow</option>
                </select>
              </label>

              <label className="listing-studio-shell-search">
                <span>Listing type</span>
                <select defaultValue={listingType} name="type">
                  <option value="">All types</option>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </label>

              <div className="listing-studio-shell-actions">
                <button className="office-button office-button-primary" type="submit">
                  Apply filters
                </button>
                <Link
                  className="office-button office-button-secondary"
                  href="/listing-studio/listings"
                >
                  Reset
                </Link>
              </div>
            </form>
          </section>

          <section className="listing-studio-listed-section">
            <div className="listing-studio-listed-section-head">
              <div>
                <span className="listing-studio-shell-eyebrow">Personal workspace</span>
                <h2>Saved listing packets</h2>
              </div>
              <p>
                {items.length} listing{items.length === 1 ? "" : "s"} currently
                match this view.
              </p>
            </div>

            <div className="listing-studio-card-grid">
              {items.length ? (
                items.map((item) => (
                  <ListingStudioCard
                    canManageCompanyFeed={canManageCompanyFeed}
                    item={item}
                    key={item.packId}
                    showCollectionPicker
                    showDeleteAction={item.savedSource === "imported_by_me"}
                  />
                ))
              ) : (
                <div className="listing-studio-empty-state">
                  <strong>No listings match the current filters.</strong>
                  <p>
                    Try a broader search, add something from the company
                    dashboard, or save a new listing from the Acre Chrome
                    extension.
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
