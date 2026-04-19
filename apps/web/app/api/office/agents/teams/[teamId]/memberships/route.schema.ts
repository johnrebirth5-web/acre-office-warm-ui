import { z } from "zod";

export const addAgentToTeamBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  role: z.string().optional(),
  reportsToTeamMembershipId: z.string().nullable().optional()
});
