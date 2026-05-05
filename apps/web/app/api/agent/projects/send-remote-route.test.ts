import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSendProjectRemotePost } from "./sessions/[sessionId]/send-remote/route";

function createRequest(origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/agent/projects/sessions/session_1/send-remote`, {
    method: "POST",
    headers: {
      origin,
    },
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function createSessionContext() {
  return {
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: null,
    currentMembership: {
      id: "membership_1",
      role: "agent",
      permissions: ["project_signing:manage"],
    },
  } as never;
}

function createRemoteToken(overrides: Record<string, unknown> = {}) {
  return {
    recipientId: "recipient_1",
    email: "buyer@example.com",
    name: "Buyer One",
    rawToken: "raw-token-1",
    expiresAt: new Date("2026-05-01T12:00:00.000Z"),
    ...overrides,
  } as never;
}

test("handleSendProjectRemotePost returns 401 when the request is unauthenticated", async () => {
  const response = await handleSendProjectRemotePost(createRequest(), { sessionId: "session_1" }, {
    getRequestSessionContext: async () => null,
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("handleSendProjectRemotePost sends email and returns generated remote links", async () => {
  const capturedIssueInputs: Record<string, unknown>[] = [];
  const capturedEmailInputs: Record<string, unknown>[] = [];

  const response = await handleSendProjectRemotePost(
    createRequest("https://acre.example.test"),
    { sessionId: "session_1" },
    {
      canCreateProjectSigning: () => true,
      getAppBaseUrl: () => "https://acre.example.test",
      getRequestSessionContext: async () => createSessionContext(),
      issueProjectRemoteSigningTokens: async (input) => {
        capturedIssueInputs.push(input as Record<string, unknown>);
        return [createRemoteToken()];
      },
      sendSignatureRequestEmail: async (input) => {
        capturedEmailInputs.push(input as Record<string, unknown>);
      },
    },
  );

  assert.equal(response.status, 200);
  const capturedIssueInput = capturedIssueInputs[0];
  const capturedEmailInput = capturedEmailInputs[0];
  if (!capturedIssueInput || !capturedEmailInput) {
    throw new Error("Expected issue and email inputs to be captured.");
  }
  assert.equal(capturedIssueInput.sessionId, "session_1");
  assert.equal(capturedEmailInput.to, "buyer@example.com");
  assert.equal(capturedEmailInput.signingLink, "https://acre.example.test/sign/session/raw-token-1");
  assert.deepEqual(await readJson(response), {
    links: [
      {
        recipientId: "recipient_1",
        email: "buyer@example.com",
        name: "Buyer One",
        expiresAt: "2026-05-01T12:00:00.000Z",
        signingUrl: "https://acre.example.test/sign/session/raw-token-1",
      },
    ],
    delivered: [
      {
        recipientId: "recipient_1",
        email: "buyer@example.com",
        name: "Buyer One",
      },
    ],
  });
});

test("handleSendProjectRemotePost blocks local tokens from being sent with production links", async () => {
  let tokenIssued = false;

  const response = await handleSendProjectRemotePost(createRequest("http://localhost:3105"), { sessionId: "session_1" }, {
    canCreateProjectSigning: () => true,
    getAppBaseUrl: () => "https://acresystem.us",
    getRequestSessionContext: async () => createSessionContext(),
    issueProjectRemoteSigningTokens: async () => {
      tokenIssued = true;
      return [createRemoteToken()];
    },
  });
  const payload = await readJson(response);

  assert.equal(response.status, 409);
  assert.equal(tokenIssued, false);
  assert.match(String(payload.error), /local-only token/);
});

test("handleSendProjectRemotePost blocks private-network local origins from production links", async () => {
  for (const origin of ["http://0.0.0.0:3105", "http://100.96.36.58:3105"]) {
    let tokenIssued = false;

    const response = await handleSendProjectRemotePost(createRequest(origin), { sessionId: "session_1" }, {
      canCreateProjectSigning: () => true,
      getAppBaseUrl: () => "https://acresystem.us",
      getRequestSessionContext: async () => createSessionContext(),
      issueProjectRemoteSigningTokens: async () => {
        tokenIssued = true;
        return [createRemoteToken()];
      },
    });
    const payload = await readJson(response);

    assert.equal(response.status, 409);
    assert.equal(tokenIssued, false);
    assert.match(String(payload.error), /local-only token/);
  }
});

test("handleSendProjectRemotePost returns generated links when email delivery fails", async () => {
  const response = await handleSendProjectRemotePost(
    createRequest("https://acre.example.test"),
    { sessionId: "session_1" },
    {
      canCreateProjectSigning: () => true,
      getAppBaseUrl: () => "https://acre.example.test",
      getRequestSessionContext: async () => createSessionContext(),
      issueProjectRemoteSigningTokens: async () => [createRemoteToken()],
      sendSignatureRequestEmail: async () => {
        throw new Error("Sender domain is not verified.");
      },
    },
  );

  const payload = await readJson(response);

  assert.equal(response.status, 502);
  assert.deepEqual(payload.links, [
    {
      recipientId: "recipient_1",
      email: "buyer@example.com",
      name: "Buyer One",
      expiresAt: "2026-05-01T12:00:00.000Z",
      signingUrl: "https://acre.example.test/sign/session/raw-token-1",
    },
  ]);
  assert.deepEqual(payload.delivered, []);
  assert.deepEqual(payload.emailDeliveryFailures, [
    {
      recipientId: "recipient_1",
      email: "buyer@example.com",
      name: "Buyer One",
      error: "Sender domain is not verified.",
    },
  ]);
  assert.match(String(payload.emailDeliveryWarning), /Remote links were created/);
});

test("handleSendProjectRemotePost returns the domain error when a completed session cannot be resent", async () => {
  const response = await handleSendProjectRemotePost(
    createRequest("https://acre.example.test"),
    { sessionId: "session_1" },
    {
      canCreateProjectSigning: () => true,
      getAppBaseUrl: () => "https://acre.example.test",
      getRequestSessionContext: async () => createSessionContext(),
      issueProjectRemoteSigningTokens: async () => {
        throw new Error("This signing session already has submitted signatures. Create a new session before sending another link.");
      },
    },
  );
  const payload = await readJson(response);

  assert.equal(response.status, 400);
  assert.equal(
    payload.error,
    "This signing session already has submitted signatures. Create a new session before sending another link.",
  );
});
