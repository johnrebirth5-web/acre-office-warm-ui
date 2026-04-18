import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeTransactionTaskPost } from "./route";

function createOfficeTransactionTaskRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/tasks`,
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

test("handleCreateOfficeTransactionTaskPost returns 400 validation_error when title is blank", async () => {
  const response = await handleCreateOfficeTransactionTaskPost(
    createOfficeTransactionTaskRequest(
      JSON.stringify({
        title: "   ",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction task payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      title: "Task title is required.",
    },
  });
});

test("handleCreateOfficeTransactionTaskPost forwards normalized task fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeTransactionTaskPost(
    createOfficeTransactionTaskRequest(
      JSON.stringify({
        checklistGroup: "Compliance",
        title: "Request HOA certificate",
        description: "Need it before review",
        assigneeMembershipId: "membership_2",
        dueAt: "2026-04-20T14:00:00.000Z",
        status: "In progress",
        requiresDocument: true,
        requiresDocumentApproval: true,
        requiresSecondaryApproval: false,
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      createTransactionTask: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "task_1",
          title: "Request HOA certificate",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    checklistGroup: "Compliance",
    title: "Request HOA certificate",
    description: "Need it before review",
    assigneeMembershipId: "membership_2",
    dueAt: "2026-04-20T14:00:00.000Z",
    status: "In progress",
    requiresDocument: true,
    requiresDocumentApproval: true,
    requiresSecondaryApproval: false,
  });
  assert.deepEqual(await readJson(response), {
    task: {
      id: "task_1",
      title: "Request HOA certificate",
    },
  });
});
