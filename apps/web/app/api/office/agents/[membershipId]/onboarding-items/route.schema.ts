import { z } from "zod";

export const createAgentOnboardingItemBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  description: z.string().optional(),
  category: z.string().optional(),
  dueAt: z.string().optional()
});
