import { z } from "zod";

export const updateAgentTeamMembershipBodySchema = z.object({
  role: z.string().optional(),
  reportsToTeamMembershipId: z.string().nullable().optional()
});
