import { getPublicSignatureRequestSnapshot } from "@acre/db";
import { notFound } from "next/navigation";
import { PublicSignatureClient } from "./public-signature-client";

type PublicSignaturePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicSignaturePage({ params }: PublicSignaturePageProps) {
  const { token } = await params;
  const snapshot = await getPublicSignatureRequestSnapshot(token);

  if (!snapshot) {
    notFound();
  }

  return <PublicSignatureClient snapshot={snapshot} token={token} />;
}
