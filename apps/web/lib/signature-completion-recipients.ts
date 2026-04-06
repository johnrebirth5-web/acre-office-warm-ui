import type { OfficeSignatureRequest } from "@acre/db";

type CompletionRecipientSource = Pick<OfficeSignatureRequest, "recipientEmail" | "senderReplyTo" | "recipients">;

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim() || "";

  return {
    original: trimmed,
    normalized: trimmed.toLowerCase()
  };
}

export function listSignatureCompletionRecipients(request: CompletionRecipientSource) {
  const recipients = new Map<string, string>();

  for (const recipient of request.recipients) {
    const email = normalizeEmail(recipient.email);

    if (!email.normalized || recipients.has(email.normalized)) {
      continue;
    }

    recipients.set(email.normalized, email.original);
  }

  for (const fallbackEmail of [request.recipientEmail, request.senderReplyTo]) {
    const email = normalizeEmail(fallbackEmail);

    if (!email.normalized || recipients.has(email.normalized)) {
      continue;
    }

    recipients.set(email.normalized, email.original);
  }

  return [...recipients.values()];
}
