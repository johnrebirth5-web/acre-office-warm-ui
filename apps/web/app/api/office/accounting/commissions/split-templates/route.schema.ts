import { z } from "zod";

export const upsertCommissionSplitTemplateBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  agentPercent: z.string().trim().min(1, "agentPercent is required."),
  isActive: z.boolean().optional()
});
