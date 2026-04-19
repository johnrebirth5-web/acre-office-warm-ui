import { z } from "zod";
import { recurringChargeFrequencySchema } from "../route.schema";

export const updateAgentRecurringChargeRuleBodySchema = z.object({
  officeId: z.union([z.string(), z.null()]).optional(),
  membershipId: z.string().optional(),
  name: z.string().optional(),
  chargeType: z.string().optional(),
  description: z.string().optional(),
  amount: z.string().optional(),
  frequency: recurringChargeFrequencySchema.optional(),
  customIntervalDays: z.string().optional(),
  startDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  endDate: z.string().optional(),
  autoGenerateInvoice: z.boolean().optional(),
  isActive: z.boolean().optional()
});
