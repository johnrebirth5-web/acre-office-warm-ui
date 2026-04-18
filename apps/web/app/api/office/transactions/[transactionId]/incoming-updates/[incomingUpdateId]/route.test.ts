import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleReviewOfficeIncomingUpdatePatch } from "./route";

function createIncomingUpdateReviewRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/incoming-updates/update_1`,
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
      permissions: ["incoming_updates.review"],
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

test("handleReviewOfficeIncomingUpdatePatch returns 400 validation_error for unsupported review actions", async () => {
  const response = await handleReviewOfficeIncomingUpdatePatch(
    createIncomingUpdateReviewRequest(
      JSON.stringify({
        action: "archive",
      }),
    ),
    "transaction_1",
    "update_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Incoming update review payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "A valid review action is required.",
    },
  });
});

test("handleReviewOfficeIncomingUpdatePatch preserves successful review and 404 behavior", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const successResponse = await handleReviewOfficeIncomingUpdatePatch(
    createIncomingUpdateReviewRequest(
      JSON.stringify({
        action: "accept",
      }),
    ),
    "transaction_1",
    "update_1",
    createSessionContext(),
    {
      reviewIncomingUpdate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "update_1", status: "accepted" } as never;
      },
    },
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    incomingUpdateId: "update_1",
    actorMembershipId: "membership_1",
    action: "accept",
  });
  assert.deepEqual(await readJson(successResponse), {
    incomingUpdate: {
      id: "update_1",
      status: "accepted",
    },
  });
});
