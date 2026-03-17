import { canManageOfficeOffers } from "@acre/auth";
import { createOffer } from "@acre/db";
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
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        offeringPartyName?: string;
        buyerName?: string;
        price?: string;
        earnestMoneyAmount?: string;
        financingType?: string;
        closingDateOffered?: string;
        expirationAt?: string;
        notes?: string;
      }
    | null;

  if (!body?.title?.trim() || !body.offeringPartyName?.trim()) {
    return NextResponse.json({ error: "Offer title and offer party are required." }, { status: 400 });
  }

  try {
    const offer = await createOffer({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      title: body.title,
      offeringPartyName: body.offeringPartyName,
      buyerName: body.buyerName,
      price: body.price,
      earnestMoneyAmount: body.earnestMoneyAmount,
      financingType: body.financingType,
      closingDateOffered: body.closingDateOffered,
      expirationAt: body.expirationAt,
      notes: body.notes
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
