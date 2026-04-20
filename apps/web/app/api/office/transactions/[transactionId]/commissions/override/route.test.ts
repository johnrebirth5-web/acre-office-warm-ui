import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleOverrideTransactionCommissionPost } from "./route";

function createCommissionOverrideRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/commissions/override`,
    {
      method: "POST",
      body,
      headers: {
        origin,
        "content-type": "application/json",
      },
    },
  );
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_actor",
      permissions: ["commissions.manage"],
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

test("handleOverrideTransactionCommissionPost returns 400 validation_error when request body is not valid JSON", async () => {
  const response = await handleOverrideTransactionCommissionPost(
    createCommissionOverrideRequest("{"),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission override request body must be valid JSON.",
    errorCode: "validation_error",
    fieldErrors: {
      body: "Commission override request body must be valid JSON.",
    },
  });
});

test("handleOverrideTransactionCommissionPost accepts company override rows with empty membershipId", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleOverrideTransactionCommissionPost(
    createCommissionOverrideRequest(
      JSON.stringify({
        overrideReason: "Adjust company share",
        stakeholderRows: [
          {
            key: "membership_agent_1",
            membershipId: "membership_agent_1",
            amount: "40000",
          },
          {
            key: "company",
            membershipId: "",
            amount: "10000",
          },
        ],
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      overrideTransactionCommission: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "snapshot_1",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    overrideReason: "Adjust company share",
    notes: "",
    stakeholderRows: [
      {
        key: "membership_agent_1",
        membershipId: "membership_agent_1",
        amount: "40000",
      },
      {
        key: "company",
        membershipId: "",
        amount: "10000",
      },
    ],
    actorMembershipId: "membership_actor",
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      id: "snapshot_1",
    },
  });
});
