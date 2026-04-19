import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateCommissionPlanPatch } from "./route";

function createCommissionPlanRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/plans/plan_1`, {
    method: "PATCH",
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

test("handleUpdateCommissionPlanPatch returns 400 validation_error for unsupported ruleType", async () => {
  const response = await handleUpdateCommissionPlanPatch(
    createCommissionPlanRequest(
      JSON.stringify({
        name: "Updated plan",
        rules: [
          {
            ruleType: "desk_fee"
          }
        ]
      })
    ),
    createAccountingContext(),
    "plan_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission plan payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      "rules[0].ruleType":
        "Invalid option: expected one of \"base_split\"|\"brokerage_fee\"|\"referral_fee\"|\"flat_fee_deduction\"|\"sliding_scale\""
    }
  });
});

test("handleUpdateCommissionPlanPatch forwards validated update payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateCommissionPlanPatch(
    createCommissionPlanRequest(
      JSON.stringify({
        name: "Updated plan",
        description: "Updated description",
        calculationMode: "split_and_fees",
        isActive: false,
        defaultCurrency: "CAD",
        rules: [
          {
            ruleType: "sliding_scale",
            ruleName: "Tier 1",
            sortOrder: 3,
            splitPercent: "80",
            thresholdStart: "0",
            thresholdEnd: "100000",
            recipientType: "agent"
          }
        ]
      })
    ),
    createAccountingContext(),
    "plan_1",
    {
      saveCommissionPlan: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "plan_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    commissionPlanId: "plan_1",
    name: "Updated plan",
    description: "Updated description",
    calculationMode: "split_and_fees",
    isActive: false,
    defaultCurrency: "CAD",
    rules: [
      {
        ruleType: "sliding_scale",
        ruleName: "Tier 1",
        sortOrder: 3,
        splitPercent: "80",
        flatAmount: "",
        feeType: "",
        feeAmount: "",
        thresholdStart: "0",
        thresholdEnd: "100000",
        appliesToRole: "",
        recipientType: "agent",
        isActive: true
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
