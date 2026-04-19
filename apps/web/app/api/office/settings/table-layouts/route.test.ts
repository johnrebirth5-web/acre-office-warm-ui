import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveOfficeTableLayoutPut } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/table-layouts`, {
    method: "PUT",
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

test("handleSaveOfficeTableLayoutPut returns 400 validation_error for invalid columns", async () => {
  const response = await handleSaveOfficeTableLayoutPut(
    createRequest(JSON.stringify({ tableKey: "transactions", columns: "bad" })),
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleSaveOfficeTableLayoutPut forwards normalized payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveOfficeTableLayoutPut(
    createRequest(JSON.stringify({ tableKey: "transactions", columns: [{ key: "status", width: 160 }] })),
    createContext(),
    {
      saveOfficeTableLayout: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "layout_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput?.["columns"], [{ key: "status", width: 160 }]);
});
