import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handlePostAccountingStatementQuickBooksBillPost } from "./route";

function createQuickBooksBillRequest(origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/statements/statement_1/quickbooks-bill`, {
    method: "POST",
    headers: {
      origin
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

function createDraft() {
  return {
    statementId: "statement_1",
    membershipId: "membership_agent",
    agentLabel: "Casey Agent",
    payeeLabel: "Casey Agent LLC",
    vendorId: "88",
    docNumber: "ACRE-STMT-1",
    requestId: "acre-qb-bill-statement_1",
    txnDate: "2026-04-27",
    dueDate: "2026-04-27",
    totalAmountValue: "1250",
    lineDescription: "Acre payout statement ACRE-STMT-1",
    privateNote: "Acre payout statement",
    lines: [
      {
        description: "Acre payout statement ACRE-STMT-1",
        amountValue: "1250"
      }
    ]
  };
}

test("handlePostAccountingStatementQuickBooksBillPost posts draft and marks the statement posted", async () => {
  let capturedPostDraft: Record<string, unknown> | null = null;
  let capturedPostedInput: Record<string, unknown> | null = null;

  const response = await handlePostAccountingStatementQuickBooksBillPost(
    createQuickBooksBillRequest(),
    "statement_1",
    createAccountingContext(),
    {
      getAgentPayoutStatementQuickBooksBillDraft: async () => createDraft() as never,
      postQuickBooksBill: async (draft) => {
        capturedPostDraft = draft as unknown as Record<string, unknown>;
        return {
          billId: "91",
          docNumber: "ACRE-STMT-1"
        };
      },
      markAgentPayoutStatementQuickBooksBillPosted: async (input) => {
        capturedPostedInput = input as Record<string, unknown>;
        return {
          statementId: input.statementId,
          quickBooksBillId: input.quickBooksBillId
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedPostDraft?.["vendorId"], "88");
  assert.deepEqual(capturedPostedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    statementId: "statement_1",
    actorMembershipId: "membership_actor",
    quickBooksBillId: "91",
    quickBooksBillDocNumber: "ACRE-STMT-1",
    quickBooksBillRequestId: "acre-qb-bill-statement_1"
  });
  assert.deepEqual(await readJson(response), {
    statementId: "statement_1",
    quickBooksBillId: "91"
  });
});

test("handlePostAccountingStatementQuickBooksBillPost records a failed QuickBooks post", async () => {
  let capturedFailedInput: Record<string, unknown> | null = null;

  const response = await handlePostAccountingStatementQuickBooksBillPost(
    createQuickBooksBillRequest(),
    "statement_1",
    createAccountingContext(),
    {
      getAgentPayoutStatementQuickBooksBillDraft: async () => createDraft() as never,
      postQuickBooksBill: async () => {
        throw new Error("QuickBooks rejected the bill.");
      },
      markAgentPayoutStatementQuickBooksBillFailed: async (input) => {
        capturedFailedInput = input as Record<string, unknown>;
        return {
          statementId: input.statementId,
          quickBooksBillStatus: "failed"
        } as never;
      }
    }
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await readJson(response), {
    error: "QuickBooks rejected the bill."
  });
  assert.deepEqual(capturedFailedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    statementId: "statement_1",
    actorMembershipId: "membership_actor",
    quickBooksBillRequestId: "acre-qb-bill-statement_1",
    errorMessage: "QuickBooks rejected the bill."
  });
});

test("handlePostAccountingStatementQuickBooksBillPost returns 400 when the statement is not ready", async () => {
  const response = await handlePostAccountingStatementQuickBooksBillPost(
    createQuickBooksBillRequest(),
    "statement_1",
    createAccountingContext(),
    {
      getAgentPayoutStatementQuickBooksBillDraft: async () => {
        throw new Error("Only payout statements confirmed by the agent can be posted to QuickBooks.");
      }
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Only payout statements confirmed by the agent can be posted to QuickBooks."
  });
});
