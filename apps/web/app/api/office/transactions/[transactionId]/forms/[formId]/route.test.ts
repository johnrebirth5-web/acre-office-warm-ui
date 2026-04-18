import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionFormPatch } from "./route";

function createOfficeTransactionFormUpdateRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/forms/form_1`,
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
      permissions: ["forms.use"],
      role: "office_manager",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionFormPatch returns 400 validation_error for unsupported form statuses", async () => {
  const response = await handleUpdateOfficeTransactionFormPatch(
    createOfficeTransactionFormUpdateRequest(
      JSON.stringify({
        status: "archived",
      }),
    ),
    "transaction_1",
    "form_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction form update payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status: "A supported form status is required.",
    },
  });
});

test("handleUpdateOfficeTransactionFormPatch forwards normalized form update fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionFormPatch(
    createOfficeTransactionFormUpdateRequest(
      JSON.stringify({
        name: "Updated disclosure",
        linkedTaskId: null,
        offerId: "offer_2",
        generatedPayload: {
          buyerName: "Updated Buyer",
        },
        status: "prepared",
      }),
    ),
    "transaction_1",
    "form_1",
    createSessionContext(),
    {
      updateTransactionForm: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "form_1",
          name: "Updated disclosure",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    formId: "form_1",
    actorMembershipId: "membership_1",
    name: "Updated disclosure",
    linkedTaskId: undefined,
    offerId: "offer_2",
    generatedPayload: {
      buyerName: "Updated Buyer",
    },
    status: "prepared",
  });
  assert.deepEqual(await readJson(response), {
    form: {
      id: "form_1",
      name: "Updated disclosure",
    },
  });
});
