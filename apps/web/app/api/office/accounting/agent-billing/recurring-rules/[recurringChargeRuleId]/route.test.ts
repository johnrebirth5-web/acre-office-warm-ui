import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentBillingRecurringRulePatch } from "./route";

function createRecurringRuleRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(
    `${origin}/api/office/accounting/agent-billing/recurring-rules/rule_1`,
    {
      method: "PATCH",
      body,
      headers: {
        origin,
        "content-type": "application/json"
      }
    }
  );
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

test("handleUpdateAgentBillingRecurringRulePatch returns 400 validation_error for invalid frequency", async () => {
  const response = await handleUpdateAgentBillingRecurringRulePatch(
    createRecurringRuleRequest(
      JSON.stringify({
        frequency: "weekly"
      })
    ),
    "rule_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Recurring billing rule payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      frequency:
        "Invalid option: expected one of \"monthly\"|\"quarterly\"|\"annual\"|\"custom_interval\""
    }
  });
});

test("handleUpdateAgentBillingRecurringRulePatch forwards validated recurring rule updates", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateAgentBillingRecurringRulePatch(
    createRecurringRuleRequest(
      JSON.stringify({
        name: "Updated desk fee",
        frequency: "quarterly",
        autoGenerateInvoice: false,
        isActive: true
      })
    ),
    "rule_1",
    createAccountingContext(),
    {
      updateAgentRecurringChargeRule: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "rule_1";
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    recurringChargeRuleId: "rule_1",
    officeId: "office_1",
    membershipId: undefined,
    name: "Updated desk fee",
    chargeType: undefined,
    description: undefined,
    amount: undefined,
    frequency: "quarterly",
    customIntervalDays: undefined,
    startDate: undefined,
    nextDueDate: undefined,
    endDate: undefined,
    autoGenerateInvoice: false,
    isActive: true,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    recurringChargeRuleId: "rule_1"
  });
});
