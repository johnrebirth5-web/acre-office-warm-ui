import { z } from "zod";

const signatureFieldTypeSchema = z.enum([
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
]);

const submittedSignatureFieldValueSchema = z.object({
  fieldId: z.string().trim().min(1, "Field id is required."),
  fieldType: signatureFieldTypeSchema,
  textValue: z.string().optional(),
  signatureMode: z.enum(["draw", "type", "upload"]).optional(),
  imageDataUrl: z.string().optional(),
});

export const publicSignatureSubmitBodySchema = z.object({
  values: z.array(submittedSignatureFieldValueSchema),
});
