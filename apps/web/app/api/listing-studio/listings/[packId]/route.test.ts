import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateStudioListingPackPatch } from "./route";

function createPatchRequest(
  body: Record<string, unknown>,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/listing-studio/listings/pack_123`, {
    method: "PATCH",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createSessionContext(permissions: string[]) {
  return {
    currentMembership: {
      id: "membership_1",
      permissions,
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

test("handleUpdateStudioListingPackPatch rejects company dashboard visibility changes without company manage access", async () => {
  const response = await handleUpdateStudioListingPackPatch(
    createPatchRequest({
      companyFeedVisible: true,
      companyFeedLabel: "Acre Exclusive",
    }),
    "pack_123",
    {
      getRequestSessionContext: async () =>
        createSessionContext([
          "listing_studio:view",
          "listing_studio:create",
          "listing_studio:edit",
        ]),
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Listing Studio company feed manage access required.",
  });
});

test("handleUpdateStudioListingPackPatch forwards company dashboard visibility for managers", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateStudioListingPackPatch(
    createPatchRequest({
      headline: "Updated headline",
      companyFeedVisible: false,
      companyFeedLabel: "Acre Exclusive",
    }),
    "pack_123",
    {
      getRequestSessionContext: async () =>
        createSessionContext([
          "listing_studio:view",
          "listing_studio:create",
          "listing_studio:edit",
          "listing_studio:company_manage",
        ]),
      updateStudioListingPack: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          packId: "pack_123",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["organizationId"], "org_1");
  assert.equal(capturedInput?.["membershipId"], "membership_1");
  assert.equal(capturedInput?.["packId"], "pack_123");
  assert.equal(capturedInput?.["headline"], "Updated headline");
  assert.equal(capturedInput?.["companyFeedVisible"], false);
  assert.equal(capturedInput?.["companyFeedLabel"], "Acre Exclusive");
  assert.deepEqual(await response.json(), {
    packId: "pack_123",
  });
});
