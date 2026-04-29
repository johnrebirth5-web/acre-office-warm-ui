import {
  getStudioListingPackCollectionShare,
  getStudioListingPackDetail,
} from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../lib/auth-session";
import {
  buildListingStudioCollectionShareListingHref,
  normalizeListingStudioShareReturnSource,
} from "../../listing-studio-share-return";
import { ListingStudioDetailClient } from "./listing-studio-detail-client";

type ListingStudioDetailPageProps = {
  params: Promise<{ packId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingStudioDetailPage(
  props: ListingStudioDetailPageProps,
) {
  const { packId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const returnSource = normalizeListingStudioShareReturnSource(
    typeof searchParams.from === "string" ? searchParams.from : null,
  );
  const collectionShare = await getStudioListingPackCollectionShare({ packId });

  if (collectionShare) {
    redirect(
      buildListingStudioCollectionShareListingHref({
        packId,
        returnSource,
        shareCode: collectionShare.shareCode,
      }),
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
