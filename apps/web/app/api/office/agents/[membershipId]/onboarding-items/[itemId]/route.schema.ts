import { z } from "zod";

export const updateAgentOnboardingItemBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  dueAt: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "reopened"]).optional()
});
