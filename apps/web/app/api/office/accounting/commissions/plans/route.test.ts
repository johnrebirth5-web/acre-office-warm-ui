import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateCommissionPlanPost } from "./route";

function createCommissionPlanRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/plans`, {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createAccountingContext() {
  return {
    currentMembership: {
      id: "membership_actor",
      role: "office_admin",
      permissions: []
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

test("handleCreateCommissionPlanPost returns 400 validation_error when name is blank", async () => {
  const response = await handleCreateCommissionPlanPost(
    createCommissionPlanRequest(
      JSON.stringify({
        name: "   "
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission plan payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      name: "name is required."
    }
  });
});

test("handleCreateCommissionPlanPost forwards normalized plan payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateCommissionPlanPost(
    createCommissionPlanRequest(
      JSON.stringify({
        name: "Standard plan",
        description: "Primary office plan",
        calculationMode: "flat_net",
        defaultCurrency: "USD",
        rules: [
          {
            ruleType: "base_split",
            splitPercent: "70",
            recipientType: "agent"
          },
          {
            ruleType: "brokerage_fee",
            ruleName: "Desk fee",
            feeType: "flat",
            feeAmount: "495.00",
            isActive: false
          }
        ]
      })
    ),
    createAccountingContext(),
    {
      saveCommissionPlan: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "plan_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    name: "Standard plan",
    description: "Primary office plan",
    calculationMode: "flat_net",
    isActive: true,
    defaultCurrency: "USD",
    rules: [
      {
        ruleType: "base_split",
        ruleName: "",
        sortOrder: undefined,
        splitPercent: "70",
        flatAmount: "",
        feeType: "",
        feeAmount: "",
        thresholdStart: "",
        thresholdEnd: "",
        appliesToRole: "",
        recipientType: "agent",
        isActive: true
      },
      {
        ruleType: "brokerage_fee",
        ruleName: "Desk fee",
        sortOrder: undefined,
        splitPercent: "",
        flatAmount: "",
        feeType: "flat",
        feeAmount: "495.00",
        thresholdStart: "",
        thresholdEnd: "",
        appliesToRole: "",
        recipientType: "",
        isActive: false
      }
    ],
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    commissionPlan: {
      id: "plan_1"
    }
  });
});
