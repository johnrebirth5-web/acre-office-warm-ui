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
          <p>
            Review the imported facts, refine the customer-facing copy, and
            generate a poster, share page, or PDF from the same Acre packet
            with editable contact details, a clearer distribution summary, and
            a scan-ready live packet path.
          </p>
        </div>
      </section>
      <ListingStudioDetailClient detail={detail} />
    </div>
  );
}
