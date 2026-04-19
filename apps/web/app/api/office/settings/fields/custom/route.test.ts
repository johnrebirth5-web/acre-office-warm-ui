import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeCustomFieldDefinitionPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/fields/custom`, {
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

test("handleCreateOfficeCustomFieldDefinitionPost returns 400 validation_error for blank label", async () => {
  const response = await handleCreateOfficeCustomFieldDefinitionPost(
    createRequest(JSON.stringify({ label: " ", type: "text" })),
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleCreateOfficeCustomFieldDefinitionPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateOfficeCustomFieldDefinitionPost(
    createRequest(JSON.stringify({ module: "offer", label: "MLS", type: "text" })),
    createContext(),
    {
      createOfficeCustomFieldDefinition: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "snapshot_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["module"], "offer");
});
