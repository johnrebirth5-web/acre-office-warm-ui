import { canShareListingStudio } from "@acre/auth";
import { getStudioListingPackDetail } from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../../../lib/auth-session";
import {
  buildListingStudioPosterDraft,
  readListingStudioPosterStatusVariantId,
  readListingStudioPosterTemplateId,
} from "../../../../../listing-studio/listings/[packId]/listing-studio-poster";
import { ListingStudioShareStudioClient } from "../../../../../listing-studio/listings/[packId]/share/listing-studio-share-studio-client";

type ListingStudioShareStudioPageProps = {
  params: Promise<{ packId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingStudioShareStudioPage(
  props: ListingStudioShareStudioPageProps,
) {
  const context = await requireSessionContext();
  const { packId } = await props.params;

  if (!canShareListingStudio(context.currentMembership)) {
    redirect(`/listing-studio/listings/${packId}`);
  }

  const detail = await getStudioListingPackDetail({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!detail) {
    redirect("/listing-studio/listings");
  }

  const searchParams = (await props.searchParams) ?? {};
  const templateParam =
    typeof searchParams.template === "string" ? searchParams.template : null;
  const statusVariantParam =
    typeof searchParams.statusVariant === "string"
      ? searchParams.statusVariant
      : null;
  const coverAssetId =
    typeof searchParams.coverAssetId === "string"
      ? searchParams.coverAssetId
      : null;
  const initialDraft = buildListingStudioPosterDraft(
    detail,
    readListingStudioPosterTemplateId(templateParam),
    coverAssetId,
    readListingStudioPosterStatusVariantId(statusVariantParam),
  );

  return (
    <div className="listing-studio-share-route-shell">
      <div className="listing-studio-share-route-page">
        <ListingStudioShareStudioClient
          detail={detail}
          initialDraft={initialDraft}
        />
      </div>
    </div>
  );
}
