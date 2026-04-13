import { getStudioListingPackDetail } from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../lib/auth-session";
import { ListingStudioDetailClient } from "./listing-studio-detail-client";

type ListingStudioDetailPageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ListingStudioDetailPage(
  props: ListingStudioDetailPageProps,
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
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing packet</span>
          <h2>{detail.title}</h2>
        </div>
      </section>
      <ListingStudioDetailClient detail={detail} />
    </div>
  );
}
