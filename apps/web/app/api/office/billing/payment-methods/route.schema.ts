import { z } from "zod";

export const officeBillingPaymentMethodTypeSchema = z.enum([
  "card_on_file",
  "bank_account",
  "check",
  "manual",
  "other"
]);

export const createOfficeBillingPaymentMethodBodySchema = z.object({
  type: officeBillingPaymentMethodTypeSchema,
  label: z.string().trim().min(1, "label is required."),
  provider: z.string().optional(),
  last4: z.string().optional(),
  isDefault: z.boolean().optional(),
  autoPayEnabled: z.boolean().optional()
});
