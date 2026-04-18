import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionPatch } from "./route";

function createOfficeTransactionRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/transactions/transaction_1`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["transactions.manage"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionPatch returns 400 validation_error for unsupported statuses", async () => {
  const response = await handleUpdateOfficeTransactionPatch(
    createOfficeTransactionRequest(
      JSON.stringify({
        status: "archived",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction update payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status: "Unsupported transaction status.",
    },
  });
});

test("handleUpdateOfficeTransactionPatch forwards normalized status updates and preserves 404 behavior", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const notFoundResponse = await handleUpdateOfficeTransactionPatch(
    createOfficeTransactionRequest(
      JSON.stringify({
        status: "Closed",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      updateTransactionStatus: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return null;
      },
    },
  );

  assert.equal(notFoundResponse.status, 404);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    status: "Closed",
    actorMembershipId: "membership_1",
  });
  assert.deepEqual(await readJson(notFoundResponse), {
    error: "Transaction not found.",
  });
});
