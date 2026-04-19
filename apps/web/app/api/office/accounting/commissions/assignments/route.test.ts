import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateCommissionPlanAssignmentPost } from "./route";

function createAssignmentRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/assignments`, {
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

test("handleCreateCommissionPlanAssignmentPost returns 400 validation_error when commissionPlanId is blank", async () => {
  const response = await handleCreateCommissionPlanAssignmentPost(
    createAssignmentRequest(
      JSON.stringify({
        membershipId: "membership_target",
        commissionPlanId: "   ",
        effectiveFrom: "2026-04-18"
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission assignment payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      commissionPlanId: "commissionPlanId is required."
    }
  });
});

test("handleCreateCommissionPlanAssignmentPost forwards validated assignment payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateCommissionPlanAssignmentPost(
    createAssignmentRequest(
      JSON.stringify({
        membershipId: "membership_target",
        commissionPlanId: "plan_1",
        effectiveFrom: "2026-04-18",
        effectiveTo: "2026-12-31"
      })
    ),
    createAccountingContext(),
    {
      assignCommissionPlanToMembership: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "assignment_1";
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    teamId: undefined,
    commissionPlanId: "plan_1",
    effectiveFrom: "2026-04-18",
    effectiveTo: "2026-12-31",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    assignmentId: "assignment_1"
  });
});
