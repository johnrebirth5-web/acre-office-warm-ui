import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAccountingTransactionPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/transactions/txn_1`, {
    method: "PATCH",
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

test("handleUpdateAccountingTransactionPatch returns 400 validation_error for invalid line item side", async () => {
  const response = await handleUpdateAccountingTransactionPatch(
    createRequest(JSON.stringify({ lineItems: [{ entrySide: "left" }] })),
    createContext(),
    "txn_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Accounting transaction payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      "lineItems[0].entrySide": "Invalid option: expected one of \"debit\"|\"credit\""
    }
  });
});

test("handleUpdateAccountingTransactionPatch returns 404 when service cannot find transaction", async () => {
  const response = await handleUpdateAccountingTransactionPatch(
    createRequest(JSON.stringify({ status: "posted" })),
    createContext(),
    "txn_1",
    {
      updateAccountingTransaction: async () => null
    }
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Accounting transaction not found."
  });
});
