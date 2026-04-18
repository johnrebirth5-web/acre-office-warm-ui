import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeMailThreadPatch } from "./route";

function createMailThreadRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/mail/threads/thread_1`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeMailThreadPatch returns 400 validation_error for unsupported actions", async () => {
  const response = await handleUpdateOfficeMailThreadPatch(
    createMailThreadRequest(
      JSON.stringify({
        action: "pin"
      })
    ),
    "thread_1",
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid thread action is required.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "A supported mail thread action is required."
    }
  });
});

test("handleUpdateOfficeMailThreadPatch routes archive actions through archiveOfficeMailThread", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeMailThreadPatch(
    createMailThreadRequest(
      JSON.stringify({
        action: "archive"
      })
    ),
    "thread_1",
    createSessionContext(),
    {
      archiveOfficeMailThread: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return true;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    membershipId: "membership_1",
    threadId: "thread_1"
  });
  assert.deepEqual(await readJson(response), {
    ok: true
  });
});
