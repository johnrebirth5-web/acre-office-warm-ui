import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionDocumentPatch } from "./route";

function createOfficeTransactionDocumentRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/documents/document_1`,
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
      permissions: ["documents:manage"],
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

test("handleUpdateOfficeTransactionDocumentPatch returns 400 validation_error for unsupported document statuses", async () => {
  const response = await handleUpdateOfficeTransactionDocumentPatch(
    createOfficeTransactionDocumentRequest(
      JSON.stringify({
        status: "pending_signature",
      }),
    ),
    "transaction_1",
    "document_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction document payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status: "A supported document status is required.",
    },
  });
});

test("handleUpdateOfficeTransactionDocumentPatch forwards normalized document updates", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionDocumentPatch(
    createOfficeTransactionDocumentRequest(
      JSON.stringify({
        title: "Updated disclosure",
        status: "approved",
        linkedTaskId: null,
        offerId: "offer_2",
        isRequired: true,
        isUnsorted: false,
      }),
    ),
    "transaction_1",
    "document_1",
    createSessionContext(),
    {
      updateTransactionDocument: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "document_1",
          title: "Updated disclosure",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    documentId: "document_1",
    actorMembershipId: "membership_1",
    title: "Updated disclosure",
    documentType: undefined,
    status: "approved",
    isRequired: true,
    isUnsorted: false,
    linkedTaskId: undefined,
    offerId: "offer_2",
  });
  assert.deepEqual(await readJson(response), {
    document: {
      id: "document_1",
      title: "Updated disclosure",
    },
  });
});
