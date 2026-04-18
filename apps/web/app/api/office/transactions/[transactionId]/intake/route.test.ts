import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionIntakePatch } from "./route";

function createTransactionIntakeRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/intake`,
    {
      method: "PATCH",
      body,
      headers: {
        origin,
        "content-type": "application/json",
      },
    },
  );
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["transactions:view", "transactions:edit", "transactions:close"],
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

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionIntakePatch returns 400 validation_error for unsupported transaction statuses", async () => {
  const response = await handleUpdateOfficeTransactionIntakePatch(
    createTransactionIntakeRequest(
      JSON.stringify({
        transactionStatus: "Archived",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      getTransactionById: async () => ({ statusValue: "Pending" }) as never,
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction intake payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      transactionStatus: "Unsupported transaction status.",
    },
  });
});

test("handleUpdateOfficeTransactionIntakePatch forwards normalized intake payloads", async () => {
  let capturedPrepareInput: Record<string, unknown> | null = null;
  let capturedUpdateInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionIntakePatch(
    createTransactionIntakeRequest(
      JSON.stringify({
        transactionStatus: "Closed",
        address: "123 Main St",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      getTransactionById: async () =>
        ({
          id: "transaction_1",
          statusValue: "Pending",
        }) as never,
      getOfficeTransactionIntakeSchema: async () =>
        ({
          builtInFields: [],
          customFields: [],
        }) as never,
      prepareTransactionIntakeSubmission: (input) => {
        capturedPrepareInput = input as Record<string, unknown>;
        return {
          transactionType: "Sales",
          transactionStatus: "Closed",
          representing: "Buyer",
          address: "123 Main St",
          city: "",
          state: "",
          zipCode: "",
          transactionName: "123 Main St",
          askingPrice: "",
          purchasedPrice: "",
          price: "",
          buyerAgreementDate: "",
          buyerExpirationDate: "",
          acceptanceDate: "",
          listingDate: "",
          listingExpirationDate: "",
          closingDate: "",
          moveInDate: "",
          additionalFields: {},
        } as never;
      },
      updateTransactionIntake: async (input) => {
        capturedUpdateInput = input as Record<string, unknown>;
        return {
          id: "transaction_1",
          status: "Closed",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedPrepareInput, {
    schema: {
      builtInFields: [],
      customFields: [],
    },
    payload: {
      transactionStatus: "Closed",
      address: "123 Main St",
    },
    existingTransaction: {
      id: "transaction_1",
      statusValue: "Pending",
    },
  });
  assert.deepEqual(capturedUpdateInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    transactionType: "Sales",
    transactionStatus: "Closed",
    representing: "Buyer",
    address: "123 Main St",
    city: "",
    state: "",
    zipCode: "",
    transactionName: "123 Main St",
    askingPrice: "",
    purchasedPrice: "",
    price: "",
    buyerAgreementDate: "",
    buyerExpirationDate: "",
    acceptanceDate: "",
    listingDate: "",
    listingExpirationDate: "",
    closingDate: "",
    moveInDate: "",
    additionalFields: {},
  });
  assert.deepEqual(await readJson(response), {
    transaction: {
      id: "transaction_1",
      status: "Closed",
    },
  });
});
