import { z } from "zod";
import { domainId } from "../../../../../../lib/api/field-validators";

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
  fieldId: domainId("Field id is required."),
  fieldType: signatureFieldTypeSchema,
  textValue: z.string().optional(),
  signatureMode: z.enum(["draw", "type", "upload"]).optional(),
  imageDataUrl: z.string().optional(),
});

export const publicSignatureSubmitBodySchema = z.object({
  values: z.array(submittedSignatureFieldValueSchema),
});
