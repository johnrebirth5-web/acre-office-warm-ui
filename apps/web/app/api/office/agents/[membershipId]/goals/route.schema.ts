import { z } from "zod";

export const createAgentGoalBodySchema = z.object({
  periodType: z.enum(["monthly", "quarterly", "annual"]),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  targetTransactionCount: z.string().optional(),
  targetClosedVolume: z.string().optional(),
  targetOfficeNet: z.string().optional(),
  targetAgentNet: z.string().optional(),
  notes: z.string().optional()
});
