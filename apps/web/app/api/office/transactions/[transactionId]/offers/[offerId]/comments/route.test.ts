import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeOfferCommentPost } from "./route";

function createOfficeOfferCommentRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/offers/offer_1/comments`,
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
      permissions: ["offers.comment"],
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

test("handleCreateOfficeOfferCommentPost returns 400 validation_error when comment body is blank", async () => {
  const response = await handleCreateOfficeOfferCommentPost(
    createOfficeOfferCommentRequest(
      JSON.stringify({
        body: "   ",
      }),
    ),
    "transaction_1",
    "offer_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Offer comment payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      body: "Comment body is required.",
    },
  });
});

test("handleCreateOfficeOfferCommentPost forwards normalized comment input and preserves 201 response", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeOfferCommentPost(
    createOfficeOfferCommentRequest(
      JSON.stringify({
        body: "Need updated proof of funds.",
      }),
    ),
    "transaction_1",
    "offer_1",
    createSessionContext(),
    {
      createOfferComment: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "comment_1",
          body: "Need updated proof of funds.",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    offerId: "offer_1",
    actorMembershipId: "membership_1",
    body: "Need updated proof of funds.",
  });
  assert.deepEqual(await readJson(response), {
    comment: {
      id: "comment_1",
      body: "Need updated proof of funds.",
    },
  });
});
