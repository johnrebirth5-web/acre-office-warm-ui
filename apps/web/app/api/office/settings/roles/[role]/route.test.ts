import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveOrganizationRoleTemplatePermissionsPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/roles/agent`, {
    method: "PATCH",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "owner", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

test("handleSaveOrganizationRoleTemplatePermissionsPatch returns 400 validation_error for invalid permissions shape", async () => {
  const response = await handleSaveOrganizationRoleTemplatePermissionsPatch(
    createRequest(JSON.stringify({ permissions: "contacts:view" })),
    "agent",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleSaveOrganizationRoleTemplatePermissionsPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveOrganizationRoleTemplatePermissionsPatch(
    createRequest(JSON.stringify({ permissions: ["contacts:view"] })),
    "agent",
    createContext(),
    {
      saveOrganizationRoleTemplatePermissions: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { roles: [{ role: "agent", permissions: ["contacts:view"] }] } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["role"], "agent");
});
