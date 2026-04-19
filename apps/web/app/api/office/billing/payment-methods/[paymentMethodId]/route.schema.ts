import { z } from "zod";
import { officeBillingPaymentMethodTypeSchema } from "../route.schema";

export const updateOfficeBillingPaymentMethodBodySchema = z.object({
  action: z.enum(["remove"]).optional(),
  type: officeBillingPaymentMethodTypeSchema.optional(),
  label: z.string().optional(),
  provider: z.string().optional(),
  last4: z.string().optional(),
  isDefault: z.boolean().optional(),
  autoPayEnabled: z.boolean().optional()
});
