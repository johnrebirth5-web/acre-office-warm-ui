import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleReorderOfficeFieldsPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/settings/fields/reorder`, {
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

test("handleReorderOfficeFieldsPost returns 400 validation_error for blank fieldKey", async () => {
  const response = await handleReorderOfficeFieldsPost(
    createRequest(JSON.stringify({ fieldOrder: [{ fieldKey: " " }] })),
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleReorderOfficeFieldsPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleReorderOfficeFieldsPost(
    createRequest(JSON.stringify({ module: "transaction", fieldOrder: [{ kind: "custom", fieldKey: "field_1" }] })),
    createContext(),
    {
      reorderOfficeFields: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "snapshot_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput?.["fieldOrder"], [{ kind: "custom", fieldKey: "field_1" }]);
});
