import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveOfficeFieldSettingsPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/fields`, {
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

test("handleSaveOfficeFieldSettingsPatch returns 400 validation_error for invalid module", async () => {
  const response = await handleSaveOfficeFieldSettingsPatch(createRequest(JSON.stringify({ module: "agent" })), createContext());
  assert.equal(response.status, 400);
});

test("handleSaveOfficeFieldSettingsPatch forwards normalized payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveOfficeFieldSettingsPatch(
    createRequest(JSON.stringify({ module: "contact", contactRoleSettings: [{ role: "buyer", isRequired: true }] })),
    createContext(),
    {
      saveOfficeFieldSettings: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "snapshot_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["module"], "contact");
});
