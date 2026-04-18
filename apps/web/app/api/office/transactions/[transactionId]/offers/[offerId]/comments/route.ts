import { canCommentOfficeOffers } from "@acre/auth";
import {
  createOfferComment,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { createOfficeOfferCommentBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    offerId: string;
  }>;
};

type OfficeOfferCommentsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createOfferComment?: typeof createOfferComment;
};

export async function handleCreateOfficeOfferCommentPost(
  request: NextRequest,
  transactionId: string,
  offerId: string,
  context: SessionMembershipContext,
  dependencies: OfficeOfferCommentsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeOfferCommentBodySchema, {
    error: "Offer comment payload is invalid.",
    invalidJsonError: "Offer comment request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const comment = await (
      dependencies.createOfferComment ?? createOfferComment
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      offerId,
      actorMembershipId: context.currentMembership.id,
      body: parsedBody.data.body
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCommentOfficeOffers(context.currentMembership)) {
    return NextResponse.json({ error: "Offer comment access required." }, { status: 403 });
  }

  const { transactionId, offerId } = await params;
  return handleCreateOfficeOfferCommentPost(request, transactionId, offerId, context);
}
