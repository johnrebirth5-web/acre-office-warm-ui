import { randomUUID } from "node:crypto";
import type { OfficeMailAttachmentInput } from "@acre/db";
import { deleteStoredFile, saveStoredMailFile } from "../../../../lib/document-storage";

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
