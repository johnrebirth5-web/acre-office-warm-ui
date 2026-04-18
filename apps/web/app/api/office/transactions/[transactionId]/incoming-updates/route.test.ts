import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeIncomingUpdatePost } from "./route";

function createIncomingUpdateRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/incoming-updates`,
    {
      method: "POST",
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
      permissions: ["incoming_updates.review"],
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

test("handleCreateOfficeIncomingUpdatePost returns 400 validation_error when required source fields are missing", async () => {
  const response = await handleCreateOfficeIncomingUpdatePost(
    createIncomingUpdateRequest(
      JSON.stringify({
        sourceSystem: "",
        sourceReference: "   ",
        summary: "",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Incoming update payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      sourceSystem: "Source system is required.",
      sourceReference: "Source reference is required.",
      summary: "Summary is required.",
    },
  });
});

test("handleCreateOfficeIncomingUpdatePost forwards normalized incoming update payloads and preserves 201 response", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeIncomingUpdatePost(
    createIncomingUpdateRequest(
      JSON.stringify({
        sourceSystem: "Manual test feed",
        sourceReference: "folio-123",
        summary: "Closing date changed",
        payload: {
          closingDate: "2026-03-25",
        },
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      createIncomingUpdate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "update_1",
          summary: "Closing date changed",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    sourceSystem: "Manual test feed",
    sourceReference: "folio-123",
    summary: "Closing date changed",
    payload: {
      closingDate: "2026-03-25",
    },
  });
  assert.deepEqual(await readJson(response), {
    incomingUpdate: {
      id: "update_1",
      summary: "Closing date changed",
    },
  });
});
