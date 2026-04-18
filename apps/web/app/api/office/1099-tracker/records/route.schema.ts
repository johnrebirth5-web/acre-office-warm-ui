import { z } from "zod";

const paymentRecordSchema = z.object({
  id: z.string().optional(),
  paymentDate: z.string().optional(),
  paymentAmount: z.string().optional(),
  memo: z.string().optional()
});

export const saveAgent1099PaymentRecordsBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  taxYear: z.union([z.number(), z.string()]).optional(),
  records: z.array(paymentRecordSchema, {
    error: () => ({
      message: "records must be an array."
    })
  })
});
