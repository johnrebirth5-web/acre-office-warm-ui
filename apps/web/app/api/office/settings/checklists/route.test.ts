import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateChecklistTemplatePost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/checklists`, {
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

test("handleCreateChecklistTemplatePost returns 400 validation_error when name is blank", async () => {
  const response = await handleCreateChecklistTemplatePost(createRequest(JSON.stringify({ name: "   " })), createContext());

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Checklist template payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: { name: "name is required." }
  });
});

test("handleCreateChecklistTemplatePost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateChecklistTemplatePost(
    createRequest(JSON.stringify({ name: "Launch", isActive: false, items: [{ title: "Packet" }] })),
    createContext(),
    {
      createChecklistTemplate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "template_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["name"], "Launch");
  assert.equal(capturedInput?.["isActive"], false);
  assert.deepEqual(capturedInput?.["items"], [{ title: "Packet" }]);
});
