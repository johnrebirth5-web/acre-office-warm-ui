import { canCreateOfficeTransactions, canViewOfficeTransactions } from "@acre/auth";
import { createTransaction, getOfficeTransactionIntakeSchema, listTransactions, prepareTransactionIntakeSubmission, type OfficeTransactionStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

const transactionStatusOptions = ["All", "Opportunity", "Active", "Pending", "Closed", "Cancelled"] as const;
const defaultTransactionsPage = 1;
const defaultTransactionsPageSize = 20;
const maxTransactionsPageSize = 100;

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
  if (!value || !value.trim()) {
    return fallback;
  }

  const numeric = Number.parseInt(value, 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return null;
  }

  return max ? Math.min(numeric, max) : numeric;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeTransactions(context.currentMembership.role)) {
    return NextResponse.json({ error: "Transaction access required." }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("q") ?? undefined;
  const status = searchParams.get("status") ?? "All";
  const ownerMembershipId = searchParams.get("ownerMembershipId") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const page = parsePositiveInteger(searchParams.get("page"), defaultTransactionsPage);
  const pageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    defaultTransactionsPageSize,
    maxTransactionsPageSize
  );

  if (page === null || pageSize === null) {
    return NextResponse.json({ error: "page and pageSize must be positive integers." }, { status: 400 });
  }

  if (!transactionStatusOptions.includes(status as (typeof transactionStatusOptions)[number])) {
    return NextResponse.json({ error: "Unsupported transaction status filter." }, { status: 400 });
  }

  const result = await listTransactions({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id,
    search,
    status: status === "All" ? "All" : (status as OfficeTransactionStatus),
    ownerMembershipId,
    teamId,
    type,
    startDate,
    endDate,
    page,
    pageSize
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateOfficeTransactions(context.currentMembership.role)) {
    return NextResponse.json({ error: "Transaction create access required." }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  try {
    const schema = await getOfficeTransactionIntakeSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = prepareTransactionIntakeSubmission({
      schema,
      payload: body
    });
    const transaction = await createTransaction({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id,
      ownerMembershipId: context.currentMembership.id,
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

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create transaction."
      },
      { status: 400 }
    );
  }
}
