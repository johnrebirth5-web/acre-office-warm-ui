import { z } from "zod";

const signatureRecipientRoles = ["signer", "approver", "cc"] as const;
const signatureContextTypes = [
  "transaction",
  "membership",
  "finance_request",
  "admin_request",
  "generic",
] as const;

const recipientBodySchema = z.object({
  id: z.union([z.string(), z.null()]).optional(),
  role: z.enum(signatureRecipientRoles).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  recipientRole: z.string().optional(),
  routingStep: z.union([z.number(), z.null()]).optional(),
  sortOrder: z.union([z.number(), z.null()]).optional(),
});

export const createOfficeSignatureRequestBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    signatureRequestId: z.union([z.string(), z.null()]).optional(),
    formId: z.union([z.string(), z.null()]).optional(),
    documentId: z.union([z.string(), z.null()]).optional(),
    offerId: z.union([z.string(), z.null()]).optional(),
    templateId: z.union([z.string(), z.null()]).optional(),
    subjectMembershipId: z.union([z.string(), z.null()]).optional(),
    contextType: z
      .enum(signatureContextTypes, {
        error: "A supported signature context type is required.",
      })
      .optional(),
    contextId: z.union([z.string(), z.null()]).optional(),
    contextLabel: z.union([z.string(), z.null()]).optional(),
    recipientName: z.string().optional(),
    recipientEmail: z.string().optional(),
    recipientRole: z.string().optional(),
    recipients: z.array(recipientBodySchema).optional(),
    ccRecipients: z.array(recipientBodySchema).optional(),
    emailSubject: z.union([z.string(), z.null()]).optional(),
    emailBody: z.union([z.string(), z.null()]).optional(),
    expiresAt: z.union([z.string(), z.null()]).optional(),
    senderDisplayName: z.union([z.string(), z.null()]).optional(),
    senderReplyTo: z.union([z.string(), z.null()]).optional(),
    signingOrder: z.union([z.number(), z.null()]).optional(),
  }),
);
