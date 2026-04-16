import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

type SaveStoredFileInput = {
  organizationId: string;
  transactionId: string;
  fileName: string;
  bytes: Uint8Array;
};

type SaveStoredLibraryFileInput = {
  organizationId: string;
  officeId?: string | null;
  fileName: string;
  bytes: Uint8Array;
};

type SaveStoredResourceFileInput = {
  organizationId: string;
  officeId?: string | null;
  fileName: string;
  bytes: Uint8Array;
};

type SaveStoredTextInput = {
  organizationId: string;
  transactionId: string;
  fileName: string;
  content: string;
};

type SaveStoredMailFileInput = {
  organizationId: string;
  threadId: string;
  messageId: string;
  fileName: string;
  bytes: Uint8Array;
};

type SaveStoredListingStudioFileInput = {
  organizationId: string;
  importId: string;
  bucket: "raw" | "assets" | "pack";
  fileName: string;
  bytes: Uint8Array;
};

type SaveStoredListingStudioTextInput = {
  organizationId: string;
  importId: string;
  bucket: "raw" | "pack";
  fileName: string;
  content: string;
};

const DEV_DOCUMENT_STORAGE_ROOT = path.join(process.cwd(), ".local-storage", "documents");
const PRODUCTION_DOCUMENT_STORAGE_ROOT = "/var/lib/acre/documents";
const REMOTE_DOCUMENTS_NOT_FOUND_EXIT_CODE = 44;
const remoteFetchCache = new Map<string, Promise<StoredDocumentFile | null>>();

export type StoredDocumentFile = {
  storageKey: string;
  absolutePath: string;
  fileName: string;
  fileSizeBytes: number;
};

export function getDocumentStorageRoot() {
  const configuredRoot = process.env.ACRE_DOCUMENTS_STORAGE_DIR?.trim();

  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return process.env.NODE_ENV === "production" ? PRODUCTION_DOCUMENT_STORAGE_ROOT : DEV_DOCUMENT_STORAGE_ROOT;
}

function trimEnv(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function getRemoteDocumentFallbackConfig() {
  const sshTarget = trimEnv(process.env.ACRE_REMOTE_DOCUMENTS_SSH_TARGET);
  const remoteRoot = trimEnv(process.env.ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT);

  if (!sshTarget || !remoteRoot) {
    return null;
  }

  return {
    sshTarget,
    remoteRoot,
    sshKey: trimEnv(process.env.ACRE_REMOTE_DOCUMENTS_SSH_KEY),
    knownHosts: trimEnv(process.env.ACRE_REMOTE_DOCUMENTS_SSH_KNOWN_HOSTS),
  };
}

function buildRemoteAbsolutePath(storageKey: string, remoteRoot: string) {
  const normalizedStorageKey = storageKey.split(path.sep).join(path.posix.sep);
  return path.posix.join(remoteRoot, normalizedStorageKey);
}

function readRemoteFileBuffer(remoteAbsolutePath: string) {
  const fallback = getRemoteDocumentFallbackConfig();
  if (!fallback) {
    return Promise.resolve<Buffer | null>(null);
  }

  return new Promise<Buffer | null>((resolve, reject) => {
    const sshArgs = [
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "ConnectTimeout=5",
    ];

    if (fallback.sshKey) {
      sshArgs.push("-i", fallback.sshKey);
    }

    if (fallback.knownHosts) {
      sshArgs.push("-o", `UserKnownHostsFile=${fallback.knownHosts}`);
    }

    sshArgs.push(
      fallback.sshTarget,
      `if [ -f ${shellEscape(remoteAbsolutePath)} ]; then cat -- ${shellEscape(
        remoteAbsolutePath,
      )}; else exit ${REMOTE_DOCUMENTS_NOT_FOUND_EXIT_CODE}; fi`,
    );

    const child = spawn("ssh", sshArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }

      if (code === REMOTE_DOCUMENTS_NOT_FOUND_EXIT_CODE) {
        resolve(null);
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          stderr
            ? `Remote document fallback failed: ${stderr}`
            : `Remote document fallback failed with exit code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function hydrateStoredFileFromRemote(
  storageKey: string,
  absolutePath: string,
): Promise<StoredDocumentFile | null> {
  const fallback = getRemoteDocumentFallbackConfig();
  if (!fallback) {
    return null;
  }

  const cacheKey = absolutePath;
  const cached = remoteFetchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const remoteAbsolutePath = buildRemoteAbsolutePath(storageKey, fallback.remoteRoot);
    const fileBuffer = await readRemoteFileBuffer(remoteAbsolutePath);
    if (!fileBuffer) {
      return null;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    return {
      storageKey,
      absolutePath,
      fileName: path.basename(absolutePath),
      fileSizeBytes: fileBuffer.byteLength,
    };
  })();

  remoteFetchCache.set(cacheKey, pending);

  try {
    return await pending;
  } finally {
    remoteFetchCache.delete(cacheKey);
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "file";
}

async function ensureScopedDirectory(organizationId: string, scopeSegments: string[]) {
  const directory = path.join(getDocumentStorageRoot(), sanitizeSegment(organizationId), ...scopeSegments.map((segment) => sanitizeSegment(segment)));
  await mkdir(directory, { recursive: true });
  return directory;
}

async function saveScopedFile(input: {
  organizationId: string;
  scopeSegments: string[];
  fileName: string;
  bytes: Uint8Array;
}): Promise<StoredDocumentFile> {
  const directory = await ensureScopedDirectory(input.organizationId, input.scopeSegments);
  const savedFileName = `${randomUUID()}-${sanitizeSegment(input.fileName)}`;
  const relativePath = path.join(
    sanitizeSegment(input.organizationId),
    ...input.scopeSegments.map((segment) => sanitizeSegment(segment)),
    savedFileName
  );
  const absolutePath = path.join(directory, savedFileName);

  await writeFile(absolutePath, Buffer.from(input.bytes));

  return {
    storageKey: relativePath,
    absolutePath,
    fileName: savedFileName,
    fileSizeBytes: input.bytes.byteLength
  };
}

export async function saveStoredFile(input: SaveStoredFileInput): Promise<StoredDocumentFile> {
  return saveScopedFile({
    organizationId: input.organizationId,
    scopeSegments: [input.transactionId],
    fileName: input.fileName,
    bytes: input.bytes
  });
}

export async function saveStoredLibraryFile(input: SaveStoredLibraryFileInput): Promise<StoredDocumentFile> {
  return saveScopedFile({
    organizationId: input.organizationId,
    scopeSegments: ["library", input.officeId ? `office-${input.officeId}` : "company"],
    fileName: input.fileName,
    bytes: input.bytes
  });
}

export async function saveStoredResourceFile(input: SaveStoredResourceFileInput): Promise<StoredDocumentFile> {
  return saveScopedFile({
    organizationId: input.organizationId,
    scopeSegments: ["resources", input.officeId ? `office-${input.officeId}` : "company"],
    fileName: input.fileName,
    bytes: input.bytes
  });
}

export async function saveStoredTextDocument(input: SaveStoredTextInput): Promise<StoredDocumentFile> {
  const bytes = Buffer.from(input.content, "utf8");
  return saveStoredFile({
    organizationId: input.organizationId,
    transactionId: input.transactionId,
    fileName: input.fileName,
    bytes
  });
}

export async function saveStoredMailFile(input: SaveStoredMailFileInput): Promise<StoredDocumentFile> {
  return saveScopedFile({
    organizationId: input.organizationId,
    scopeSegments: ["mail", input.threadId, input.messageId],
    fileName: input.fileName,
    bytes: input.bytes
  });
}

export async function saveStoredListingStudioFile(
  input: SaveStoredListingStudioFileInput,
): Promise<StoredDocumentFile> {
  return saveScopedFile({
    organizationId: input.organizationId,
    scopeSegments: ["listing-studio", `import-${input.importId}`, input.bucket],
    fileName: input.fileName,
    bytes: input.bytes,
  });
}

export async function saveStoredListingStudioText(
  input: SaveStoredListingStudioTextInput,
): Promise<StoredDocumentFile> {
  const bytes = Buffer.from(input.content, "utf8");
  return saveStoredListingStudioFile({
    organizationId: input.organizationId,
    importId: input.importId,
    bucket: input.bucket,
    fileName: input.fileName,
    bytes,
  });
}

export async function readStoredFile(storageKey: string) {
  const absolutePath = path.isAbsolute(storageKey) ? storageKey : path.join(getDocumentStorageRoot(), storageKey);

  try {
    const [fileBuffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);

    return {
      absolutePath,
      fileBuffer,
      fileSizeBytes: fileStat.size
    };
  } catch (error) {
    if (!path.isAbsolute(storageKey) && isNotFoundError(error)) {
      const hydrated = await hydrateStoredFileFromRemote(storageKey, absolutePath);
      if (hydrated) {
        return {
          absolutePath: hydrated.absolutePath,
          fileBuffer: await readFile(hydrated.absolutePath),
          fileSizeBytes: hydrated.fileSizeBytes,
        };
      }
    }

    throw error;
  }
}

export async function deleteStoredFile(storageKey: string) {
  const absolutePath = path.isAbsolute(storageKey) ? storageKey : path.join(getDocumentStorageRoot(), storageKey);
  await rm(absolutePath, { force: true });
}
