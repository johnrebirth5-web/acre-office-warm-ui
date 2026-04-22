import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleListingStudioExtensionSessionPost } from "./route";

function createListingStudioExtensionSessionRequest(
  origin = "http://localhost:3105",
  extensionToken = "ls_ext_123",
) {
  return new NextRequest(
    `${origin}/api/listing-studio/extension/connect/session`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
      },
      body: JSON.stringify({ extensionToken }),
    },
  );
}

function createListingStudioSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["listing_studio:view", "listing_studio:create"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
      name: "Acre",
      slug: "acre",
      timezone: "America/New_York",
    },
    currentOffice: {
      id: "office_1",
      name: "New York",
      slug: "new-york",
      market: "New York",
    },
  } as never;
}

test("handleListingStudioExtensionSessionPost rejects unauthenticated requests", async () => {
  const response = await handleListingStudioExtensionSessionPost(
    createListingStudioExtensionSessionRequest(),
    {
      getRequestSessionContext: async () => null,
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
});

test("handleListingStudioExtensionSessionPost reports a matching browser token", async () => {
  const response = await handleListingStudioExtensionSessionPost(
    createListingStudioExtensionSessionRequest(),
    {
      getRequestSessionContext: async () => createListingStudioSessionContext(),
      getStudioListingExtensionTokenOwner: async () =>
        ({
          organizationId: "org_1",
          officeId: "office_1",
          membershipId: "membership_1",
          membershipLabel: "Admin User",
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tokenValid: true,
    matchesCurrentMembership: true,
    currentMembershipId: "membership_1",
    tokenMembershipId: "membership_1",
    tokenMembershipLabel: "Admin User",
  });
});

test("handleListingStudioExtensionSessionPost flags a mismatched browser token", async () => {
  const response = await handleListingStudioExtensionSessionPost(
    createListingStudioExtensionSessionRequest(),
    {
      getRequestSessionContext: async () => createListingStudioSessionContext(),
      getStudioListingExtensionTokenOwner: async () =>
        ({
          organizationId: "org_1",
          officeId: "office_1",
          membershipId: "membership_admin",
          membershipLabel: "Office Admin",
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tokenValid: true,
    matchesCurrentMembership: false,
    currentMembershipId: "membership_1",
    tokenMembershipId: "membership_admin",
    tokenMembershipLabel: "Office Admin",
  });
});
