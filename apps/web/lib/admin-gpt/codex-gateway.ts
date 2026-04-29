import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
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
  provider: "codex-cli-oauth";
  reply: string;
};

export type AdminAssistantCodexExecResult = {
  stderr: string;
  stdout: string;
};

export type AdminAssistantCodexExecRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    input: string;
    maxBufferBytes: number;
    timeoutMs: number;
  },
) => Promise<AdminAssistantCodexExecResult>;

export type AdminAssistantGatewayDependencies = {
  codexExec?: AdminAssistantCodexExecRunner;
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
  constructor(message = "The Codex OAuth runner is not available.") {
    super(message);
    this.name = "AdminAssistantGatewayUnavailableError";
  }
}

const DEFAULT_MAX_HISTORY_MESSAGES = 8;
const DEFAULT_MAX_IMAGE_BYTES = 1024 * 1024;
const DEFAULT_MAX_IMAGES = 3;
const DEFAULT_MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_TOTAL_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 90;
const DEFAULT_CODEX_MODEL = "gpt-5.5";
const DEFAULT_MAX_EXEC_OUTPUT_BYTES = 512 * 1024;
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
    maxExecOutputBytes: getPositiveIntegerEnv(
      "ACRE_ADMIN_CODEX_MAX_EXEC_OUTPUT_BYTES",
      DEFAULT_MAX_EXEC_OUTPUT_BYTES,
    ),
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

function getCodexCliConfig() {
  return {
    bin: process.env.ACRE_ADMIN_CODEX_BIN?.trim() || "codex",
    model: process.env.ACRE_ADMIN_CODEX_MODEL?.trim() || DEFAULT_CODEX_MODEL,
    workdir: resolve(process.env.ACRE_ADMIN_CODEX_WORKDIR?.trim() || process.cwd()),
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

  return clampText(
    normalized.replace(/[^\w.\- ()]/g, ""),
    MAX_ATTACHMENT_NAME_CHARS,
  );
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
      type: "image" as const,
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
    "- Do not run shell commands, do not inspect server files, and do not ask the user to run commands or change server files from chat.",
    "- Do not reveal or infer customer, transaction, finance, or credential details that are not visible in the user's question or screenshot.",
    "- When evidence is weak, say you are not sure and give the page, permission, reproduction steps, expected result, actual result, visible error text, and screenshot-summary template for the programmer.",
    "",
    "Answer style:",
    "- Prefer Chinese when the administrator writes Chinese; otherwise answer in the user's language.",
    "- Be practical and concise. Explain where to click, what a page does, whether a feature exists, and how to tell operation issue vs permission/configuration/likely bug.",
    "- Never claim a feature exists unless the curated Acre facts below say available or partial.",
    "- Return only the final assistant answer text.",
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

function buildCodexExecPrompt(
  input: ReturnType<typeof normalizeAdminAssistantInput>,
  context: SessionMembershipContext,
) {
  return [
    "SYSTEM / NON-NEGOTIABLE INSTRUCTIONS",
    buildAcreAdminAssistantSystemPrompt(input, context),
    "",
    "USER REQUEST",
    buildAcreAdminAssistantUserMessage(input),
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

function imageExtensionForMimeType(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "png";
  }
}

async function writeImageAttachments(
  tempDir: string,
  input: ReturnType<typeof normalizeAdminAssistantInput>,
) {
  const paths: string[] = [];

  for (const [index, attachment] of input.attachments.entries()) {
    const extension = imageExtensionForMimeType(attachment.mimeType);
    const path = join(tempDir, `screenshot-${index + 1}.${extension}`);

    await writeFile(path, Buffer.from(attachment.content, "base64"));
    paths.push(path);
  }

  return paths;
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function extractCodexCliReply(stdout: string, outputFileText: string) {
  const fromFile = outputFileText.trim();

  if (fromFile) {
    return fromFile;
  }

  const cleaned = stripAnsi(stdout)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("OpenAI Codex"))
    .filter((line) => !line.startsWith("Thinking"))
    .join("\n")
    .trim();

  return cleaned || null;
}

function buildCodexExecArgs(input: {
  imagePaths: string[];
  outputPath: string;
}) {
  const config = getCodexCliConfig();
  const args = [
    "--ask-for-approval",
    "never",
    "--sandbox",
    "read-only",
    "exec",
    "--ephemeral",
    "--color",
    "never",
    "-m",
    config.model,
    "-C",
    config.workdir,
    "--skip-git-repo-check",
    "-o",
    input.outputPath,
  ];

  for (const imagePath of input.imagePaths) {
    args.push("--image", imagePath);
  }

  args.push("-");
  return args;
}

function normalizeCodexExecFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/not logged in|401 unauthorized|missing bearer|api key|authentication/i.test(message)) {
    return new AdminAssistantGatewayUnavailableError(
      "Codex OAuth is not configured for the Acre service user. Run codex login --device-auth as the service user, then retry.",
    );
  }

  return new AdminAssistantGatewayUnavailableError(
    `Codex OAuth runner failed: ${clampText(message, 300)}`,
  );
}

export async function runCodexExec(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    input: string;
    maxBufferBytes: number;
    timeoutMs: number;
  },
) {
  return new Promise<AdminAssistantCodexExecResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        rejectPromise(new Error("Codex exec timed out."));
      }
    }, Math.max(1000, options.timeoutMs));

    function appendOutput(current: string, chunk: Buffer) {
      const next = current + chunk.toString("utf8");

      if (Buffer.byteLength(next, "utf8") > options.maxBufferBytes) {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          clearTimeout(timeout);
          rejectPromise(new Error("Codex exec produced too much output."));
        }

        return current;
      }

      return next;
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        rejectPromise(error);
      }
    });
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (signal) {
        rejectPromise(new Error(`Codex exec exited with signal ${signal}. ${stderr}`));
        return;
      }

      if ((code ?? 0) !== 0) {
        rejectPromise(new Error(`Codex exec exited with code ${code ?? 0}. ${stderr || stdout}`));
        return;
      }

      resolvePromise({ stderr, stdout });
    });

    child.stdin.end(options.input);
  });
}

export async function callOpenClawAdminAssistant(
  input: AdminAssistantChatInput,
  context: SessionMembershipContext,
  dependencies: AdminAssistantGatewayDependencies = {},
): Promise<AdminAssistantGatewayResult> {
  const normalized = normalizeAdminAssistantInput(input);
  const config = getCodexCliConfig();
  const limits = getAdminAssistantLimits();
  const timeoutMs = Math.max(10_000, (limits.timeoutSeconds + 30) * 1000);
  const tempDir = await mkdtemp(join(tmpdir(), "acre-admin-codex-"));
  const sessionHash = stableShortHash(`${context.currentMembership.id}:${normalized.sessionId}`);

  try {
    const imagePaths = await writeImageAttachments(tempDir, normalized);
    const outputPath = join(tempDir, `reply-${sessionHash}.txt`);
    const args = buildCodexExecArgs({
      imagePaths,
      outputPath,
    });
    const prompt = buildCodexExecPrompt(normalized, context);

    const result = await (dependencies.codexExec ?? runCodexExec)(
      config.bin,
      args,
      {
        cwd: config.workdir,
        env: {
          ...process.env,
          NO_COLOR: "1",
        },
        input: prompt,
        maxBufferBytes: limits.maxExecOutputBytes,
        timeoutMs,
      },
    ).catch((error) => {
      throw normalizeCodexExecFailure(error);
    });
    const combinedOutput = `${result.stderr}\n${result.stdout}`;

    if (/not logged in|401 unauthorized|missing bearer|api key|authentication/i.test(combinedOutput)) {
      throw new AdminAssistantGatewayUnavailableError(
        "Codex OAuth is not configured for the Acre service user. Run codex login --device-auth as the service user, then retry.",
      );
    }

    const outputFileText = await readFile(outputPath, "utf8").catch(() => "");
    const reply = extractCodexCliReply(result.stdout, outputFileText);

    if (!reply) {
      throw new AdminAssistantGatewayUnavailableError(
        "Codex OAuth runner finished without a readable assistant reply.",
      );
    }

    return {
      provider: "codex-cli-oauth",
      reply,
    };
  } finally {
    await rm(tempDir, {
      force: true,
      recursive: true,
    }).catch(() => undefined);
  }
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
