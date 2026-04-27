import { z } from "zod";
import { amountString, optionalRateString } from "../../../../../../lib/api/field-validators";

const transactionFinanceFeeSchema = z.object({
  feeType: z.string().trim().min(1, "Fee type is required."),
  rate: optionalRateString("Enter a valid rate.").optional(),
  amount: amountString("Enter a valid amount.").optional(),
  selectedCalculationType: z.string().optional(),
  approvalStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const transactionFinanceBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    grossCommission: amountString("Enter a valid amount.").optional(),
    referralFee: amountString("Enter a valid amount.").optional(),
    officeNet: amountString("Enter a valid amount.").optional(),
    agentNet: amountString("Enter a valid amount.").optional(),
    financeNotes: z.string().optional(),
    clientReferralFormApproved: z.boolean().optional(),
    rebateAgreementSigned: z.boolean().optional(),
    rebateGoogleFormSubmitted: z.boolean().optional(),
    fees: z.array(transactionFinanceFeeSchema).optional(),
  }),
);
