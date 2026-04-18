import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionReportSearchLayoutPatch } from "./route";

function createReportSearchLayoutRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/reports/search-layout`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["fields:manage"],
      role: "office_admin"
    },
    currentOrganization: {
      id: "org_1"
    },
    currentOffice: {
      id: "office_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionReportSearchLayoutPatch returns 400 validation_error for non-array fields", async () => {
  const response = await handleUpdateOfficeTransactionReportSearchLayoutPatch(
    createReportSearchLayoutRequest(
      JSON.stringify({
        fields: "status"
      })
    ),
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Report search layout payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      fields: "Invalid input: expected array, received string"
    }
  });
});

test("handleUpdateOfficeTransactionReportSearchLayoutPatch forwards normalized layout payloads and returns snapshot", async () => {
  let capturedSaveInput: Record<string, unknown> | null = null;
  let capturedSnapshotInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionReportSearchLayoutPatch(
    createReportSearchLayoutRequest(
      JSON.stringify({
        fields: ["transactionStatus", "address"]
      })
    ),
    createSessionContext(),
    {
      saveOfficeTransactionReportSearchLayout: async (input) => {
        capturedSaveInput = input as Record<string, unknown>;
        return [] as never;
      },
      getOfficeTransactionReportSearchLayoutSnapshot: async (input) => {
        capturedSnapshotInput = input as Record<string, unknown>;
        return {
          fields: ["transactionStatus", "address"]
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedSaveInput, {
    organizationId: "org_1",
    officeId: "office_1",
    actorMembershipId: "membership_1",
    fields: ["transactionStatus", "address"]
  });
  assert.deepEqual(capturedSnapshotInput, {
    organizationId: "org_1",
    viewerMembershipId: "membership_1",
    officeId: "office_1"
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      fields: ["transactionStatus", "address"]
    }
  });
});
