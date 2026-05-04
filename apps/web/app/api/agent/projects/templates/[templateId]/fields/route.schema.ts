import { z } from "zod";

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
  "dropdown",
]);

export const saveProjectSigningTemplateFieldsBodySchema = z.object({
  fields: z.array(
    z.object({
      assignedTemplateRecipientId: z.string().nullable().optional(),
      fieldType: signatureFieldTypeSchema,
      label: z.string().trim().min(1, "Every field needs a label."),
      page: z.number().int().min(1, "Every field needs a PDF page."),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0.01).max(1),
      height: z.number().min(0.01).max(1),
      required: z.boolean().optional(),
      defaultValue: z.string().nullable().optional(),
      fontStyle: z.string().nullable().optional(),
      fieldKey: z.string().nullable().optional(),
      isReadOnly: z.boolean().optional(),
      isSystemPrefilled: z.boolean().optional(),
      visibilityRule: z.record(z.string(), z.string()).optional(),
      mirrorGroup: z.string().nullable().optional(),
      fieldOptions: z.record(z.string(), z.string()).optional(),
      sortOrder: z.number().nullable().optional(),
    }),
  ),
});
