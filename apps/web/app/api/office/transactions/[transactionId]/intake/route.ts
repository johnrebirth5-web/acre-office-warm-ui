import { canEditOfficeTransactions, canManageOfficeTransactionStatus } from "@acre/auth";
import {
  getOfficeTransactionIntakeSchema,
  getTransactionById,
  prepareTransactionIntakeSubmission,
  type SessionMembershipContext,
  updateTransactionIntake,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { updateOfficeTransactionIntakeBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type OfficeTransactionIntakeRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  getTransactionById?: typeof getTransactionById;
  getOfficeTransactionIntakeSchema?: typeof getOfficeTransactionIntakeSchema;
  prepareTransactionIntakeSubmission?: typeof prepareTransactionIntakeSubmission;
  updateTransactionIntake?: typeof updateTransactionIntake;
};

export async function handleUpdateOfficeTransactionIntakePatch(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionIntakeRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeTransactionIntakeBodySchema, {
    error: "Transaction intake payload is invalid.",
    invalidJsonError: "Transaction intake request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const existingTransaction = await (
    dependencies.getTransactionById ?? getTransactionById
  )({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    transactionId,
    officeId: context.currentOffice?.id ?? null
  });

  if (!existingTransaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  try {
    const canManageTransactionStatus = canManageOfficeTransactionStatus(context.currentMembership);
    const schema = await (
      dependencies.getOfficeTransactionIntakeSchema ??
      getOfficeTransactionIntakeSchema
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const requestBody = parsedBody.data;
    const submission = (
      dependencies.prepareTransactionIntakeSubmission ??
      prepareTransactionIntakeSubmission
    )({
      schema,
      payload: {
        ...requestBody,
        transactionStatus:
          canManageTransactionStatus && typeof requestBody.transactionStatus === "string" && requestBody.transactionStatus.trim()
            ? requestBody.transactionStatus
            : existingTransaction.statusValue
      },
      existingTransaction
    });
    const transaction = await (
      dependencies.updateTransactionIntake ?? updateTransactionIntake
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      transactionType: submission.transactionType,
      transactionStatus: canManageTransactionStatus ? submission.transactionStatus : existingTransaction.statusValue,
      representing: submission.representing,
      address: submission.address,
      city: submission.city,
      state: submission.state,
      zipCode: submission.zipCode,
      transactionName: submission.transactionName,
      askingPrice: submission.askingPrice,
      purchasedPrice: submission.purchasedPrice,
      price: submission.price,
      buyerAgreementDate: submission.buyerAgreementDate,
      buyerExpirationDate: submission.buyerExpirationDate,
      acceptanceDate: submission.acceptanceDate,
      listingDate: submission.listingDate,
      listingExpirationDate: submission.listingExpirationDate,
      closingDate: submission.closingDate,
      moveInDate: submission.moveInDate,
      additionalFields: submission.additionalFields
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update transaction intake."
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction edit access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleUpdateOfficeTransactionIntakePatch(request, transactionId, context);
}
