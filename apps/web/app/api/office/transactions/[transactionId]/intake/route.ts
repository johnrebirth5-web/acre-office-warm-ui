import { canEditOfficeTransactions } from "@acre/auth";
import { getOfficeTransactionIntakeSchema, getTransactionById, prepareTransactionIntakeSubmission, updateTransactionIntake } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction edit access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const existingTransaction = await getTransactionById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    transactionId,
    officeId: context.currentOffice?.id ?? null
  });

  if (!existingTransaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  try {
    const schema = await getOfficeTransactionIntakeSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = prepareTransactionIntakeSubmission({
      schema,
      payload: body ?? {},
      existingTransaction
    });
    const transaction = await updateTransactionIntake({
      organizationId: context.currentOrganization.id,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      transactionType: submission.transactionType,
      transactionStatus: submission.transactionStatus,
      representing: submission.representing,
      address: submission.address,
      city: submission.city,
      state: submission.state,
      zipCode: submission.zipCode,
      transactionName: submission.transactionName,
      price: submission.price,
      buyerAgreementDate: submission.buyerAgreementDate,
      buyerExpirationDate: submission.buyerExpirationDate,
      acceptanceDate: submission.acceptanceDate,
      listingDate: submission.listingDate,
      listingExpirationDate: submission.listingExpirationDate,
      closingDate: submission.closingDate,
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
