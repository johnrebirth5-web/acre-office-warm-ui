import Link from "next/link";
import { listStudioListingPacks } from "@acre/db";
import { SectionCard, TextInput } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";

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
          <h2>Saved listing packets</h2>
          <p>
            Browse every listing captured by the extension, refine the packet,
            and open the public share or PDF from the detail page.
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle="Search by address, building, neighborhood, or title. Filters stay lightweight in v1 so the save flow remains the priority."
          title="Filters"
        >
          <form className="listing-studio-filter-bar" method="get">
            <label className="listing-studio-filter-field">
              <span>Search</span>
              <TextInput
                defaultValue={query}
                name="q"
                placeholder="Address, building, neighborhood..."
              />
            </label>
            <label className="listing-studio-filter-field">
              <span>Source</span>
              <select defaultValue={sourceSite} name="source">
                <option value="">All</option>
                <option value="streeteasy">StreetEasy</option>
                <option value="zillow">Zillow</option>
              </select>
            </label>
            <label className="listing-studio-filter-field">
              <span>Type</span>
              <select defaultValue={listingType} name="type">
                <option value="">All</option>
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
              </select>
            </label>
            <div className="listing-studio-filter-actions">
              <button className="office-button office-button-primary" type="submit">
                Apply filters
              </button>
              <Link className="office-button office-button-secondary" href="/listing-studio/listings">
                Reset
              </Link>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle={`${items.length} packet${items.length === 1 ? "" : "s"} currently match this view.`}
          title="Imported listings"
        >
          <div className="listing-studio-card-grid">
            {items.length ? (
              items.map((item) => (
                <Link
                  className="listing-studio-card"
                  href={`/listing-studio/listings/${item.packId}`}
                  key={item.packId}
                >
                  <div className="listing-studio-card-media">
                    {item.heroAssetId ? (
                      <img
                        alt={item.title}
                        src={`/api/listing-studio/assets/${item.heroAssetId}`}
                      />
                    ) : (
                      <div className="listing-studio-card-media-fallback">
                        {item.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow"}
                      </div>
                    )}
                  </div>
                  <div className="listing-studio-card-body">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {item.sourceSite}
                      </span>
                      {item.shareEnabled ? (
                        <span className="office-status-badge office-status-badge-success">
                          Shared
                        </span>
                      ) : null}
                    </div>
                    <strong>{item.priceLabel}</strong>
                    <span className="listing-studio-card-title">{item.title}</span>
                    <span className="listing-studio-card-address">{item.addressLine}</span>
                    <span className="listing-studio-card-facts">{item.factsLine}</span>
                    {item.statusLabel ? (
                      <span className="listing-studio-card-status">{item.statusLabel}</span>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No packets match the current filters.</strong>
                <p>
                  Try loosening the search or save a fresh listing from the Acre
                  Chrome extension.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
