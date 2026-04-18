import { z } from "zod";

const officeTransactionDocumentStatuses = [
  "uploaded",
  "submitted",
  "approved",
  "rejected",
  "signed",
  "archived",
] as const;

export const updateOfficeTransactionDocumentBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    title: z.string().optional(),
    documentType: z.string().optional(),
    status: z
      .enum(officeTransactionDocumentStatuses, {
        error: "A supported document status is required.",
      })
      .optional(),
    isRequired: z.boolean().optional(),
    isUnsorted: z.boolean().optional(),
    linkedTaskId: z.union([z.string(), z.null()]).optional(),
    offerId: z.union([z.string(), z.null()]).optional(),
  }),
);
