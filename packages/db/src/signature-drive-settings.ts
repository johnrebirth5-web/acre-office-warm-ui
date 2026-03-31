import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

const DEV_SETTINGS_SECRET = "acre-local-session-dev-only";
const signatureDriveSecretAlgorithm = "aes-256-gcm";
const signatureDriveSecretVersion = "v1";
const signatureDriveSecretIvBytes = 12;

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
type SignatureFolderMappingKey = "hr" | "finance" | "admin" | "transaction" | "generic";

type SignatureFolderMappings = Record<SignatureFolderMappingKey, string>;

type OrganizationSignatureDriveSettingRecord = Awaited<ReturnType<typeof loadOrganizationSignatureDriveSetting>>;

export type OfficeSignatureDriveSettingsSnapshot = {
  summary: {
    statusLabel: string;
    statusTone: BadgeTone;
    canSyncNow: boolean;
    configuredFolderCount: number;
  };
  settings: {
    source: "database" | "none";
    isEnabled: boolean;
    projectId: string;
    clientEmail: string;
    clientId: string;
    privateKeyId: string;
    hasStoredPrivateKey: boolean;
    sharedDriveId: string;
    rootFolderId: string;
    folderMappings: SignatureFolderMappings;
    updatedAtLabel: string;
    updatedByLabel: string;
    encryptionReady: boolean;
  };
};

export type SaveOrganizationSignatureDriveSettingsInput = {
  organizationId: string;
  actorMembershipId: string;
  isEnabled: boolean;
  projectId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  privateKeyId?: string | null;
  privateKey?: string | null;
  sharedDriveId?: string | null;
  rootFolderId?: string | null;
  folderMappings?: Partial<Record<SignatureFolderMappingKey, string | null | undefined>> | null;
};

export type DeleteOrganizationSignatureDriveSettingsInput = {
  organizationId: string;
  actorMembershipId: string;
};

export type ResolveOrganizationSignatureDriveConfigResult = {
  projectId: string | null;
  clientEmail: string;
  clientId: string | null;
  privateKeyId: string | null;
  privateKey: string;
  sharedDriveId: string | null;
  rootFolderId: string | null;
  folderMappings: SignatureFolderMappings;
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
    "Saved Google Drive credentials require ACRE_SETTINGS_ENCRYPTION_SECRET or ACRE_SESSION_SECRET."
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
  return createHash("sha256").update(`acre-signature-drive:${secret}`).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(signatureDriveSecretIvBytes);
  const cipher = createCipheriv(signatureDriveSecretAlgorithm, deriveEncryptionKey(resolveEncryptionSecret()), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    signatureDriveSecretVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

function decryptSecret(payload: string) {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split(":");

  if (version !== signatureDriveSecretVersion || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Saved Google Drive credentials are not readable.");
  }

  const decipher = createDecipheriv(
    signatureDriveSecretAlgorithm,
    deriveEncryptionKey(resolveEncryptionSecret()),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function buildEmptyFolderMappings(): SignatureFolderMappings {
  return {
    hr: "",
    finance: "",
    admin: "",
    transaction: "",
    generic: ""
  };
}

function normalizeFolderMappings(
  mappings: Partial<Record<SignatureFolderMappingKey, string | null | undefined>> | null | undefined
): SignatureFolderMappings {
  return {
    hr: normalizeOptionalString(mappings?.hr) ?? "",
    finance: normalizeOptionalString(mappings?.finance) ?? "",
    admin: normalizeOptionalString(mappings?.admin) ?? "",
    transaction: normalizeOptionalString(mappings?.transaction) ?? "",
    generic: normalizeOptionalString(mappings?.generic) ?? ""
  };
}

async function loadOrganizationSignatureDriveSetting(organizationId: string) {
  return prisma.organizationSignatureDriveSetting.findUnique({
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

function buildFolderMappings(record: OrganizationSignatureDriveSettingRecord): SignatureFolderMappings {
  const value =
    record?.folderMappings && typeof record.folderMappings === "object" && !Array.isArray(record.folderMappings)
      ? (record.folderMappings as Partial<Record<SignatureFolderMappingKey, string | null | undefined>>)
      : null;

  return normalizeFolderMappings(value);
}

function buildUpdatedByLabel(record: OrganizationSignatureDriveSettingRecord) {
  const firstName = record?.updatedByMembership?.user.firstName?.trim() ?? "";
  const lastName = record?.updatedByMembership?.user.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();

  return name || record?.updatedByMembership?.user.email || "—";
}

function countConfiguredFolders(folderMappings: SignatureFolderMappings, rootFolderId: string) {
  return [rootFolderId, ...Object.values(folderMappings)].filter(Boolean).length;
}

function buildSaveChanges(
  existing: OrganizationSignatureDriveSettingRecord,
  next: {
    isEnabled: boolean;
    projectId: string | null;
    clientEmail: string | null;
    clientId: string | null;
    privateKeyId: string | null;
    privateKeyChanged: boolean;
    sharedDriveId: string | null;
    rootFolderId: string | null;
    folderMappings: SignatureFolderMappings;
  }
): ActivityLogChange[] {
  const existingMappings = buildFolderMappings(existing);

  return [
    {
      label: "Status",
      previousValue: existing?.isEnabled ? "Enabled" : existing ? "Disabled" : "Not configured",
      nextValue: next.isEnabled ? "Enabled" : "Disabled"
    },
    {
      label: "Project ID",
      previousValue: existing?.projectId ?? "—",
      nextValue: next.projectId ?? "—"
    },
    {
      label: "Client email",
      previousValue: existing?.clientEmail ?? "—",
      nextValue: next.clientEmail ?? "—"
    },
    {
      label: "Private key",
      previousValue: existing?.encryptedPrivateKey ? "Stored" : "Missing",
      nextValue: next.privateKeyChanged ? "Updated" : existing?.encryptedPrivateKey ? "Stored" : "Missing"
    },
    {
      label: "Shared drive",
      previousValue: existing?.sharedDriveId ?? "—",
      nextValue: next.sharedDriveId ?? "—"
    },
    {
      label: "Root folder",
      previousValue: existing?.rootFolderId ?? "—",
      nextValue: next.rootFolderId ?? "—"
    },
    {
      label: "HR folder",
      previousValue: existingMappings.hr || "—",
      nextValue: next.folderMappings.hr || "—"
    },
    {
      label: "Finance folder",
      previousValue: existingMappings.finance || "—",
      nextValue: next.folderMappings.finance || "—"
    },
    {
      label: "Admin folder",
      previousValue: existingMappings.admin || "—",
      nextValue: next.folderMappings.admin || "—"
    },
    {
      label: "Transaction folder",
      previousValue: existingMappings.transaction || "—",
      nextValue: next.folderMappings.transaction || "—"
    },
    {
      label: "Generic folder",
      previousValue: existingMappings.generic || "—",
      nextValue: next.folderMappings.generic || "—"
    }
  ].filter((change) => change.previousValue !== change.nextValue);
}

export async function getOfficeSignatureDriveSettingsSnapshot(input: {
  organizationId: string;
}): Promise<OfficeSignatureDriveSettingsSnapshot> {
  const record = await loadOrganizationSignatureDriveSetting(input.organizationId);
  const folderMappings = buildFolderMappings(record);
  const rootFolderId = record?.rootFolderId?.trim() ?? "";
  const hasStoredPrivateKey = Boolean(record?.encryptedPrivateKey);
  const canSyncNow = Boolean(
    record?.isEnabled &&
      record.clientEmail?.trim() &&
      hasStoredPrivateKey &&
      (rootFolderId || Object.values(folderMappings).some(Boolean))
  );

  return {
    summary: {
      statusLabel: canSyncNow ? "Ready" : record?.isEnabled ? "Incomplete" : record ? "Disabled" : "Not configured",
      statusTone: canSyncNow ? "success" : record?.isEnabled ? "warning" : "neutral",
      canSyncNow,
      configuredFolderCount: countConfiguredFolders(folderMappings, rootFolderId)
    },
    settings: {
      source: record ? "database" : "none",
      isEnabled: record?.isEnabled ?? false,
      projectId: record?.projectId?.trim() ?? "",
      clientEmail: record?.clientEmail?.trim() ?? "",
      clientId: record?.clientId?.trim() ?? "",
      privateKeyId: record?.privateKeyId?.trim() ?? "",
      hasStoredPrivateKey,
      sharedDriveId: record?.sharedDriveId?.trim() ?? "",
      rootFolderId,
      folderMappings,
      updatedAtLabel: formatDateTimeLabel(record?.updatedAt ?? null) || "—",
      updatedByLabel: buildUpdatedByLabel(record),
      encryptionReady: hasEncryptionSecret()
    }
  };
}

export async function saveOrganizationSignatureDriveSettings(input: SaveOrganizationSignatureDriveSettingsInput) {
  const existing = await loadOrganizationSignatureDriveSetting(input.organizationId);
  const projectId = normalizeOptionalString(input.projectId);
  const clientEmail = normalizeOptionalString(input.clientEmail);
  const clientId = normalizeOptionalString(input.clientId);
  const privateKeyId = normalizeOptionalString(input.privateKeyId);
  const nextPrivateKeyValue = normalizeOptionalString(input.privateKey)?.replace(/\\n/g, "\n");
  const encryptedPrivateKey =
    nextPrivateKeyValue ? encryptSecret(nextPrivateKeyValue) : existing?.encryptedPrivateKey ?? null;
  const sharedDriveId = normalizeOptionalString(input.sharedDriveId);
  const rootFolderId = normalizeOptionalString(input.rootFolderId);
  const folderMappings = normalizeFolderMappings(input.folderMappings);

  if (input.isEnabled) {
    normalizeRequiredString(clientEmail, "Service account email");

    if (!encryptedPrivateKey) {
      throw new Error("Service account private key is required before Drive sync can be enabled.");
    }

    if (!rootFolderId && !Object.values(folderMappings).some(Boolean)) {
      throw new Error("Configure at least one Drive folder target before enabling sync.");
    }
  }

  const changes = buildSaveChanges(existing, {
    isEnabled: input.isEnabled,
    projectId,
    clientEmail,
    clientId,
    privateKeyId,
    privateKeyChanged: Boolean(nextPrivateKeyValue),
    sharedDriveId,
    rootFolderId,
    folderMappings
  });

  await prisma.$transaction(async (tx) => {
    const saved = await tx.organizationSignatureDriveSetting.upsert({
      where: {
        organizationId: input.organizationId
      },
      create: {
        organizationId: input.organizationId,
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: input.isEnabled,
        projectId,
        clientEmail,
        clientId,
        privateKeyId,
        encryptedPrivateKey,
        sharedDriveId,
        rootFolderId,
        folderMappings
      },
      update: {
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: input.isEnabled,
        projectId,
        clientEmail,
        clientId,
        privateKeyId,
        encryptedPrivateKey,
        sharedDriveId,
        rootFolderId,
        folderMappings
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_signature_drive_setting",
      entityId: saved.id,
      action: activityLogActions.settingsSignatureDriveUpdated,
      payload: {
        objectLabel: "Signature Drive settings",
        details: [
          saved.isEnabled
            ? `Signature Drive sync is enabled for ${saved.clientEmail ?? "the configured service account"}.`
            : "Signature Drive sync is disabled."
        ],
        changes
      }
    });
  });

  return getOfficeSignatureDriveSettingsSnapshot({
    organizationId: input.organizationId
  });
}

export async function deleteOrganizationSignatureDriveSettings(input: DeleteOrganizationSignatureDriveSettingsInput) {
  const existing = await loadOrganizationSignatureDriveSetting(input.organizationId);

  if (!existing) {
    return getOfficeSignatureDriveSettingsSnapshot({
      organizationId: input.organizationId
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationSignatureDriveSetting.delete({
      where: {
        organizationId: input.organizationId
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_signature_drive_setting",
      entityId: existing.id,
      action: activityLogActions.settingsSignatureDriveDeleted,
      payload: {
        objectLabel: "Signature Drive settings",
        details: ["Saved Google Drive sync settings were removed."],
        changes: [
          {
            label: "Status",
            previousValue: existing.isEnabled ? "Configured" : "Disabled",
            nextValue: "Deleted"
          }
        ]
      }
    });
  });

  return getOfficeSignatureDriveSettingsSnapshot({
    organizationId: input.organizationId
  });
}

export async function resolveOrganizationSignatureDriveConfig(input: {
  organizationId: string;
}): Promise<ResolveOrganizationSignatureDriveConfigResult> {
  const record = await prisma.organizationSignatureDriveSetting.findUnique({
    where: {
      organizationId: input.organizationId
    }
  });

  if (!record || !record.isEnabled) {
    throw new Error("Signature Drive sync is disabled in Settings > Signature Drive.");
  }

  if (!record.clientEmail?.trim()) {
    throw new Error("Signature Drive service account email is missing.");
  }

  if (!record.encryptedPrivateKey) {
    throw new Error("Signature Drive private key is missing.");
  }

  const folderMappings = buildFolderMappings({
    ...record,
    updatedByMembership: null
  });

  if (!record.rootFolderId?.trim() && !Object.values(folderMappings).some(Boolean)) {
    throw new Error("Signature Drive target folders are not configured.");
  }

  return {
    projectId: record.projectId?.trim() ?? null,
    clientEmail: record.clientEmail.trim(),
    clientId: record.clientId?.trim() ?? null,
    privateKeyId: record.privateKeyId?.trim() ?? null,
    privateKey: decryptSecret(record.encryptedPrivateKey),
    sharedDriveId: record.sharedDriveId?.trim() ?? null,
    rootFolderId: record.rootFolderId?.trim() ?? null,
    folderMappings
  };
}
