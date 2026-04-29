import { createHash, randomUUID } from "node:crypto";
import type { SessionMembershipContext } from "@acre/db";
import {
  ADMIN_GPT_SCOPE_BOUNDARY,
  searchAdminGptFeatureCatalog,
  type AdminGptFeatureCatalogEntry,
} from "./catalog";

export type AdminAssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AdminAssistantImageAttachment = {
  content: string;
  fileName?: string;
  mimeType: string;
};

export type AdminAssistantChatInput = {
  attachments?: AdminAssistantImageAttachment[];
  currentPath?: string;
  history?: AdminAssistantChatMessage[];
  message: string;
  sessionId?: string;
};

export type AdminAssistantGatewayResult = {
  provider: "openclaw-codex-gateway";
  reply: string;
};

export type AdminAssistantGatewayRequest = (
  method: string,
  params: Record<string, unknown>,
  options: {
    expectFinal?: boolean;
    timeoutMs: number;
  },
) => Promise<unknown>;

export type AdminAssistantGatewayDependencies = {
  gatewayRequest?: AdminAssistantGatewayRequest;
};

export class AdminAssistantInputRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAssistantInputRejectedError";
  }
}

export class AdminAssistantGatewayBusyError extends Error {
  constructor() {
    super("The Acre Admin Assistant is already answering another request.");
    this.name = "AdminAssistantGatewayBusyError";
  }
}

export class AdminAssistantGatewayUnavailableError extends Error {
  constructor(message = "The Codex gateway is not available.") {
    super(message);
    this.name = "AdminAssistantGatewayUnavailableError";
  }
}

const DEFAULT_AGENT_ID = "acre-admin-help";
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_MAX_HISTORY_MESSAGES = 8;
const DEFAULT_MAX_IMAGE_BYTES = 1024 * 1024;
const DEFAULT_MAX_IMAGES = 3;
const DEFAULT_MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_TOTAL_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 90;
const MAX_ATTACHMENT_NAME_CHARS = 120;
const MAX_CURRENT_PATH_CHARS = 300;
const MAX_HISTORY_MESSAGE_CHARS = 1600;
const SUPPORTED_IMAGE_MIME_PATTERN = /^image\/(png|jpe?g|webp|gif|heic|heif)$/i;

let activeAdminAssistantRun = false;

function getPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAdminAssistantLimits() {
  return {
    maxHistoryMessages: DEFAULT_MAX_HISTORY_MESSAGES,
    maxImageBytes: getPositiveIntegerEnv(
      "ACRE_ADMIN_CODEX_MAX_IMAGE_BYTES",
      DEFAULT_MAX_IMAGE_BYTES,
    ),
    maxImages: getPositiveIntegerEnv(
      "ACRE_ADMIN_CODEX_MAX_IMAGES",
      DEFAULT_MAX_IMAGES,
    ),
    maxMessageChars: DEFAULT_MAX_MESSAGE_CHARS,
    maxTotalImageBytes: getPositiveIntegerEnv(
      "ACRE_ADMIN_CODEX_MAX_TOTAL_IMAGE_BYTES",
      DEFAULT_MAX_TOTAL_IMAGE_BYTES,
    ),
    timeoutSeconds: getPositiveIntegerEnv(
      "ACRE_ADMIN_CODEX_TIMEOUT_SECONDS",
      DEFAULT_TIMEOUT_SECONDS,
    ),
  };
}

function normalizeWhitespace(value: string | undefined) {
  return value?.trim().replace(/\r\n/g, "\n") ?? "";
}

function clampText(value: string, maxChars: number) {
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function normalizePath(value: string | undefined) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return clampText(normalized, MAX_CURRENT_PATH_CHARS);
}

function normalizeAttachmentName(value: string | undefined, index: number) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return `screenshot-${index + 1}`;
  }

  return clampText(normalized.replace(/[^\w.\- ()]/g, ""), MAX_ATTACHMENT_NAME_CHARS);
}

function stripDataUrlPrefix(value: string, fallbackMimeType: string) {
  const trimmed = value.trim();
  const match = /^data:([^;]+);base64,([\s\S]+)$/i.exec(trimmed);

  if (!match) {
    return {
      base64: trimmed.replace(/\s/g, ""),
      mimeType: fallbackMimeType,
    };
  }

  return {
    base64: match[2]?.replace(/\s/g, "") ?? "",
    mimeType: match[1]?.trim() || fallbackMimeType,
  };
}

function estimateBase64DecodedBytes(base64: string) {
  if (!base64) {
    return 0;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function assertValidBase64(base64: string, label: string) {
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new AdminAssistantInputRejectedError(`${label} is not a valid image payload.`);
  }
}

export function normalizeAdminAssistantInput(input: AdminAssistantChatInput) {
  const limits = getAdminAssistantLimits();
  const message = normalizeWhitespace(input.message);

  if (!message) {
    throw new AdminAssistantInputRejectedError("Message is required.");
  }

  if (message.length > limits.maxMessageChars) {
    throw new AdminAssistantInputRejectedError(
      `Message is too long. Keep it under ${limits.maxMessageChars} characters.`,
    );
  }

  const history = (input.history ?? [])
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .map((entry) => ({
      role: entry.role,
      content: clampText(normalizeWhitespace(entry.content), MAX_HISTORY_MESSAGE_CHARS),
    }))
    .filter((entry) => entry.content)
    .slice(-limits.maxHistoryMessages);

  const rawAttachments = input.attachments ?? [];

  if (rawAttachments.length > limits.maxImages) {
    throw new AdminAssistantInputRejectedError(
      `Attach no more than ${limits.maxImages} screenshots.`,
    );
  }

  let totalImageBytes = 0;
  const attachments = rawAttachments.map((attachment, index) => {
    const normalized = stripDataUrlPrefix(attachment.content, attachment.mimeType);
    const mimeType = normalized.mimeType.toLowerCase();
    const fileName = normalizeAttachmentName(attachment.fileName, index);

    if (!SUPPORTED_IMAGE_MIME_PATTERN.test(mimeType)) {
      throw new AdminAssistantInputRejectedError(`${fileName} must be an image file.`);
    }

    assertValidBase64(normalized.base64, fileName);

    const imageBytes = estimateBase64DecodedBytes(normalized.base64);

    if (imageBytes <= 0 || imageBytes > limits.maxImageBytes) {
      throw new AdminAssistantInputRejectedError(
        `${fileName} is too large. Limit each screenshot to ${Math.floor(limits.maxImageBytes / 1024)} KB.`,
      );
    }

    totalImageBytes += imageBytes;

    if (totalImageBytes > limits.maxTotalImageBytes) {
      throw new AdminAssistantInputRejectedError(
        `Attached screenshots are too large together. Limit total images to ${Math.floor(limits.maxTotalImageBytes / 1024)} KB.`,
      );
    }

    return {
      content: normalized.base64,
      fileName,
      mimeType,
      sizeBytes: imageBytes,
      type: "image",
    };
  });

  return {
    attachments,
    currentPath: normalizePath(input.currentPath),
    history,
    message,
    sessionId: sanitizeSessionId(input.sessionId),
  };
}

function roleLabel(role: AdminAssistantChatMessage["role"]) {
  return role === "user" ? "Administrator" : "Acre Admin Assistant";
}

function formatHistory(history: AdminAssistantChatMessage[]) {
  if (history.length === 0) {
    return "No previous turns in this browser session.";
  }

  return history
    .map((entry) => `${roleLabel(entry.role)}: ${entry.content}`)
    .join("\n\n");
}

function summarizeFeature(entry: AdminGptFeatureCatalogEntry) {
  return [
    `Title: ${entry.title}`,
    `Route: ${entry.route ?? "No route yet"}`,
    `Status: ${entry.status}`,
    `Audience: ${entry.audience}`,
    `Summary: ${entry.summary}`,
    `How to use: ${entry.howToUse.join(" ")}`,
    `Required access: ${entry.requiredAccess}`,
    `Limitations: ${entry.limitations.join(" ") || "None listed."}`,
    `Bug signals: ${entry.bugSignals.join(" ") || "None listed."}`,
  ].join("\n");
}

function buildKnowledgeBlock(input: ReturnType<typeof normalizeAdminAssistantInput>) {
  const query = [
    input.message,
    input.currentPath,
    input.history.map((entry) => entry.content).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const matches = searchAdminGptFeatureCatalog(query || "dashboard transactions settings", 6);

  if (matches.length === 0) {
    return "No curated Acre feature entry matched clearly. Ask for the exact page URL, visible label, and screenshot details.";
  }

  return matches.map(summarizeFeature).join("\n\n---\n\n");
}

function buildAttachmentInstruction(input: ReturnType<typeof normalizeAdminAssistantInput>) {
  if (input.attachments.length === 0) {
    return "No screenshot was attached.";
  }

  return [
    "Screenshots are attached as image inputs. Inspect only visible UI, visible text, and visible error messages.",
    ...input.attachments.map((attachment, index) =>
      `Screenshot ${index + 1}: ${attachment.fileName}, ${attachment.mimeType}, ${Math.ceil(attachment.sizeBytes / 1024)} KB.`,
    ),
  ].join("\n");
}

export function buildAcreAdminAssistantSystemPrompt(
  input: ReturnType<typeof normalizeAdminAssistantInput>,
  context: SessionMembershipContext,
) {
  return [
    "You are Acre Admin Assistant, a tightly scoped helper for Acre Back Office administrators.",
    "",
    "Hard scope boundary:",
    ADMIN_GPT_SCOPE_BOUNDARY,
    "",
    "Mandatory refusal rules:",
    "- Refuse code editing, code generation for this repository, database changes, SQL, migrations, production deploys, credentials, permission bypasses, destructive data operations, and unrelated conversations.",
    "- Do not ask the user to run commands or change server files from chat.",
    "- Do not reveal or infer customer, transaction, finance, or credential details that are not visible in the user's question or screenshot.",
    "- When evidence is weak, say you are not sure and give the page, permission, reproduction steps, expected result, actual result, visible error text, and screenshot-summary template for the programmer.",
    "",
    "Answer style:",
    "- Prefer Chinese when the administrator writes Chinese; otherwise answer in the user's language.",
    "- Be practical and concise. Explain where to click, what a page does, whether a feature exists, and how to tell operation issue vs permission/configuration/likely bug.",
    "- Never claim a feature exists unless the curated Acre facts below say available or partial.",
    "",
    "Current admin context:",
    `- Role: ${context.currentMembership.role}`,
    `- Title: ${context.currentMembership.title ?? "Not set"}`,
    `- Organization: ${context.currentOrganization.name}`,
    `- Office: ${context.currentOffice?.name ?? "All / no active office"}`,
    `- Accessible modules are governed by role and permissions; do not suggest bypassing them.`,
    "",
    "Curated Acre facts for this request:",
    buildKnowledgeBlock(input),
  ].join("\n");
}

export function buildAcreAdminAssistantUserMessage(
  input: ReturnType<typeof normalizeAdminAssistantInput>,
) {
  return [
    "Current Acre page:",
    input.currentPath || "Not provided",
    "",
    "Recent chat context:",
    formatHistory(input.history),
    "",
    "Screenshot context:",
    buildAttachmentInstruction(input),
    "",
    "Administrator question:",
    input.message,
  ].join("\n");
}

function sanitizeSessionId(value: string | undefined) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return randomUUID();
  }

  return normalized.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64) || randomUUID();
}

function stableShortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function buildGatewaySessionId(inputSessionId: string, context: SessionMembershipContext) {
  const prefix = process.env.ACRE_ADMIN_CODEX_SESSION_PREFIX?.trim() || "acre-admin-help";
  return `${prefix}-${stableShortHash(context.currentMembership.id)}-${inputSessionId}`;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractPayloadTexts(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const payloads = Array.isArray(record.payloads)
    ? record.payloads
    : record.result && typeof record.result === "object" && Array.isArray((record.result as Record<string, unknown>).payloads)
      ? ((record.result as Record<string, unknown>).payloads as unknown[])
      : [];

  return payloads
    .map((payload) => {
      if (!payload || typeof payload !== "object") {
        return "";
      }

      return readString((payload as Record<string, unknown>).text) ?? "";
    })
    .filter(Boolean);
}

export function extractOpenClawGatewayReply(payload: unknown): string | null {
  const texts = extractPayloadTexts(payload);

  if (texts.length > 0) {
    return texts.join("\n\n");
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const direct =
      readString(record.reply) ??
      readString(record.text) ??
      readString(record.content) ??
      readString(record.message) ??
      readString(record.summary);

    if (direct && direct !== "accepted") {
      return direct;
    }

    if (record.result && typeof record.result === "object") {
      const nested: string | null = extractOpenClawGatewayReply(record.result);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function getGatewayConfig() {
  return {
    agentId: process.env.ACRE_ADMIN_CODEX_AGENT_ID?.trim() || DEFAULT_AGENT_ID,
    gatewayPassword: process.env.ACRE_ADMIN_CODEX_GATEWAY_PASSWORD?.trim() || undefined,
    gatewayToken: process.env.ACRE_ADMIN_CODEX_GATEWAY_TOKEN?.trim() || undefined,
    gatewayUrl: process.env.ACRE_ADMIN_CODEX_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL,
    thinking: process.env.ACRE_ADMIN_CODEX_THINKING?.trim() || "low",
  };
}

function messageDataToString(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return Promise.resolve(data);
  }

  if (data instanceof ArrayBuffer) {
    return Promise.resolve(Buffer.from(data).toString("utf8"));
  }

  if (ArrayBuffer.isView(data)) {
    return Promise.resolve(
      Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8"),
    );
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.text();
  }

  return Promise.resolve(String(data ?? ""));
}

function createGatewayRequestFrame(method: string, params: Record<string, unknown>) {
  return {
    id: randomUUID(),
    method,
    params,
    type: "req",
  };
}

export async function callOpenClawGateway(
  method: string,
  params: Record<string, unknown>,
  options: {
    expectFinal?: boolean;
    timeoutMs: number;
  },
) {
  if (typeof WebSocket === "undefined") {
    throw new AdminAssistantGatewayUnavailableError(
      "The runtime does not provide WebSocket support for the Codex gateway.",
    );
  }

  const config = getGatewayConfig();

  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    let connected = false;
    const pending = new Map<
      string,
      {
        expectFinal: boolean;
        reject: (error: Error) => void;
        resolve: (value: unknown) => void;
      }
    >();
    const timeout = setTimeout(() => {
      finishWithError(
        new AdminAssistantGatewayUnavailableError("The Codex gateway request timed out."),
      );
    }, Math.max(1000, options.timeoutMs));
    const ws = new WebSocket(config.gatewayUrl);

    function cleanup() {
      clearTimeout(timeout);

      try {
        ws.close();
      } catch {
        // The socket may already be closing. Nothing else to do.
      }
    }

    function finishWithValue(value: unknown) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);
    }

    function finishWithError(error: Error) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    }

    function sendRequest(
      requestMethod: string,
      requestParams: Record<string, unknown>,
      requestOptions: { expectFinal?: boolean } = {},
    ) {
      const frame = createGatewayRequestFrame(requestMethod, requestParams);

      pending.set(frame.id, {
        expectFinal: requestOptions.expectFinal === true,
        reject: finishWithError,
        resolve: requestMethod === "connect" ? () => {
          connected = true;
          sendRequest(method, params, { expectFinal: options.expectFinal });
        } : finishWithValue,
      });

      ws.send(JSON.stringify(frame));
    }

    ws.addEventListener("error", () => {
      finishWithError(
        new AdminAssistantGatewayUnavailableError("Unable to reach the Codex gateway."),
      );
    });

    ws.addEventListener("close", () => {
      if (!settled && !connected) {
        finishWithError(
          new AdminAssistantGatewayUnavailableError("The Codex gateway closed before connecting."),
        );
      }
    });

    ws.addEventListener("message", (event) => {
      void messageDataToString(event.data)
        .then((raw) => {
          let parsed: unknown;

          try {
            parsed = JSON.parse(raw);
          } catch {
            return;
          }

          if (!parsed || typeof parsed !== "object") {
            return;
          }

          const frame = parsed as Record<string, unknown>;

          if (frame.type === "event" && frame.event === "connect.challenge") {
            const payload = frame.payload as Record<string, unknown> | undefined;
            const nonce = readString(payload?.nonce);

            if (!nonce) {
              finishWithError(
                new AdminAssistantGatewayUnavailableError("The Codex gateway challenge was invalid."),
              );
              return;
            }

            sendRequest("connect", {
              auth:
                config.gatewayToken || config.gatewayPassword
                  ? {
                      password: config.gatewayPassword,
                      token: config.gatewayToken,
                    }
                  : undefined,
              caps: [],
              client: {
                id: "gateway-client",
                mode: "backend",
                platform: process.platform,
                version: "acre-admin-assistant",
              },
              maxProtocol: 3,
              minProtocol: 3,
              role: "operator",
              scopes: ["operator.write"],
            });
            return;
          }

          if (frame.type !== "res") {
            return;
          }

          const id = readString(frame.id);

          if (!id) {
            return;
          }

          const request = pending.get(id);

          if (!request) {
            return;
          }

          const payload = frame.payload as Record<string, unknown> | undefined;

          if (request.expectFinal && frame.ok === true && payload?.status === "accepted") {
            return;
          }

          pending.delete(id);

          if (frame.ok === true) {
            request.resolve(frame.payload);
            return;
          }

          const error = frame.error as Record<string, unknown> | undefined;
          request.reject(
            new AdminAssistantGatewayUnavailableError(
              readString(error?.message) ?? "The Codex gateway rejected the request.",
            ),
          );
        })
        .catch((error) => {
          finishWithError(
            error instanceof Error
              ? error
              : new AdminAssistantGatewayUnavailableError(String(error)),
          );
        });
    });
  });
}

export async function callOpenClawAdminAssistant(
  input: AdminAssistantChatInput,
  context: SessionMembershipContext,
  dependencies: AdminAssistantGatewayDependencies = {},
): Promise<AdminAssistantGatewayResult> {
  const normalized = normalizeAdminAssistantInput(input);
  const config = getGatewayConfig();
  const limits = getAdminAssistantLimits();
  const timeoutMs = Math.max(10_000, (limits.timeoutSeconds + 30) * 1000);
  const payload = await (dependencies.gatewayRequest ?? callOpenClawGateway)(
    "agent",
    {
      agentId: config.agentId,
      attachments: normalized.attachments.map((attachment) => ({
        content: attachment.content,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        type: "image",
      })),
      deliver: false,
      extraSystemPrompt: buildAcreAdminAssistantSystemPrompt(normalized, context),
      idempotencyKey: randomUUID(),
      message: buildAcreAdminAssistantUserMessage(normalized),
      sessionId: buildGatewaySessionId(normalized.sessionId, context),
      thinking: config.thinking,
      timeout: limits.timeoutSeconds,
    },
    {
      expectFinal: true,
      timeoutMs,
    },
  );
  const reply = extractOpenClawGatewayReply(payload);

  if (!reply) {
    throw new AdminAssistantGatewayUnavailableError(
      "The Codex gateway finished without a readable assistant reply.",
    );
  }

  return {
    provider: "openclaw-codex-gateway",
    reply,
  };
}

export async function callSerializedOpenClawAdminAssistant(
  input: AdminAssistantChatInput,
  context: SessionMembershipContext,
  dependencies: AdminAssistantGatewayDependencies = {},
) {
  if (activeAdminAssistantRun) {
    throw new AdminAssistantGatewayBusyError();
  }

  activeAdminAssistantRun = true;

  try {
    return await callOpenClawAdminAssistant(input, context, dependencies);
  } finally {
    activeAdminAssistantRun = false;
  }
}

export function __resetAdminAssistantGatewayLockForTest() {
  activeAdminAssistantRun = false;
}
