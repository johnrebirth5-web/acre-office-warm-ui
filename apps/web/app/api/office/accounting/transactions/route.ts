import { canManageOfficeAccounting } from "@acre/auth";
import { createAccountingTransaction } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

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

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAccounting(context.currentMembership)) {
    return NextResponse.json({ error: "Accounting management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const transaction = await createAccountingTransaction({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      type: typeof body?.type === "string" ? body.type : "",
      status: typeof body?.status === "string" ? body.status : "",
      accountingDate: typeof body?.accountingDate === "string" ? body.accountingDate : "",
      dueDate: typeof body?.dueDate === "string" ? body.dueDate : "",
      paymentMethod: typeof body?.paymentMethod === "string" ? body.paymentMethod : "",
      referenceNumber: typeof body?.referenceNumber === "string" ? body.referenceNumber : "",
      counterpartyName: typeof body?.counterpartyName === "string" ? body.counterpartyName : "",
      memo: typeof body?.memo === "string" ? body.memo : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      totalAmount: typeof body?.totalAmount === "string" ? body.totalAmount : "",
      relatedTransactionId: typeof body?.relatedTransactionId === "string" ? body.relatedTransactionId : "",
      relatedMembershipId: typeof body?.relatedMembershipId === "string" ? body.relatedMembershipId : "",
      lineItems: normalizeLineItems(body?.lineItems),
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
