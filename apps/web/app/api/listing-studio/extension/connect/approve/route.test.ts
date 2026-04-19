import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleListingStudioExtensionApprovePost } from "./route";

function createListingStudioExtensionApproveRequest(
  origin = "http://localhost:3105",
  challengeToken = "ls_chal_123",
) {
  return new NextRequest(
    `${origin}/api/listing-studio/extension/connect/approve`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-forwarded-for": "203.0.113.7",
      },
      body: JSON.stringify({ challengeToken }),
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

test("handleListingStudioExtensionApprovePost returns 429 when approval is rate limited", async () => {
  const response = await handleListingStudioExtensionApprovePost(
    createListingStudioExtensionApproveRequest(),
    {
      getRequestSessionContext: async () => createListingStudioSessionContext(),
      rateLimit: async () => ({
        allowed: false,
        limit: 20,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(await response.json(), {
    error: "Too many extension approval attempts. Please try again in a moment.",
  });
});

test("handleListingStudioExtensionApprovePost returns the approval payload on success", async () => {
  const response = await handleListingStudioExtensionApprovePost(
    createListingStudioExtensionApproveRequest(),
    {
      getRequestSessionContext: async () => createListingStudioSessionContext(),
      rateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
      approveStudioListingExtensionChallenge: async () =>
        ({ status: "approved" }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "approved",
  });
});
