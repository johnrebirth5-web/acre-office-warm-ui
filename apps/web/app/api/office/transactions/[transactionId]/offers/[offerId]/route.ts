import { canAcceptOfficeOffers, canManageOfficeOffers, canReviewOfficeOffers } from "@acre/auth";
import { transitionOfferStatus, updateOffer } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    offerId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { transactionId, offerId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        title?: string;
        offeringPartyName?: string;
        buyerName?: string;
        price?: string;
        earnestMoneyAmount?: string;
        financingType?: string;
        closingDateOffered?: string;
        expirationAt?: string;
        isPrimaryOffer?: boolean;
        notes?: string;
      }
    | null;

  try {
    if (body?.action) {
      if (body.action === "accept") {
        if (!canAcceptOfficeOffers(context.currentMembership)) {
          return NextResponse.json({ error: "Offer acceptance access required." }, { status: 403 });
        }
      } else if (!canReviewOfficeOffers(context.currentMembership) && !canManageOfficeOffers(context.currentMembership)) {
        return NextResponse.json({ error: "Offer review access required." }, { status: 403 });
      }

      const offer = await transitionOfferStatus({
        organizationId: context.currentOrganization.id,
        transactionId,
        offerId,
        actorMembershipId: context.currentMembership.id,
        action: body.action as
          | "submit"
          | "receive"
          | "review"
          | "counter"
          | "accept"
          | "reject"
          | "withdraw"
          | "expire"
      });

      if (!offer) {
        return NextResponse.json({ error: "Offer not found." }, { status: 404 });
      }

      return NextResponse.json({ offer });
    }

    if (!canManageOfficeOffers(context.currentMembership)) {
      return NextResponse.json({ error: "Offer management access required." }, { status: 403 });
    }

    const offer = await updateOffer({
      organizationId: context.currentOrganization.id,
      transactionId,
      offerId,
      actorMembershipId: context.currentMembership.id,
      title: body?.title,
      offeringPartyName: body?.offeringPartyName,
      buyerName: body?.buyerName,
      price: body?.price,
      earnestMoneyAmount: body?.earnestMoneyAmount,
      financingType: body?.financingType,
      closingDateOffered: body?.closingDateOffered,
      expirationAt: body?.expirationAt,
      isPrimaryOffer: body?.isPrimaryOffer,
      notes: body?.notes
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({ offer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Offer update failed." },
      { status: 400 }
    );
  }
}
