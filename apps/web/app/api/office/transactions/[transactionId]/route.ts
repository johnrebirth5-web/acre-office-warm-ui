import { canManageOfficeTransactionStatus, canViewOfficeTransactions } from "@acre/auth";
import { getTransactionById, type OfficeTransactionStatus, updateTransactionStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { isOfficeTransactionStatus } from "../../../../office/transactions/transaction-status-rules";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const transaction = await getTransactionById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    transactionId,
    officeId: context.currentOffice?.id ?? null
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTransactionStatus(context.currentMembership)) {
    return NextResponse.json({ error: "Only admins can update transaction status." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json()) as { status?: string };
  const status = body.status;

  if (!status) {
    return NextResponse.json({ error: "Status is required." }, { status: 400 });
  }

  if (!isOfficeTransactionStatus(status)) {
    return NextResponse.json({ error: "Unsupported transaction status." }, { status: 400 });
  }

  const transaction = await updateTransactionStatus({
    organizationId: context.currentOrganization.id,
    transactionId,
    status: status as OfficeTransactionStatus,
    actorMembershipId: context.currentMembership.id
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}
