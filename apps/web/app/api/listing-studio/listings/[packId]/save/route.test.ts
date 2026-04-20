import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveStudioListingPackPost } from "./route";

function createSaveRequest(origin = "http://localhost:3105") {
  return new NextRequest(
    `${origin}/api/listing-studio/listings/pack_123/save`,
    {
      method: "POST",
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
      permissions: ["listing_studio:view"],
      role: "agent",
    },
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: {
      id: "office_1",
    },
  } as never;
}

test("handleSaveStudioListingPackPost returns 404 when the company listing cannot be saved", async () => {
  const response = await handleSaveStudioListingPackPost(
    createSaveRequest(),
    "pack_123",
    {
      getRequestSessionContext: async () => createSessionContext(),
      saveStudioListingPackToMyListings: async () => null,
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Company dashboard listing not found.",
  });
});

test("handleSaveStudioListingPackPost forwards organization and membership scope", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleSaveStudioListingPackPost(
    createSaveRequest(),
    "pack_123",
    {
      getRequestSessionContext: async () => createSessionContext(),
      saveStudioListingPackToMyListings: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          saved: true,
          alreadySaved: false,
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    membershipId: "membership_1",
    packId: "pack_123",
  });
  assert.deepEqual(await response.json(), {
    saved: true,
    alreadySaved: false,
  });
});
