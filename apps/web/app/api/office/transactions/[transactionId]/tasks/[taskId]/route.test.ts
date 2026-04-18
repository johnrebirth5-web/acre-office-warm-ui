import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeTransactionTaskPatch } from "./route";

function createOfficeTransactionTaskUpdateRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/tasks/task_1`,
    {
      method: "PATCH",
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
      id: "membership_1",
      permissions: ["tasks:manage"],
      role: "office_user",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeTransactionTaskPatch returns 400 validation_error for unsupported task statuses", async () => {
  const response = await handleUpdateOfficeTransactionTaskPatch(
    createOfficeTransactionTaskUpdateRequest(
      JSON.stringify({
        status: "Archived",
      }),
    ),
    "transaction_1",
    "task_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction task update payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status: "A supported task status is required.",
    },
  });
});

test("handleUpdateOfficeTransactionTaskPatch forwards task updates and preserves blank-title compatibility", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeTransactionTaskPatch(
    createOfficeTransactionTaskUpdateRequest(
      JSON.stringify({
        checklistGroup: "General",
        title: "   ",
        description: "Waiting on final review",
        assigneeMembershipId: "membership_2",
        dueAt: "2026-04-25T16:30:00.000Z",
        status: "Reopened",
        sortOrder: 4,
        requiresDocument: true,
        requiresDocumentApproval: true,
        requiresSecondaryApproval: true,
      }),
    ),
    "transaction_1",
    "task_1",
    createSessionContext(),
    {
      updateTransactionTask: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "task_1",
          title: "Untitled task",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    taskId: "task_1",
    actorMembershipId: "membership_1",
    checklistGroup: "General",
    title: "",
    description: "Waiting on final review",
    assigneeMembershipId: "membership_2",
    dueAt: "2026-04-25T16:30:00.000Z",
    status: "Reopened",
    sortOrder: 4,
    requiresDocument: true,
    requiresDocumentApproval: true,
    requiresSecondaryApproval: true,
  });
  assert.deepEqual(await readJson(response), {
    task: {
      id: "task_1",
      title: "Untitled task",
    },
  });
});
