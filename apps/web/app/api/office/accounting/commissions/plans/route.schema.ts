import { z } from "zod";

export const commissionCalculationModeSchema = z.enum(["split_and_fees", "flat_net"]);
export const commissionPlanRuleTypeSchema = z.enum([
  "base_split",
  "brokerage_fee",
  "referral_fee",
  "flat_fee_deduction",
  "sliding_scale"
]);
export const commissionRuleFeeTypeSchema = z.enum(["percentage", "flat"]);
export const commissionRecipientTypeSchema = z.enum(["agent", "brokerage", "referral"]);

export const commissionPlanRuleBodySchema = z.object({
  ruleType: commissionPlanRuleTypeSchema,
  ruleName: z.string().optional(),
  sortOrder: z.number().finite().optional(),
  splitPercent: z.string().optional(),
  flatAmount: z.string().optional(),
  feeType: commissionRuleFeeTypeSchema.optional(),
  feeAmount: z.string().optional(),
  thresholdStart: z.string().optional(),
  thresholdEnd: z.string().optional(),
  appliesToRole: z.string().optional(),
  recipientType: commissionRecipientTypeSchema.optional(),
  isActive: z.boolean().optional()
});

export const upsertCommissionPlanBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  description: z.string().optional(),
  calculationMode: commissionCalculationModeSchema.optional(),
  isActive: z.boolean().optional(),
  defaultCurrency: z.string().optional(),
  rules: z.array(commissionPlanRuleBodySchema).optional()
});
