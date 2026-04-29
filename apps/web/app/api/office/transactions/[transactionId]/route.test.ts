import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleDeleteOfficeTransactionDelete, handleUpdateOfficeTransactionPatch } from "./route";

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
    currentUser: {
      email: "admin@example.com",
      firstName: "Office",
      lastName: "Admin",
    },
    currentMembership: {
      id: "membership_1",
      permissions: ["transactions.manage"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: {
      id: "office_1",
    },
  } as never;
}

function createTransactionDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "transaction_1",
    title: "Primary residence",
    address: "123 Main St",
    city: "Queens",
    state: "NY",
    status: "Pending",
    statusValue: "pending",
    ownerName: "Ada Agent",
    ownerEmail: "agent@example.com",
    officeName: "Acre NY Realty",
    ...overrides,
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
      getTransactionById: async () => null,
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

test("handleUpdateOfficeTransactionPatch sends a reminder when a transaction first closes", async () => {
  let capturedEmailInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionPatch(
    createOfficeTransactionRequest(
      JSON.stringify({
        status: "Closed",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      getTransactionById: async () => createTransactionDetail({ status: "Pending", statusValue: "pending" }),
      updateTransactionStatus: async () =>
        createTransactionDetail({
          status: "Closed",
          statusValue: "closed",
        }),
      sendTransactionClosedOperationalEmail: async (input) => {
        capturedEmailInput = input as unknown as Record<string, unknown>;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(capturedEmailInput?.["organizationId"], "org_1");
  assert.equal(capturedEmailInput?.["baseUrl"], "http://localhost:3105");
  assert.equal(capturedEmailInput?.["actorName"], "Office Admin");
  assert.equal(capturedEmailInput?.["actorEmail"], "admin@example.com");
  assert.deepEqual(await readJson(response), {
    transaction: {
      id: "transaction_1",
      title: "Primary residence",
      address: "123 Main St",
      city: "Queens",
      state: "NY",
      status: "Closed",
      statusValue: "closed",
      ownerName: "Ada Agent",
      ownerEmail: "agent@example.com",
      officeName: "Acre NY Realty",
    },
  });
});

test("handleUpdateOfficeTransactionPatch does not resend when an already closed transaction is saved", async () => {
  let sendCount = 0;

  const response = await handleUpdateOfficeTransactionPatch(
    createOfficeTransactionRequest(
      JSON.stringify({
        status: "Closed",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      getTransactionById: async () => createTransactionDetail({ status: "Closed", statusValue: "closed" }),
      updateTransactionStatus: async () =>
        createTransactionDetail({
          status: "Closed",
          statusValue: "closed",
        }),
      sendTransactionClosedOperationalEmail: async () => {
        sendCount += 1;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(sendCount, 0);
});

test("handleDeleteOfficeTransactionDelete returns 404 when the transaction cannot be removed", async () => {
  const response = await handleDeleteOfficeTransactionDelete(createSessionContext(), "transaction_missing", {
    deleteTransaction: async () => null,
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Transaction not found.",
  });
});

test("handleDeleteOfficeTransactionDelete forwards delete scope and cleans up stored files", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const deletedStorageKeys: string[] = [];

  const response = await handleDeleteOfficeTransactionDelete(createSessionContext(), "transaction_1", {
    deleteTransaction: async (input) => {
      capturedInput = input as Record<string, unknown>;
      return {
        id: "transaction_1",
        title: "Primary residence",
        storageKeys: ["transactions/documents/doc_1.pdf", "transactions/signatures/artifact_1.pdf"],
      };
    },
    deleteStoredFile: async (storageKey) => {
      deletedStorageKeys.push(storageKey);
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
  });
  assert.deepEqual(deletedStorageKeys, [
    "transactions/documents/doc_1.pdf",
    "transactions/signatures/artifact_1.pdf",
  ]);
  assert.deepEqual(await readJson(response), {
    transactionId: "transaction_1",
  });
});
