import { z } from "zod";

export const linkOfficeTransactionContactBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    contactId: z
      .string()
      .trim()
      .min(1, "Contact is required."),
    isPrimary: z.boolean().optional(),
  }),
);
