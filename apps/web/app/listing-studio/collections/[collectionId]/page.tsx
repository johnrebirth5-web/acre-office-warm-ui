import { listStudioListingPacks, getStudioListingCollectionDetail } from "@acre/db";
import { notFound } from "next/navigation";
import { requireSessionContext } from "../../../../lib/auth-session";
import { ListingStudioCollectionDetailClient } from "./listing-studio-collection-detail-client";

type ListingStudioCollectionDetailPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function ListingStudioCollectionDetailPage(
  props: ListingStudioCollectionDetailPageProps,
) {
  const context = await requireSessionContext();
  const { collectionId } = await props.params;
  const [detail, availableListings] = await Promise.all([
    getStudioListingCollectionDetail({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      collectionId,
    }),
    listStudioListingPacks({
      organizationId: context.currentOrganization.id,
    }),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <div className="office-list-page listing-studio-page">
      <div className="listing-studio-shell">
        <ListingStudioCollectionDetailClient
          availableListings={availableListings}
          detail={detail}
        />
      </div>
    </div>
  );
}
