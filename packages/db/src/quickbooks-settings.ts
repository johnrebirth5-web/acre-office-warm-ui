import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

const DEV_SETTINGS_SECRET = "acre-local-session-dev-only";
const quickBooksSecretAlgorithm = "aes-256-gcm";
const quickBooksSecretVersion = "v1";
const quickBooksSecretIvBytes = 12;
const quickBooksAccountingScope = "com.intuit.quickbooks.accounting";
const quickBooksAuthorizationEndpoint = "https://appcenter.intuit.com/connect/oauth2";
const quickBooksTokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const tokenRefreshSkewMs = 2 * 60 * 1000;

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
type QuickBooksEnvironment = "production" | "sandbox";
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type OrganizationQuickBooksConnectionRecord = Awaited<ReturnType<typeof loadOrganizationQuickBooksConnection>>;

type QuickBooksTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
};

type QuickBooksCompanyInfoResponse = {
  CompanyInfo?: {
    CompanyName?: string | null;
    LegalName?: string | null;
  } | null;
};

export type OfficeQuickBooksSettingsSnapshot = {
  summary: {
    statusLabel: string;
    statusTone: BadgeTone;
    canConnect: boolean;
    canValidate: boolean;
    environmentLabel: string;
    companyLabel: string;
  };
  settings: {
    source: "database" | "none";
    isEnabled: boolean;
    isConnected: boolean;
    realmId: string;
    companyName: string;
    legalName: string;
    scope: string;
    tokenType: string;
    hasStoredAccessToken: boolean;
    hasStoredRefreshToken: boolean;
    accessTokenExpiresAtLabel: string;
    refreshTokenExpiresAtLabel: string;
    connectedAtLabel: string;
    lastValidatedAtLabel: string;
    lastValidationStatus: string;
    lastValidationMessage: string;
    updatedAtLabel: string;
    updatedByLabel: string;
    encryptionReady: boolean;
    clientConfigured: boolean;
    authorizationScope: string;
    environment: QuickBooksEnvironment;
  };
};

export type BuildQuickBooksAuthorizationUrlInput = {
  redirectUri: string;
  state: string;
};

export type ConnectOrganizationQuickBooksConnectionInput = {
  organizationId: string;
  actorMembershipId: string;
  code: string;
  realmId: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
};

export type DeleteOrganizationQuickBooksConnectionInput = {
  organizationId: string;
  actorMembershipId: string;
};

export type ValidateOrganizationQuickBooksConnectionInput = {
  organizationId: string;
  actorMembershipId: string;
  fetchImpl?: FetchLike;
};

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredString(value: string | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function resolveEncryptionSecret() {
  const dedicatedSecret = process.env.ACRE_SETTINGS_ENCRYPTION_SECRET?.trim();

  if (dedicatedSecret) {
    return dedicatedSecret;
  }

  const sessionSecret = process.env.ACRE_SESSION_SECRET?.trim();

  if (sessionSecret) {
    return sessionSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_SETTINGS_SECRET;
  }

  throw new Error(
    "Saved QuickBooks tokens require ACRE_SETTINGS_ENCRYPTION_SECRET or ACRE_SESSION_SECRET."
  );
}

function hasEncryptionSecret() {
  try {
    void resolveEncryptionSecret();
    return true;
  } catch {
    return false;
  }
}

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(`acre-quickbooks:${secret}`).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(quickBooksSecretIvBytes);
  const cipher = createCipheriv(quickBooksSecretAlgorithm, deriveEncryptionKey(resolveEncryptionSecret()), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    quickBooksSecretVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

function decryptSecret(payload: string) {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split(":");

  if (version !== quickBooksSecretVersion || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Saved QuickBooks tokens are not readable.");
  }

  const decipher = createDecipheriv(
    quickBooksSecretAlgorithm,
    deriveEncryptionKey(resolveEncryptionSecret()),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function getQuickBooksEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
}

function getQuickBooksApiBaseUrl() {
  return getQuickBooksEnvironment() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
    : "https://quickbooks.api.intuit.com/v3/company";
}

function getQuickBooksClientConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? "";

  return {
    clientId,
    clientSecret,
    isConfigured: Boolean(clientId && clientSecret),
    environment: getQuickBooksEnvironment()
  };
}

function assertQuickBooksClientConfig() {
  const config = getQuickBooksClientConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("QuickBooks OAuth requires QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.");
  }

  return config;
}

function buildUpdatedByLabel(record: OrganizationQuickBooksConnectionRecord) {
  const firstName = record?.updatedByMembership?.user.firstName?.trim() ?? "";
  const lastName = record?.updatedByMembership?.user.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();

  return name || record?.updatedByMembership?.user.email || "—";
}

function buildDateLabel(value: Date | null | undefined) {
  return formatDateTimeLabel(value);
}

function buildStatus(record: OrganizationQuickBooksConnectionRecord): {
  statusLabel: string;
  statusTone: BadgeTone;
} {
  if (!record) {
    return {
      statusLabel: "Not connected",
      statusTone: "neutral"
    };
  }

  if (!record.isEnabled || record.disconnectedAt) {
    return {
      statusLabel: "Disconnected",
      statusTone: "warning"
    };
  }

  if (!record.encryptedAccessToken || !record.encryptedRefreshToken) {
    return {
      statusLabel: "Token missing",
      statusTone: "danger"
    };
  }

  if (record.lastValidationStatus === "error") {
    return {
      statusLabel: "Needs review",
      statusTone: "warning"
    };
  }

  return {
    statusLabel: "Connected",
    statusTone: "success"
  };
}

async function loadOrganizationQuickBooksConnection(organizationId: string) {
  return prisma.organizationQuickBooksConnection.findUnique({
    where: {
      organizationId
    },
    include: {
      updatedByMembership: {
        select: {
          id: true,
          role: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  });
}

export async function getOfficeQuickBooksSettingsSnapshot(input: {
  organizationId: string;
}): Promise<OfficeQuickBooksSettingsSnapshot> {
  const record = await loadOrganizationQuickBooksConnection(input.organizationId);
  const config = getQuickBooksClientConfig();
  const status = buildStatus(record);
  const isConnected = Boolean(record?.isEnabled && !record.disconnectedAt && record.encryptedAccessToken && record.encryptedRefreshToken);
  const companyLabel = record?.companyName || record?.legalName || record?.realmId || "—";

  return {
    summary: {
      ...status,
      canConnect: config.isConfigured && hasEncryptionSecret(),
      canValidate: isConnected,
      environmentLabel: config.environment === "sandbox" ? "Sandbox" : "Production",
      companyLabel
    },
    settings: {
      source: record ? "database" : "none",
      isEnabled: record?.isEnabled ?? false,
      isConnected,
      realmId: record?.realmId ?? "",
      companyName: record?.companyName ?? "",
      legalName: record?.legalName ?? "",
      scope: record?.scope ?? "",
      tokenType: record?.tokenType ?? "",
      hasStoredAccessToken: Boolean(record?.encryptedAccessToken),
      hasStoredRefreshToken: Boolean(record?.encryptedRefreshToken),
      accessTokenExpiresAtLabel: buildDateLabel(record?.accessTokenExpiresAt),
      refreshTokenExpiresAtLabel: buildDateLabel(record?.refreshTokenExpiresAt),
      connectedAtLabel: buildDateLabel(record?.connectedAt),
      lastValidatedAtLabel: buildDateLabel(record?.lastValidatedAt),
      lastValidationStatus: record?.lastValidationStatus ?? "",
      lastValidationMessage: record?.lastValidationMessage ?? "",
      updatedAtLabel: buildDateLabel(record?.updatedAt),
      updatedByLabel: buildUpdatedByLabel(record),
      encryptionReady: hasEncryptionSecret(),
      clientConfigured: config.isConfigured,
      authorizationScope: quickBooksAccountingScope,
      environment: config.environment
    }
  };
}

export function buildQuickBooksAuthorizationUrl(input: BuildQuickBooksAuthorizationUrlInput) {
  const config = assertQuickBooksClientConfig();
  const url = new URL(quickBooksAuthorizationEndpoint);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", quickBooksAccountingScope);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);

  return url.toString();
}

function buildTokenExpiry(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }

  return new Date(Date.now() + Math.max(0, seconds) * 1000);
}

async function readResponseJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function extractQuickBooksError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const fault = record.Fault;

  if (fault && typeof fault === "object") {
    const errors = (fault as Record<string, unknown>).Error;

    if (Array.isArray(errors)) {
      const messages = errors
        .map((error) => {
          if (!error || typeof error !== "object") {
            return null;
          }

          const errorRecord = error as Record<string, unknown>;
          return String(errorRecord.Message ?? errorRecord.Detail ?? "").trim();
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  }

  const errorDescription = String(record.error_description ?? "").trim();

  if (errorDescription) {
    return errorDescription;
  }

  const error = String(record.error ?? "").trim();

  return error || fallback;
}

async function requestQuickBooksToken(body: URLSearchParams, fetchImpl: FetchLike = fetch) {
  const config = assertQuickBooksClientConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetchImpl(quickBooksTokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(extractQuickBooksError(payload, "QuickBooks token request failed."));
  }

  const token = payload as QuickBooksTokenResponse;

  if (!token.access_token) {
    throw new Error("QuickBooks did not return an access token.");
  }

  return token;
}

async function exchangeQuickBooksAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri
  });
  const token = await requestQuickBooksToken(body, input.fetchImpl);

  if (!token.refresh_token) {
    throw new Error("QuickBooks did not return a refresh token.");
  }

  return token;
}

async function refreshQuickBooksToken(input: {
  refreshToken: string;
  fetchImpl?: FetchLike;
}) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken
  });
  const token = await requestQuickBooksToken(body, input.fetchImpl);

  if (!token.refresh_token) {
    throw new Error("QuickBooks did not return a refreshed refresh token.");
  }

  return token;
}

async function fetchQuickBooksCompanyInfo(input: {
  realmId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}) {
  const response = await (input.fetchImpl ?? fetch)(
    `${getQuickBooksApiBaseUrl()}/${encodeURIComponent(input.realmId)}/companyinfo/${encodeURIComponent(input.realmId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`
      }
    }
  );
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(extractQuickBooksError(payload, "QuickBooks company info request failed."));
  }

  const companyInfo = (payload as QuickBooksCompanyInfoResponse).CompanyInfo;

  return {
    companyName: normalizeOptionalString(companyInfo?.CompanyName),
    legalName: normalizeOptionalString(companyInfo?.LegalName)
  };
}

function buildTokenPersistence(token: QuickBooksTokenResponse) {
  return {
    encryptedAccessToken: encryptSecret(normalizeRequiredString(token.access_token, "QuickBooks access token")),
    encryptedRefreshToken: encryptSecret(normalizeRequiredString(token.refresh_token, "QuickBooks refresh token")),
    accessTokenExpiresAt: buildTokenExpiry(token.expires_in),
    refreshTokenExpiresAt: buildTokenExpiry(token.x_refresh_token_expires_in),
    tokenType: normalizeOptionalString(token.token_type),
    scope: normalizeOptionalString(token.scope)
  };
}

export async function connectOrganizationQuickBooksConnection(
  input: ConnectOrganizationQuickBooksConnectionInput
) {
  const code = normalizeRequiredString(input.code, "QuickBooks authorization code");
  const realmId = normalizeRequiredString(input.realmId, "QuickBooks realm ID");
  const redirectUri = normalizeRequiredString(input.redirectUri, "QuickBooks redirect URI");
  const token = await exchangeQuickBooksAuthorizationCode({
    code,
    redirectUri,
    fetchImpl: input.fetchImpl
  });
  const companyInfo = await fetchQuickBooksCompanyInfo({
    realmId,
    accessToken: normalizeRequiredString(token.access_token, "QuickBooks access token"),
    fetchImpl: input.fetchImpl
  });
  const persistedToken = buildTokenPersistence(token);

  const connection = await prisma.organizationQuickBooksConnection.upsert({
    where: {
      organizationId: input.organizationId
    },
    create: {
      organizationId: input.organizationId,
      updatedByMembershipId: input.actorMembershipId,
      isEnabled: true,
      realmId,
      companyName: companyInfo.companyName,
      legalName: companyInfo.legalName,
      ...persistedToken,
      connectedAt: new Date(),
      disconnectedAt: null,
      lastValidatedAt: new Date(),
      lastValidationStatus: "connected",
      lastValidationMessage: "QuickBooks company info was verified during OAuth connection."
    },
    update: {
      updatedByMembershipId: input.actorMembershipId,
      isEnabled: true,
      realmId,
      companyName: companyInfo.companyName,
      legalName: companyInfo.legalName,
      ...persistedToken,
      connectedAt: new Date(),
      disconnectedAt: null,
      lastValidatedAt: new Date(),
      lastValidationStatus: "connected",
      lastValidationMessage: "QuickBooks company info was verified during OAuth connection."
    }
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "organization_quickbooks_connection",
    entityId: connection.id,
    action: activityLogActions.settingsQuickBooksConnected,
    payload: {
      objectLabel: companyInfo.companyName ?? "QuickBooks Online",
      contextHref: "/office/settings/quickbooks",
      details: [
        `Realm ID: ${realmId}`,
        companyInfo.companyName ? `Company: ${companyInfo.companyName}` : "Company: Not provided",
        `Environment: ${getQuickBooksEnvironment()}`
      ]
    }
  });

  return getOfficeQuickBooksSettingsSnapshot({
    organizationId: input.organizationId
  });
}

export async function deleteOrganizationQuickBooksConnection(
  input: DeleteOrganizationQuickBooksConnectionInput
) {
  const existing = await prisma.organizationQuickBooksConnection.findUnique({
    where: {
      organizationId: input.organizationId
    }
  });

  if (!existing) {
    return getOfficeQuickBooksSettingsSnapshot({
      organizationId: input.organizationId
    });
  }

  await prisma.organizationQuickBooksConnection.update({
    where: {
      organizationId: input.organizationId
    },
    data: {
      updatedByMembershipId: input.actorMembershipId,
      isEnabled: false,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      disconnectedAt: new Date(),
      lastValidationStatus: "disconnected",
      lastValidationMessage: "QuickBooks connection was removed from Acre."
    }
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "organization_quickbooks_connection",
    entityId: existing.id,
    action: activityLogActions.settingsQuickBooksDisconnected,
    payload: {
      objectLabel: existing.companyName ?? "QuickBooks Online",
      contextHref: "/office/settings/quickbooks",
      details: ["Saved QuickBooks OAuth tokens were removed."]
    }
  });

  return getOfficeQuickBooksSettingsSnapshot({
    organizationId: input.organizationId
  });
}

function isTokenUsable(accessTokenExpiresAt: Date | null | undefined) {
  if (!accessTokenExpiresAt) {
    return true;
  }

  return accessTokenExpiresAt.getTime() > Date.now() + tokenRefreshSkewMs;
}

async function resolveUsableAccessToken(input: {
  organizationId: string;
  actorMembershipId: string;
  record: NonNullable<OrganizationQuickBooksConnectionRecord>;
  fetchImpl?: FetchLike;
}) {
  if (!input.record.encryptedAccessToken || !input.record.encryptedRefreshToken) {
    throw new Error("QuickBooks connection is missing stored OAuth tokens.");
  }

  if (isTokenUsable(input.record.accessTokenExpiresAt)) {
    return decryptSecret(input.record.encryptedAccessToken);
  }

  const refreshToken = decryptSecret(input.record.encryptedRefreshToken);
  const refreshedToken = await refreshQuickBooksToken({
    refreshToken,
    fetchImpl: input.fetchImpl
  });
  const persistedToken = buildTokenPersistence(refreshedToken);

  await prisma.organizationQuickBooksConnection.update({
    where: {
      organizationId: input.organizationId
    },
    data: {
      updatedByMembershipId: input.actorMembershipId,
      ...persistedToken
    }
  });

  return normalizeRequiredString(refreshedToken.access_token, "QuickBooks access token");
}

export async function validateOrganizationQuickBooksConnection(
  input: ValidateOrganizationQuickBooksConnectionInput
) {
  const record = await loadOrganizationQuickBooksConnection(input.organizationId);

  if (!record || !record.isEnabled || record.disconnectedAt) {
    throw new Error("QuickBooks is not connected for this organization.");
  }

  try {
    const accessToken = await resolveUsableAccessToken({
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId,
      record,
      fetchImpl: input.fetchImpl
    });
    const companyInfo = await fetchQuickBooksCompanyInfo({
      realmId: record.realmId,
      accessToken,
      fetchImpl: input.fetchImpl
    });

    await prisma.organizationQuickBooksConnection.update({
      where: {
        organizationId: input.organizationId
      },
      data: {
        updatedByMembershipId: input.actorMembershipId,
        companyName: companyInfo.companyName,
        legalName: companyInfo.legalName,
        lastValidatedAt: new Date(),
        lastValidationStatus: "connected",
        lastValidationMessage: "QuickBooks company info was verified."
      }
    });

    await recordActivityLogEvent(prisma, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_quickbooks_connection",
      entityId: record.id,
      action: activityLogActions.settingsQuickBooksValidated,
      payload: {
        objectLabel: companyInfo.companyName ?? record.companyName ?? "QuickBooks Online",
        contextHref: "/office/settings/quickbooks",
        details: ["QuickBooks company info check succeeded."]
      }
    });

    return getOfficeQuickBooksSettingsSnapshot({
      organizationId: input.organizationId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks connection check failed.";

    await prisma.organizationQuickBooksConnection.update({
      where: {
        organizationId: input.organizationId
      },
      data: {
        updatedByMembershipId: input.actorMembershipId,
        lastValidatedAt: new Date(),
        lastValidationStatus: "error",
        lastValidationMessage: message
      }
    });

    throw new Error(message);
  }
}
