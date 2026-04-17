import Link from "next/link";
import { listStudioListingPacks } from "@acre/db";
import { TextInput } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
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

export default async function ListingStudioListingsPage(
  props: ListingStudioListingsPageProps,
) {
  const context = await requireSessionContext();
  const searchParams = (await props.searchParams) ?? {};
  const query = readSearchParam(searchParams, "q");
  const sourceSite = readSearchParam(searchParams, "source") as StudioListingSourceSite | "";
  const listingType = readSearchParam(searchParams, "type");
  const deleted = readSearchParam(searchParams, "deleted");
  const items = await listStudioListingPacks({
    organizationId: context.currentOrganization.id,
    search: query || null,
    sourceSite: sourceSite || null,
    listingType: listingType || null,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Listings</h2>
          <p>
            Review every parsed packet imported from the Chrome extension, then
            sort them into collections without leaving Listing Studio.
          </p>
        </div>
      </section>

      <div className="listing-studio-shell">
        {deleted ? (
          <div className="listing-studio-status-message">
            Listing deleted from Listing Studio.
          </div>
        ) : null}

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
              <span className="listing-studio-shell-eyebrow">Imported packets</span>
              <h2>Saved listing packets</h2>
            </div>
            <p>
              {items.length} listing{items.length === 1 ? "" : "s"} currently match
              this view.
            </p>
          </div>

          <div className="listing-studio-card-grid">
            {items.length ? (
              items.map((item) => (
                <ListingStudioCard
                  item={item}
                  key={item.packId}
                  showCollectionPicker
                  showDeleteAction
                />
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No listings match the current filters.</strong>
                <p>
                  Try a broader search or save a new listing from the Acre Chrome
                  extension.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
