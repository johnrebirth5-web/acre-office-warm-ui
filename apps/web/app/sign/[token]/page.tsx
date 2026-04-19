import { getPublicSignatureRequestSnapshot } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
} from "../../../lib/public-token-rate-limit";
import { PublicSignatureClient } from "./public-signature-client";

type PublicSignaturePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicSignaturePage({ params }: PublicSignaturePageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/signatures/read",
    request: headerStore,
    token,
    options: PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getPublicSignatureRequestSnapshot(token);

  if (!snapshot) {
    notFound();
  }

  return <PublicSignatureClient snapshot={snapshot} token={token} />;
}
