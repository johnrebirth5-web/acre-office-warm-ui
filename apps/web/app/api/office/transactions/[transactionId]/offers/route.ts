import { canManageOfficeOffers } from "@acre/auth";
import { createOffer, getOfficeOfferFieldSchema, prepareOfferFieldSubmission } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOffers(context.currentMembership)) {
    return NextResponse.json({ error: "Offer management access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const schema = await getOfficeOfferFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = prepareOfferFieldSubmission({
      schema,
      payload: body ?? {}
    });
    const offer = await createOffer({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      title: submission.title,
      offeringPartyName: submission.offeringPartyName,
      buyerName: submission.buyerName,
      price: submission.price,
      earnestMoneyAmount: submission.earnestMoneyAmount,
      financingType: submission.financingType,
      closingDateOffered: submission.closingDateOffered,
      expirationAt: submission.expirationAt,
      notes: submission.notes,
      additionalFields: submission.additionalFields
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer could not be created." }, { status: 404 });
    }

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Offer could not be created." },
      { status: 400 }
    );
  }
}
