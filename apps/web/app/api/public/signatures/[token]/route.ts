import { getPublicSignatureRequestSnapshot } from "@acre/db";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  const snapshot = await getPublicSignatureRequestSnapshot(token);

  if (!snapshot) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}
