import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeTransactionFormPost } from "./route";

function createOfficeTransactionFormRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/transactions/transaction_1/forms`, {
    method: "POST",
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
      permissions: ["forms.use", "documents.manage"],
      role: "office_manager",
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

test("handleCreateOfficeTransactionFormPost returns 400 validation_error when templateId is missing", async () => {
  const response = await handleCreateOfficeTransactionFormPost(
    createOfficeTransactionFormRequest(
      JSON.stringify({
        templateId: "   ",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction form payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      templateId: "Template is required.",
    },
  });
});

test("handleCreateOfficeTransactionFormPost creates generated document and form with normalized draft data", async () => {
  let capturedDraftInput: Record<string, unknown> | null = null;
  let capturedFileInput: Record<string, unknown> | null = null;
  let capturedFormInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeTransactionFormPost(
    createOfficeTransactionFormRequest(
      JSON.stringify({
        templateId: "template_1",
        linkedTaskId: "task_1",
        offerId: "offer_1",
        name: "Buyer disclosure",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      prepareTransactionFormDraft: async (input) => {
        capturedDraftInput = input as Record<string, unknown>;
        return {
          templateId: "template_1",
          linkedTaskId: "task_1",
          offerId: "offer_1",
          name: "Buyer disclosure",
          generatedPayload: {
            buyerName: "Acre Buyer",
          },
          documentType: "Disclosure",
        } as never;
      },
      saveStoredTextDocument: async (input) => {
        capturedFileInput = input as Record<string, unknown>;
        return {
          fileName: "buyer-disclosure.json",
          fileSizeBytes: 42,
          storageKey: "documents/form_1.json",
        } as never;
      },
      createTransactionForm: async (input) => {
        capturedFormInput = input as Record<string, unknown>;
        return {
          id: "form_1",
          name: "Buyer disclosure",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedDraftInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    templateId: "template_1",
    linkedTaskId: "task_1",
    offerId: "offer_1",
    name: "Buyer disclosure",
  });
  assert.deepEqual(capturedFileInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    fileName: "Buyer-disclosure.json",
    content: JSON.stringify(
      {
        buyerName: "Acre Buyer",
      },
      null,
      2,
    ),
  });
  assert.deepEqual(capturedFormInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    templateId: "template_1",
    linkedTaskId: "task_1",
    offerId: "offer_1",
    name: "Buyer disclosure",
    generatedPayload: {
      buyerName: "Acre Buyer",
    },
    generatedDocument: {
      title: "Buyer disclosure document",
      fileName: "buyer-disclosure.json",
      mimeType: "application/json",
      fileSizeBytes: 42,
      storageKey: "documents/form_1.json",
      documentType: "Disclosure",
    },
  });
  assert.deepEqual(await readJson(response), {
    form: {
      id: "form_1",
      name: "Buyer disclosure",
    },
  });
});
