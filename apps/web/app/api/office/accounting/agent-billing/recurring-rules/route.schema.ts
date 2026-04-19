import { z } from "zod";

export const recurringChargeFrequencySchema = z.enum([
  "monthly",
  "quarterly",
  "annual",
  "custom_interval"
]);

export const createAgentRecurringChargeRuleBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  name: z.string().trim().min(1, "name is required."),
  chargeType: z.string().trim().min(1, "chargeType is required."),
  description: z.string().optional(),
  amount: z.string().trim().min(1, "amount is required."),
  frequency: recurringChargeFrequencySchema,
  customIntervalDays: z.string().optional(),
  startDate: z.string().trim().min(1, "startDate is required."),
  nextDueDate: z.string().trim().min(1, "nextDueDate is required."),
  endDate: z.string().optional(),
  autoGenerateInvoice: z.boolean().optional(),
  isActive: z.boolean().optional()
});
