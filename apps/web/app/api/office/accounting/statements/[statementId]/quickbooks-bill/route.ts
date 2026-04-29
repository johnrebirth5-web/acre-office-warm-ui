import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import {
  getAgentPayoutStatementEmailContext,
  getAgentPayoutStatementQuickBooksBillDraft,
  markAgentPayoutStatementQuickBooksBillFailed,
  markAgentPayoutStatementQuickBooksBillPosted,
  saveAgentProfile,
  type AgentPayoutStatementQuickBooksBillDraft,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import {
  appendOperationalEmailWarning,
  captureOperationalEmailWarning,
  sendPayoutStatementQuickBooksPostedOperationalEmail
} from "../../../../../../../lib/operational-email";
import { getAppBaseUrl } from "../../../../../../../lib/request-origin";

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
  saveAgentProfile?: typeof saveAgentProfile;
  getAgentPayoutStatementEmailContext?: typeof getAgentPayoutStatementEmailContext;
  sendPayoutStatementQuickBooksPostedOperationalEmail?: typeof sendPayoutStatementQuickBooksPostedOperationalEmail;
};

type QuickBooksBillPostResult = {
  billId: string;
  docNumber: string;
  vendorId?: string;
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

type QuickBooksVendor = {
  Id?: string;
  DisplayName?: string;
  Active?: boolean;
};

type QuickBooksVendorQueryResponseBody = {
  QueryResponse?: {
    Vendor?: QuickBooksVendor[];
  };
  Fault?: QuickBooksBillResponseBody["Fault"];
};

type QuickBooksVendorCreateResponseBody = {
  Vendor?: QuickBooksVendor;
  Fault?: QuickBooksBillResponseBody["Fault"];
};

type QuickBooksCompanyConnection = {
  key: string;
  companyName: string;
  realmId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  apAccountId: string;
  agentCommissionExpenseAccountId: string;
};

const cachedQuickBooksAccessTokens = new Map<
  string,
  {
    accessToken: string;
    expiresAt: number;
  }
>();

type QuickBooksOfficeConnectionRaw = Record<string, unknown>;

function readOptionalQuickBooksText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readQuickBooksConnectionField(entry: QuickBooksOfficeConnectionRaw, fieldName: string, envDescription: string) {
  const value = readOptionalQuickBooksText(entry[fieldName]);

  if (!value) {
    throw new Error(`QuickBooks is not configured. Missing ${envDescription}.`);
  }

  return value;
}

function readRequiredQuickBooksEnvFrom(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`QuickBooks is not configured. Missing ${names.join(" or ")}.`);
}

function readQuickBooksClientId() {
  return readRequiredQuickBooksEnvFrom(["ACRE_QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_ID"]);
}

function readQuickBooksClientSecret() {
  return readRequiredQuickBooksEnvFrom(["ACRE_QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_CLIENT_SECRET"]);
}

function readMappedQuickBooksConnections() {
  const raw = process.env.ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON?.trim();

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("QuickBooks is not configured. ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("QuickBooks is not configured. ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON must be a JSON object.");
  }

  const connections = new Map<string, QuickBooksCompanyConnection>();

  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`QuickBooks is not configured. Connection "${key}" must be a JSON object.`);
    }

    const entry = value as QuickBooksOfficeConnectionRaw;
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("QuickBooks is not configured. Connection keys cannot be blank.");
    }

    connections.set(normalizedKey, {
      key: normalizedKey,
      companyName: readOptionalQuickBooksText(entry.companyName) || normalizedKey,
      realmId: readQuickBooksConnectionField(entry, "realmId", `${normalizedKey}.realmId`),
      clientId: readOptionalQuickBooksText(entry.clientId) || readQuickBooksClientId(),
      clientSecret: readOptionalQuickBooksText(entry.clientSecret) || readQuickBooksClientSecret(),
      refreshToken: readQuickBooksConnectionField(entry, "refreshToken", `${normalizedKey}.refreshToken`),
      apAccountId: readQuickBooksConnectionField(entry, "apAccountId", `${normalizedKey}.apAccountId`),
      agentCommissionExpenseAccountId: readQuickBooksConnectionField(
        entry,
        "agentCommissionExpenseAccountId",
        `${normalizedKey}.agentCommissionExpenseAccountId`
      )
    });
  }

  return connections;
}

function resolveQuickBooksCompanyConnection(draft: AgentPayoutStatementQuickBooksBillDraft): QuickBooksCompanyConnection {
  const mappedConnections = readMappedQuickBooksConnections();

  if (mappedConnections) {
    const keys = [draft.officeSlug, draft.officeId, draft.officeLabel].map((value) => value.trim()).filter(Boolean);

    for (const key of keys) {
      const connection = mappedConnections.get(key);

      if (connection) {
        return connection;
      }
    }

    const expectedKey = draft.officeSlug || draft.officeId || draft.officeLabel || "this office";
    throw new Error(
      `QuickBooks company mapping is not configured for ${draft.officeLabel || "this statement office"}. Add ${expectedKey} to ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON.`
    );
  }

  if (
    !process.env.ACRE_QUICKBOOKS_REALM_ID?.trim() &&
    !process.env.ACRE_QUICKBOOKS_REFRESH_TOKEN?.trim() &&
    !process.env.ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON?.trim()
  ) {
    const expectedKey = draft.officeSlug || draft.officeId || draft.officeLabel || "this office";
    throw new Error(
      `QuickBooks bill posting is not configured for ${draft.officeLabel || "this statement office"}. Add a ${expectedKey} entry to ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON before posting payout statements.`
    );
  }

  return {
    key: "default",
    companyName: process.env.ACRE_QUICKBOOKS_COMPANY_NAME?.trim() || "QuickBooks",
    realmId: readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_REALM_ID"),
    clientId: readQuickBooksClientId(),
    clientSecret: readQuickBooksClientSecret(),
    refreshToken: readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_REFRESH_TOKEN"),
    apAccountId: readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_AP_ACCOUNT_ID"),
    agentCommissionExpenseAccountId: readRequiredQuickBooksEnv("ACRE_QUICKBOOKS_AGENT_COMMISSION_EXPENSE_ACCOUNT_ID")
  };
}

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

function formatQuickBooksFault(
  body:
    | QuickBooksBillResponseBody
    | QuickBooksTokenResponseBody
    | QuickBooksVendorQueryResponseBody
    | QuickBooksVendorCreateResponseBody
    | null,
  fallback: string
) {
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

async function getQuickBooksAccessToken(fetchImpl: typeof fetch, connection: QuickBooksCompanyConnection) {
  const cacheKey = `${connection.realmId}:${connection.clientId}`;
  const cachedQuickBooksAccessToken = cachedQuickBooksAccessTokens.get(cacheKey);

  if (cachedQuickBooksAccessToken && cachedQuickBooksAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedQuickBooksAccessToken.accessToken;
  }

  const tokenResponse = await fetchImpl("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${connection.clientId}:${connection.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken
    })
  });
  const tokenBody = (await tokenResponse.json().catch(() => null)) as QuickBooksTokenResponseBody | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(formatQuickBooksFault(tokenBody, "Failed to refresh the QuickBooks access token."));
  }

  cachedQuickBooksAccessTokens.set(cacheKey, {
    accessToken: tokenBody.access_token,
    expiresAt: Date.now() + Math.max(Number(tokenBody.expires_in ?? 3600) - 60, 60) * 1000
  });

  return tokenBody.access_token;
}

function getQuickBooksVendorLookupNames(draft: AgentPayoutStatementQuickBooksBillDraft) {
  return Array.from(
    new Set([draft.payeeLabel, draft.agentLabel].map((value) => value.trim()).filter(Boolean))
  );
}

function escapeQuickBooksQueryString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildQuickBooksVendorLookupError(draft: AgentPayoutStatementQuickBooksBillDraft) {
  const lookupNames = getQuickBooksVendorLookupNames(draft);

  if (lookupNames.length === 0) {
    return "Add a QuickBooks Vendor ID on this agent profile before posting the payout statement.";
  }

  return `A QuickBooks Vendor could not be resolved or created for "${lookupNames[0]}".`;
}

async function findQuickBooksVendorIdByDisplayName(input: {
  accessToken: string;
  connection: QuickBooksCompanyConnection;
  fetchImpl: typeof fetch;
  displayName: string;
}) {
  const url = new URL(`/v3/company/${input.connection.realmId}/query`, getQuickBooksApiBaseUrl());
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());
  url.searchParams.set(
    "query",
    `select Id, DisplayName, Active from Vendor where DisplayName = '${escapeQuickBooksQueryString(input.displayName)}'`
  );

  const vendorResponse = await input.fetchImpl(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`
    }
  });
  const vendorBody = (await vendorResponse.json().catch(() => null)) as QuickBooksVendorQueryResponseBody | null;

  if (!vendorResponse.ok) {
    throw new Error(formatQuickBooksFault(vendorBody, "Failed to find the QuickBooks vendor."));
  }

  const matches = (vendorBody?.QueryResponse?.Vendor ?? []).filter((vendor) => {
    const vendorId = vendor.Id?.trim() ?? "";
    const displayName = vendor.DisplayName?.trim() ?? "";

    return vendorId.length > 0 && vendor.Active !== false && displayName === input.displayName;
  });

  if (matches.length > 1) {
    throw new Error(
      `QuickBooks returned multiple active vendors named "${input.displayName}". Save the QuickBooks Vendor ID on the agent profile before posting.`
    );
  }

  return matches[0]?.Id?.trim() ?? "";
}

async function findQuickBooksVendorIdById(input: {
  accessToken: string;
  connection: QuickBooksCompanyConnection;
  fetchImpl: typeof fetch;
  vendorId: string;
}) {
  const vendorId = input.vendorId.trim();

  if (!vendorId) {
    return "";
  }

  const url = new URL(`/v3/company/${input.connection.realmId}/query`, getQuickBooksApiBaseUrl());
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());
  url.searchParams.set("query", `select Id, DisplayName, Active from Vendor where Id = '${escapeQuickBooksQueryString(vendorId)}'`);

  const vendorResponse = await input.fetchImpl(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`
    }
  });
  const vendorBody = (await vendorResponse.json().catch(() => null)) as QuickBooksVendorQueryResponseBody | null;

  if (!vendorResponse.ok) {
    throw new Error(formatQuickBooksFault(vendorBody, "Failed to validate the saved QuickBooks vendor."));
  }

  const vendor = (vendorBody?.QueryResponse?.Vendor ?? []).find((entry) => {
    return entry.Id?.trim() === vendorId && entry.Active !== false;
  });

  return vendor?.Id?.trim() ?? "";
}

async function createQuickBooksVendorByDisplayName(input: {
  accessToken: string;
  connection: QuickBooksCompanyConnection;
  fetchImpl: typeof fetch;
  displayName: string;
}) {
  const url = new URL(`/v3/company/${input.connection.realmId}/vendor`, getQuickBooksApiBaseUrl());
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());

  const vendorResponse = await input.fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      DisplayName: input.displayName
    })
  });
  const vendorBody = (await vendorResponse.json().catch(() => null)) as QuickBooksVendorCreateResponseBody | null;
  const vendorId = vendorBody?.Vendor?.Id?.trim() ?? "";

  if (!vendorResponse.ok || !vendorId) {
    throw new Error(formatQuickBooksFault(vendorBody, `Failed to create the QuickBooks vendor "${input.displayName}".`));
  }

  return vendorId;
}

async function resolveQuickBooksVendorIdByName(input: {
  draft: AgentPayoutStatementQuickBooksBillDraft;
  accessToken: string;
  connection: QuickBooksCompanyConnection;
  fetchImpl: typeof fetch;
  staleVendorId?: string;
}) {
  const lookupNames = getQuickBooksVendorLookupNames(input.draft);

  for (const displayName of lookupNames) {
    const vendorId = await findQuickBooksVendorIdByDisplayName({
      accessToken: input.accessToken,
      connection: input.connection,
      fetchImpl: input.fetchImpl,
      displayName
    });

    if (vendorId) {
      return vendorId;
    }
  }

  const createDisplayName = lookupNames[0];

  if (!createDisplayName) {
    if (input.staleVendorId) {
      throw new Error(
        `Saved QuickBooks Vendor ID "${input.staleVendorId}" was not found in ${input.connection.companyName}. Update the agent profile before posting the payout statement.`
      );
    }

    throw new Error(buildQuickBooksVendorLookupError(input.draft));
  }

  return createQuickBooksVendorByDisplayName({
    accessToken: input.accessToken,
    connection: input.connection,
    fetchImpl: input.fetchImpl,
    displayName: createDisplayName
  });
}

async function resolveQuickBooksVendorId(input: {
  draft: AgentPayoutStatementQuickBooksBillDraft;
  accessToken: string;
  connection: QuickBooksCompanyConnection;
  fetchImpl: typeof fetch;
}) {
  const savedVendorId = input.draft.vendorId.trim();

  if (savedVendorId) {
    const vendorId = await findQuickBooksVendorIdById({
      accessToken: input.accessToken,
      connection: input.connection,
      fetchImpl: input.fetchImpl,
      vendorId: savedVendorId
    });

    if (vendorId) {
      return vendorId;
    }
  }

  return resolveQuickBooksVendorIdByName({
    ...input,
    staleVendorId: savedVendorId
  });
}

function buildQuickBooksBillPayload(
  draft: AgentPayoutStatementQuickBooksBillDraft,
  connection: QuickBooksCompanyConnection,
  vendorId: string
) {
  return {
    VendorRef: {
      value: vendorId
    },
    APAccountRef: {
      value: connection.apAccountId
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
          value: connection.agentCommissionExpenseAccountId
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
  const connection = resolveQuickBooksCompanyConnection(draft);
  const accessToken = await getQuickBooksAccessToken(fetchImpl, connection);
  const vendorId = await resolveQuickBooksVendorId({
    draft,
    accessToken,
    connection,
    fetchImpl
  });
  const url = new URL(`/v3/company/${connection.realmId}/bill`, getQuickBooksApiBaseUrl());
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());
  url.searchParams.set("requestid", draft.requestId);

  const billResponse = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildQuickBooksBillPayload(draft, connection, vendorId))
  });
  const billBody = (await billResponse.json().catch(() => null)) as QuickBooksBillResponseBody | null;
  const billId = billBody?.Bill?.Id?.trim() ?? "";

  if (!billResponse.ok || !billId) {
    throw new Error(formatQuickBooksFault(billBody, "Failed to create the QuickBooks unpaid bill."));
  }

  return {
    billId,
    docNumber: billBody?.Bill?.DocNumber?.trim() || draft.docNumber,
    vendorId
  };
}

export async function handlePostAccountingStatementQuickBooksBillPost(
  request: NextRequest,
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

  const savedVendorId = draft.vendorId.trim();
  const resolvedVendorId = quickBooksBill.vendorId?.trim() ?? "";

  if (resolvedVendorId && resolvedVendorId !== savedVendorId) {
    await (dependencies.saveAgentProfile ?? saveAgentProfile)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: draft.membershipId,
      actorMembershipId: context.currentMembership.id,
      quickBooksVendorId: resolvedVendorId
    }).catch(() => null);
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

    const emailWarning = await captureOperationalEmailWarning("payout statement QuickBooks bill posted", async () => {
      const statement = await (
        dependencies.getAgentPayoutStatementEmailContext ?? getAgentPayoutStatementEmailContext
      )({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        statementId
      });

      if (!statement) {
        return;
      }

      await (
        dependencies.sendPayoutStatementQuickBooksPostedOperationalEmail ??
        sendPayoutStatementQuickBooksPostedOperationalEmail
      )({
        organizationId: context.currentOrganization.id,
        baseUrl: getAppBaseUrl(request),
        statement
      });
    });

    return NextResponse.json(appendOperationalEmailWarning(result as Record<string, unknown>, emailWarning));
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
