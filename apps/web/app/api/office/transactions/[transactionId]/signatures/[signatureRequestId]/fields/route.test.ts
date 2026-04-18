import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleReplaceOfficeSignatureFieldsPut } from "./route";

function createOfficeSignatureFieldsRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/signatures/sig_1/fields`,
    {
      method: "PUT",
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
      permissions: ["signatures:manage"],
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

test("handleReplaceOfficeSignatureFieldsPut returns 400 validation_error when fields are missing", async () => {
  const response = await handleReplaceOfficeSignatureFieldsPut(
    createOfficeSignatureFieldsRequest(JSON.stringify({})),
    "transaction_1",
    "sig_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Signature fields payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      fields: "A fields array is required.",
    },
  });
});

test("handleReplaceOfficeSignatureFieldsPut returns 400 validation_error for invalid field types", async () => {
  const response = await handleReplaceOfficeSignatureFieldsPut(
    createOfficeSignatureFieldsRequest(
      JSON.stringify({
        fields: [
          {
            fieldType: "stamp",
          },
        ],
      }),
    ),
    "transaction_1",
    "sig_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Signature fields payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      "fields[0].fieldType": "Every signature field needs a valid field type.",
    },
  });
});

test("handleReplaceOfficeSignatureFieldsPut forwards normalized signature fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleReplaceOfficeSignatureFieldsPut(
    createOfficeSignatureFieldsRequest(
      JSON.stringify({
        fields: [
          {
            id: "field_1",
            fieldType: "signature",
            label: "  Signature  ",
            page: 2,
            x: 0.42,
            y: 0.61,
            width: 0.3,
            height: 0.08,
            required: false,
            defaultValue: "  Acre Agent ",
            fontStyle: "script",
            assignedRecipientId: " recipient_1 ",
            fieldKey: " buyer.signature ",
            isReadOnly: true,
            isSystemPrefilled: true,
            visibilityRule: { dependsOn: "field_2" },
            mirrorGroup: "buyer",
            fieldOptions: { mode: "draw" },
            sortOrder: 5,
          },
        ],
      }),
    ),
    "transaction_1",
    "sig_1",
    createSessionContext(),
    {
      replaceSignatureRequestFields: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return [
          {
            id: "field_1",
            fieldType: "signature",
          },
        ] as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    signatureRequestId: "sig_1",
    actorMembershipId: "membership_1",
    fields: [
      {
        id: "field_1",
        assignedRecipientId: "recipient_1",
        fieldType: "signature",
        label: "Signature",
        page: 2,
        x: 0.42,
        y: 0.61,
        width: 0.3,
        height: 0.08,
        required: false,
        defaultValue: "  Acre Agent ",
        fontStyle: "script",
        fieldKey: " buyer.signature ",
        isReadOnly: true,
        isSystemPrefilled: true,
        visibilityRule: { dependsOn: "field_2" },
        mirrorGroup: "buyer",
        fieldOptions: { mode: "draw" },
        sortOrder: 5,
      },
    ],
  });
  assert.deepEqual(await readJson(response), {
    fields: [
      {
        id: "field_1",
        fieldType: "signature",
      },
    ],
  });
});
