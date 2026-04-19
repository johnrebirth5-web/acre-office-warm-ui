import { z } from "zod";

export const createAgentTeamBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  parentTeamId: z.string().nullable().optional(),
  leaderMembershipId: z.string().optional()
});
