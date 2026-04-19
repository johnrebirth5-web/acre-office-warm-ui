import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateChecklistTemplatePatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/checklists/template_1`, {
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

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateChecklistTemplatePatch returns 400 validation_error when items is not an array", async () => {
  const response = await handleUpdateChecklistTemplatePatch(
    createRequest(JSON.stringify({ name: "Launch", items: "bad" })),
    "template_1",
    createContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Checklist template payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: { items: "Invalid input: expected array, received string" }
  });
});

test("handleUpdateChecklistTemplatePatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateChecklistTemplatePatch(
    createRequest(JSON.stringify({ name: "Launch", description: "desc" })),
    "template_1",
    createContext(),
    {
      updateChecklistTemplate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "template_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["templateId"], "template_1");
  assert.equal(capturedInput?.["description"], "desc");
});
