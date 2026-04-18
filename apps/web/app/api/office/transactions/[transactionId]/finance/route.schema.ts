import { z } from "zod";

const transactionFinanceFeeSchema = z.object({
  feeType: z.string().trim().min(1, "Fee type is required."),
  rate: z.string().optional(),
  amount: z.string().optional(),
  selectedCalculationType: z.string().optional(),
  approvalStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const transactionFinanceBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    grossCommission: z.string().optional(),
    referralFee: z.string().optional(),
    officeNet: z.string().optional(),
    agentNet: z.string().optional(),
    financeNotes: z.string().optional(),
    clientReferralFormApproved: z.boolean().optional(),
    rebateAgreementSigned: z.boolean().optional(),
    rebateGoogleFormSubmitted: z.boolean().optional(),
    fees: z.array(transactionFinanceFeeSchema).optional(),
  }),
);
