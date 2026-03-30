import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

const DEV_SETTINGS_SECRET = "acre-local-session-dev-only";
const smtpSecretAlgorithm = "aes-256-gcm";
const smtpSecretVersion = "v1";
const smtpSecretIvBytes = 12;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailDeliverySource = "database" | "environment" | "none";
type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type ResolvedSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  defaultReplyTo: string | null;
};

type EnvironmentSmtpSettingsState = {
  isPresent: boolean;
  isReady: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

type OrganizationSmtpSettingRecord = Awaited<ReturnType<typeof loadOrganizationSmtpSetting>>;

export type OfficeEmailDeliverySettingsSnapshot = {
  summary: {
    sourceLabel: string;
    sourceTone: BadgeTone;
    transportLabel: string;
    transportTone: BadgeTone;
    statusLabel: string;
    statusTone: BadgeTone;
    canSendSignatureEmails: boolean;
  };
  settings: {
    source: EmailDeliverySource;
    isEnabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromEmail: string;
    fromName: string;
    replyTo: string;
    hasStoredPassword: boolean;
    saveRequiresPassword: boolean;
    updatedAtLabel: string;
    updatedByLabel: string;
    encryptionReady: boolean;
  };
  environmentFallback: {
    isPresent: boolean;
    isReady: boolean;
    host: string;
    fromEmail: string;
  };
};

export type SaveOrganizationSmtpSettingsInput = {
  organizationId: string;
  actorMembershipId: string;
  isEnabled: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  user?: string | null;
  password?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
};

export type DeleteOrganizationSmtpSettingsInput = {
  organizationId: string;
  actorMembershipId: string;
};

export type ResolveOrganizationSignatureSmtpConfigResult = {
  source: Exclude<EmailDeliverySource, "none">;
  config: ResolvedSmtpConfig;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

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

function normalizeEmail(value: string | null | undefined, label: string, required = false) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    if (required) {
      throw new Error(`${label} is required.`);
    }

    return null;
  }

  if (!emailPattern.test(normalized)) {
    throw new Error(`${label} must be a valid email address.`);
  }

  return normalized.toLowerCase();
}

function normalizePort(value: number | null | undefined) {
  const normalized = Number(value ?? 587);

  if (!Number.isFinite(normalized)) {
    throw new Error("SMTP port must be a valid number.");
  }

  const rounded = Math.round(normalized);

  if (rounded < 1 || rounded > 65535) {
    throw new Error("SMTP port must stay within 1-65535.");
  }

  return rounded;
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
    "Saved SMTP credentials require ACRE_SETTINGS_ENCRYPTION_SECRET or ACRE_SESSION_SECRET."
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
  return createHash("sha256").update(`acre-smtp-settings:${secret}`).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(smtpSecretIvBytes);
  const cipher = createCipheriv(smtpSecretAlgorithm, deriveEncryptionKey(resolveEncryptionSecret()), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    smtpSecretVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

function decryptSecret(payload: string) {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split(":");

  if (version !== smtpSecretVersion || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Saved SMTP credentials are not readable.");
  }

  const decipher = createDecipheriv(
    smtpSecretAlgorithm,
    deriveEncryptionKey(resolveEncryptionSecret()),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function readEnvironmentSmtpSettingsState(): EnvironmentSmtpSettingsState {
  const host = process.env.ACRE_SMTP_HOST?.trim() ?? "";
  const user = process.env.ACRE_SMTP_USER?.trim() ?? "";
  const password = process.env.ACRE_SMTP_PASSWORD?.trim() ?? "";
  const fromEmail = process.env.ACRE_SIGNATURE_FROM_EMAIL?.trim() ?? "";
  const fromName = process.env.ACRE_SIGNATURE_FROM_NAME?.trim() ?? "Acre Signatures";
  const replyTo = process.env.ACRE_SIGNATURE_REPLY_TO?.trim() ?? "";
  const portValue = Number(process.env.ACRE_SMTP_PORT?.trim() || "587");
  const port = Number.isFinite(portValue) ? Math.round(portValue) : 587;

  return {
    isPresent: Boolean(
      host ||
        user ||
        password ||
        fromEmail ||
        replyTo ||
        process.env.ACRE_SMTP_PORT ||
        process.env.ACRE_SMTP_SECURE
    ),
    isReady: Boolean(host && user && password && fromEmail),
    host,
    port,
    secure: parseBooleanEnv(process.env.ACRE_SMTP_SECURE, port === 465),
    user,
    hasPassword: Boolean(password),
    fromEmail,
    fromName,
    replyTo
  };
}

async function loadOrganizationSmtpSetting(organizationId: string) {
  return prisma.organizationSmtpSetting.findUnique({
    where: {
      organizationId
    },
    include: {
      updatedByMembership: {
        include: {
          user: true
        }
      }
    }
  });
}

function getUpdatedByLabel(setting: OrganizationSmtpSettingRecord) {
  if (!setting?.updatedByMembership?.user) {
    return "—";
  }

  const fullName = `${setting.updatedByMembership.user.firstName} ${setting.updatedByMembership.user.lastName}`.trim();
  return fullName || setting.updatedByMembership.user.email;
}

function buildResolvedConfigFromRecord(setting: NonNullable<OrganizationSmtpSettingRecord>): ResolvedSmtpConfig {
  const host = normalizeRequiredString(setting.host, "SMTP host");
  const user = normalizeRequiredString(setting.user, "SMTP username");
  const fromEmail = normalizeEmail(setting.fromEmail, "Sender email", true)!;
  const fromName = normalizeOptionalString(setting.fromName) ?? "Acre Signatures";
  const passwordPayload = normalizeRequiredString(setting.encryptedPassword, "SMTP password");

  return {
    host,
    port: normalizePort(setting.port),
    secure: Boolean(setting.secure),
    user,
    password: decryptSecret(passwordPayload),
    fromEmail,
    fromName,
    defaultReplyTo: normalizeEmail(setting.replyTo, "Reply-to email")
  };
}

function buildResolvedConfigFromEnvironment(state: EnvironmentSmtpSettingsState): ResolvedSmtpConfig {
  return {
    host: normalizeRequiredString(state.host, "SMTP host"),
    port: normalizePort(state.port),
    secure: state.secure,
    user: normalizeRequiredString(state.user, "SMTP username"),
    password: normalizeRequiredString(process.env.ACRE_SMTP_PASSWORD?.trim() ?? "", "SMTP password"),
    fromEmail: normalizeEmail(state.fromEmail, "Sender email", true)!,
    fromName: normalizeOptionalString(state.fromName) ?? "Acre Signatures",
    defaultReplyTo: normalizeEmail(state.replyTo, "Reply-to email")
  };
}

function hasUsableDatabaseConfig(setting: OrganizationSmtpSettingRecord) {
  if (!setting || !setting.isEnabled) {
    return false;
  }

  return Boolean(
    normalizeOptionalString(setting.host) &&
      normalizeOptionalString(setting.user) &&
      normalizeOptionalString(setting.encryptedPassword) &&
      normalizeOptionalString(setting.fromEmail) &&
      hasEncryptionSecret()
  );
}

function hasUsableDatabaseSenderProfile(setting: OrganizationSmtpSettingRecord) {
  if (!setting || !setting.isEnabled) {
    return false;
  }

  return Boolean(normalizeOptionalString(setting.fromEmail));
}

function hasUsableEnvironmentSenderProfile(state: EnvironmentSmtpSettingsState) {
  return Boolean(normalizeOptionalString(state.fromEmail));
}

function hasResendApiKey() {
  return Boolean(process.env.ACRE_RESEND_API_KEY?.trim());
}

function resolveSource(
  setting: OrganizationSmtpSettingRecord,
  environmentState: EnvironmentSmtpSettingsState
): EmailDeliverySource {
  if (setting) {
    return "database";
  }

  if (environmentState.isPresent) {
    return "environment";
  }

  return "none";
}

function formatChangeValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function buildChange(label: string, previousValue: string | number | boolean | null | undefined, nextValue: string | number | boolean | null | undefined) {
  const previous = formatChangeValue(previousValue);
  const next = formatChangeValue(nextValue);

  if (previous === next) {
    return null;
  }

  return {
    label,
    previousValue: previous,
    nextValue: next
  } satisfies ActivityLogChange;
}

function isActivityLogChange(value: ActivityLogChange | null): value is ActivityLogChange {
  return Boolean(value);
}

function buildSaveChanges(
  existing: OrganizationSmtpSettingRecord,
  nextValues: {
    isEnabled: boolean;
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    fromEmail: string | null;
    fromName: string | null;
    replyTo: string | null;
    passwordChanged: boolean;
  }
): ActivityLogChange[] {
  const changes: Array<ActivityLogChange | null> = [
    buildChange("Enabled", existing?.isEnabled ?? null, nextValues.isEnabled),
    buildChange("SMTP host", existing?.host ?? null, nextValues.host),
    buildChange("Port", existing?.port ?? null, nextValues.port),
    buildChange("Secure", existing?.secure ?? null, nextValues.secure),
    buildChange("Username", existing?.user ?? null, nextValues.user),
    buildChange("Sender email", existing?.fromEmail ?? null, nextValues.fromEmail),
    buildChange("Sender name", existing?.fromName ?? null, nextValues.fromName),
    buildChange("Reply-to", existing?.replyTo ?? null, nextValues.replyTo),
    nextValues.passwordChanged
      ? buildChange(
          "Password",
          existing?.encryptedPassword ? "Stored" : null,
          existing?.encryptedPassword ? "Updated" : "Stored"
        )
      : null
  ];

  return changes.filter(isActivityLogChange);
}

export async function getOfficeEmailDeliverySettingsSnapshot(input: {
  organizationId: string;
}): Promise<OfficeEmailDeliverySettingsSnapshot> {
  const [setting, environmentState] = await Promise.all([
    loadOrganizationSmtpSetting(input.organizationId),
    Promise.resolve(readEnvironmentSmtpSettingsState())
  ]);
  const source = resolveSource(setting, environmentState);
  const encryptionReady = hasEncryptionSecret();
  const resendConfigured = hasResendApiKey();
  const transportLabel = resendConfigured ? "Resend API" : "SMTP";
  const transportTone: BadgeTone = resendConfigured ? "accent" : "neutral";

  const sourceLabel =
    source === "database" ? "System settings" : source === "environment" ? "Environment fallback" : "Not configured";
  const sourceTone: BadgeTone =
    source === "database" ? "accent" : source === "environment" ? "warning" : "neutral";

  let statusLabel = "Not configured";
  let statusTone: BadgeTone = "neutral";

  if (source === "database") {
    if (!setting?.isEnabled) {
      statusLabel = "Disabled";
      statusTone = "neutral";
    } else if (resendConfigured) {
      statusLabel = hasUsableDatabaseSenderProfile(setting) ? "Ready" : "Incomplete";
      statusTone = hasUsableDatabaseSenderProfile(setting) ? "success" : "warning";
    } else if (!encryptionReady) {
      statusLabel = "Secret unavailable";
      statusTone = "danger";
    } else if (hasUsableDatabaseConfig(setting)) {
      statusLabel = "Ready";
      statusTone = "success";
    } else if (!setting?.encryptedPassword) {
      statusLabel = "Needs password";
      statusTone = "warning";
    } else {
      statusLabel = "Incomplete";
      statusTone = "warning";
    }
  } else if (source === "environment") {
    const environmentReady = resendConfigured ? hasUsableEnvironmentSenderProfile(environmentState) : environmentState.isReady;
    statusLabel = environmentReady ? "Ready" : resendConfigured ? "Sender info missing" : "Env incomplete";
    statusTone = environmentReady ? "success" : "warning";
  }

  const canSendSignatureEmails =
    source === "database"
      ? resendConfigured
        ? hasUsableDatabaseSenderProfile(setting)
        : hasUsableDatabaseConfig(setting)
      : source === "environment"
        ? resendConfigured
          ? hasUsableEnvironmentSenderProfile(environmentState)
          : environmentState.isReady
        : false;

  return {
    summary: {
      sourceLabel,
      sourceTone,
      transportLabel,
      transportTone,
      statusLabel,
      statusTone,
      canSendSignatureEmails
    },
    settings: {
      source,
      isEnabled: source === "database" ? Boolean(setting?.isEnabled) : environmentState.isReady,
      host: source === "database" ? setting?.host ?? "" : source === "environment" ? environmentState.host : "",
      port: source === "database" ? setting?.port ?? 587 : environmentState.port,
      secure: source === "database" ? Boolean(setting?.secure) : environmentState.secure,
      user: source === "database" ? setting?.user ?? "" : source === "environment" ? environmentState.user : "",
      fromEmail: source === "database" ? setting?.fromEmail ?? "" : source === "environment" ? environmentState.fromEmail : "",
      fromName:
        source === "database"
          ? setting?.fromName ?? "Acre Signatures"
          : source === "environment"
            ? environmentState.fromName
            : "Acre Signatures",
      replyTo: source === "database" ? setting?.replyTo ?? "" : source === "environment" ? environmentState.replyTo : "",
      hasStoredPassword: source === "database" ? Boolean(setting?.encryptedPassword) : environmentState.hasPassword,
      saveRequiresPassword: source !== "database" || !Boolean(setting?.encryptedPassword),
      updatedAtLabel:
        source === "database" && setting
          ? formatDateTimeLabel(setting.updatedAt)
          : source === "environment"
            ? "Runtime environment"
            : "—",
      updatedByLabel: source === "database" ? getUpdatedByLabel(setting) : source === "environment" ? "Environment variables" : "—",
      encryptionReady
    },
    environmentFallback: {
      isPresent: environmentState.isPresent,
      isReady: environmentState.isReady,
      host: environmentState.host,
      fromEmail: environmentState.fromEmail
    }
  };
}

export async function saveOrganizationSmtpSettings(input: SaveOrganizationSmtpSettingsInput) {
  const existing = await loadOrganizationSmtpSetting(input.organizationId);
  const host = normalizeOptionalString(input.host);
  const port = normalizePort(input.port);
  const secure = typeof input.secure === "boolean" ? input.secure : port === 465;
  const user = normalizeOptionalString(input.user);
  const fromEmail = normalizeEmail(input.fromEmail, "Sender email");
  const fromName = normalizeOptionalString(input.fromName) ?? "Acre Signatures";
  const replyTo = normalizeEmail(input.replyTo, "Reply-to email");
  const nextPasswordValue = normalizeOptionalString(input.password);
  const encryptedPassword =
    nextPasswordValue ? encryptSecret(nextPasswordValue) : existing?.encryptedPassword ?? null;

  if (input.isEnabled) {
    normalizeRequiredString(host, "SMTP host");
    normalizeRequiredString(user, "SMTP username");
    normalizeEmail(fromEmail, "Sender email", true);

    if (!encryptedPassword) {
      throw new Error("SMTP password is required before email delivery can be enabled.");
    }
  }

  const changes = buildSaveChanges(existing, {
    isEnabled: input.isEnabled,
    host,
    port,
    secure,
    user,
    fromEmail,
    fromName,
    replyTo,
    passwordChanged: Boolean(nextPasswordValue)
  });

  await prisma.$transaction(async (tx) => {
    const saved = await tx.organizationSmtpSetting.upsert({
      where: {
        organizationId: input.organizationId
      },
      create: {
        organizationId: input.organizationId,
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: input.isEnabled,
        host,
        port,
        secure,
        user,
        encryptedPassword,
        fromEmail,
        fromName,
        replyTo
      },
      update: {
        updatedByMembershipId: input.actorMembershipId,
        isEnabled: input.isEnabled,
        host,
        port,
        secure,
        user,
        encryptedPassword,
        fromEmail,
        fromName,
        replyTo
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_smtp_setting",
      entityId: saved.id,
      action: activityLogActions.settingsSmtpUpdated,
      payload: {
        objectLabel: "Email delivery settings",
        details: [
          saved.isEnabled
            ? `SMTP delivery is enabled for ${saved.fromEmail ?? "the configured sender"}.`
            : "SMTP delivery is disabled."
        ],
        changes
      }
    });
  });

  return getOfficeEmailDeliverySettingsSnapshot({
    organizationId: input.organizationId
  });
}

export async function deleteOrganizationSmtpSettings(input: DeleteOrganizationSmtpSettingsInput) {
  const existing = await loadOrganizationSmtpSetting(input.organizationId);

  if (!existing) {
    return getOfficeEmailDeliverySettingsSnapshot({
      organizationId: input.organizationId
    });
  }

  const environmentState = readEnvironmentSmtpSettingsState();

  await prisma.$transaction(async (tx) => {
    await tx.organizationSmtpSetting.delete({
      where: {
        organizationId: input.organizationId
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_smtp_setting",
      entityId: existing.id,
      action: activityLogActions.settingsSmtpDeleted,
      payload: {
        objectLabel: "Email delivery settings",
        details: [
          environmentState.isReady
            ? "System SMTP settings were removed. Signature emails will fall back to environment delivery."
            : "System SMTP settings were removed."
        ],
        changes: [
          {
            label: "Status",
            previousValue: existing.isEnabled ? "Configured" : "Disabled",
            nextValue: "Deleted"
          }
        ].filter(isActivityLogChange)
      }
    });
  });

  return getOfficeEmailDeliverySettingsSnapshot({
    organizationId: input.organizationId
  });
}

export async function resolveOrganizationSignatureSmtpConfig(input: {
  organizationId: string;
}): Promise<ResolveOrganizationSignatureSmtpConfigResult> {
  const setting = await prisma.organizationSmtpSetting.findUnique({
    where: {
      organizationId: input.organizationId
    }
  });

  if (setting) {
    if (!setting.isEnabled) {
      throw new Error("Signature email delivery is disabled in Settings > Email delivery.");
    }

    return {
      source: "database",
      config: buildResolvedConfigFromRecord({
        ...setting,
        updatedByMembership: null
      })
    };
  }

  const environmentState = readEnvironmentSmtpSettingsState();

  if (environmentState.isReady) {
    return {
      source: "environment",
      config: buildResolvedConfigFromEnvironment(environmentState)
    };
  }

  throw new Error(
    "Signature email delivery is not configured. Ask an administrator to configure Settings > Email delivery."
  );
}
