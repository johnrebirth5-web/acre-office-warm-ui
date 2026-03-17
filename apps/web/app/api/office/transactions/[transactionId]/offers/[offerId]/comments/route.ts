import { canCommentOfficeOffers } from "@acre/auth";
import { createOfferComment } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    offerId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCommentOfficeOffers(context.currentMembership)) {
    return NextResponse.json({ error: "Offer comment access required." }, { status: 403 });
  }

  const { transactionId, offerId } = await params;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
  }

  try {
    const comment = await createOfferComment({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      offerId,
      actorMembershipId: context.currentMembership.id,
      body: body.body
    });

    if (!comment) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Comment could not be created." },
      { status: 400 }
    );
  }
}
