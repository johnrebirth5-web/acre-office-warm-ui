import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateEarnestMoneyRecordPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/earnest-money`, {
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

test("handleCreateEarnestMoneyRecordPost returns 400 validation_error for invalid trackInLedger type", async () => {
  const response = await handleCreateEarnestMoneyRecordPost(
    createRequest(JSON.stringify({ trackInLedger: "yes" })),
    createContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Earnest money payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      trackInLedger: "Invalid input: expected boolean, received string"
    }
  });
});

test("handleCreateEarnestMoneyRecordPost forwards normalized payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateEarnestMoneyRecordPost(
    createRequest(
      JSON.stringify({
        transactionId: "txn_1",
        expectedAmount: "15000",
        dueAt: "2026-04-19",
        heldByOffice: true,
        heldExternally: false
      })
    ),
    createContext(),
    {
      createEarnestMoneyRecord: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "emd_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "txn_1",
    expectedAmount: "15000",
    dueAt: "2026-04-19",
    heldByOffice: true,
    heldExternally: false,
    trackInLedger: true,
    notes: "",
    createdByMembershipId: "membership_actor",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), { earnestMoneyRecord: { id: "emd_1" } });
});
