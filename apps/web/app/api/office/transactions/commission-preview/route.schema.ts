import { z } from "zod";

const commissionPreviewFeeSchema = z.object({
  feeType: z.string().optional(),
  rate: z.string().optional(),
  amount: z.string().optional(),
  selectedCalculationType: z.string().optional(),
  approvalStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const createOfficeTransactionCommissionPreviewBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    ownerMembershipId: z.string().optional(),
    grossCommission: z.string().optional(),
    fees: z.array(commissionPreviewFeeSchema).optional(),
  }),
);
