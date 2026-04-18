import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeOfferPost } from "./route";

function createOfficeOfferRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/offers`,
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
      permissions: ["offers:create"],
      role: "office_user",
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

test("handleCreateOfficeOfferPost returns 400 validation_error when request body is not valid JSON", async () => {
  const response = await handleCreateOfficeOfferPost(
    createOfficeOfferRequest("{"),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Offer request body must be valid JSON.",
    errorCode: "validation_error",
    fieldErrors: {
      body: "Offer request body must be valid JSON.",
    },
  });
});

test("handleCreateOfficeOfferPost forwards normalized offer payloads", async () => {
  let capturedPrepareInput: Record<string, unknown> | null = null;
  let capturedCreateInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeOfferPost(
    createOfficeOfferRequest(
      JSON.stringify({
        title: "Best and final",
        offeringPartyName: "Buyer LLC",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      getOfficeOfferFieldSchema: async () => ({ sections: [] }) as never,
      prepareOfferFieldSubmission: (input) => {
        capturedPrepareInput = input as Record<string, unknown>;
        return {
          title: "Best and final",
          offeringPartyName: "Buyer LLC",
          buyerName: "Acre Buyer",
          price: "925000",
          earnestMoneyAmount: "",
          financingType: "Cash",
          closingDateOffered: "",
          expirationAt: "",
          notes: "",
          additionalFields: {},
        } as never;
      },
      createOffer: async (input) => {
        capturedCreateInput = input as Record<string, unknown>;
        return {
          id: "offer_1",
          title: "Best and final",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedPrepareInput, {
    schema: {
      sections: [],
    },
    payload: {
      title: "Best and final",
      offeringPartyName: "Buyer LLC",
    },
  });
  assert.deepEqual(capturedCreateInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    title: "Best and final",
    offeringPartyName: "Buyer LLC",
    buyerName: "Acre Buyer",
    price: "925000",
    earnestMoneyAmount: "",
    financingType: "Cash",
    closingDateOffered: "",
    expirationAt: "",
    notes: "",
    additionalFields: {},
  });
  assert.deepEqual(await readJson(response), {
    offer: {
      id: "offer_1",
      title: "Best and final",
    },
  });
});
