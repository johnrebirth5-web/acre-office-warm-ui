import { z } from "zod";

export const reviewAgentPayoutStatementBodySchema = z.object({
  response: z.enum(["confirm", "request_revision"]).optional(),
  message: z.string().optional()
});
