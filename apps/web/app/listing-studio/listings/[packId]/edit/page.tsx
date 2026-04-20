import { getStudioListingPackDetail } from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../../lib/auth-session";
import { ListingStudioDetailClient } from "../listing-studio-detail-client";

type ListingStudioEditPageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ListingStudioEditPage(
  props: ListingStudioEditPageProps,
) {
  const context = await requireSessionContext();
  const { packId } = await props.params;
  const detail = await getStudioListingPackDetail({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!detail) {
    redirect("/listing-studio/listings");
  }

  return (
    <div className="office-list-page listing-studio-page">
      <ListingStudioDetailClient detail={detail} mode="edit" />
    </div>
  );
}
