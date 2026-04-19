import { z } from "zod";

export const createAgentPayoutStatementBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  invoiceNumbers: z.array(z.string()).optional(),
  commissionCalculationIds: z.array(z.string()).optional()
});
