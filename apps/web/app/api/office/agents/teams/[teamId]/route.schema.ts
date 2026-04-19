import { z } from "zod";

export const updateAgentTeamBodySchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  parentTeamId: z.string().nullable().optional()
});
