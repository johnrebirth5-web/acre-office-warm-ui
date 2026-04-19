import { canManageOfficeAccounting } from "@acre/auth";
import { createAccountingTransaction, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { saveAccountingTransactionBodySchema } from "./route.schema";

function normalizeLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;

    return [
      {
        id: typeof record.id === "string" ? record.id : undefined,
        ledgerAccountId: typeof record.ledgerAccountId === "string" ? record.ledgerAccountId : "",
        description: typeof record.description === "string" ? record.description : "",
        amount: typeof record.amount === "string" ? record.amount : "",
        entrySide: typeof record.entrySide === "string" ? record.entrySide : ""
      }
    ];
  });
}

type AccountingTransactionsRouteDependencies = {
  createAccountingTransaction?: typeof createAccountingTransaction;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateAccountingTransactionPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AccountingTransactionsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    saveAccountingTransactionBodySchema,
    {
      error: "Accounting transaction payload is invalid.",
      invalidJsonError: "Accounting transaction request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const transaction = await (
      dependencies.createAccountingTransaction ?? createAccountingTransaction
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      type: body.type ?? "",
      status: body.status ?? "",
      accountingDate: body.accountingDate ?? "",
      dueDate: body.dueDate ?? "",
      paymentMethod: body.paymentMethod ?? "",
      referenceNumber: body.referenceNumber ?? "",
      counterpartyName: body.counterpartyName ?? "",
      memo: body.memo ?? "",
      notes: body.notes ?? "",
      totalAmount: body.totalAmount ?? "",
      relatedTransactionId: body.relatedTransactionId ?? "",
      relatedMembershipId: body.relatedMembershipId ?? "",
      lineItems: normalizeLineItems(body.lineItems),
      createdByMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create accounting transaction." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  return handleCreateAccountingTransactionPost(request, context);
}
