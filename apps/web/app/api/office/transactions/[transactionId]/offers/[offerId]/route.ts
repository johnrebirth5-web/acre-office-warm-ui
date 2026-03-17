import { canAcceptOfficeOffers, canManageOfficeOffers, canReviewOfficeOffers } from "@acre/auth";
import { getOfficeOfferFieldSchema, listTransactionOffersSnapshot, prepareOfferFieldSubmission, transitionOfferStatus, updateOffer } from "@acre/db";
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
  const body = (await request.json().catch(() => null)) as (Record<string, unknown> & { action?: string; isPrimaryOffer?: boolean }) | null;

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

    const [schema, offersSnapshot] = await Promise.all([
      getOfficeOfferFieldSchema({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null
      }),
      listTransactionOffersSnapshot(context.currentOrganization.id, transactionId)
    ]);
    const existingOffer = offersSnapshot.offers.find((offer) => offer.id === offerId) ?? null;

    if (!existingOffer) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const submission = prepareOfferFieldSubmission({
      schema,
      payload: body ?? {},
      existingOffer
    });

    const offer = await updateOffer({
      organizationId: context.currentOrganization.id,
      transactionId,
      offerId,
      actorMembershipId: context.currentMembership.id,
      title: submission.title,
      offeringPartyName: submission.offeringPartyName,
      buyerName: submission.buyerName,
      price: submission.price,
      earnestMoneyAmount: submission.earnestMoneyAmount,
      financingType: submission.financingType,
      closingDateOffered: submission.closingDateOffered,
      expirationAt: submission.expirationAt,
      isPrimaryOffer: body?.isPrimaryOffer,
      notes: submission.notes,
      additionalFields: submission.additionalFields
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
