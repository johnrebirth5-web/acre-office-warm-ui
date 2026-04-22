import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleFrontOfficeClientPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/agent/clients/client_1`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createContext() {
  return {
    currentMembership: {
      id: "membership_actor",
      role: "office_admin",
      permissions: [],
    },
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: {
      id: "office_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleFrontOfficeClientPatch returns 400 when payload is not an object", async () => {
  const response = await handleFrontOfficeClientPatch(
    createRequest(JSON.stringify(["bad"])),
    createContext(),
    "client_1",
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid JSON body is required.",
  });
});

test("handleFrontOfficeClientPatch validates unsupported follow-up status", async () => {
  const response = await handleFrontOfficeClientPatch(
    createRequest(
      JSON.stringify({
        followUpStatus: "not_real_status",
      }),
    ),
    createContext(),
    "client_1",
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Fix the highlighted values and try again.",
    errorCode: "validation_error",
    fieldErrors: {
      followUpStatus: "Unsupported follow-up status.",
    },
  });
});

test("handleFrontOfficeClientPatch forwards the lightweight execution update", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleFrontOfficeClientPatch(
    createRequest(
      JSON.stringify({
        fullName: "Annie Chen",
        budgetMax: "6.5k",
        preferredAreas: "LIC, Astoria",
        followUpStatus: "waiting_reply",
        nextFollowUpAt: "2026-05-12",
        notes: "WeChat buyer. Wants weekday showings.",
        wechatDisplayName: "安妮",
        markFollowedUpNow: true,
      }),
    ),
    createContext(),
    "client_1",
    {
      updateFrontOfficeClientExecution: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "client_1" } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    clientId: "client_1",
    actorMembershipId: "membership_actor",
    actorOfficeId: "office_1",
    fullName: "Annie Chen",
    budgetMax: "6500",
    preferredAreas: ["LIC", "Astoria"],
    followUpStatus: "waiting_reply",
    nextFollowUpAt: "2026-05-12",
    notes: "WeChat buyer. Wants weekday showings.",
    wechatDisplayName: "安妮",
    markFollowedUpNow: true,
  });
  assert.deepEqual(await readJson(response), {
    contact: {
      id: "client_1",
    },
  });
});
