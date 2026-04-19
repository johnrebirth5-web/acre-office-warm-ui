import { z } from "zod";

export const createCommissionPlanAssignmentBodySchema = z.object({
  membershipId: z.string().optional(),
  teamId: z.string().optional(),
  commissionPlanId: z.string().trim().min(1, "commissionPlanId is required."),
  effectiveFrom: z.string().trim().min(1, "effectiveFrom is required."),
  effectiveTo: z.string().optional()
});
