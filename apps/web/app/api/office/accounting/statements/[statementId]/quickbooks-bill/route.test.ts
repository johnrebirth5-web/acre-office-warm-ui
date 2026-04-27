import assert from "node:assert/strict";
import test from "node:test";
import type { AgentPayoutStatementQuickBooksBillDraft } from "@acre/db";
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

function createDraft(
  overrides: Partial<AgentPayoutStatementQuickBooksBillDraft> = {}
): AgentPayoutStatementQuickBooksBillDraft {
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
    ],
    ...overrides
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
          docNumber: "ACRE-STMT-1",
          vendorId: "88"
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
    docNumber: "ACRE-STMT-1",
    vendorId: "88"
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
  assert.equal((billPayload as { VendorRef?: { value?: string } }).VendorRef?.value, "88");
  assert.equal(billPayload.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.value, "expense_nj");
});

test("postQuickBooksBill resolves a missing vendor id from an exact QuickBooks agent display name", async () => {
  const fetchCalls: Array<{
    url: string;
    body: string;
  }> = [];

  const result = await withQuickBooksEnv(
    {
      ACRE_QUICKBOOKS_CLIENT_ID: "client_name_lookup",
      ACRE_QUICKBOOKS_CLIENT_SECRET: "client_secret",
      ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON: JSON.stringify({
        "acre-nj-llc": {
          companyName: "ACRE NJ LLC",
          realmId: "realm_name_lookup",
          refreshToken: "refresh_name_lookup",
          apAccountId: "ap_nj",
          agentCommissionExpenseAccountId: "expense_nj"
        }
      })
    },
    async () =>
      postQuickBooksBill(createDraft({ vendorId: "" }) as never, {
        fetchImpl: async (input, init) => {
          fetchCalls.push({
            url: String(input),
            body: String(init?.body ?? "")
          });

          if (fetchCalls.length === 1) {
            return Response.json({
              access_token: "access_name_lookup",
              expires_in: 3600
            });
          }

          if (fetchCalls.length === 2) {
            return Response.json({
              QueryResponse: {}
            });
          }

          if (fetchCalls.length === 3) {
            return Response.json({
              QueryResponse: {
                Vendor: [
                  {
                    Id: "vendor_by_name",
                    DisplayName: "Casey Agent",
                    Active: true
                  }
                ]
              }
            });
          }

          return Response.json({
            Bill: {
              Id: "bill_name_lookup",
              DocNumber: "ACRE-STMT-1"
            }
          });
        }
      })
  );

  assert.deepEqual(result, {
    billId: "bill_name_lookup",
    docNumber: "ACRE-STMT-1",
    vendorId: "vendor_by_name"
  });
  assert.equal(fetchCalls.length, 4);

  const payeeLookupUrl = new URL(fetchCalls[1]?.url ?? "http://localhost");
  assert.equal(payeeLookupUrl.pathname, "/v3/company/realm_name_lookup/query");
  assert.equal(
    payeeLookupUrl.searchParams.get("query"),
    "select Id, DisplayName, Active from Vendor where DisplayName = 'Casey Agent LLC'"
  );

  const agentLookupUrl = new URL(fetchCalls[2]?.url ?? "http://localhost");
  assert.equal(agentLookupUrl.pathname, "/v3/company/realm_name_lookup/query");
  assert.equal(
    agentLookupUrl.searchParams.get("query"),
    "select Id, DisplayName, Active from Vendor where DisplayName = 'Casey Agent'"
  );

  const billPayload = JSON.parse(fetchCalls[3]?.body ?? "{}") as {
    VendorRef?: { value?: string };
  };
  assert.equal(billPayload.VendorRef?.value, "vendor_by_name");
});

test("handlePostAccountingStatementQuickBooksBillPost saves an auto-resolved vendor id after posting", async () => {
  let capturedProfileInput: Record<string, unknown> | null = null;

  const response = await handlePostAccountingStatementQuickBooksBillPost(
    createQuickBooksBillRequest(),
    "statement_1",
    createAccountingContext(),
    {
      getAgentPayoutStatementQuickBooksBillDraft: async () => createDraft({ vendorId: "" }) as never,
      postQuickBooksBill: async () => ({
        billId: "91",
        docNumber: "ACRE-STMT-1",
        vendorId: "vendor_by_name"
      }),
      saveAgentProfile: async (input) => {
        capturedProfileInput = input as Record<string, unknown>;
        return { id: "profile_1" } as never;
      },
      markAgentPayoutStatementQuickBooksBillPosted: async (input) => {
        return {
          statementId: input.statementId,
          quickBooksBillId: input.quickBooksBillId
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedProfileInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_agent",
    actorMembershipId: "membership_actor",
    quickBooksVendorId: "vendor_by_name"
  });
});
