import { z } from "zod";

const transactionCommissionOverrideRowSchema = z.object({
  key: z.string().trim().min(1, "Each override row must include a stable key."),
  membershipId: z.string().optional().default(""),
  amount: z.string().min(1, "Every override row must include a valid amount."),
});

export const overrideTransactionCommissionBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    overrideReason: z.string().trim().min(1, "Override reason is required."),
    notes: z.string().optional(),
    stakeholderRows: z
      .array(transactionCommissionOverrideRowSchema)
      .min(1, "Enter at least one stakeholder override row."),
  }),
);
