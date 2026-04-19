import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateContactFollowUpTaskPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/contacts/contact_1/follow-up-tasks`, {
    method: "POST",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "office_admin", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateContactFollowUpTaskPost returns 400 validation_error when title is blank", async () => {
  const response = await handleCreateContactFollowUpTaskPost(
    createRequest(JSON.stringify({ title: "   " })),
    createContext(),
    "contact_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Follow-up task payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      title: "title is required."
    }
  });
});

test("handleCreateContactFollowUpTaskPost forwards validated task payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateContactFollowUpTaskPost(
    createRequest(JSON.stringify({ title: "Call client", dueAt: "2026-04-20" })),
    createContext(),
    "contact_1",
    {
      createFollowUpTask: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "task_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    clientId: "contact_1",
    assigneeMembershipId: "membership_actor",
    actorMembershipId: "membership_actor",
    actorOfficeId: "office_1",
    title: "Call client",
    dueAt: "2026-04-20"
  });
  assert.deepEqual(await readJson(response), { task: { id: "task_1" } });
});
