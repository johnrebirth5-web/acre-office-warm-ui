import { z } from "zod";

const createTransactionFeeSchema = z.object({
  feeType: z.string().optional(),
  rate: z.string().optional(),
  amount: z.string().optional(),
  selectedCalculationType: z.string().optional(),
  approvalStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const createOfficeTransactionBodySchema = z.preprocess(
  (value) => value ?? {},
  z
    .object({
      handoffDraftId: z.string().optional(),
      acknowledgeIncompleteHandoffPrefill: z.boolean().optional(),
      frontOfficeClientId: z.string().optional(),
      ownerMembershipId: z.string().optional(),
      companyReferral: z.string().optional(),
      companyReferralEmployeeName: z.string().optional(),
      grossCommission: z.string().optional(),
      financeNotes: z.string().optional(),
      fees: z.array(createTransactionFeeSchema).optional(),
    })
    .passthrough(),
);
