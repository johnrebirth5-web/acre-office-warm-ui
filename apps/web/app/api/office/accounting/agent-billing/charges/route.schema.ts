import { z } from "zod";

export const createAgentBillingChargesBodySchema = z.object({
  membershipIds: z.array(z.string()).min(1, "membershipIds must include at least one agent."),
  chargeType: z.string().trim().min(1, "chargeType is required."),
  description: z.string().optional(),
  amount: z.string().trim().min(1, "amount is required."),
  accountingDate: z.string().trim().min(1, "accountingDate is required."),
  dueDate: z.string().optional(),
  relatedTransactionId: z.string().optional(),
  notes: z.string().optional()
});
