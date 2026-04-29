import {
  getStudioListingPackCollectionShare,
  getStudioListingPackDetail,
} from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../lib/auth-session";
import { ListingStudioDetailClient } from "./listing-studio-detail-client";

type ListingStudioDetailPageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ListingStudioDetailPage(
  props: ListingStudioDetailPageProps,
) {
  const { packId } = await props.params;
  const collectionShare = await getStudioListingPackCollectionShare({ packId });

  if (collectionShare) {
    redirect(
      `/share/collections/${collectionShare.shareCode}?listing=${encodeURIComponent(
        packId,
      )}`,
    );
  }

  const context = await requireSessionContext();
  const detail = await getStudioListingPackDetail({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!detail) {
    redirect("/listing-studio/listings");
  }

  return (
    <div className="office-list-page listing-studio-page">
      <ListingStudioDetailClient detail={detail} />
    </div>
  );
}
