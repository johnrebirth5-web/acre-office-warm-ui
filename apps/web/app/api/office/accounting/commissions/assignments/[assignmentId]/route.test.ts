import assert from "node:assert/strict";
import test from "node:test";
import * as routeModule from "./route";

const routeExports = ("default" in routeModule ? routeModule.default : routeModule) as {
  handleDeleteCommissionPlanAssignmentDelete: typeof import("./route").handleDeleteCommissionPlanAssignmentDelete;
};

const { handleDeleteCommissionPlanAssignmentDelete } = routeExports;

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

test("handleDeleteCommissionPlanAssignmentDelete returns 404 when assignment is missing", async () => {
  const response = await handleDeleteCommissionPlanAssignmentDelete(createAccountingContext(), "assignment_missing", {
    deleteCommissionPlanAssignment: async () => null
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Commission assignment not found."
  });
});

test("handleDeleteCommissionPlanAssignmentDelete forwards validated delete payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleDeleteCommissionPlanAssignmentDelete(createAccountingContext(), "assignment_1", {
    deleteCommissionPlanAssignment: async (input) => {
      capturedInput = input as Record<string, unknown>;
      return "assignment_1";
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    assignmentId: "assignment_1",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    assignmentId: "assignment_1"
  });
});
