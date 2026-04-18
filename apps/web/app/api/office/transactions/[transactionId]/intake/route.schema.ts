import { z } from "zod";

const officeTransactionStatusInputs = [
  "opportunity",
  "active",
  "pending",
  "closed",
  "cancelled",
  "Opportunity",
  "Active",
  "Pending",
  "Closed",
  "Cancelled",
] as const;

export const updateOfficeTransactionIntakeBodySchema = z.preprocess(
  (value) => value ?? {},
  z
    .object({
      transactionStatus: z
        .string()
        .trim()
        .refine(
          (value) =>
            value.length === 0 ||
            officeTransactionStatusInputs.includes(
              value as (typeof officeTransactionStatusInputs)[number],
            ),
          "Unsupported transaction status.",
        )
        .optional(),
    })
    .passthrough(),
);
