import { z } from "zod";

export const updateEarnestMoneyRecordBodySchema = z.object({
  expectedAmount: z.string().optional(),
  dueAt: z.string().optional(),
  receivedAmount: z.string().optional(),
  refundedAmount: z.string().optional(),
  paymentDate: z.string().optional(),
  depositDate: z.string().optional(),
  heldByOffice: z.boolean().optional(),
  heldExternally: z.boolean().optional(),
  trackInLedger: z.boolean().optional(),
  notes: z.string().optional()
});
