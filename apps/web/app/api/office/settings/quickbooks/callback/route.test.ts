import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createQuickBooksOAuthState } from "../../../../../../lib/quickbooks-oauth-state";
import { handleQuickBooksCallbackGet } from "./route";

function createCallbackRequest(searchParams: URLSearchParams, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/quickbooks/callback?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      origin,
    },
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

test("handleQuickBooksCallbackGet persists OAuth callback values", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const state = createQuickBooksOAuthState({
    organizationId: "org_1",
    membershipId: "membership_1",
  });
  const response = await handleQuickBooksCallbackGet(
    createCallbackRequest(
      new URLSearchParams({
        code: "auth_code_1",
        realmId: "1234567890",
        state,
      }),
    ),
    createSessionContext(),
    {
      connectOrganizationQuickBooksConnection: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "quickbooks_1" } as never;
      },
    },
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3105/office/settings/quickbooks?quickbooks=connected",
  );
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    code: "auth_code_1",
    realmId: "1234567890",
    redirectUri: "http://localhost:3105/api/office/settings/quickbooks/callback",
  });
});

test("handleQuickBooksCallbackGet rejects state for another membership", async () => {
  const state = createQuickBooksOAuthState({
    organizationId: "org_1",
    membershipId: "membership_2",
  });
  const response = await handleQuickBooksCallbackGet(
    createCallbackRequest(
      new URLSearchParams({
        code: "auth_code_1",
        realmId: "1234567890",
        state,
      }),
    ),
    createSessionContext(),
  );
  const location = response.headers.get("location") ?? "";
  const redirectedUrl = new URL(location);

  assert.equal(response.status, 307);
  assert.equal(redirectedUrl.origin, "http://localhost:3105");
  assert.equal(redirectedUrl.pathname, "/office/settings/quickbooks");
  assert.equal(redirectedUrl.searchParams.get("quickbooks"), "error");
  assert.match(redirectedUrl.searchParams.get("message") ?? "", /does not match the current session/);
});
