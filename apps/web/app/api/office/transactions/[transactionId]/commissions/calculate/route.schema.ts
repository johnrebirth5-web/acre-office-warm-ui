import { z } from "zod";

export const calculateTransactionCommissionBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    commissionPlanId: z.string().optional(),
    notes: z.string().optional(),
  }),
);
