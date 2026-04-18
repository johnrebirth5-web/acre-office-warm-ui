import { z } from "zod";

const officeTransactionFormStatuses = [
  "draft",
  "prepared",
  "sent_for_signature",
  "partially_signed",
  "fully_signed",
  "rejected",
  "voided",
] as const;

export const updateOfficeTransactionFormBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    name: z.string().optional(),
    linkedTaskId: z.union([z.string(), z.null()]).optional(),
    offerId: z.union([z.string(), z.null()]).optional(),
    generatedPayload: z.record(z.string(), z.string()).optional(),
    status: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length === 0 ||
          officeTransactionFormStatuses.includes(
            value as (typeof officeTransactionFormStatuses)[number],
          ),
        "A supported form status is required.",
      )
      .optional(),
  }),
);
