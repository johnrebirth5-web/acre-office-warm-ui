import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleRunOfficeTransactionTaskWorkflowPost } from "./route";

function createOfficeTransactionTaskWorkflowRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/tasks/task_1/workflow`,
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

function createSessionContext(
  permissions?: string[],
  role = "office_user",
) {
  const currentMembership = {
    id: "membership_1",
    role,
  } as {
    id: string;
    role: string;
    permissions?: string[];
  };

  if (permissions) {
    currentMembership.permissions = permissions;
  }

  return {
    currentMembership,
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleRunOfficeTransactionTaskWorkflowPost returns 400 validation_error for unsupported workflow actions", async () => {
  const response = await handleRunOfficeTransactionTaskWorkflowPost(
    createOfficeTransactionTaskWorkflowRequest(
      JSON.stringify({
        action: "archive",
      }),
    ),
    "transaction_1",
    "task_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction task workflow payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "A valid workflow action is required.",
    },
  });
});

test("handleRunOfficeTransactionTaskWorkflowPost enforces review permissions for approve actions", async () => {
  const response = await handleRunOfficeTransactionTaskWorkflowPost(
    createOfficeTransactionTaskWorkflowRequest(
      JSON.stringify({
        action: "approve",
      }),
    ),
    "transaction_1",
    "task_1",
    createSessionContext(["tasks:manage"], "office_user"),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Document review permission required.",
  });
});

test("handleRunOfficeTransactionTaskWorkflowPost forwards normalized workflow payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleRunOfficeTransactionTaskWorkflowPost(
    createOfficeTransactionTaskWorkflowRequest(
      JSON.stringify({
        action: "reject",
        rejectionReason: "  Missing initials on page 4  ",
        source: "approve_docs_queue",
      }),
    ),
    "transaction_1",
    "task_1",
    createSessionContext(undefined, "owner"),
    {
      rejectTransactionTask: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "task_1",
          reviewStatus: "Rejected",
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
    rejectionReason: "Missing initials on page 4",
    activitySource: "approve_docs_queue",
  });
  assert.deepEqual(await readJson(response), {
    task: {
      id: "task_1",
      reviewStatus: "Rejected",
    },
  });
});
