import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeCustomFieldDefinitionPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/fields/custom/custom_1`, {
    method: "PATCH",
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

test("handleUpdateOfficeCustomFieldDefinitionPatch returns 400 validation_error for invalid sortOrder", async () => {
  const response = await handleUpdateOfficeCustomFieldDefinitionPatch(
    createRequest(JSON.stringify({ sortOrder: "bad" })),
    "custom_1",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleUpdateOfficeCustomFieldDefinitionPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateOfficeCustomFieldDefinitionPatch(
    createRequest(JSON.stringify({ label: "Preferred vendor", sortOrder: 2 })),
    "custom_1",
    createContext(),
    {
      updateOfficeCustomFieldDefinition: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "snapshot_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["fieldKey"], "custom_1");
  assert.equal(capturedInput?.["sortOrder"], 2);
});
