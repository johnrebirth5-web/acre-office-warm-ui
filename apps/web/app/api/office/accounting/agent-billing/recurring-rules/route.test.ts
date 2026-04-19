import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentBillingRecurringRulePost } from "./route";

function createRecurringRuleRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/agent-billing/recurring-rules`, {
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

test("handleCreateAgentBillingRecurringRulePost returns 400 validation_error for unsupported frequency", async () => {
  const response = await handleCreateAgentBillingRecurringRulePost(
    createRecurringRuleRequest(
      JSON.stringify({
        membershipId: "membership_target",
        name: "Desk fee",
        chargeType: "desk_fee",
        amount: "125.00",
        frequency: "weekly",
        startDate: "2026-04-01",
        nextDueDate: "2026-05-01"
      })
    ),
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

test("handleCreateAgentBillingRecurringRulePost forwards validated recurring rule payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAgentBillingRecurringRulePost(
    createRecurringRuleRequest(
      JSON.stringify({
        membershipId: "membership_target",
        name: "Desk fee",
        chargeType: "desk_fee",
        description: "Monthly desk fee",
        amount: "125.00",
        frequency: "monthly",
        startDate: "2026-04-01",
        nextDueDate: "2026-05-01",
        autoGenerateInvoice: true,
        isActive: true
      })
    ),
    createAccountingContext(),
    {
      createAgentRecurringChargeRule: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "rule_1";
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    name: "Desk fee",
    chargeType: "desk_fee",
    description: "Monthly desk fee",
    amount: "125.00",
    frequency: "monthly",
    customIntervalDays: "",
    startDate: "2026-04-01",
    nextDueDate: "2026-05-01",
    endDate: "",
    autoGenerateInvoice: true,
    isActive: true,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    recurringChargeRuleId: "rule_1"
  });
});
