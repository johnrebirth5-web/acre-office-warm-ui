import { z } from "zod";

export const sendAgentPayoutStatementBodySchema = z.object({
  message: z.string().optional()
});
