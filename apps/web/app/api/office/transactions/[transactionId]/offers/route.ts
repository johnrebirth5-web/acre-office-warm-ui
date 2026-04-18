import { canManageOfficeOffers } from "@acre/auth";
import {
  createOffer,
  getOfficeOfferFieldSchema,
  prepareOfferFieldSubmission,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createOfficeOfferBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type OfficeTransactionOffersRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  getOfficeOfferFieldSchema?: typeof getOfficeOfferFieldSchema;
  prepareOfferFieldSubmission?: typeof prepareOfferFieldSubmission;
  createOffer?: typeof createOffer;
};

export async function handleCreateOfficeOfferPost(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionOffersRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeOfferBodySchema, {
    error: "Offer payload is invalid.",
    invalidJsonError: "Offer request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const schema = await (
      dependencies.getOfficeOfferFieldSchema ??
      getOfficeOfferFieldSchema
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = (
      dependencies.prepareOfferFieldSubmission ??
      prepareOfferFieldSubmission
    )({
      schema,
      payload: parsedBody.data
    });
    const offer = await (
      dependencies.createOffer ?? createOffer
    )({
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOffers(context.currentMembership)) {
    return NextResponse.json({ error: "Offer management access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleCreateOfficeOfferPost(request, transactionId, context);
}
