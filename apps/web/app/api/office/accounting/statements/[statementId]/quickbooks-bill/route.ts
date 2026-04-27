import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  getAgentPayoutStatementQuickBooksBillDraft,
  markAgentPayoutStatementQuickBooksBillFailed,
  markAgentPayoutStatementQuickBooksBillPosted,
  type AgentPayoutStatementQuickBooksBillDraft,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

type QuickBooksBillRouteDependencies = {
  getAgentPayoutStatementQuickBooksBillDraft?: typeof getAgentPayoutStatementQuickBooksBillDraft;
  markAgentPayoutStatementQuickBooksBillFailed?: typeof markAgentPayoutStatementQuickBooksBillFailed;
  markAgentPayoutStatementQuickBooksBillPosted?: typeof markAgentPayoutStatementQuickBooksBillPosted;
  postQuickBooksBill?: typeof postQuickBooksBill;
};

type QuickBooksBillPostResult = {
  billId: string;
  docNumber: string;
};

type QuickBooksBillResponseBody = {
  Bill?: {
    Id?: string;
    DocNumber?: string;
  };
  Fault?: {
    Error?: Array<{
      Message?: string;
      Detail?: string;
      code?: string;
    }>;
  };
};

type QuickBooksTokenResponseBody = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

let cachedQuickBooksAccessToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

function readRequiredQuickBooksEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`QuickBooks is not configured. Missing ${name}.`);
  }

  return value;
}

function getQuickBooksApiBaseUrl() {
  return process.env.ACRE_QUICKBOOKS_API_BASE_URL?.trim() || "https://quickbooks.api.intuit.com";
}

function getQuickBooksMinorVersion() {
  return process.env.ACRE_QUICKBOOKS_MINOR_VERSION?.trim() || "75";
}

function formatQuickBooksFault(body: QuickBooksBillResponseBody | QuickBooksTokenResponseBody | null, fallback: string) {
  if (body && "Fault" in body && body.Fault?.Error?.length) {
    return body.Fault.Error.map((error) => [error.code, error.Message, error.Detail].filter(Boolean).join(": ")).join("; ");
  }

  if (body && "error_description" in body && body.error_description) {
    return body.error_description;
  }

  if (body && "error" in body && body.error) {
    return body.error;
  }

  return fallback;
}

async function getQuickBooksAccessToken(fetchImpl: typeof fetch) {
  if (cachedQuickBooksAccessToken && cachedQuickBooksAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedQuickBooksAccessToken.accessToken;
  }

  const clientId = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_CLIENT_ID");
  const clientSecret = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_CLIENT_SECRET");
  const refreshToken = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_REFRESH_TOKEN");
  const tokenResponse = await fetchImpl("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  const tokenBody = (await tokenResponse.json().catch(() => null)) as QuickBooksTokenResponseBody | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(formatQuickBooksFault(tokenBody, "Failed to refresh the QuickBooks access token."));
  }

  cachedQuickBooksAccessToken = {
    accessToken: tokenBody.access_token,
    expiresAt: Date.now() + Math.max(Number(tokenBody.expires_in ?? 3600) - 60, 60) * 1000
  };

  return tokenBody.access_token;
}

function buildQuickBooksBillPayload(draft: AgentPayoutStatementQuickBooksBillDraft) {
  const apAccountId = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_AP_ACCOUNT_ID");
  const expenseAccountId = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_AGENT_COMMISSION_EXPENSE_ACCOUNT_ID");

  return {
    VendorRef: {
      value: draft.vendorId
    },
    APAccountRef: {
      value: apAccountId
    },
    TxnDate: draft.txnDate,
    DueDate: draft.dueDate,
    DocNumber: draft.docNumber,
    PrivateNote: draft.privateNote,
    Line: draft.lines.map((line) => ({
      DetailType: "AccountBasedExpenseLineDetail",
      Amount: Number(line.amountValue),
      Description: line.description,
      AccountBasedExpenseLineDetail: {
        AccountRef: {
          value: expenseAccountId
        }
      }
    }))
  };
}

export async function postQuickBooksBill(
  draft: AgentPayoutStatementQuickBooksBillDraft,
  options: {
    fetchImpl?: typeof fetch;
  } = {}
): Promise<QuickBooksBillPostResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const realmId = readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_REALM_ID");
  const accessToken = await getQuickBooksAccessToken(fetchImpl);
  const url = new URL(`/v3/company/${realmId}/bill`, getQuickBooksApiBaseUrl());
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());
  url.searchParams.set("requestid", draft.requestId);

  const billResponse = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildQuickBooksBillPayload(draft))
  });
  const billBody = (await billResponse.json().catch(() => null)) as QuickBooksBillResponseBody | null;
  const billId = billBody?.Bill?.Id?.trim() ?? "";

  if (!billResponse.ok || !billId) {
    throw new Error(formatQuickBooksFault(billBody, "Failed to create the QuickBooks unpaid bill."));
  }

  return {
    billId,
    docNumber: billBody?.Bill?.DocNumber?.trim() || draft.docNumber
  };
}

export async function handlePostAccountingStatementQuickBooksBillPost(
  _request: NextRequest,
  statementId: string,
  context: SessionMembershipContext,
  dependencies: QuickBooksBillRouteDependencies = {}
) {
  let draft: AgentPayoutStatementQuickBooksBillDraft | null = null;

  try {
    draft = await (
      dependencies.getAgentPayoutStatementQuickBooksBillDraft ??
      getAgentPayoutStatementQuickBooksBillDraft
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId
    });

    if (!draft) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare the QuickBooks bill." },
      { status: 400 }
    );
  }

  let quickBooksBill: QuickBooksBillPostResult;

  try {
    quickBooksBill = await (dependencies.postQuickBooksBill ?? postQuickBooksBill)(draft);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to post the QuickBooks unpaid bill.";

    await (
      dependencies.markAgentPayoutStatementQuickBooksBillFailed ??
      markAgentPayoutStatementQuickBooksBillFailed
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      actorMembershipId: context.currentMembership.id,
      quickBooksBillRequestId: draft.requestId,
      errorMessage
    }).catch(() => null);

    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  try {
    const result = await (
      dependencies.markAgentPayoutStatementQuickBooksBillPosted ??
      markAgentPayoutStatementQuickBooksBillPosted
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      actorMembershipId: context.currentMembership.id,
      quickBooksBillId: quickBooksBill.billId,
      quickBooksBillDocNumber: quickBooksBill.docNumber,
      quickBooksBillRequestId: draft.requestId
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "QuickBooks bill was created, but Acre failed to record the posted state." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const { statementId } = await params;
  return handlePostAccountingStatementQuickBooksBillPost(request, statementId, context);
}
