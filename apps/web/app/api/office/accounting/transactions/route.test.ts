import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAccountingTransactionPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/transactions`, {
    method: "POST",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "office_admin", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateAccountingTransactionPost returns 400 validation_error for invalid paymentMethod", async () => {
  const response = await handleCreateAccountingTransactionPost(
    createRequest(
      JSON.stringify({
        type: "invoice",
        status: "draft",
        paymentMethod: "venmo"
      })
    ),
    createContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Accounting transaction payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      paymentMethod:
        "Invalid option: expected one of \"ach\"|\"check\"|\"wire\"|\"cash\"|\"internal_transfer\"|\"other\""
    }
  });
});

test("handleCreateAccountingTransactionPost forwards normalized payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateAccountingTransactionPost(
    createRequest(
      JSON.stringify({
        type: "invoice",
        status: "open",
        accountingDate: "2026-04-18",
        totalAmount: "1250.00",
        lineItems: [
          { ledgerAccountId: "acct_1", description: "Commission", amount: "1250.00", entrySide: "credit" }
        ]
      })
    ),
    createContext(),
    {
      createAccountingTransaction: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "txn_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    type: "invoice",
    status: "open",
    accountingDate: "2026-04-18",
    dueDate: "",
    paymentMethod: "",
    referenceNumber: "",
    counterpartyName: "",
    memo: "",
    notes: "",
    totalAmount: "1250.00",
    relatedTransactionId: "",
    relatedMembershipId: "",
    lineItems: [
      {
        id: undefined,
        ledgerAccountId: "acct_1",
        description: "Commission",
        amount: "1250.00",
        entrySide: "credit"
      }
    ],
    createdByMembershipId: "membership_actor",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), { transaction: { id: "txn_1" } });
});
