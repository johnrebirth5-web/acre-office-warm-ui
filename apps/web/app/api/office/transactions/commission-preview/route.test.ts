import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeTransactionCommissionPreviewPost } from "./route";

function createCommissionPreviewRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/transactions/commission-preview`, {
    method: "POST",
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
      permissions: ["transactions:create"],
      role: "office_user",
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

test("handleCreateOfficeTransactionCommissionPreviewPost returns 400 validation_error for non-array fees", async () => {
  const response = await handleCreateOfficeTransactionCommissionPreviewPost(
    createCommissionPreviewRequest(
      JSON.stringify({
        grossCommission: "10000",
        fees: "invalid",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission preview payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      fees: "Invalid input: expected array, received string",
    },
  });
});

test("handleCreateOfficeTransactionCommissionPreviewPost forwards normalized owner and fee inputs", async () => {
  let capturedOwnerInput: Record<string, unknown> | null = null;
  let capturedPreviewInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeTransactionCommissionPreviewPost(
    createCommissionPreviewRequest(
      JSON.stringify({
        ownerMembershipId: "membership_2",
        grossCommission: "15000",
        fees: [
          {
            feeType: "Broker split",
            rate: "0.1",
            amount: "",
            selectedCalculationType: "rate",
            approvalStatus: "approved",
            notes: "standard plan",
          },
        ],
      }),
    ),
    createSessionContext(),
    {
      getOfficeTransactionOwnerAssignment: async (input) => {
        capturedOwnerInput = input as Record<string, unknown>;
        return {
          canSelectDifferentOwner: true,
          options: [{ id: "membership_2", label: "Agent Two" }],
        } as never;
      },
      previewCreateTransactionCommissionCalculator: async (input) => {
        capturedPreviewInput = input as Record<string, unknown>;
        return {
          summary: { ownerLabel: "Agent Two" },
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedOwnerInput, {
    organizationId: "org_1",
    viewerMembershipId: "membership_1",
    officeId: "office_1",
  });
  assert.deepEqual(capturedPreviewInput, {
    organizationId: "org_1",
    officeId: "office_1",
    ownerMembershipId: "membership_2",
    grossCommission: "15000",
    fees: [
      {
        feeType: "Broker split",
        rate: "0.1",
        amount: "",
        selectedCalculationType: "rate",
        approvalStatus: "approved",
        notes: "standard plan",
      },
    ],
  });
  assert.deepEqual(await readJson(response), {
    preview: {
      summary: {
        ownerLabel: "Agent Two",
      },
    },
  });
});
