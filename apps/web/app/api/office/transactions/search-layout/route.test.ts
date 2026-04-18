import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionSearchLayoutPatch } from "./route";

function createTransactionSearchLayoutRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/transactions/search-layout`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["fields:manage"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: {
      id: "office_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionSearchLayoutPatch returns 400 validation_error for unsupported field kinds", async () => {
  const response = await handleUpdateOfficeTransactionSearchLayoutPatch(
    createTransactionSearchLayoutRequest(
      JSON.stringify({
        fields: [
          {
            kind: "legacy",
            key: "search",
          },
        ],
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction search layout payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      "fields[0].kind": "A supported search layout field kind is required.",
    },
  });
});

test("handleUpdateOfficeTransactionSearchLayoutPatch forwards normalized field layout and returns snapshot", async () => {
  let capturedSaveInput: Record<string, unknown> | null = null;
  let capturedSnapshotInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionSearchLayoutPatch(
    createTransactionSearchLayoutRequest(
      JSON.stringify({
        fields: [
          {
            kind: "system",
            key: "search",
          },
          {
            kind: "custom",
            key: "invoiceNumber",
          },
        ],
      }),
    ),
    createSessionContext(),
    {
      saveOfficeTransactionSearchLayout: async (input) => {
        capturedSaveInput = input as Record<string, unknown>;
        return [] as never;
      },
      getOfficeTransactionSearchLayoutSnapshot: async (input) => {
        capturedSnapshotInput = input as Record<string, unknown>;
        return {
          selectedFields: [{ kind: "system", key: "search" }],
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedSaveInput, {
    organizationId: "org_1",
    officeId: "office_1",
    actorMembershipId: "membership_1",
    fields: [
      { kind: "system", key: "search" },
      { kind: "custom", key: "invoiceNumber" },
    ],
  });
  assert.deepEqual(capturedSnapshotInput, {
    organizationId: "org_1",
    viewerMembershipId: "membership_1",
    officeId: "office_1",
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      selectedFields: [{ kind: "system", key: "search" }],
    },
  });
});
