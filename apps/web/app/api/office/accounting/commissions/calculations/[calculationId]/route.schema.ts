import { z } from "zod";

export const updateCommissionCalculationStatusBodySchema = z.object({
  status: z.enum(["draft", "calculated", "reviewed", "statement_ready", "payable", "paid"]),
  notes: z.string().optional()
});
