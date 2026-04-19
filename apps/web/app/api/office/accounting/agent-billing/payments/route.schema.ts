import { z } from "zod";

export const recordAgentBillingPaymentBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  invoiceIds: z.array(z.string()).min(1, "invoiceIds must include at least one invoice."),
  amount: z.string().optional(),
  accountingDate: z.string().trim().min(1, "accountingDate is required."),
  paymentMethod: z.string().trim().min(1, "paymentMethod is required."),
  referenceNumber: z.string().optional(),
  notes: z.string().optional()
});
