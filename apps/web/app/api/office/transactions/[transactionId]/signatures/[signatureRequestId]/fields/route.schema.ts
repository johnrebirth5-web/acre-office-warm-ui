import { z } from "zod";

const signatureFieldTypes = [
  "signature",
  "date",
  "name",
  "text",
  "initials",
  "email",
  "title",
  "company",
  "checkbox",
  "dropdown",
] as const;

const signatureFieldBodySchema = z.object({
  id: z.string().optional(),
  fieldType: z.enum(signatureFieldTypes, {
    error: "Every signature field needs a valid field type.",
  }),
  label: z.string().optional(),
  page: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.null()]).optional(),
  fontStyle: z.union([z.string(), z.null()]).optional(),
  assignedRecipientId: z.union([z.string(), z.null()]).optional(),
  fieldKey: z.union([z.string(), z.null()]).optional(),
  isReadOnly: z.boolean().optional(),
  isSystemPrefilled: z.boolean().optional(),
  visibilityRule: z.unknown().optional(),
  mirrorGroup: z.union([z.string(), z.null()]).optional(),
  fieldOptions: z.unknown().optional(),
  sortOrder: z.number().optional(),
});

export const replaceOfficeSignatureFieldsBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    fields: z.array(signatureFieldBodySchema, {
      error: "A fields array is required.",
    }),
  }),
);
