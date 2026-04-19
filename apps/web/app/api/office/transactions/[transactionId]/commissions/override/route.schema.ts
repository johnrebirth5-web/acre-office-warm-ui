import { z } from "zod";
import {
  amountString,
  domainId,
} from "../../../../../../../lib/api/field-validators";

const transactionCommissionOverrideRowSchema = z.object({
  key: z.string().trim().min(1, "Each override row must include a stable key."),
  membershipId: domainId("Enter a valid identifier.").optional().default(""),
  amount: amountString("Every override row must include a valid amount.").min(
    1,
    "Every override row must include a valid amount.",
  ),
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
