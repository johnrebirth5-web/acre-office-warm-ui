import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeOfferPatch } from "./route";

function createOfficeOfferRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/offers/offer_1`,
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
      role: "owner",
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

test("handleUpdateOfficeOfferPatch returns 400 validation_error for unsupported offer actions", async () => {
  const response = await handleUpdateOfficeOfferPatch(
    createOfficeOfferRequest(
      JSON.stringify({
        action: "archive",
      }),
    ),
    "transaction_1",
    "offer_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Offer update payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "A valid offer action is required.",
    },
  });
});

test("handleUpdateOfficeOfferPatch forwards transition actions to transitionOfferStatus", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeOfferPatch(
    createOfficeOfferRequest(
      JSON.stringify({
        action: "accept",
      }),
    ),
    "transaction_1",
    "offer_1",
    createSessionContext(),
    {
      transitionOfferStatus: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "offer_1",
          statusValue: "accepted",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    offerId: "offer_1",
    actorMembershipId: "membership_1",
    action: "accept",
  });
  assert.deepEqual(await readJson(response), {
    offer: {
      id: "offer_1",
      statusValue: "accepted",
    },
  });
});

test("handleUpdateOfficeOfferPatch forwards normalized field updates and preserves primary-offer flag", async () => {
  let capturedPayload: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeOfferPatch(
    createOfficeOfferRequest(
      JSON.stringify({
        title: "Final counter",
        offeringPartyName: "Buyer LLC",
        isPrimaryOffer: true,
      }),
    ),
    "transaction_1",
    "offer_1",
    createSessionContext(),
    {
      getOfficeOfferFieldSchema: async () => ({ sections: [] }) as never,
      listTransactionOffersSnapshot: async () =>
        ({
          offers: [{ id: "offer_1", title: "Existing offer" }],
        }) as never,
      prepareOfferFieldSubmission: () =>
        ({
          title: "Final counter",
          offeringPartyName: "Buyer LLC",
          buyerName: "",
          price: "950000",
          earnestMoneyAmount: "",
          financingType: "",
          closingDateOffered: "",
          expirationAt: "",
          notes: "",
          additionalFields: {},
        }) as never,
      updateOffer: async (input) => {
        capturedPayload = input as Record<string, unknown>;
        return {
          id: "offer_1",
          title: "Final counter",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedPayload, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    offerId: "offer_1",
    actorMembershipId: "membership_1",
    title: "Final counter",
    offeringPartyName: "Buyer LLC",
    buyerName: "",
    price: "950000",
    earnestMoneyAmount: "",
    financingType: "",
    closingDateOffered: "",
    expirationAt: "",
    isPrimaryOffer: true,
    notes: "",
    additionalFields: {},
  });
  assert.deepEqual(await readJson(response), {
    offer: {
      id: "offer_1",
      title: "Final counter",
    },
  });
});
