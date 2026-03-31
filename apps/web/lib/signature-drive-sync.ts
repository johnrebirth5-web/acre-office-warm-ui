import { createSign, randomUUID } from "node:crypto";
import { SignatureDriveSyncStatus } from "@prisma/client";
import {
  ensureSignatureDriveArtifacts,
  getSignatureDriveSyncJob,
  markSignatureDriveSyncPending,
  resolveOrganizationSignatureDriveConfig,
  saveSignatureDriveSyncResult
} from "@acre/db";
import { readStoredFile } from "./document-storage";

type DriveUploadResult = {
  id: string;
  webViewLink?: string | null;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function buildServiceAccountAssertion(input: {
  clientEmail: string;
  privateKey: string;
}) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: input.clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${signer.sign(input.privateKey).toString("base64url")}`;
}

async function fetchDriveAccessToken(input: {
  clientEmail: string;
  privateKey: string;
}) {
  const assertion = buildServiceAccountAssertion(input);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = (await response.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || "Google Drive access token could not be created.");
  }

  return payload.access_token;
}

async function uploadDriveFile(input: {
  accessToken: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const boundary = `acre-signature-${randomUUID()}`;
  const metadata = JSON.stringify({
    name: input.fileName,
    parents: [input.folderId]
  });
  const requestBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
      "utf8"
    ),
    Buffer.from(input.bytes),
    Buffer.from(`\r\n--${boundary}--`, "utf8")
  ]);
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: requestBody
    }
  );

  const payload = (await response.json().catch(() => null)) as { id?: string; webViewLink?: string; error?: { message?: string } } | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error?.message || "Google Drive upload failed.");
  }

  return {
    id: payload.id,
    webViewLink: payload.webViewLink ?? null
  } satisfies DriveUploadResult;
}

function resolveDriveFolderId(
  config: Awaited<ReturnType<typeof resolveOrganizationSignatureDriveConfig>>,
  job: NonNullable<Awaited<ReturnType<typeof getSignatureDriveSyncJob>>>
) {
  const mappingKey:
    | "transaction"
    | "generic"
    | "hr"
    | "finance"
    | "admin"
    | null =
    (job.templateCategory || null) ??
    (job.contextType === "membership"
      ? "hr"
      : job.contextType === "finance_request"
        ? "finance"
        : job.contextType === "admin_request"
          ? "admin"
          : job.contextType === "transaction"
            ? "transaction"
            : "generic");

  return (
    (mappingKey ? config.folderMappings[mappingKey] : "") ||
    config.folderMappings.generic ||
    config.rootFolderId ||
    ""
  );
}

export async function attemptSignatureDriveSync(input: {
  organizationId: string;
  signatureRequestId: string;
}) {
  const job = await ensureSignatureDriveArtifacts(input);

  if (!job || job.artifacts.length === 0) {
    return {
      ok: false,
      message: "No signature artifacts are available for Drive sync."
    };
  }

  try {
    const config = await resolveOrganizationSignatureDriveConfig({
      organizationId: input.organizationId
    });
    const folderId = resolveDriveFolderId(config, job);

    if (!folderId) {
      throw new Error("No Drive folder target is configured for this signature request.");
    }

    await markSignatureDriveSyncPending(input);

    const accessToken = await fetchDriveAccessToken({
      clientEmail: config.clientEmail,
      privateKey: config.privateKey
    });

    const artifactResults = await Promise.all(
      job.artifacts.map(async (artifact) => {
        try {
          const stored = await readStoredFile(artifact.storageKey);
          const upload = await uploadDriveFile({
            accessToken,
            folderId,
            fileName: artifact.fileName,
            mimeType: artifact.mimeType,
            bytes: stored.fileBuffer
          });

          return {
            artifactId: artifact.id,
            driveSyncStatus: SignatureDriveSyncStatus.synced,
            driveSyncError: null,
            driveSyncedAt: new Date(),
            driveFolderId: folderId,
            driveFileId: upload.id,
            driveWebViewLink: upload.webViewLink ?? null
          };
        } catch (error) {
          return {
            artifactId: artifact.id,
            driveSyncStatus: SignatureDriveSyncStatus.failed,
            driveSyncError: error instanceof Error ? error.message : "Drive upload failed.",
            driveSyncedAt: null,
            driveFolderId: folderId,
            driveFileId: null,
            driveWebViewLink: null
          };
        }
      })
    );

    const failedResults = artifactResults.filter((artifact) => artifact.driveSyncStatus === SignatureDriveSyncStatus.failed);

    await saveSignatureDriveSyncResult({
      organizationId: input.organizationId,
      signatureRequestId: input.signatureRequestId,
      requestStatus: failedResults.length > 0 ? SignatureDriveSyncStatus.failed : SignatureDriveSyncStatus.synced,
      requestError: failedResults[0]?.driveSyncError ?? null,
      requestSyncedAt: failedResults.length > 0 ? null : new Date(),
      artifactResults
    });

    return {
      ok: failedResults.length === 0,
      message:
        failedResults.length === 0
          ? "Signature artifacts synced to Google Drive."
          : failedResults[0]?.driveSyncError ?? "One or more Drive uploads failed."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive sync failed.";

    await saveSignatureDriveSyncResult({
      organizationId: input.organizationId,
      signatureRequestId: input.signatureRequestId,
      requestStatus: SignatureDriveSyncStatus.not_configured,
      requestError: message,
      requestSyncedAt: null,
      artifactResults: job.artifacts.map((artifact) => ({
        artifactId: artifact.id,
        driveSyncStatus: SignatureDriveSyncStatus.not_configured,
        driveSyncError: message,
        driveSyncedAt: null,
        driveFolderId: null,
        driveFileId: null,
        driveWebViewLink: null
      }))
    });

    return {
      ok: false,
      message
    };
  }
}
