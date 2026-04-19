import { z } from "zod";

export const applyAgentBillingCreditMemoBodySchema = z.object({
  creditMemoId: z.string().trim().min(1, "creditMemoId is required."),
  invoiceId: z.string().trim().min(1, "invoiceId is required."),
  amount: z.string().optional(),
  memo: z.string().optional()
});
