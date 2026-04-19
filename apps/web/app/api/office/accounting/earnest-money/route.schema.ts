import { z } from "zod";

export const createEarnestMoneyRecordBodySchema = z.object({
  transactionId: z.string().optional(),
  expectedAmount: z.string().optional(),
  dueAt: z.string().optional(),
  heldByOffice: z.boolean().optional(),
  heldExternally: z.boolean().optional(),
  trackInLedger: z.boolean().optional(),
  notes: z.string().optional()
});
