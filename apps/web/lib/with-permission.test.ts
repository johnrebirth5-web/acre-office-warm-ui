import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import { withPermission } from "./with-permission";

function createRequest() {
  return new Request("https://example.com/api/office/settings/test") as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("withPermission returns 401 when session context is missing", async () => {
  const response = await withPermission(
    createRequest(),
    () => true,
    async () => new Response("ok"),
    {
      forbiddenMessage: "Permission required.",
      getRequestSessionContext: async () => null,
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("withPermission returns 403 when access is denied", async () => {
  const response = await withPermission(
    createRequest(),
    () => false,
    async () => new Response("ok"),
    {
      forbiddenMessage: "Permission required.",
      getRequestSessionContext: async () =>
        ({
          currentMembership: {
            id: "member_1",
          },
        }) as never,
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Permission required.",
  });
});

test("withPermission passes through the handler when session and access are valid", async () => {
  const response = await withPermission(
    createRequest(),
    () => true,
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    {
      forbiddenMessage: "Permission required.",
      getRequestSessionContext: async () =>
        ({
          currentMembership: {
            id: "member_1",
          },
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    ok: true,
  });
});
