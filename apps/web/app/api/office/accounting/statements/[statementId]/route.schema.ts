import { z } from "zod";

const manualLineItemSchema = z.object({
  id: z.string().optional(),
  memo: z.string().optional(),
  amount: z.string().optional()
});

export const updateAgentPayoutStatementManualLineItemsBodySchema = z.object({
  manualLineItems: z.array(manualLineItemSchema).optional()
});
