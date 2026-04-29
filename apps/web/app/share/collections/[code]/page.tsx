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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingStudioPublicCollectionPage(
  props: ListingStudioPublicCollectionPageProps,
) {
  const { code } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const viewerFingerprint =
    typeof searchParams.viewer === "string" ? searchParams.viewer : null;
  const initialListingPackId =
    typeof searchParams.listing === "string" ? searchParams.listing : null;
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
    viewerFingerprint,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip"),
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <ListingStudioPublicCollectionClient
      initialListingPackId={initialListingPackId}
      snapshot={snapshot}
    />
  );
}
