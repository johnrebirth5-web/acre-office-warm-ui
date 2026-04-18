import { z } from "zod";
import { isOfficeTransactionStatus } from "../../../../office/transactions/transaction-status-rules";

export const updateOfficeTransactionBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    status: z
      .string()
      .trim()
      .min(1, "Status is required.")
      .refine(
        (value) => isOfficeTransactionStatus(value),
        "Unsupported transaction status.",
      ),
  }),
);
