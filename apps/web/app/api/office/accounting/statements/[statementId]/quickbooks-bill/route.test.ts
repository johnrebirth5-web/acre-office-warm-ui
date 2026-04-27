import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handlePostAccountingStatementQuickBooksBillPost, postQuickBooksBill } from "./route";

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
    officeId: "office_1",
    officeSlug: "acre-nj-llc",
    officeLabel: "Acre NJ LLC",
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

function withQuickBooksEnv<T>(values: Record<string, string | undefined>, callback: () => Promise<T>) {
  const previousValues = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previousValues.set(key, process.env[key]);

    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  return callback().finally(() => {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
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

test("postQuickBooksBill uses the QuickBooks company mapped to the statement office", async () => {
  const fetchCalls: Array<{
    url: string;
    body: string;
    authorization: string;
  }> = [];

  const result = await withQuickBooksEnv(
    {
      ACRE_QUICKBOOKS_CLIENT_ID: "client_id",
      ACRE_QUICKBOOKS_CLIENT_SECRET: "client_secret",
      ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON: JSON.stringify({
        "acre-nj-llc": {
          companyName: "ACRE NJ LLC",
          realmId: "realm_nj",
          refreshToken: "refresh_nj",
          apAccountId: "ap_nj",
          agentCommissionExpenseAccountId: "expense_nj"
        },
        "acre-ny-realty": {
          companyName: "ACRE NY REALTY INC",
          realmId: "realm_ny_realty",
          refreshToken: "refresh_ny_realty",
          apAccountId: "ap_ny_realty",
          agentCommissionExpenseAccountId: "expense_ny_realty"
        }
      })
    },
    async () =>
      postQuickBooksBill(createDraft() as never, {
        fetchImpl: async (input, init) => {
          fetchCalls.push({
            url: String(input),
            body: String(init?.body ?? ""),
            authorization: String(init?.headers instanceof Headers ? init.headers.get("Authorization") : (init?.headers as Record<string, string> | undefined)?.Authorization)
          });

          if (fetchCalls.length === 1) {
            return Response.json({
              access_token: "access_nj",
              expires_in: 3600
            });
          }

          return Response.json({
            Bill: {
              Id: "bill_nj",
              DocNumber: "ACRE-STMT-1"
            }
          });
        }
      })
  );

  assert.deepEqual(result, {
    billId: "bill_nj",
    docNumber: "ACRE-STMT-1"
  });
  assert.equal(fetchCalls[0]?.url, "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer");
  assert.equal(fetchCalls[0]?.body, "grant_type=refresh_token&refresh_token=refresh_nj");
  assert.equal(fetchCalls[1]?.url, "https://quickbooks.api.intuit.com/v3/company/realm_nj/bill?minorversion=75&requestid=acre-qb-bill-statement_1");
  assert.equal(fetchCalls[1]?.authorization, "Bearer access_nj");

  const billPayload = JSON.parse(fetchCalls[1]?.body ?? "{}") as {
    APAccountRef?: { value?: string };
    Line?: Array<{
      AccountBasedExpenseLineDetail?: {
        AccountRef?: { value?: string };
      };
    }>;
  };

  assert.equal(billPayload.APAccountRef?.value, "ap_nj");
  assert.equal(billPayload.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.value, "expense_nj");
});
