import { z } from "zod";

export const createOfficeTransactionFormBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    templateId: z
      .string()
      .trim()
      .min(1, "Template is required."),
    linkedTaskId: z.string().optional(),
    offerId: z.string().optional(),
    name: z.string().optional(),
  }),
);
