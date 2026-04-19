import { randomUUID } from "node:crypto";
import type { OfficeMailAttachmentInput } from "@acre/db";
import { deleteStoredFile, saveStoredMailFile } from "../../../../lib/document-storage";
import {
  DEFAULT_UPLOAD_BATCH_MAX_BYTES,
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getCombinedUploadSize,
  getOversizedUpload,
} from "../../../../lib/upload-validation";

const MAIL_ATTACHMENT_MAX_BYTES = DEFAULT_UPLOAD_MAX_BYTES;
const MAIL_ATTACHMENT_BATCH_MAX_BYTES = DEFAULT_UPLOAD_BATCH_MAX_BYTES;

export function createMailMessageIds(threadId?: string) {
  return {
    threadId: threadId?.trim() || randomUUID(),
    messageId: randomUUID()
  };
}

export function parseMailRecipientIds(formData: FormData) {
  return formData
    .getAll("recipientMembershipId")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function parseMailFiles(formData: FormData, fieldName = "attachments") {
  return formData
    .getAll(fieldName)
    .filter((entry): entry is File => entry instanceof File && entry.name.trim().length > 0);
}

export function getMailAttachmentValidationError(files: File[]) {
  const oversizedAttachment = getOversizedUpload(files, MAIL_ATTACHMENT_MAX_BYTES);

  if (oversizedAttachment) {
    return `Each attachment must be ${formatUploadLimit(MAIL_ATTACHMENT_MAX_BYTES)} or smaller.`;
  }

  if (getCombinedUploadSize(files) > MAIL_ATTACHMENT_BATCH_MAX_BYTES) {
    return `Attachment batches must stay under ${formatUploadLimit(MAIL_ATTACHMENT_BATCH_MAX_BYTES)}.`;
  }

  return null;
}

export async function saveMailAttachments(input: {
  organizationId: string;
  threadId: string;
  messageId: string;
  files: File[];
}) {
  const storedKeys: string[] = [];
  const attachments: OfficeMailAttachmentInput[] = [];

  try {
    for (const file of input.files) {
      const stored = await saveStoredMailFile({
        organizationId: input.organizationId,
        threadId: input.threadId,
        messageId: input.messageId,
        fileName: file.name,
        bytes: new Uint8Array(await file.arrayBuffer())
      });

      storedKeys.push(stored.storageKey);
      attachments.push({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: stored.fileSizeBytes,
        storageKey: stored.storageKey
      });
    }
  } catch (error) {
    await cleanupStoredMailFiles(storedKeys);
    throw error;
  }

  return { attachments, storedKeys };
}

export async function cleanupStoredMailFiles(storageKeys: string[]) {
  await Promise.all(storageKeys.map((storageKey) => deleteStoredFile(storageKey).catch(() => null)));
}
