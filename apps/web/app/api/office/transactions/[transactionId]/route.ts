import { canDeleteOfficeTransactions, canManageOfficeTransactionStatus, canViewOfficeTransactions } from "@acre/auth";
import {
  deleteTransaction,
  getTransactionById,
  type OfficeTransactionStatus,
  type SessionMembershipContext,
  updateTransactionStatus,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile } from "../../../../../lib/document-storage";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { updateOfficeTransactionBodySchema } from "./route.schema";

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

type OfficeTransactionRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateTransactionStatus?: typeof updateTransactionStatus;
  deleteTransaction?: typeof deleteTransaction;
  deleteStoredFile?: typeof deleteStoredFile;
};

export async function handleUpdateOfficeTransactionPatch(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeTransactionBodySchema, {
    error: "Transaction update payload is invalid.",
    invalidJsonError: "Transaction update request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const transaction = await (
    dependencies.updateTransactionStatus ?? updateTransactionStatus
  )({
    organizationId: context.currentOrganization.id,
    transactionId,
    status: parsedBody.data.status as OfficeTransactionStatus,
    actorMembershipId: context.currentMembership.id
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
  return handleUpdateOfficeTransactionPatch(request, transactionId, context);
}

export async function handleDeleteOfficeTransactionDelete(
  context: SessionMembershipContext,
  transactionId: string,
  dependencies: OfficeTransactionRouteDependencies = {},
) {
  try {
    const removed = await (dependencies.deleteTransaction ?? deleteTransaction)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id
    });

    if (!removed) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    const deleteFile = dependencies.deleteStoredFile ?? deleteStoredFile;
    await Promise.allSettled(removed.storageKeys.map((storageKey) => deleteFile(storageKey)));

    return NextResponse.json({ transactionId: removed.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaction delete failed." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canDeleteOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Only admins can delete transactions." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleDeleteOfficeTransactionDelete(context, transactionId);
}
