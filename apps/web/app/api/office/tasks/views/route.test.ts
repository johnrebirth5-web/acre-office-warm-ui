import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeTaskViewPost } from "./route";

function createTaskViewRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/tasks/views`, {
    method: "POST",
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
      permissions: ["tasks:manage"],
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

test("handleCreateOfficeTaskViewPost returns 400 validation_error for unsupported visibleColumns payloads", async () => {
  const response = await handleCreateOfficeTaskViewPost(
    createTaskViewRequest(
      JSON.stringify({
        name: "Ops queue",
        visibleColumns: "title"
      })
    ),
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Task view payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      visibleColumns: "Invalid input: expected array, received string"
    }
  });
});

test("handleCreateOfficeTaskViewPost forwards normalized task view payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeTaskViewPost(
    createTaskViewRequest(
      JSON.stringify({
        name: "Ops queue",
        isShared: true,
        filters: {
          transactionStatus: "Active",
          assigneeMembershipId: "",
          dueWindow: "",
          noDueDate: false,
          reviewStatus: "",
          requiresSecondaryApproval: false,
          complianceStatuses: [],
          transactionId: "",
          q: "",
          includeCompleted: false
        },
        visibleColumns: ["task", "dueDate"],
        sort: {
          field: "dueAt",
          direction: "asc",
          nulls: "last"
        }
      })
    ),
    createSessionContext(),
    {
      saveTaskListView: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "view_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    name: "Ops queue",
    isShared: true,
    filters: {
      transactionStatus: "Active",
      assigneeMembershipId: "",
      dueWindow: "",
      noDueDate: false,
      reviewStatus: "",
      requiresSecondaryApproval: false,
      complianceStatuses: [],
      transactionId: "",
      q: "",
      includeCompleted: false
    },
    visibleColumns: ["task", "dueDate"],
    sort: {
      field: "dueAt",
      direction: "asc",
      nulls: "last"
    }
  });
  assert.deepEqual(await readJson(response), {
    view: {
      id: "view_1"
    }
  });
});
