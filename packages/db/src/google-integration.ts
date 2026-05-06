import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { HrSyncState, Prisma } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

const DEV_SETTINGS_SECRET = "acre-local-session-dev-only";
const googleSecretAlgorithm = "aes-256-gcm";
const googleSecretVersion = "v1";
const googleSecretIvBytes = 12;
const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleCalendarEndpoint = "https://www.googleapis.com/calendar/v3";
const googleDriveEndpoint = "https://www.googleapis.com/drive/v3";
const googleUploadEndpoint = "https://www.googleapis.com/upload/drive/v3";
const googleSheetsEndpoint = "https://sheets.googleapis.com/v4/spreadsheets";
const tokenRefreshSkewMs = 2 * 60 * 1000;

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type BuildGoogleAuthorizationUrlInput = {
  state: string;
  redirectUri?: string | null;
  scopes?: string[];
};

export type ConnectOrganizationGoogleIntegrationInput = {
  organizationId: string;
  actorMembershipId: string;
  code: string;
  redirectUri?: string | null;
  fetchImpl?: FetchLike;
};

export type GoogleCalendarEventInput = {
  organizationId: string;
  calendarId?: string | null;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  timeZone?: string | null;
  location?: string | null;
  attendeeEmails?: string[];
  createMeet?: boolean;
  fetchImpl?: FetchLike;
};

export type GoogleDriveFolderInput = {
  organizationId: string;
  name: string;
  parentFolderId?: string | null;
  fetchImpl?: FetchLike;
};

export type GoogleDriveUploadInput = {
  organizationId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  parentFolderId?: string | null;
  fetchImpl?: FetchLike;
};

export type GoogleSheetAppendInput = {
  organizationId: string;
  spreadsheetId: string;
  range: string;
  values: string[][];
  fetchImpl?: FetchLike;
};

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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

  throw new Error("Saved Google tokens require ACRE_SETTINGS_ENCRYPTION_SECRET or ACRE_SESSION_SECRET.");
}

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(`acre-google:${secret}`).digest();
}

export function encryptGoogleSecret(value: string) {
  const iv = randomBytes(googleSecretIvBytes);
  const cipher = createCipheriv(googleSecretAlgorithm, deriveEncryptionKey(resolveEncryptionSecret()), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    googleSecretVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptGoogleSecret(payload: string) {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split(":");

  if (version !== googleSecretVersion || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Saved Google tokens are not readable.");
  }

  const decipher = createDecipheriv(
    googleSecretAlgorithm,
    deriveEncryptionKey(resolveEncryptionSecret()),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getGoogleClientConfig() {
  const clientId = process.env.ACRE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.ACRE_GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.ACRE_GOOGLE_OAUTH_REDIRECT_URL?.trim() ?? "";

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret && redirectUri),
  };
}

function assertGoogleClientConfig() {
  const config = getGoogleClientConfig();

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Google OAuth requires ACRE_GOOGLE_OAUTH_CLIENT_ID, ACRE_GOOGLE_OAUTH_CLIENT_SECRET, and ACRE_GOOGLE_OAUTH_REDIRECT_URL.");
  }

  return config;
}

export function buildGoogleAuthorizationUrl(input: BuildGoogleAuthorizationUrlInput) {
  const config = assertGoogleClientConfig();
  const scopes = input.scopes?.length
    ? input.scopes
    : [GOOGLE_CALENDAR_SCOPE, GOOGLE_DRIVE_SCOPE, GOOGLE_SHEETS_SCOPE];
  const url = new URL(googleAuthorizationEndpoint);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", normalizeOptionalString(input.redirectUri) ?? config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", input.state);

  return url.toString();
}

async function readGoogleTokenResponse(response: Response) {
  const body = (await response.json().catch(() => null)) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description || body?.error || "Google OAuth token exchange failed.");
  }

  return body;
}

function buildBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function buildTokenExpiration(seconds: number | null | undefined) {
  return typeof seconds === "number" && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;
}

export async function connectOrganizationGoogleIntegration(input: ConnectOrganizationGoogleIntegrationInput) {
  const config = assertGoogleClientConfig();
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: normalizeOptionalString(input.redirectUri) ?? config.redirectUri,
  });

  const tokenResponse = await fetchImpl(googleTokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const tokens = await readGoogleTokenResponse(tokenResponse);
  const now = new Date();

  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.organizationGoogleIntegration.upsert({
      where: {
        organizationId: input.organizationId,
      },
      update: {
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: true,
        scope: tokens.scope ?? null,
        encryptedAccessToken: encryptGoogleSecret(tokens.access_token!),
        encryptedRefreshToken: tokens.refresh_token
          ? encryptGoogleSecret(tokens.refresh_token)
          : undefined,
        accessTokenExpiresAt: buildTokenExpiration(tokens.expires_in),
        refreshTokenExpiresAt: buildTokenExpiration(tokens.refresh_token_expires_in),
        disconnectedAt: null,
        lastSyncStatus: HrSyncState.synced,
        lastSyncMessage: "Google connected.",
        connectedAt: now,
      },
      create: {
        organizationId: input.organizationId,
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: true,
        scope: tokens.scope ?? null,
        encryptedAccessToken: encryptGoogleSecret(tokens.access_token!),
        encryptedRefreshToken: tokens.refresh_token ? encryptGoogleSecret(tokens.refresh_token) : null,
        accessTokenExpiresAt: buildTokenExpiration(tokens.expires_in),
        refreshTokenExpiresAt: buildTokenExpiration(tokens.refresh_token_expires_in),
        lastSyncStatus: HrSyncState.synced,
        lastSyncMessage: "Google connected.",
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_candidate",
      entityId: saved.id,
      action: activityLogActions.hrGoogleSyncSucceeded,
      payload: {
        objectLabel: "Google integration connected",
      },
    });

    return saved;
  });

  return record;
}

export async function getOrganizationGoogleIntegration(organizationId: string) {
  return prisma.organizationGoogleIntegration.findUnique({
    where: { organizationId },
  });
}

async function getDecryptedGoogleTokens(organizationId: string, fetchImpl: FetchLike = fetch) {
  const integration = await getOrganizationGoogleIntegration(organizationId);

  if (!integration?.isEnabled || integration.disconnectedAt) {
    throw new Error("Google integration is not connected.");
  }

  if (!integration.encryptedAccessToken && !integration.encryptedRefreshToken) {
    throw new Error("Google integration tokens are missing.");
  }

  const accessTokenExpiresAt = integration.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = !integration.encryptedAccessToken || accessTokenExpiresAt - tokenRefreshSkewMs <= Date.now();

  if (!needsRefresh) {
    return {
      accessToken: decryptGoogleSecret(integration.encryptedAccessToken!),
      integration,
    };
  }

  if (!integration.encryptedRefreshToken) {
    throw new Error("Google refresh token is missing.");
  }

  const config = assertGoogleClientConfig();
  const response = await fetchImpl(googleTokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptGoogleSecret(integration.encryptedRefreshToken),
    }).toString(),
  });
  const tokens = await readGoogleTokenResponse(response);

  const saved = await prisma.organizationGoogleIntegration.update({
    where: { organizationId },
    data: {
      encryptedAccessToken: encryptGoogleSecret(tokens.access_token!),
      encryptedRefreshToken: tokens.refresh_token
        ? encryptGoogleSecret(tokens.refresh_token)
        : integration.encryptedRefreshToken,
      accessTokenExpiresAt: buildTokenExpiration(tokens.expires_in),
      refreshTokenExpiresAt: buildTokenExpiration(tokens.refresh_token_expires_in) ?? integration.refreshTokenExpiresAt,
      scope: tokens.scope ?? integration.scope,
      lastSyncStatus: HrSyncState.synced,
      lastSyncMessage: "Google access token refreshed.",
    },
  });

  return {
    accessToken: tokens.access_token!,
    integration: saved,
  };
}

async function requestGoogleJson<T>(
  organizationId: string,
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const { accessToken } = await getDecryptedGoogleTokens(organizationId, fetchImpl);
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = (await response.json().catch(() => null)) as T & {
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new Error(body?.error?.message || "Google API request failed.");
  }

  return body as T;
}

export async function createGoogleCalendarEvent(input: GoogleCalendarEventInput) {
  const integration = await getOrganizationGoogleIntegration(input.organizationId);
  const calendarId = encodeURIComponent(input.calendarId ?? integration?.calendarId ?? "primary");
  const url = new URL(`${googleCalendarEndpoint}/calendars/${calendarId}/events`);

  if (input.createMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
  }

  const body = {
    summary: input.title,
    description: input.description ?? undefined,
    start: {
      dateTime: input.startsAt.toISOString(),
      timeZone: input.timeZone ?? undefined,
    },
    end: {
      dateTime: (input.endsAt ?? new Date(input.startsAt.getTime() + 60 * 60 * 1000)).toISOString(),
      timeZone: input.timeZone ?? undefined,
    },
    location: input.location ?? undefined,
    attendees: (input.attendeeEmails ?? [])
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email })),
    conferenceData: input.createMeet
      ? {
          createRequest: {
            requestId: randomBytes(12).toString("hex"),
          },
        }
      : undefined,
  };

  return requestGoogleJson<{
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ uri?: string }>;
    };
  }>(
    input.organizationId,
    url.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    input.fetchImpl,
  );
}

export async function createGoogleDriveFolder(input: GoogleDriveFolderInput) {
  return requestGoogleJson<{ id: string; webViewLink?: string }>(
    input.organizationId,
    `${googleDriveEndpoint}/files?fields=id,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: input.parentFolderId ? [input.parentFolderId] : undefined,
      }),
    },
    input.fetchImpl,
  );
}

export async function uploadGoogleDriveFile(input: GoogleDriveUploadInput) {
  const metadata = {
    name: input.fileName,
    parents: input.parentFolderId ? [input.parentFolderId] : undefined,
  };
  const boundary = `acre-${randomBytes(12).toString("hex")}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`${delimiter}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
    Buffer.from(input.bytes),
    Buffer.from(`\r\n${closeDelimiter}\r\n`),
  ]);

  return requestGoogleJson<{ id: string; webViewLink?: string }>(
    input.organizationId,
    `${googleUploadEndpoint}/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    input.fetchImpl,
  );
}

export async function appendGoogleSheetRow(input: GoogleSheetAppendInput) {
  const spreadsheetId = encodeURIComponent(input.spreadsheetId);
  const range = encodeURIComponent(input.range);
  return requestGoogleJson<{ updates?: { updatedRows?: number } }>(
    input.organizationId,
    `${googleSheetsEndpoint}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: input.values,
      }),
    },
    input.fetchImpl,
  );
}

export async function updateGoogleIntegrationFolders(input: {
  organizationId: string;
  actorMembershipId: string;
  calendarId?: string | null;
  driveRootFolderId?: string | null;
  resumeFolderId?: string | null;
  offerFolderId?: string | null;
  onboardingFolderId?: string | null;
  offboardingFolderId?: string | null;
  hrTrackerSpreadsheetId?: string | null;
  onboardingFormUrl?: string | null;
  offboardingFormUrl?: string | null;
}) {
  const data: Prisma.OrganizationGoogleIntegrationUpdateInput = {};

  for (const key of [
    "calendarId",
    "driveRootFolderId",
    "resumeFolderId",
    "offerFolderId",
    "onboardingFolderId",
    "offboardingFolderId",
    "hrTrackerSpreadsheetId",
    "onboardingFormUrl",
    "offboardingFormUrl",
  ] as const) {
    if (key in input) {
      data[key] = normalizeOptionalString(input[key]);
    }
  }

  return prisma.organizationGoogleIntegration.upsert({
    where: { organizationId: input.organizationId },
    update: {
      ...data,
      updatedByMembershipId: input.actorMembershipId,
    },
    create: {
      organizationId: input.organizationId,
      updatedByMembershipId: input.actorMembershipId,
      isEnabled: false,
      ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value ?? null])),
    },
  });
}
