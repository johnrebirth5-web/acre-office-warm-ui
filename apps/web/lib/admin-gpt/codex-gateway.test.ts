import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
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
  type AdminAssistantCodexExecRunner,
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

test("callOpenClawAdminAssistant sends a read-only Codex CLI request with image attachments", async () => {
  const captured: Array<{ args: string[]; command: string; input: string }> = [];
  const codexExec: AdminAssistantCodexExecRunner = async (command, args, options) => {
    captured.push({ args, command, input: options.input });
    assert.equal(command, "codex");
    assert.ok(args.includes("--ask-for-approval"));
    assert.ok(args.includes("never"));
    assert.ok(args.includes("--sandbox"));
    assert.ok(args.includes("read-only"));
    assert.ok(args.includes("exec"));
    assert.ok(args.includes("--ephemeral"));
    assert.ok(args.includes("--image"));
    assert.equal(typeof options.timeoutMs, "number");
    assert.match(options.input, /Mandatory refusal rules/);
    assert.match(options.input, /Administrator question/);

    const outputIndex = args.indexOf("-o");
    assert.ok(outputIndex >= 0);
    const outputPath = args[outputIndex + 1];
    assert.ok(outputPath);
    await writeFile(outputPath, "去 Transactions 页面点 New transaction。");

    return {
      stderr: "",
      stdout: "ignored when output file is present",
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
    { codexExec },
  );

  assert.equal(result.provider, "codex-cli-oauth");
  assert.equal(result.reply, "去 Transactions 页面点 New transaction。");
  assert.equal(captured.length, 1);
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
  const codexExec: AdminAssistantCodexExecRunner = async (_command, args) => {
    await new Promise<void>((resolve) => {
      releaseRef.current = resolve;
    });

    const outputIndex = args.indexOf("-o");
    const outputPath = args[outputIndex + 1];
    assert.ok(outputPath);
    await writeFile(outputPath, "done");

    return {
      stderr: "",
      stdout: "",
    };
  };

  const first = callSerializedOpenClawAdminAssistant(
    {
      message: "第一条",
    },
    adminContext,
    { codexExec },
  );

  for (let attempt = 0; attempt < 20 && typeof releaseRef.current !== "function"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  await assert.rejects(
    () =>
      callSerializedOpenClawAdminAssistant(
        {
          message: "第二条",
        },
        adminContext,
        { codexExec },
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
