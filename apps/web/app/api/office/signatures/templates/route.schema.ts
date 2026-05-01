import { z } from "zod";

const signatureRecipientRoleSchema = z.enum(["signer", "approver", "cc"]);
const signatureFieldTypeSchema = z.enum([
  "signature",
  "date",
  "name",
  "initials",
  "text",
  "email",
  "title",
  "company",
  "checkbox",
  "dropdown"
]);

export const saveSignatureTemplateBodySchema = z.object({
  templateId: z.string().nullable().optional(),
  name: z.string().trim().min(1, "name is required."),
  description: z.string().optional(),
  category: z.enum(["hr", "finance", "admin", "transaction", "project_sales"]).optional(),
  isActive: z.boolean().optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  senderDisplayName: z.string().optional(),
  senderReplyTo: z.string().optional(),
  recipients: z.array(
    z.object({
      id: z.string().nullable().optional(),
      role: signatureRecipientRoleSchema,
      recipientRole: z.string().trim().min(1, "recipientRole is required."),
      routingStep: z.number().nullable().optional(),
      sortOrder: z.number().nullable().optional()
    })
  ),
  fields: z.array(
    z.object({
      assignedTemplateRecipientId: z.string().nullable().optional(),
      fieldType: signatureFieldTypeSchema,
      label: z.string().trim().min(1, "label is required."),
      page: z.number(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      required: z.boolean().optional(),
      defaultValue: z.string().nullable().optional(),
      fontStyle: z.string().nullable().optional(),
      fieldKey: z.string().nullable().optional(),
      isReadOnly: z.boolean().optional(),
      isSystemPrefilled: z.boolean().optional(),
      visibilityRule: z.record(z.string(), z.string()).optional(),
      mirrorGroup: z.string().nullable().optional(),
      fieldOptions: z.record(z.string(), z.string()).optional(),
      sortOrder: z.number().nullable().optional()
    })
  )
});
