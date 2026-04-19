import { z } from "zod";

export const generateAgentBillingChargesBodySchema = z.object({
  membershipId: z.string().optional(),
  asOfDate: z.string().optional()
});
