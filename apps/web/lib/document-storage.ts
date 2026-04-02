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

const DEV_DOCUMENT_STORAGE_ROOT = path.join(process.cwd(), ".local-storage", "documents");
const PRODUCTION_DOCUMENT_STORAGE_ROOT = "/var/lib/acre/documents";

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

export async function readStoredFile(storageKey: string) {
  const absolutePath = path.isAbsolute(storageKey) ? storageKey : path.join(getDocumentStorageRoot(), storageKey);
  const [fileBuffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);

  return {
    absolutePath,
    fileBuffer,
    fileSizeBytes: fileStat.size
  };
}

export async function deleteStoredFile(storageKey: string) {
  const absolutePath = path.isAbsolute(storageKey) ? storageKey : path.join(getDocumentStorageRoot(), storageKey);
  await rm(absolutePath, { force: true });
}
