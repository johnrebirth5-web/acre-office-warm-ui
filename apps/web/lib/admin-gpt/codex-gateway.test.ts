import assert from "node:assert/strict";
import test from "node:test";
import type { SessionMembershipContext } from "@acre/db";
import {
  AdminAssistantGatewayBusyError,
  AdminAssistantInputRejectedError,
  __resetAdminAssistantGatewayLockForTest,
  buildAcreAdminAssistantSystemPrompt,
  callOpenClawAdminAssistant,
  callSerializedOpenClawAdminAssistant,
  extractOpenClawGatewayReply,
  normalizeAdminAssistantInput,
  type AdminAssistantGatewayRequest,
} from "./codex-gateway";

const adminContext = {
  accessibleOffices: [
    {
      id: "office-1",
      market: "NYC",
      name: "Acre NY",
      slug: "acre-ny",
    },
  ],
  currentCredential: null,
  currentMembership: {
    id: "membership-1",
    permissions: ["ai:use"],
    role: "office_admin",
    status: "active",
    title: "Office Admin",
  },
  currentOffice: {
    id: "office-1",
    market: "NYC",
    name: "Acre NY",
    slug: "acre-ny",
  },
  currentOrganization: {
    id: "org-1",
    name: "Acre",
    slug: "acre",
    timezone: "America/New_York",
  },
  currentUser: {
    email: "admin@example.com",
    firstName: "Acre",
    id: "user-1",
    lastName: "Admin",
    locale: "en-US",
    timezone: "America/New_York",
  },
} satisfies SessionMembershipContext;

test("buildAcreAdminAssistantSystemPrompt keeps the assistant scoped to Acre admin help", () => {
  const input = normalizeAdminAssistantInput({
    currentPath: "/office/transactions",
    message: "我要登单在哪里？",
  });
  const prompt = buildAcreAdminAssistantSystemPrompt(input, adminContext);

  assert.match(prompt, /Hard scope boundary/);
  assert.match(prompt, /Refuse code editing/);
  assert.match(prompt, /Transactions/);
  assert.match(prompt, /\/office\/transactions/);
  assert.doesNotMatch(prompt, /admin@example\.com/);
});

test("normalizeAdminAssistantInput rejects non-image and oversized screenshot payloads", () => {
  assert.throws(
    () =>
      normalizeAdminAssistantInput({
        attachments: [
          {
            content: "dGVzdA==",
            fileName: "notes.txt",
            mimeType: "text/plain",
          },
        ],
        message: "看截图",
      }),
    AdminAssistantInputRejectedError,
  );

  assert.throws(
    () =>
      normalizeAdminAssistantInput({
        attachments: [
          {
            content: Buffer.alloc(1024 * 1024 + 1).toString("base64"),
            fileName: "big.png",
            mimeType: "image/png",
          },
        ],
        message: "看截图",
      }),
    AdminAssistantInputRejectedError,
  );
});

test("callOpenClawAdminAssistant sends a Codex gateway agent request with image attachments", async () => {
  const capturedParams: Record<string, unknown>[] = [];
  const gatewayRequest: AdminAssistantGatewayRequest = async (method, params, options) => {
    capturedParams.push(params);
    assert.equal(method, "agent");
    assert.equal(options.expectFinal, true);
    assert.equal(typeof options.timeoutMs, "number");

    return {
      payloads: [
        {
          text: "去 Transactions 页面点 New transaction。",
        },
      ],
      status: "ok",
    };
  };

  const result = await callOpenClawAdminAssistant(
    {
      attachments: [
        {
          content: "iVBORw0KGgo=",
          fileName: "screen.png",
          mimeType: "image/png",
        },
      ],
      currentPath: "/office/transactions",
      message: "我要登单在哪？",
    },
    adminContext,
    { gatewayRequest },
  );

  assert.equal(result.reply, "去 Transactions 页面点 New transaction。");
  const params = capturedParams[0];
  assert.ok(params);
  assert.equal(params.agentId, "acre-admin-help");
  assert.equal(params.deliver, false);
  assert.equal(Array.isArray(params.attachments), true);
  assert.match(String(params.extraSystemPrompt), /Do not provide code changes/);
});

test("extractOpenClawGatewayReply supports nested gateway payload shapes", () => {
  assert.equal(
    extractOpenClawGatewayReply({
      result: {
        payloads: [
          {
            text: "nested reply",
          },
        ],
      },
    }),
    "nested reply",
  );
  assert.equal(extractOpenClawGatewayReply({ summary: "summary reply" }), "summary reply");
});

test("callSerializedOpenClawAdminAssistant rejects overlapping gateway calls", async () => {
  __resetAdminAssistantGatewayLockForTest();
  const releaseRef: { current?: () => void } = {};
  const gatewayRequest: AdminAssistantGatewayRequest = async () => {
    await new Promise<void>((resolve) => {
      releaseRef.current = resolve;
    });

    return {
      payloads: [
        {
          text: "done",
        },
      ],
      status: "ok",
    };
  };

  const first = callSerializedOpenClawAdminAssistant(
    {
      message: "第一条",
    },
    adminContext,
    { gatewayRequest },
  );

  await assert.rejects(
    () =>
      callSerializedOpenClawAdminAssistant(
        {
          message: "第二条",
        },
        adminContext,
        { gatewayRequest },
      ),
    AdminAssistantGatewayBusyError,
  );

  const releaseRun = releaseRef.current;
  if (typeof releaseRun !== "function") {
    throw new Error("release callback was not captured");
  }
  releaseRun();
  await assert.doesNotReject(first);
  __resetAdminAssistantGatewayLockForTest();
});
