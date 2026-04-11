import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSignatureRequestPatch } from "./route";

function createPatchRequest(
  body: Record<string, unknown>,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/tx_1/signatures/sig_1`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: {
        origin,
        "content-type": "application/json",
      },
    },
  );
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function allowSignatureAccess(
  _request: NextRequest,
  _canAccess: unknown,
  handler: (context: ReturnType<typeof createSessionContext>) => Promise<Response> | Response,
) {
  return handler(createSessionContext());
}

function createSessionContext() {
  return {
    currentOrganization: {
      id: "org_1",
    },
    currentMembership: {
      id: "membership_1",
      role: "office_admin",
      permissions: ["signatures:manage"],
    },
    currentUser: {
      email: "agent@example.com",
      firstName: "Acre",
      lastName: "Agent",
    },
  } as never;
}

test("handleSignatureRequestPatch returns 403 when csrf validation fails", async () => {
  const response = await handleSignatureRequestPatch(
    createPatchRequest({ action: "send" }),
    {
      transactionId: "tx_1",
      signatureRequestId: "sig_1",
    },
    {
      csrf: () => false,
    },
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await readJson(response), {
    error: "CSRF validation failed.",
  });
});

test("handleSignatureRequestPatch returns 400 when the action is invalid", async () => {
  const response = await handleSignatureRequestPatch(
    createPatchRequest({ action: "bad_action" }),
    {
      transactionId: "tx_1",
      signatureRequestId: "sig_1",
    },
    {
      csrf: () => true,
      withPermission: allowSignatureAccess as never,
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid signature action is required.",
  });
});

test("handleSignatureRequestPatch returns 429 when send is rate limited", async () => {
  const response = await handleSignatureRequestPatch(
    createPatchRequest({ action: "send" }),
    {
      transactionId: "tx_1",
      signatureRequestId: "sig_1",
    },
    {
      csrf: () => true,
      withPermission: allowSignatureAccess as never,
      rateLimit: () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 45_000,
        retryAfterSeconds: 45,
      }),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "45");
  assert.deepEqual(await readJson(response), {
    error: "Too many signature send attempts. Please try again in a moment.",
  });
});

test("handleSignatureRequestPatch bypasses rate limiting for non-send actions", async () => {
  const response = await handleSignatureRequestPatch(
    createPatchRequest({ action: "viewed" }),
    {
      transactionId: "tx_1",
      signatureRequestId: "sig_1",
    },
    {
      csrf: () => true,
      withPermission: allowSignatureAccess as never,
      rateLimit: () => {
        throw new Error("rate limit should not run");
      },
      updateSignatureRequest: async (input) =>
        ({
          id: input.signatureRequestId,
          status: input.action,
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    signatureRequest: {
      id: "sig_1",
      status: "viewed",
    },
  });
});

test("handleSignatureRequestPatch returns 404 when send cannot load the signature request", async () => {
  const response = await handleSignatureRequestPatch(
    createPatchRequest({ action: "send" }),
    {
      transactionId: "tx_1",
      signatureRequestId: "sig_1",
    },
    {
      csrf: () => true,
      withPermission: allowSignatureAccess as never,
      rateLimit: () => ({
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAt: Date.now() + 60_000,
        retryAfterSeconds: 60,
      }),
      getSignatureEditorSnapshot: async () => null,
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Signature request not found.",
  });
});
