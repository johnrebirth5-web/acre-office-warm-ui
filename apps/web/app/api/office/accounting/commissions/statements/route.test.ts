import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateCommissionStatementPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/statements`, {
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

test("handleCreateCommissionStatementPost returns 400 validation_error when membershipId is blank", async () => {
  const response = await handleCreateCommissionStatementPost(
    createRequest(JSON.stringify({ membershipId: "   ", startDate: "2026-01-01", endDate: "2026-03-31" })),
    createContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission statement payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      membershipId: "membershipId is required."
    }
  });
});

test("handleCreateCommissionStatementPost returns 404 when agent cannot be found", async () => {
  const response = await handleCreateCommissionStatementPost(
    createRequest(JSON.stringify({ membershipId: "membership_target", startDate: "2026-01-01", endDate: "2026-03-31" })),
    createContext(),
    {
      generateCommissionStatementSnapshot: async () => null
    }
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Agent not found for statement generation."
  });
});
