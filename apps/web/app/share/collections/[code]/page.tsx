import { getStudioListingPublicCollection } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../lib/public-token-rate-limit";
import { ListingStudioPublicCollectionClient } from "./listing-studio-public-collection-client";

type ListingStudioPublicCollectionPageProps = {
  params: Promise<{ code: string }>;
};

export default async function ListingStudioPublicCollectionPage(
  props: ListingStudioPublicCollectionPageProps,
) {
  const { code } = await props.params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/listing-studio/collections/read",
    request: headerStore,
    token: code,
    options: PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getStudioListingPublicCollection({
    shareCode: code,
  });

  if (!snapshot) {
    notFound();
  }

  return <ListingStudioPublicCollectionClient snapshot={snapshot} />;
}
