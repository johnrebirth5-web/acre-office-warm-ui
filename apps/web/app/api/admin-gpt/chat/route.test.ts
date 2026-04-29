import assert from "node:assert/strict";
import test from "node:test";
import type { SessionMembershipContext } from "@acre/db";
import { NextRequest } from "next/server";
import { handleAdminAssistantChatPost } from "./route";

function createContext(
  role: SessionMembershipContext["currentMembership"]["role"] = "office_admin",
  permissions: string[] = ["ai:use"],
) {
  return {
    accessibleOffices: [],
    currentCredential: null,
    currentMembership: {
      id: "membership_1",
      permissions,
      role,
      status: "active",
      title: "Office Admin",
    },
    currentOffice: null,
    currentOrganization: {
      id: "org_1",
      name: "Acre",
      slug: "acre",
      timezone: "America/New_York",
    },
    currentUser: {
      email: "admin@acre.test",
      firstName: "Admin",
      id: "user_1",
      lastName: "User",
      locale: "en-US",
      timezone: "America/New_York",
    },
  } as SessionMembershipContext;
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("https://acre.test/api/admin-gpt/chat", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://acre.test",
    },
    method: "POST",
  });
}

function allowRateLimit() {
  return {
    allowed: true,
    limit: 8,
    remaining: 7,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 0,
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleAdminAssistantChatPost returns the Codex gateway reply for admins", async () => {
  let capturedMessage = "";
  const response = await handleAdminAssistantChatPost(
    createRequest({
      attachments: [
        {
          content: "iVBORw0KGgo=",
          fileName: "screen.png",
          mimeType: "image/png",
        },
      ],
      currentPath: "/office/transactions",
      message: "我要在哪里登单？",
    }),
    {
      callAssistant: async (input) => {
        capturedMessage = input.message;
        assert.equal(input.attachments?.[0]?.fileName, "screen.png");

        return {
          provider: "codex-cli-oauth",
          reply: "去 Transactions 页面创建新交易。",
        };
      },
      getRequestSessionContext: async () => createContext(),
      rateLimit: allowRateLimit,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(capturedMessage, "我要在哪里登单？");
  assert.deepEqual(await readJson(response), {
    provider: "codex-cli-oauth",
    reply: "去 Transactions 页面创建新交易。",
    status: "ok",
  });
});

test("handleAdminAssistantChatPost rejects non-admin chat access", async () => {
  let calledAssistant = false;
  const response = await handleAdminAssistantChatPost(
    createRequest({
      message: "我能用吗？",
    }),
    {
      callAssistant: async () => {
        calledAssistant = true;
        throw new Error("should not call assistant");
      },
      getRequestSessionContext: async () => createContext("agent"),
      rateLimit: allowRateLimit,
    },
  );

  assert.equal(response.status, 403);
  assert.equal(calledAssistant, false);
  assert.deepEqual(await readJson(response), {
    error: "Admin assistant permission required.",
  });
});

test("handleAdminAssistantChatPost surfaces busy gateway responses as 429", async () => {
  const response = await handleAdminAssistantChatPost(
    createRequest({
      message: "测试报错怎么办？",
    }),
    {
      callAssistant: async () => {
        const { AdminAssistantGatewayBusyError } = await import(
          "../../../../lib/admin-gpt/codex-gateway"
        );
        throw new AdminAssistantGatewayBusyError();
      },
      getRequestSessionContext: async () => createContext(),
      rateLimit: allowRateLimit,
    },
  );

  assert.equal(response.status, 429);
  assert.deepEqual(await readJson(response), {
    error: "管理员助手正在回答上一个问题，请稍后再试。",
    errorCode: "assistant_busy",
  });
});
