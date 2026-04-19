import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateEarnestMoneyRecordPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/earnest-money/emd_1`, {
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

test("handleUpdateEarnestMoneyRecordPatch returns 400 validation_error for invalid heldExternally type", async () => {
  const response = await handleUpdateEarnestMoneyRecordPatch(
    createRequest(JSON.stringify({ heldExternally: "no" })),
    createContext(),
    "emd_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Earnest money payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      heldExternally: "Invalid input: expected boolean, received string"
    }
  });
});

test("handleUpdateEarnestMoneyRecordPatch returns 404 when record is missing", async () => {
  const response = await handleUpdateEarnestMoneyRecordPatch(
    createRequest(JSON.stringify({ notes: "Updated" })),
    createContext(),
    "emd_1",
    {
      updateEarnestMoneyRecord: async () => null
    }
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Earnest money record not found."
  });
});
